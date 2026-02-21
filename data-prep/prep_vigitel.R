# ============================================================================
# Vigitel Data Pipeline — prepare-data.R
# ============================================================================
# Downloads Vigitel microdata via healthbR, computes survey-weighted
# prevalence estimates for health indicators, and saves a lightweight
# aggregated .rds file for the dashboard.
#
# Usage: source("data-prep/prep_vigitel.R")   (from project root)
# Output: dashboard/vigitel/vigitel_aggregated.rds
# Runtime: ~15–30 min (download is cached after the first run)
#
# ---- Vigitel variable mapping (confirmed from actual data) ------------------
# Demographics:
#   q6       = age (years, 18+)
#   q7       = sex (1 = Masculino, 2 = Feminino)
#   fet      = age group (1=18-24, 2=25-34, 3=35-44, 4=45-54, 5=55-64, 6=65+)
#   fesc     = education level (1=0-8y, 2=9-11y, 3=12+y)
#   cidade   = city code (1–27, alphabetical: 1=Aracaju … 27=Distrito Federal)
#   pesorake = post-stratification raking weight
#
# Derived indicators (binary 0/1, present in most years):
#   fumante      = current smoker
#   exfuma       = former smoker
#   alcabu       = abusive alcohol consumption
#   flvreg       = regular fruit & vegetable intake
#   refritl5     = regular soft drink consumption (5+/week)
#   ativo_livre  = leisure-time physical activity
#   inativo      = physical inactivity
#   excpeso      = overweight (BMI >= 25)
#   obesid       = obesity (BMI >= 30)
#   diab         = self-reported diabetes
#   hart         = self-reported hypertension
#   mamo         = mammography (women 50-69, may not be in all years)
#   papa         = pap smear (women 25-64, may not be in all years)
#   q88          = health insurance (1=yes; variable name may differ by year)
# ============================================================================

# --- 1. Packages -------------------------------------------------------------

required <- c("healthbR", "arrow", "srvyr", "dplyr", "tidyr", "future", "furrr")
missing  <- required[!vapply(required, requireNamespace, logical(1), quietly = TRUE)]

if (length(missing) > 0) {
  message("Installing missing packages: ", paste(missing, collapse = ", "))
  if ("healthbR" %in% missing) {
    if (!requireNamespace("pak", quietly = TRUE)) install.packages("pak")
    pak::pak("SidneyBissoli/healthbR")
    missing <- setdiff(missing, "healthbR")
  }
  if (length(missing) > 0) install.packages(missing)
}

library(healthbR)
library(srvyr)
library(dplyr, warn.conflicts = FALSE)
library(tidyr)
library(arrow)
library(future)
library(furrr)

# colunas necessarias para o pipeline (todas as demais sao descartadas via lazy)
# variaveis de nome variavel por ano sao incluidas com todas as variantes
VIGITEL_COLS <- c(
  # demographics
  "ano", "cidade", "q6", "q7", "fet", "fesc", "q8_anos", "anoescol",
  # survey weights (nome muda entre anos)
  "pesorake", "pesofim", "peso_final",
  # indicator source variables
  "fumante", "exfuma", "alcabu", "flvreg", "refritl5",
  "ativo_livre", "inativo", "excpeso", "obesid",
  "diab", "hart", "mamo", "papa",
  # health insurance (nome muda entre anos)
  "q88", "q87", "q85"
)

# --- 2. City code → capital name + region ------------------------------------
# Codes 1-27, alphabetical by city name (confirmed via vigitel_dictionary())

city_map <- tibble::tribble(
  ~cidade_code, ~capital,            ~region,
  1L,           "Aracaju",           "Nordeste",
  2L,           "Belém",             "Norte",
  3L,           "Belo Horizonte",    "Sudeste",
  4L,           "Boa Vista",         "Norte",
  5L,           "Campo Grande",      "Centro-Oeste",
  6L,           "Cuiabá",            "Centro-Oeste",
  7L,           "Curitiba",          "Sul",
  8L,           "Florianópolis",     "Sul",
  9L,           "Fortaleza",         "Nordeste",
  10L,          "Goiânia",           "Centro-Oeste",
  11L,          "João Pessoa",       "Nordeste",
  12L,          "Macapá",            "Norte",
  13L,          "Maceió",            "Nordeste",
  14L,          "Manaus",            "Norte",
  15L,          "Natal",             "Nordeste",
  16L,          "Palmas",            "Norte",
  17L,          "Porto Alegre",      "Sul",
  18L,          "Porto Velho",       "Norte",
  19L,          "Recife",            "Nordeste",
  20L,          "Rio Branco",        "Norte",
  21L,          "Rio de Janeiro",    "Sudeste",
  22L,          "Salvador",          "Nordeste",
  23L,          "São Luís",          "Nordeste",
  24L,          "São Paulo",         "Sudeste",
  25L,          "Teresina",          "Nordeste",
  26L,          "Vitória",           "Sudeste",
  27L,          "Brasília",          "Centro-Oeste"
)

# --- 3. Indicator metadata ---------------------------------------------------

indicator_meta <- tibble::tribble(
  ~col,                      ~id,                  ~label_pt,                              ~label_en,                         ~domain_pt,             ~domain_en,
  "ind_smoking",             "smoking",            "Fumante atual",                        "Current smoker",                  "Tabagismo e Álcool",   "Smoking & Alcohol",
  "ind_former_smoker",       "former_smoker",      "Ex-fumante",                           "Former smoker",                   "Tabagismo e Álcool",   "Smoking & Alcohol",
  "ind_abusive_alcohol",     "abusive_alcohol",    "Consumo abusivo de álcool",            "Abusive alcohol consumption",     "Tabagismo e Álcool",   "Smoking & Alcohol",
  "ind_fruit_vegetable",     "fruit_vegetable",    "Consumo regular de frutas/hortaliças", "Regular fruit/vegetable intake",   "Atividade Física e Alimentação", "Physical Activity & Diet",
  "ind_soft_drink",          "soft_drink",         "Consumo regular de refrigerante",      "Regular soft drink consumption",   "Atividade Física e Alimentação", "Physical Activity & Diet",
  "ind_physical_activity",   "physical_activity",  "Atividade física no lazer",            "Leisure-time physical activity",   "Atividade Física e Alimentação", "Physical Activity & Diet",
  "ind_physical_inactivity", "physical_inactivity","Inatividade física",                   "Physical inactivity",              "Atividade Física e Alimentação", "Physical Activity & Diet",
  "ind_overweight",          "overweight",         "Excesso de peso (IMC >= 25)",          "Overweight (BMI >= 25)",          "Obesidade",            "Obesity",
  "ind_obesity",             "obesity",            "Obesidade (IMC >= 30)",                "Obesity (BMI >= 30)",             "Obesidade",            "Obesity",
  "ind_diabetes",            "diabetes",           "Diabetes autorreferida",               "Self-reported diabetes",          "Doenças Crônicas",     "Chronic Diseases",
  "ind_hypertension",        "hypertension",       "Hipertensão autorreferida",            "Self-reported hypertension",      "Doenças Crônicas",     "Chronic Diseases",
  "ind_health_insurance",    "health_insurance",   "Plano de saúde",                       "Health insurance",                "Acesso e Prevenção",   "Access & Prevention",
  "ind_mammography",         "mammography",        "Mamografia (mulheres 50-69)",          "Mammography (women 50-69)",       "Acesso e Prevenção",   "Access & Prevention",
  "ind_pap_smear",           "pap_smear",          "Papanicolau (mulheres 25-64)",         "Pap smear (women 25-64)",         "Acesso e Prevenção",   "Access & Prevention"
)

# --- 4. Helpers --------------------------------------------------------------

# Return first column name that exists in df, or NULL
find_var <- function(df, ...) {
  for (v in c(...)) if (v %in% names(df)) return(v)
  NULL
}

# Map derived indicator variables to standardised indicator columns.
# Variable names confirmed from 2006 & 2023 microdata.
create_indicators <- function(df) {
  cols <- names(df)

  # Smoking
  df$ind_smoking <- if ("fumante" %in% cols) df$fumante else NA_integer_

  # Former smoker
  df$ind_former_smoker <- if ("exfuma" %in% cols) df$exfuma else NA_integer_

  # Abusive alcohol
  df$ind_abusive_alcohol <- if ("alcabu" %in% cols) df$alcabu else NA_integer_


  # Regular fruit + vegetable intake
  df$ind_fruit_vegetable <- if ("flvreg" %in% cols) df$flvreg else NA_integer_

  # Regular soft drink consumption
  df$ind_soft_drink <- if ("refritl5" %in% cols) df$refritl5 else NA_integer_

  # Leisure-time physical activity
  df$ind_physical_activity <- if ("ativo_livre" %in% cols) df$ativo_livre else NA_integer_

  # Physical inactivity
  df$ind_physical_inactivity <- if ("inativo" %in% cols) df$inativo else NA_integer_

  # Overweight (BMI >= 25)
  df$ind_overweight <- if ("excpeso" %in% cols) df$excpeso else NA_integer_

  # Obesity (BMI >= 30)
  df$ind_obesity <- if ("obesid" %in% cols) df$obesid else NA_integer_

  # Diabetes
  df$ind_diabetes <- if ("diab" %in% cols) df$diab else NA_integer_

  # Hypertension
  df$ind_hypertension <- if ("hart" %in% cols) df$hart else NA_integer_

  # Health insurance — q88 in recent years (1 = yes)
  v_hi <- find_var(df, "q88", "q87", "q85")
  if (!is.null(v_hi)) {
    df$ind_health_insurance <- as.integer(df[[v_hi]] == 1)
  } else {
    df$ind_health_insurance <- NA_integer_
  }

  # Mammography (only valid for eligible women, marked by mamo indicator)
  if ("mamo" %in% cols) {
    df$ind_mammography <- df$mamo
    # Set non-eligible to NA (mamo is only computed for women 50-69)
    df$ind_mammography[is.na(df$mamo)] <- NA_integer_
  } else {
    df$ind_mammography <- NA_integer_
  }

  # Pap smear (only valid for eligible women)
  if ("papa" %in% cols) {
    df$ind_pap_smear <- df$papa
    df$ind_pap_smear[is.na(df$papa)] <- NA_integer_
  } else {
    df$ind_pap_smear <- NA_integer_
  }

  df
}

# Standardise demographics using actual Vigitel variable names.
standardize_demographics <- function(df) {
  # Sex: q7 (1 = Masculino, 2 = Feminino)
  df$sex <- case_when(
    df$q7 == 1 ~ "Masculino",
    df$q7 == 2 ~ "Feminino",
    TRUE ~ NA_character_
  )

  # Age group: use `fet` if available (1-6), otherwise derive from q6
  if ("fet" %in% names(df)) {
    df$age_group <- case_when(
      df$fet == 1 ~ "18-24",
      df$fet == 2 ~ "25-34",
      df$fet == 3 ~ "35-44",
      df$fet == 4 ~ "45-54",
      df$fet == 5 ~ "55-64",
      df$fet == 6 ~ "65+",
      TRUE ~ NA_character_
    )
  } else {
    age <- df$q6
    df$age_group <- case_when(
      age >= 18 & age <= 24 ~ "18-24",
      age >= 25 & age <= 34 ~ "25-34",
      age >= 35 & age <= 44 ~ "35-44",
      age >= 45 & age <= 54 ~ "45-54",
      age >= 55 & age <= 64 ~ "55-64",
      age >= 65             ~ "65+",
      TRUE ~ NA_character_
    )
  }

  # Education: use `fesc` if available (1/2/3), otherwise derive from q8_anos
  if ("fesc" %in% names(df)) {
    df$education <- case_when(
      df$fesc == 1 ~ "0-8 anos",
      df$fesc == 2 ~ "9-11 anos",
      df$fesc == 3 ~ "12+ anos",
      TRUE ~ NA_character_
    )
  } else {
    v_ed <- find_var(df, "q8_anos", "anoescol")
    if (!is.null(v_ed)) {
      ed <- as.numeric(df[[v_ed]])
      df$education <- case_when(
        ed >= 0  & ed <= 8  ~ "0-8 anos",
        ed >= 9  & ed <= 11 ~ "9-11 anos",
        ed >= 12            ~ "12+ anos",
        TRUE ~ NA_character_
      )
    } else {
      df$education <- NA_character_
    }
  }

  # Capital and region from cidade code (1–27)
  df$cidade_code <- as.integer(df$cidade)
  df <- left_join(df, city_map, by = "cidade_code")

  # Year
  df$year <- as.integer(df$ano)

  df
}

# Compute survey-weighted prevalences for one grouping level ------------------
compute_prevalences <- function(svy, group_vars, ind_cols) {
  out <- list()

  for (col in ind_cols) {
    if (all(is.na(svy$variables[[col]]))) next
    ind_id <- indicator_meta$id[indicator_meta$col == col]

    res <- tryCatch({
      svy |>
        group_by(across(all_of(group_vars))) |>
        summarise(
          prev = survey_mean(.data[[col]], na.rm = TRUE, vartype = "ci"),
          n    = unweighted(sum(!is.na(.data[[col]]))),
          .groups = "drop"
        ) |>
        mutate(indicator = ind_id)
    }, error = function(e) {
      message("    [skip] ", col, ": ", conditionMessage(e))
      NULL
    })

    if (!is.null(res)) out[[length(out) + 1]] <- res
  }

  if (length(out) == 0) return(NULL)

  bind_rows(out) |>
    rename(prevalence = prev, ci_lower = prev_low, ci_upper = prev_upp) |>
    mutate(across(c(prevalence, ci_lower, ci_upper), ~ .x * 100))
}

# --- 5. Main pipeline --------------------------------------------------------

message("\n", strrep("=", 60))
message("  Vigitel Data Pipeline")
message(strrep("=", 60))

years    <- vigitel_years()
ind_cols <- indicator_meta$col
message("Years: ", paste(years, collapse = ", "))

# --- 5a. download paralelo (popula cache do healthbR) -----------------------
# vigitel requer survey design por ano, entao o processamento e sequencial.
# porem o download (gargalo principal, ~15-30 min) pode ser paralelizado.
# apos esta fase, vigitel_data() le do cache local (instantaneo).

message("\n--- Pre-download: baixando microdados em paralelo ---")

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

n_ok <- sum(vapply(download_status, function(x) x$ok, logical(1)))
message("  ", n_ok, "/", length(years), " anos baixados com sucesso")
for (s in download_status) {
  if (!s$ok) message("  FALHA ", s$year, ": ", s$msg)
}

# --- 5b. processamento sequencial (do cache) --------------------------------

# Grouping levels for aggregation
groupings <- list(
  overall        = "year",
  by_capital     = c("year", "capital", "region"),
  by_sex         = c("year", "sex"),
  by_age         = c("year", "age_group"),
  by_education   = c("year", "education"),
  by_region      = c("year", "region"),
  by_sex_age     = c("year", "sex", "age_group"),
  by_capital_sex = c("year", "capital", "region", "sex")
)

all_dims    <- c("year", "capital", "region", "sex", "age_group", "education")
all_results <- list()

# filtrar apenas anos que foram baixados com sucesso
years_ok <- vapply(download_status[vapply(download_status, function(x) x$ok, logical(1))],
                   function(x) x$year, integer(1))

message("\n--- Processando ", length(years_ok), " anos (do cache) ---")

for (yr in years_ok) {
  message("\n--- ", yr, " ", strrep("-", 50))

  df <- tryCatch({
    ds <- vigitel_data(year = yr, lazy = TRUE)
    keep_cols <- intersect(VIGITEL_COLS, names(ds))
    ds |> dplyr::select(dplyr::all_of(keep_cols)) |> dplyr::collect()
  }, error = function(e) { message("  ERROR: ", e$message); NULL })
  if (is.null(df)) next

  message("  Records: ", format(nrow(df), big.mark = ","),
          " | Columns: ", ncol(df),
          " (lazy: column pushdown)")

  df <- df |> create_indicators() |> standardize_demographics()

  wt <- find_var(df, "pesorake", "pesofim", "peso_final")
  if (is.null(wt)) { message("  No weight variable — skipping"); next }

  avail <- vapply(ind_cols, function(c) sum(!is.na(df[[c]])), integer(1))
  message("  Indicators available: ", sum(avail > 0), "/", length(ind_cols))

  svy <- as_survey_design(df, ids = 1, weights = !!rlang::sym(wt))

  for (grp_name in names(groupings)) {
    grp <- groupings[[grp_name]]
    message("  ", grp_name)
    res <- compute_prevalences(svy, grp, ind_cols)
    if (!is.null(res)) {
      for (d in setdiff(all_dims, grp)) {
        if (d != "year") res[[d]] <- "Total"
      }
      all_results[[length(all_results) + 1]] <- res
    }
  }

  rm(df, svy); gc(verbose = FALSE)
}

# --- 6. Combine, label, and save ---------------------------------------------

message("\n", strrep("=", 60))
message("Combining results...")

vigitel_aggregated <- bind_rows(all_results) |>
  left_join(
    indicator_meta |> select(id, label_pt, label_en, domain_pt, domain_en),
    by = c("indicator" = "id")
  ) |>
  select(year, capital, region, sex, age_group, education,
         indicator, label_pt, label_en, domain_pt, domain_en,
         prevalence, ci_lower, ci_upper, n) |>
  arrange(year, indicator, capital, sex, age_group)

message("Final: ", format(nrow(vigitel_aggregated), big.mark = ","),
        " rows x ", ncol(vigitel_aggregated), " cols")

output_path <- "dashboard/vigitel/vigitel_aggregated.rds"
saveRDS(vigitel_aggregated, output_path)
message("Saved to: ", output_path)
message(strrep("=", 60), "\n")
