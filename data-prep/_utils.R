# =============================================================================
# _utils.R
# funcoes auxiliares compartilhadas entre scripts de preparacao
# =============================================================================

library(dplyr)

# padronizar nomes de UF
padronizar_uf <- function(uf) {
  uf |>
    toupper() |>
    trimws()
}

# calcular taxa por 1.000 habitantes
taxa_1000 <- function(numerador, denominador) {
  (numerador / denominador) * 1000
}

# calcular taxa por 100.000 habitantes
taxa_100000 <- function(numerador, denominador) {
  (numerador / denominador) * 100000
}

# calcular taxa por 10.000 habitantes
taxa_10000 <- function(numerador, denominador) {
  (numerador / denominador) * 10000
}

# calcular proporcao percentual
proporcao_pct <- function(parte, total) {
  (parte / total) * 100
}

# lista de UFs brasileiras (para validacao)
UFS_BR <- c(
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA",
  "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN",
  "RO", "RR", "RS", "SC", "SE", "SP", "TO"
)

# regioes brasileiras
REGIOES_BR <- tibble::tibble(
  uf = UFS_BR,
  regiao = c(
    "Norte", "Nordeste", "Norte", "Norte", "Nordeste", "Nordeste",
    "Centro-Oeste", "Sudeste", "Centro-Oeste", "Nordeste",
    "Sudeste", "Centro-Oeste", "Centro-Oeste", "Norte", "Nordeste",
    "Nordeste", "Nordeste", "Sul", "Sudeste", "Nordeste",
    "Norte", "Norte", "Sul", "Sul", "Nordeste", "Sudeste", "Norte"
  )
)

# mapear codigo CID-10 para capitulo
cid10_capitulo <- function(codigo) {
  primeiro <- substr(codigo, 1, 1)
  case_when(
    primeiro == "A" | primeiro == "B" ~ "I - Doencas infecciosas e parasitarias",
    primeiro == "C" | (primeiro == "D" & as.integer(substr(codigo, 2, 3)) <= 48) ~ "II - Neoplasias",
    primeiro == "I" ~ "IX - Doencas do aparelho circulatorio",
    primeiro == "J" ~ "X - Doencas do aparelho respiratorio",
    primeiro == "K" ~ "XI - Doencas do aparelho digestivo",
    primeiro == "V" | primeiro == "W" | primeiro == "X" | primeiro == "Y" ~ "XX - Causas externas",
    TRUE ~ "Outros"
  )
}

# suavizacao trienal para dados municipais (media movel de 3 anos)
# necessaria para estabilidade estatistica em municipios pequenos
suavizar_trienio <- function(df, coluna_valor, coluna_ano = "ano") {
  df |>
    arrange(!!sym(coluna_ano)) |>
    mutate(
      valor_suavizado = slider::slide_dbl(
        !!sym(coluna_valor), mean, .before = 1, .after = 1, .complete = TRUE
      )
    )
}
