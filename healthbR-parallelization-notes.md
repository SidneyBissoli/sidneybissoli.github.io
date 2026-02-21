# healthbR Parallelization: Observations and Audit

> Drafted: 2026-02-20
> Context: audit of prep scripts against the parallelization features available
> in healthbR's internal infrastructure, followed by implementation of improvements.

---

## 1. What healthbR offers internally

healthbR has three distinct performance mechanisms, defined in its utility modules:

### 1.1 `.map_parallel()` (utils-parallel.R)

A unified map wrapper that automatically chooses between parallel and sequential execution:

```r
.map_parallel(.x, .f, ..., .delay = NULL)
```

| Condition | Behavior |
|---|---|
| `furrr` + `future` installed **and** user has set a non-sequential `future::plan()` | Uses `furrr::future_map()` (parallel) |
| `.delay` > 0 and length > 1 (no furrr or sequential plan) | Sequential `purrr::imap()` with `Sys.sleep(.delay)` between iterations |
| Default | Sequential `purrr::map()` |

**Key insight:** healthbR never forces parallelism. It respects the user's `future::plan()`. If you don't set one, everything runs sequentially.

**How sipni_data() uses it:** FTP downloads (1994-2019) go through `.map_parallel()` with `.delay = 0.5` for polite rate-limiting. When `future::plan(multisession)` is set by the user, the delay is ignored and files download in parallel via `furrr::future_map()`.

### 1.2 `.multi_download()` (utils-download.R)

Concurrent HTTP downloads using `curl::multi_download()`:

```r
.multi_download(urls, destfiles, max_concurrent = 6L, timeout = 600L)
```

- Downloads up to 6 files simultaneously over HTTP/HTTPS
- Uses HTTP multiplexing (`multiplex = TRUE`)
- Only works for HTTP/HTTPS (not FTP)
- Returns a data frame with per-file success/failure status

**How sipni_data() uses it:** CSV downloads (2020+ data) use `.multi_download()` with `max_concurrent = 6` and `timeout = 600` seconds. This is always concurrent -- no user configuration needed.

### 1.3 Lazy evaluation via Arrow/DuckDB (utils-cache.R)

Not parallelization per se, but a major performance feature:

```r
# user-facing parameter in sipni_data()
sipni_data(year = 2020:2024, lazy = TRUE, backend = "arrow")
sipni_data(year = 2020:2024, lazy = TRUE, backend = "duckdb")
```

- Returns an Arrow Dataset or DuckDB lazy table instead of materializing into memory
- Partition-level filters are pushed down before reading
- Cache is stored as Hive-style partitioned Parquet (partitioned by `uf_source`, `year`, and for CSV data also `month`)
- Requires: `arrow` package (and `duckdb` + `dbplyr` for the DuckDB backend)

---

## 2. What the prep scripts were doing before

Both scripts downloaded data using **sequential `for` loops** with `tryCatch`, one year at a time:

```r
# prep_imunizacao.R (before)
for (yr in ANOS_CPNI) {
  df <- sipni_data(year = yr, type = "CPNI")
  ...
}

# prep_vigitel.R (before)
for (yr in years) {
  df <- vigitel_data(year = yr)
  # ... survey design + prevalence computation ...
}
```

This meant:
- No `future::plan()` was set, so `.map_parallel()` inside healthbR fell back to sequential
- No use of `.multi_download()` at the script level (though healthbR uses it internally for 2020+ CSVs within a single `sipni_data()` call)
- No lazy evaluation (`lazy = TRUE` was not passed)
- The `arrow` package optimization for caching was not explicitly leveraged
- Year vectors were not passed, preventing healthbR from batching internally

---

## 3. Gap analysis (pre-fix)

| healthbR feature | Available | Used in prep scripts | Impact |
|---|---|---|---|
| `future::plan(multisession)` for FTP parallelism | Yes (via `.map_parallel`) | No | Could parallelize FTP downloads for years 1994-2019 |
| `curl::multi_download()` for HTTP concurrency | Yes (via `.multi_download`, max 6) | Indirectly | Already active within individual `sipni_data()` calls on CSV years, but not across years |
| `lazy = TRUE` with Arrow backend | Yes | No | Would avoid materializing full datasets into memory |
| `lazy = TRUE` with DuckDB backend | Yes | No | Same benefit + SQL query pushdown |
| Parquet caching (`arrow` package) | Yes (auto if `arrow` installed) | Passive | Faster re-runs if `arrow` is present |
| Vectorized year download (`year = 2020:2024`) | Yes (`sipni_data()` accepts vectors) | No | Would let healthbR batch-download and use `.multi_download` across years |
| Partitioned cache read | Yes (Hive-style by uf/year/month) | Not leveraged | Re-runs would skip already-cached partitions |

---

## 4. Changes applied to `prep_imunizacao.R`

### 4.1 Parallel plan activation

```r
library(future)
plan(multisession, workers = parallelly::availableCores(omit = 1L))
```

Activates `.map_parallel()` inside healthbR for all FTP-based downloads (DPNI 1994-2019). The `.delay` parameter is ignored in parallel mode.

### 4.2 Vectorized year downloads (replacing `for` loops)

Three sequential `for` loops (CPNI, DPNI, population) replaced with single vectorized calls. This lets healthbR handle batching with `.map_parallel()` for FTP years and `.multi_download()` for CSV years, plus unified caching across all years.

### 4.3 Lazy evaluation with predicate pushdown

The CPNI and DPNI downloads use `lazy = TRUE` to filter immunobiologics at the Arrow engine level before materializing into R memory:

```r
# before: downloads all immunobiologics, filters later in R
df <- sipni_data(year = ANOS_CPNI, type = "CPNI")

# after: Arrow filters at read time, only priority vaccines enter memory
ds <- sipni_data(year = ANOS_CPNI, type = "CPNI", lazy = TRUE)
imuno_col <- find_imuno_col(ds)
ds <- ds |> dplyr::filter(.data[[imuno_col]] %in% unname(IMUNO_CODES))
df <- dplyr::collect(ds)
```

Parquet cache + predicate pushdown means only the 8 priority immunobiologics are read from disk. Rows for all other vaccines never enter R memory.

**Why not lazy for population data?** `censo_estimativa()` returns small aggregated data (UF-level population estimates). The overhead of lazy evaluation would exceed the benefit.

**Why a different lazy strategy for Vigitel?** `as_survey_design()` requires a fully materialized dataframe, so predicate pushdown (row filtering) doesn't help — all rows are needed. Instead, Vigitel uses **column pushdown**: only ~25 columns (out of the full microdata) are selected at the Arrow level before `collect()`. See section 5.2.

### 4.4 Plan reset after downloads

```r
plan(sequential)
```

Restores the default after the download phase to avoid side effects in downstream processing.

### 4.5 Removed intermediate binding step

The `bind_rows(dados_cobertura)` / `bind_rows(dados_doses)` calls were eliminated since `sipni_data()` returns a combined tibble directly when given a year vector.

### 4.6 Dependency changes

Replaced `purrr` with `future`. Added `arrow` as a hard dependency (`library(arrow)`).

---

## 5. Changes applied to `prep_vigitel.R`

Vigitel required a different strategy than SI-PNI because each year needs its own survey design (`as_survey_design`) -- variable names and weights change across years. The processing loop **must** remain sequential. However, the download phase (the main bottleneck, ~15-30 min on first run) can be parallelized.

### 5.1 Two-phase architecture (download vs processing)

The original single loop was split into:

**Phase 5a -- Parallel download (populates healthbR's cache):**

```r
plan(multisession, workers = parallelly::availableCores(omit = 1L))

download_status <- future_map(years, function(yr) {
  tryCatch({
    vigitel_data(year = yr, lazy = TRUE)
    list(year = yr, ok = TRUE)
  }, error = function(e) {
    list(year = yr, ok = FALSE, msg = conditionMessage(e))
  })
}, .options = furrr_options(seed = TRUE))

plan(sequential)
```

All years download concurrently via `furrr::future_map()`. Each worker calls `vigitel_data(lazy = TRUE)` which saves to healthbR's Parquet cache. Only a lightweight lazy Arrow reference is returned (and immediately discarded), avoiding full materialization on each worker and reducing memory pressure across parallel workers.

**Phase 5b -- Sequential processing (from cache):**

The original processing loop is preserved unchanged, but now `vigitel_data()` reads from the local cache (near-instant) instead of downloading. Only years that downloaded successfully are processed (`years_ok`).

### 5.2 Lazy evaluation with column pushdown

Unlike SI-PNI (which uses **predicate pushdown** to filter rows), Vigitel uses **column pushdown** to select only the ~25 columns needed for the pipeline. Survey design requires all rows, but not all columns.

```r
VIGITEL_COLS <- c(
  "ano", "cidade", "q6", "q7", "fet", "fesc", "q8_anos", "anoescol",
  "pesorake", "pesofim", "peso_final",
  "fumante", "exfuma", "alcabu", "flvreg", "refritl5",
  "ativo_livre", "inativo", "excpeso", "obesid",
  "diab", "hart", "mamo", "papa",
  "q88", "q87", "q85"
)

# in the processing loop:
ds <- vigitel_data(year = yr, lazy = TRUE)
keep_cols <- intersect(VIGITEL_COLS, names(ds))
ds |> dplyr::select(dplyr::all_of(keep_cols)) |> dplyr::collect()
```

The `intersect()` call handles columns that don't exist in every year (e.g., weight variable names change across years). Only the needed columns are read from Parquet; remaining columns never enter R memory.

### 5.3 Dependency changes

- Replaced `purrr` with `future` + `furrr` in the required/library list
- Added `arrow` as a hard dependency (`library(arrow)`)

### 5.4 Why not vectorized `vigitel_data()` like SI-PNI?

Passing a year vector to `vigitel_data()` would return a combined dataframe, losing the per-year structure needed for survey design. The two-phase approach (parallel download, sequential processing) is the correct pattern for survey microdata.

---

## 6. Features not yet used (potential future improvements)

| Feature | Status | Notes |
|---|---|---|
| `lazy = TRUE` with Arrow backend | Applied to SI-PNI (predicate pushdown) and Vigitel (column pushdown) | SI-PNI filters immunobiologics (rows) before materialization. Vigitel selects only ~25 needed columns before materialization. Population data too small to benefit. |
| `lazy = TRUE` with DuckDB backend | Not applied | Alternative to Arrow with SQL query pushdown. Could be useful for complex aggregations on SIM/SIH. |
| `vars` parameter for column selection | Not applied | Could reduce memory by selecting only needed columns at download time. Most impactful for wide datasets (SIH has 100+ columns). |

The DuckDB backend and `vars` parameter would be most impactful for the heavier modules planned next (SIM, SIH, SINAN).

---

## 7. Summary

| Script | Before | After |
|---|---|---|
| `prep_imunizacao.R` | 3 sequential `for` loops (25+ iterations total), no parallelism, eager materialization | Vectorized calls + `plan(multisession)` + `lazy = TRUE` with Arrow predicate pushdown (filters 8 priority immunobiologics before materialization) |
| `prep_vigitel.R` | 1 sequential `for` loop (~19 iterations), download + processing interleaved | 2-phase: parallel download via `furrr::future_map()`, then sequential processing from cache + `lazy = TRUE` with Arrow column pushdown (selects only ~25 needed columns before materialization) |
| Both | No `arrow` awareness | `arrow` as hard dependency; all data flows through Parquet cache + lazy evaluation (no eager fallback) |

healthbR's parallelization infrastructure is **opt-in by the user**. The prep scripts now opt in, activating all three performance mechanisms (`.map_parallel()`, `.multi_download()`, lazy evaluation with Parquet caching) with minimal code changes. `arrow` is a hard dependency — all caching uses Parquet and all reads use `lazy = TRUE`.
