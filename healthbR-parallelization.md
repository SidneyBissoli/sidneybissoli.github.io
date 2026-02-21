# Parallelization in healthbR

> Package: [SidneyBissoli/healthbR](https://github.com/SidneyBissoli/healthbR)
> Drafted: 2026-02-20

---

## Overview

healthbR has three built-in performance mechanisms for downloading and reading Brazilian public health data. None of them force parallelism — they are opt-in by the user or automatic depending on protocol and context.

| Mechanism | Where | Activation | Protocol |
|---|---|---|---|
| `.map_parallel()` | `utils-parallel.R` | User sets `future::plan(multisession)` | FTP |
| `.multi_download()` | `utils-download.R` | Always on (no config needed) | HTTP/HTTPS |
| Lazy evaluation (Arrow/DuckDB) | `utils-cache.R` | User passes `lazy = TRUE` + `arrow` installed | Disk I/O |

---

## 1. `.map_parallel()` — parallel FTP downloads

Defined in `R/utils-parallel.R`. A unified map wrapper that automatically chooses between parallel and sequential execution based on the user's environment.

```r
.map_parallel(.x, .f, ..., .delay = NULL)
```

### Decision logic

| Condition | Behavior |
|---|---|
| `furrr` + `future` installed **and** `future::plan()` is non-sequential | `furrr::future_map()` (parallel) |
| `.delay > 0` and `length(.x) > 1` (no parallel plan) | `purrr::imap()` with `Sys.sleep(.delay)` between iterations (rate-limited sequential) |
| Default | `purrr::map()` (plain sequential) |

### How SI-PNI uses it

FTP downloads for years 1994–2019 go through `.map_parallel()` with `.delay = 0.5` for polite rate-limiting against DATASUS FTP servers:

- **Without `future::plan()`:** files download one at a time, with a 0.5-second pause between each request.
- **With `future::plan(multisession)`:** files download in parallel across workers. The `.delay` is ignored since parallel workers hit the server simultaneously.

### How to activate

```r
library(future)
plan(multisession, workers = parallelly::availableCores(omit = 1L))

# now any healthbR function that uses .map_parallel() runs in parallel
sipni_data(year = 2010:2019, type = "DPNI")

plan(sequential)  # restore after downloads
```

### Design rationale

healthbR never forces parallelism because:

1. `furrr` and `future` are suggested (not required) dependencies
2. The user controls the number of workers and the plan type
3. Rate-limiting (`.delay`) provides a polite default for sequential mode
4. Resetting to `plan(sequential)` after downloads avoids side effects in downstream processing

---

## 2. `.multi_download()` — concurrent HTTP downloads

Defined in `R/utils-download.R`. Uses `curl::multi_download()` for concurrent HTTP/HTTPS file downloads.

```r
.multi_download(urls, destfiles, max_concurrent = 6L, timeout = 600L)
```

### Behavior

- Downloads up to **6 files simultaneously** (configurable via `max_concurrent`)
- Uses HTTP multiplexing (`multiplex = TRUE`)
- Returns a data frame with per-file success/failure status
- Only works for HTTP/HTTPS — **not FTP**
- Always concurrent — no user configuration needed

### How SI-PNI uses it

CSV downloads for 2020+ data use `.multi_download()`:

```r
# internal to sipni_data() — user doesn't call this directly
.multi_download(csv_urls, dest_paths, max_concurrent = 6, timeout = 600)
```

When `sipni_data()` receives a year vector spanning both FTP (pre-2020) and HTTP (2020+) years, it splits the work:

- FTP years → `.map_parallel()`
- HTTP years → `.multi_download()`

### Supporting utilities in `utils-download.R`

| Function | Purpose |
|---|---|
| `.datasus_download()` | FTP download via `curl::curl_download()` (single file) |
| `.http_download()` | HTTP download with retry logic and exponential backoff |
| `.http_download_resumable()` | HTTP download with Range header support for resuming interrupted transfers |
| `.multi_download()` | Concurrent HTTP downloads (described above) |

All download functions include:

- **Retry logic** with configurable max retries and exponential backoff
- **Timeout handling** (default 600 seconds per file)
- **Error reporting** with per-file success/failure status

---

## 3. Lazy evaluation via Arrow/DuckDB — cache I/O

Defined in `R/utils-cache.R`. Not parallelization per se, but a major performance feature that controls how data is cached and read from disk.

### Cache storage

| Condition | Format | Structure |
|---|---|---|
| `arrow` installed | Parquet | Hive-style partitioned by `uf_source`, `year`, and (for CSV data) `month` |
| `arrow` not installed | RDS | Single file per download unit (`saveRDS`/`readRDS`) |

Key cache functions:

| Function | Purpose |
|---|---|
| `.cache_write()` | Writes a single data frame to cache (Parquet or RDS) |
| `.cache_write_partitioned()` | Writes Hive-style partitioned Parquet |
| `.cache_read()` | Reads from cache (tries Parquet first, then RDS) |
| `.cache_open_lazy()` | Opens cache as Arrow Dataset or DuckDB lazy table |
| `.try_lazy_cache()` | Attempts lazy cache read, falls back to eager if needed |
| `.lazy_return()` | Returns lazy reference or collected tibble based on `lazy` parameter |
| `.data_return()` | Final return wrapper that handles lazy vs eager |

### Lazy evaluation (`lazy = TRUE`)

When the user passes `lazy = TRUE` to a data function:

```r
# returns Arrow Dataset (not materialized into memory)
ds <- sipni_data(year = 2010:2024, type = "CPNI", lazy = TRUE)

# user applies filters at the Arrow level
ds <- ds |> dplyr::filter(imuno %in% c("09", "21", "29"))

# only now does data enter R memory
df <- dplyr::collect(ds)
```

Two types of pushdown are available:

- **Predicate pushdown (row filtering):** filters rows before reading from Parquet. Only matching rows enter R memory.
- **Column pushdown (column selection):** selects columns before reading. Only needed columns are read from disk.

### Backend options

```r
sipni_data(year = 2020:2024, lazy = TRUE, backend = "arrow")   # default
sipni_data(year = 2020:2024, lazy = TRUE, backend = "duckdb")   # SQL pushdown
```

| Backend | Returns | Requires |
|---|---|---|
| `arrow` | Arrow Dataset | `arrow` package |
| `duckdb` | DuckDB lazy table | `duckdb` + `dbplyr` packages |

The DuckDB backend enables SQL query pushdown, which can be more efficient for complex aggregations.

### What happens without `arrow`

| Component | With `arrow` | Without `arrow` |
|---|---|---|
| Cache format | Hive-style partitioned Parquet | Single RDS files |
| Cache reading | `arrow::open_dataset()` | `readRDS()` |
| `lazy = TRUE` | Returns Arrow Dataset | Errors via `cli::cli_abort()` |
| Partition pruning | Yes (only reads relevant partitions) | No (reads entire file) |

---

## 4. How `sipni_data()` orchestrates all three

A single `sipni_data()` call runs a multi-step pipeline that uses all three mechanisms:

```
sipni_data(year = 2010:2024, type = "CPNI", lazy = TRUE)
```

```
Step 1: Split years into FTP (1994-2019) and CSV (2020+)
  |
  +-- FTP years (2010-2019)
  |     |
  |     +-- .map_parallel() with .delay = 0.5
  |           |
  |           +-- (sequential) purrr::map() + Sys.sleep
  |           +-- (parallel)   furrr::future_map()  <-- if plan(multisession)
  |
  +-- CSV years (2020-2024)
        |
        +-- .multi_download() with max_concurrent = 6  <-- always concurrent
  |
Step 2: Cache write
  |     Parquet (partitioned by uf_source/year/month) if arrow installed
  |     RDS otherwise
  |
Step 3: Cache read
  |     lazy = TRUE  --> Arrow Dataset (no materialization)
  |     lazy = FALSE --> tibble (full materialization)
  |
Step 4: Return combined result
```

### Year vector batching

When given a year vector (e.g., `year = 2010:2024`), healthbR batches all years in a single pipeline. This is more efficient than calling `sipni_data()` in a loop because:

- FTP downloads are batched through `.map_parallel()` (parallel when plan is set)
- HTTP downloads are batched through `.multi_download()` (always concurrent)
- Cache is checked once across all years (skips already-cached partitions)
- A single combined result is returned (no `bind_rows()` needed)

### Partition pruning on re-runs

On subsequent runs, the Parquet cache already contains the data. healthbR checks for existing partitions before downloading:

- Partitions that exist on disk are skipped
- Only missing partitions trigger new downloads
- With `lazy = TRUE`, only the requested partitions are opened (Hive-style partition pruning)

---

## 5. How `vigitel_data()` orchestrates

Simpler than SI-PNI since Vigitel distributes data via HTTP (single file per year):

```
vigitel_data(year = 2023, lazy = TRUE)
```

```
Step 1: Download via HTTP (single file per year)
  |
Step 2: Cache write (Parquet or RDS)
  |
Step 3: Cache read
  |     lazy = TRUE  --> Arrow Dataset
  |     lazy = FALSE --> tibble
  |
Step 4: Return
```

Vigitel doesn't benefit from `.map_parallel()` or `.multi_download()` internally (one file per call). However, the **caller** can parallelize across years using `furrr::future_map()` externally.

---

## 6. Activating all mechanisms from user code

```r
library(healthbR)
library(arrow)
library(future)

# 1. Activate .map_parallel() for FTP downloads
plan(multisession, workers = parallelly::availableCores(omit = 1L))

# 2. .multi_download() is always active for HTTP — nothing to do

# 3. Use lazy = TRUE for Arrow-level pushdown
ds <- sipni_data(year = 2010:2024, type = "CPNI", lazy = TRUE)

# Apply predicate pushdown (row filtering)
ds <- ds |> dplyr::filter(imuno %in% c("09", "21", "29"))

# Apply column pushdown (column selection)
ds <- ds |> dplyr::select(ano, uf, imuno, cobertura)

# Materialize only the filtered/selected data
df <- dplyr::collect(ds)

# 4. Restore sequential plan
plan(sequential)
```

---

## 7. Summary table

| Mechanism | What it does | When it's active | User action required |
|---|---|---|---|
| `.map_parallel()` | Parallel FTP downloads | `furrr` + `future` installed, `plan(multisession)` set | `plan(multisession)` |
| `.multi_download()` | Concurrent HTTP downloads (up to 6) | Always | None |
| Parquet caching | Hive-style partitioned storage | `arrow` installed | `library(arrow)` |
| `lazy = TRUE` | Arrow Dataset with predicate/column pushdown | `arrow` installed, `lazy = TRUE` passed | `lazy = TRUE` in function call |
| `lazy = TRUE` (DuckDB) | DuckDB lazy table with SQL pushdown | `duckdb` + `dbplyr` installed | `lazy = TRUE, backend = "duckdb"` |
| Partition pruning | Skips already-cached data on re-runs | Parquet cache exists | None (automatic) |
| Year vector batching | Batches downloads across years | Year vector passed to function | `year = 2010:2024` instead of loop |
