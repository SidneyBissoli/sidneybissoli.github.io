# =============================================================================
# prep_imunizacao.R
# descricao: prepara dados de imunizacao para o dashboard
# fonte: SI-PNI (Sistema de Informacoes do Programa Nacional de Imunizacoes)
# autor: Sidney Bissoli
# ultima atualizacao: 2026-02-20
# =============================================================================

# dependencias ----------------------------------------------------------------
library(healthbR)
library(arrow)
library(dplyr, warn.conflicts = FALSE)
library(tidyr)
library(readr)
library(stringr)
library(future)

source("data-prep/_utils.R")

# paralelismo -----------------------------------------------------------------
# ativa .map_parallel() dentro do healthbR para downloads FTP concorrentes.
# downloads HTTP/CSV (2020+) ja usam curl::multi_download() internamente.
plan(multisession, workers = parallelly::availableCores(omit = 1L))

# parametros ------------------------------------------------------------------
# DPNI: dados agregados FTP (1994-2019)
# CPNI: cobertura vacinal pre-calculada
# API: microdados individuais (2020+, mais lento)
ANOS_DPNI <- 2010:2019
ANOS_CPNI <- 2010:2024  # tentar cobertura pre-calculada para periodo amplo
OUTPUT_DIR <- "dashboard/data/imunizacao/"

if (!dir.exists(OUTPUT_DIR)) dir.create(OUTPUT_DIR, recursive = TRUE)

# imunobiologicos prioritarios (codigos do dicionario SI-PNI)
# codigos confirmados via sipni_dictionary()
IMUNO_CODES <- c(
  "BCG"            = "09",
  "Hepatite B"     = "21",
  "Pentavalente"   = "81",
  "VIP"            = "82",
  "VOP"            = "23",
  "Triplice viral" = "29",
  "Febre amarela"  = "28",
  "HPV"            = "85"
)

# metas de cobertura vacinal do PNI (%)
METAS_COBERTURA <- c(
  "BCG"            = 90,
  "Hepatite B"     = 95,
  "Pentavalente"   = 95,
  "VIP"            = 95,
  "VOP"            = 95,
  "Triplice viral" = 95,
  "Febre amarela"  = 95,
  "HPV"            = 80
)

cat("\n", strrep("=", 60), "\n")
cat("  Imunizacao (SI-PNI) Data Pipeline\n")
cat(strrep("=", 60), "\n")

# ============================================================================
# 1. download e processamento dos dados de cobertura vacinal
# ============================================================================

# estrategia: usar CPNI (cobertura pre-calculada) como fonte principal
# fallback para DPNI (dados agregados de doses) se CPNI nao estiver disponivel
#
# healthbR aceita vetores de anos e faz o batching internamente:
# - anos FTP (1994-2019): usa .map_parallel() (paralelo com future::plan)
# - anos CSV (2020+): usa curl::multi_download() (6 conexoes simultaneas)

cat("\n--- Baixando dados de cobertura vacinal (CPNI) ---\n")
cat("  Anos:", paste(range(ANOS_CPNI), collapse = "-"),
    "(", length(ANOS_CPNI), "anos)\n")

df_cobertura <- tryCatch({
  ds <- sipni_data(year = ANOS_CPNI, type = "CPNI", lazy = TRUE)
  imuno_col <- find_imuno_col(ds)
  if (!is.null(imuno_col)) {
    ds <- ds |> dplyr::filter(.data[[imuno_col]] %in% unname(IMUNO_CODES))
  }
  df <- dplyr::collect(ds)
  if (!is.null(df) && nrow(df) > 0) {
    cat("  ", format(nrow(df), big.mark = ","), "registros\n")
    df
  } else {
    cat("  sem dados\n")
    tibble()
  }
}, error = function(e) {
  cat("  ERRO:", conditionMessage(e), "\n")
  tibble()
})

cat("\n--- Baixando dados de doses aplicadas (DPNI) ---\n")
cat("  Anos:", paste(range(ANOS_DPNI), collapse = "-"),
    "(", length(ANOS_DPNI), "anos)\n")

df_doses <- tryCatch({
  ds <- sipni_data(year = ANOS_DPNI, type = "DPNI", lazy = TRUE)
  imuno_col <- find_imuno_col(ds)
  if (!is.null(imuno_col)) {
    ds <- ds |> dplyr::filter(.data[[imuno_col]] %in% unname(IMUNO_CODES))
  }
  df <- dplyr::collect(ds)
  if (!is.null(df) && nrow(df) > 0) {
    cat("  ", format(nrow(df), big.mark = ","), "registros\n")
    df
  } else {
    cat("  sem dados\n")
    tibble()
  }
}, error = function(e) {
  cat("  ERRO:", conditionMessage(e), "\n")
  tibble()
})

# ============================================================================
# 2. download de dados populacionais (denominadores)
# ============================================================================

cat("\n--- Baixando estimativas populacionais ---\n")

ANOS_POP <- sort(unique(c(ANOS_CPNI, ANOS_DPNI)))

pop_uf <- tryCatch({
  p <- censo_estimativa(year = ANOS_POP, territorial_level = "uf")
  if (!is.null(p) && nrow(p) > 0) p else tibble()
}, error = function(e) {
  cat("  ERRO:", conditionMessage(e), "\n")
  tibble()
})

cat("  Populacao UF:", nrow(pop_uf), "registros\n")

# restaurar plan sequencial (downloads concluidos)
plan(sequential)

# ============================================================================
# 3. processar e agregar dados
# ============================================================================

cat("\n--- Processando dados ---\n")

if (nrow(df_cobertura) > 0) {
  cat("  Cobertura:", format(nrow(df_cobertura), big.mark = ","), "registros\n")
  cat("  Colunas:", paste(names(df_cobertura), collapse = ", "), "\n")
} else {
  cat("  AVISO: nenhum dado de cobertura disponivel\n")
}

if (nrow(df_doses) > 0) {
  cat("  Doses:", format(nrow(df_doses), big.mark = ","), "registros\n")
  cat("  Colunas:", paste(names(df_doses), collapse = ", "), "\n")
} else {
  cat("  AVISO: nenhum dado de doses disponivel\n")
}

# ============================================================================
# 4. funcao para construir o CSV long padronizado
# ============================================================================

# helper: identificar coluna de UF nos dados
find_col <- function(df, candidates) {
  nms <- tolower(names(df))
  for (c in tolower(candidates)) {
    idx <- which(nms == c)
    if (length(idx) > 0) return(names(df)[idx[1]])
  }
  NULL
}

# helper: identificar coluna de imunobiologico
find_imuno_col <- function(df) {
  find_col(df, c("IMUNO", "imuno", "Imuno", "imunobiologico", "IMUNOBIOLOGICO",
                  "vacina", "VACINA"))
}

# helper: identificar coluna de doses
find_dose_col <- function(df) {
  find_col(df, c("QT_DOSE", "qt_dose", "DOSE", "dose", "doses",
                  "quantidade", "QTD", "qtd"))
}

# helper: identificar coluna de cobertura
find_cob_col <- function(df) {
  find_col(df, c("COBERTURA", "cobertura", "COB", "cob",
                  "cobertura_vacinal", "COBERTURA_VACINAL"))
}

# helper: identificar coluna de municipio
find_munic_col <- function(df) {
  find_col(df, c("MUNIC", "munic", "COD_MUNIC", "cod_munic",
                  "municipio", "MUNICIPIO", "CO_MUNICIPIO", "co_municipio",
                  "IBGE", "ibge", "codmun"))
}

# helper: padronizar nome do imunobiologico
padronizar_imuno <- function(imuno_code) {
  code_str <- str_pad(as.character(imuno_code), 2, pad = "0")
  nomes <- names(IMUNO_CODES)
  codes <- unname(IMUNO_CODES)
  idx <- match(code_str, codes)
  ifelse(is.na(idx), NA_character_, nomes[idx])
}

# ============================================================================
# 5. construir CSVs no formato long padronizado
# ============================================================================

cat("\n--- Construindo CSVs padronizados ---\n")

# --- nivel brasil.csv --------------------------------------------------------

build_brasil <- function(df_cob, df_dos) {
  result <- tibble()

  # se temos dados de cobertura pre-calculada
  if (nrow(df_cob) > 0) {
    uf_col <- find_col(df_cob, c("UF", "uf", "sigla_uf", "SIGLA_UF"))
    imuno_col <- find_imuno_col(df_cob)
    cob_col <- find_cob_col(df_cob)

    if (!is.null(imuno_col) && !is.null(cob_col)) {
      # agregar nivel nacional por imunobiologico e ano
      brasil_cob <- df_cob |>
        mutate(imuno_nome = padronizar_imuno(.data[[imuno_col]])) |>
        filter(!is.na(imuno_nome)) |>
        group_by(ano, imuno_nome) |>
        summarise(
          taxa = mean(as.numeric(.data[[cob_col]]), na.rm = TRUE),
          .groups = "drop"
        ) |>
        mutate(
          periodo = as.character(ano),
          nivel_geo = "brasil",
          cod_local = "BR",
          nome_local = "Brasil",
          uf = NA_character_,
          regiao = NA_character_,
          populacao = NA_integer_,
          desagregacao = "imunobiologico",
          categoria = imuno_nome,
          numerador = NA_integer_,
          denominador = NA_integer_,
          unidade = "%"
        )

      result <- bind_rows(result, brasil_cob)
    }
  }

  # se temos dados de doses aplicadas (DPNI)
  if (nrow(df_dos) > 0) {
    imuno_col <- find_imuno_col(df_dos)
    dose_col <- find_dose_col(df_dos)

    if (!is.null(imuno_col) && !is.null(dose_col)) {
      brasil_dos <- df_dos |>
        mutate(imuno_nome = padronizar_imuno(.data[[imuno_col]])) |>
        filter(!is.na(imuno_nome)) |>
        group_by(ano, imuno_nome) |>
        summarise(
          numerador = sum(as.numeric(.data[[dose_col]]), na.rm = TRUE),
          .groups = "drop"
        ) |>
        mutate(
          periodo = as.character(ano),
          nivel_geo = "brasil",
          cod_local = "BR",
          nome_local = "Brasil",
          uf = NA_character_,
          regiao = NA_character_,
          populacao = NA_integer_,
          desagregacao = "imunobiologico",
          categoria = imuno_nome,
          denominador = NA_integer_,
          taxa = NA_real_,
          unidade = "%"
        )

      # se ja temos cobertura, adicionar numerador de doses; senao usar doses
      if (nrow(result) > 0) {
        result <- result |>
          left_join(
            brasil_dos |> select(ano, categoria, numerador_doses = numerador),
            by = c("ano", "categoria")
          ) |>
          mutate(numerador = coalesce(numerador, as.integer(numerador_doses))) |>
          select(-numerador_doses)
      } else {
        result <- bind_rows(result, brasil_dos)
      }
    }
  }

  result
}

# --- nivel uf.csv ------------------------------------------------------------

build_uf <- function(df_cob, df_dos) {
  result <- tibble()

  if (nrow(df_cob) > 0) {
    uf_col <- find_col(df_cob, c("UF", "uf", "sigla_uf", "SIGLA_UF"))
    imuno_col <- find_imuno_col(df_cob)
    cob_col <- find_cob_col(df_cob)

    if (!is.null(uf_col) && !is.null(imuno_col) && !is.null(cob_col)) {
      uf_cob <- df_cob |>
        mutate(
          imuno_nome = padronizar_imuno(.data[[imuno_col]]),
          uf_pad = padronizar_uf(.data[[uf_col]])
        ) |>
        filter(!is.na(imuno_nome), uf_pad %in% UFS_BR) |>
        left_join(REGIOES_BR, by = c("uf_pad" = "uf")) |>
        group_by(ano, uf_pad, regiao, imuno_nome) |>
        summarise(
          taxa = mean(as.numeric(.data[[cob_col]]), na.rm = TRUE),
          .groups = "drop"
        ) |>
        mutate(
          periodo = as.character(ano),
          nivel_geo = "uf",
          cod_local = uf_pad,
          nome_local = uf_pad,
          uf = uf_pad,
          desagregacao = "imunobiologico",
          categoria = imuno_nome,
          populacao = NA_integer_,
          numerador = NA_integer_,
          denominador = NA_integer_,
          unidade = "%"
        ) |>
        select(-uf_pad)

      result <- bind_rows(result, uf_cob)
    }
  }

  result
}

# --- nivel municipal.csv (trienios) ------------------------------------------

build_municipal <- function(df_cob) {
  result <- tibble()

  if (nrow(df_cob) > 0) {
    uf_col <- find_col(df_cob, c("UF", "uf", "sigla_uf", "SIGLA_UF"))
    munic_col <- find_munic_col(df_cob)
    imuno_col <- find_imuno_col(df_cob)
    cob_col <- find_cob_col(df_cob)

    if (!is.null(munic_col) && !is.null(imuno_col) && !is.null(cob_col)) {
      # calcular trienios
      anos_disp <- sort(unique(df_cob$ano))
      trienios <- list()
      for (i in seq_along(anos_disp)) {
        if (i >= 2 && i <= (length(anos_disp) - 1)) {
          trienios[[length(trienios) + 1]] <- anos_disp[(i-1):(i+1)]
        }
      }
      # se poucos anos, usar tudo como um unico periodo
      if (length(trienios) == 0 && length(anos_disp) >= 1) {
        trienios <- list(anos_disp)
      }

      for (tri in trienios) {
        ano_central <- tri[ceiling(length(tri) / 2)]
        periodo_label <- paste0(min(tri), "-", max(tri))

        mun_tri <- df_cob |>
          filter(ano %in% tri) |>
          mutate(
            imuno_nome = padronizar_imuno(.data[[imuno_col]]),
            cod_mun = as.character(.data[[munic_col]])
          ) |>
          filter(!is.na(imuno_nome))

        if (!is.null(uf_col)) {
          mun_tri <- mun_tri |>
            mutate(uf_pad = padronizar_uf(.data[[uf_col]]))
        }

        mun_agg <- mun_tri |>
          group_by(cod_mun, imuno_nome) |>
          summarise(
            taxa = mean(as.numeric(.data[[cob_col]]), na.rm = TRUE),
            uf_pad = if (!is.null(uf_col)) first(uf_pad) else NA_character_,
            .groups = "drop"
          ) |>
          left_join(REGIOES_BR, by = c("uf_pad" = "uf")) |>
          mutate(
            ano = ano_central,
            periodo = periodo_label,
            nivel_geo = "municipio",
            cod_local = cod_mun,
            nome_local = cod_mun,  # idealmente usar nome, mas cod e suficiente
            uf = uf_pad,
            desagregacao = "imunobiologico",
            categoria = imuno_nome,
            populacao = NA_integer_,
            numerador = NA_integer_,
            denominador = NA_integer_,
            unidade = "%"
          ) |>
          select(-uf_pad, -cod_mun)

        result <- bind_rows(result, mun_agg)
      }
    }
  }

  result
}

# ============================================================================
# 6. construir e salvar CSVs
# ============================================================================

cols_padrao <- c("ano", "periodo", "nivel_geo", "cod_local", "nome_local",
                 "uf", "regiao", "populacao", "desagregacao", "categoria",
                 "numerador", "denominador", "taxa", "unidade")

# construir cada nivel
brasil_csv <- build_brasil(df_cobertura, df_doses)
uf_csv <- build_uf(df_cobertura, df_doses)
municipal_csv <- build_municipal(df_cobertura)

# padronizar colunas
ensure_cols <- function(df) {
  for (col in cols_padrao) {
    if (!col %in% names(df)) {
      df[[col]] <- NA
    }
  }
  df |> select(all_of(cols_padrao))
}

if (nrow(brasil_csv) > 0) {
  brasil_csv <- ensure_cols(brasil_csv)
  write_csv(brasil_csv, paste0(OUTPUT_DIR, "brasil.csv"))
  cat("  brasil.csv:", format(nrow(brasil_csv), big.mark = ","), "linhas\n")
} else {
  cat("  AVISO: brasil.csv vazio -- nenhum dado processado\n")
}

if (nrow(uf_csv) > 0) {
  uf_csv <- ensure_cols(uf_csv)
  write_csv(uf_csv, paste0(OUTPUT_DIR, "uf.csv"))
  cat("  uf.csv:", format(nrow(uf_csv), big.mark = ","), "linhas\n")
} else {
  cat("  AVISO: uf.csv vazio -- nenhum dado processado\n")
}

if (nrow(municipal_csv) > 0) {
  municipal_csv <- ensure_cols(municipal_csv)
  write_csv(municipal_csv, paste0(OUTPUT_DIR, "municipal.csv"))
  cat("  municipal.csv:", format(nrow(municipal_csv), big.mark = ","), "linhas\n")
} else {
  cat("  AVISO: municipal.csv vazio -- dados municipais nao disponiveis\n")
}

# ============================================================================
# 7. validacao basica
# ============================================================================

cat("\n--- Validacao ---\n")

if (nrow(brasil_csv) > 0) {
  stopifnot(all(cols_padrao %in% names(brasil_csv)))
  cat("  brasil.csv: colunas OK\n")
  cat("    anos:", paste(sort(unique(brasil_csv$ano)), collapse = ", "), "\n")
  cat("    imunobiologicos:", paste(sort(unique(brasil_csv$categoria)), collapse = ", "), "\n")
  # verificar taxas plausíveis (cobertura 0-150%)
  taxas_br <- brasil_csv$taxa[!is.na(brasil_csv$taxa)]
  if (length(taxas_br) > 0) {
    cat("    taxa min:", round(min(taxas_br), 1),
        " max:", round(max(taxas_br), 1),
        " media:", round(mean(taxas_br), 1), "\n")
  }
}

if (nrow(uf_csv) > 0) {
  stopifnot(all(cols_padrao %in% names(uf_csv)))
  cat("  uf.csv: colunas OK\n")
  ufs_presentes <- sort(unique(uf_csv$uf[!is.na(uf_csv$uf)]))
  cat("    UFs:", length(ufs_presentes), "de 27\n")
}

if (nrow(municipal_csv) > 0) {
  stopifnot(all(cols_padrao %in% names(municipal_csv)))
  cat("  municipal.csv: colunas OK\n")
  cat("    municipios:", length(unique(municipal_csv$cod_local)), "\n")
}

# tamanho dos arquivos
for (f in c("brasil.csv", "uf.csv", "municipal.csv")) {
  fp <- paste0(OUTPUT_DIR, f)
  if (file.exists(fp)) {
    sz <- file.size(fp) / 1024 / 1024
    cat(sprintf("  %s: %.2f MB %s\n", f, sz,
                ifelse(sz > 5, "[AVISO: > 5 MB]", "[OK]")))
  }
}

cat("\n", strrep("=", 60), "\n")
cat("  Imunizacao pipeline concluido\n")
cat(strrep("=", 60), "\n\n")
