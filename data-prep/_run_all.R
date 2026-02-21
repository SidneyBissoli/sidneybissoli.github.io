# =============================================================================
# _run_all.R
# executa todos os scripts de preparacao na ordem correta
# uso: source("data-prep/_run_all.R")
# =============================================================================

cat("=== Iniciando preparacao de dados do dashboard ===\n\n")

scripts <- c(
  "data-prep/prep_imunizacao.R",
  "data-prep/prep_vigitel.R"
  # adicionar demais modulos conforme forem desenvolvidos
  # "data-prep/prep_mortalidade.R",
  # "data-prep/prep_mortalidade_materna_infantil.R",
  # "data-prep/prep_natalidade.R",
  # "data-prep/prep_morbidade_hospitalar.R",
  # "data-prep/prep_doencas_notificacao.R",
  # "data-prep/prep_saude_mental.R",
  # "data-prep/prep_pns.R"
)

for (script in scripts) {
  cat(paste0("Executando: ", script, "\n"))
  tryCatch(
    source(script, encoding = "UTF-8"),
    error = function(e) {
      cat(paste0("ERRO em ", script, ": ", conditionMessage(e), "\n"))
    }
  )
  cat("\n")
}

cat("=== Preparacao concluida ===\n")
