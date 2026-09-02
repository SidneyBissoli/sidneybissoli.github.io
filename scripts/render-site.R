# Constrói o site nos dois idiomas.
#
# Use SEMPRE este script, não `quarto render` nem `babelquarto::render_website()`
# direto: sem o segundo passo daqui, a versão em inglês sai com a barra de
# navegação em português.
#
#   "C:/Program Files/R/R-4.6.1/bin/Rscript.exe" scripts/render-site.R
#
# POR QUE EXISTE O SEGUNDO PASSO. O caminho normal para traduzir a barra seria
# um bloco `navbar` no `_quarto-en.yml`, e era o que este projeto tinha. Só que
# o babelquarto 0.1.0.9000 funde esse arquivo no `_quarto.yml` com
# `utils::modifyList()`, e a fusão morre em `[[<-.data.frame` ao encontrar a
# lista de itens da barra. Com o erro, o pós-processamento do próprio pacote
# nunca roda — e é ele que injeta o SELETOR DE IDIOMA. Ou seja: manter a
# tradução da barra custava o seletor inteiro.
#
# Medido em 31/08/2026, isolando campo a campo: com `navbar` no
# `_quarto-en.yml`, o render aborta e não há seletor; sem ele, zero erros e o
# seletor aparece nos dois idiomas, mas os rótulos ficam em português.
#
# A saída é traduzir aqui, no HTML já gerado. É menos elegante e é inteiramente
# nosso — não depende de o pacote consertar o defeito.

setwd(here::here())
library(stringr)

message("[1/3] renderizando os dois idiomas...")
babelquarto::render_website(".", preview = FALSE)

# ---- 2. tradução da barra na versão em inglês -------------------------------
# Mapa EXPLÍCITO. Rótulo que não estiver aqui não é traduzido em silêncio: o
# script AVISA e sai com erro. Barra nova em português passando despercebida é
# exatamente o defeito que este arquivo existe para não ter.
ROTULOS <- c(
  "Servidores MCP" = "MCP servers",
  "Pacotes R"      = "R packages",
  "Painéis"        = "Dashboards",
  "Projetos"       = "Projects",
  "Escritos"       = "Writing",
  "Publicações"    = "Publications",
  "Sobre mim"      = "About me"
)

message("[2/3] traduzindo a barra em _site/en/ ...")
arquivos <- list.files("_site/en", pattern = "\\.html$", recursive = TRUE,
                       full.names = TRUE)
if (length(arquivos) == 0) stop("nenhum HTML em _site/en/ — o render em inglês falhou?")

desconhecidos <- character()
tocados <- 0L

for (f in arquivos) {
  html <- paste(readLines(f, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  achados <- str_match_all(html, '<span class="menu-text">([^<]+)</span>')[[1]]
  if (nrow(achados) == 0) next

  for (rot in unique(achados[, 2])) {
    if (rot %in% names(ROTULOS)) {
      html <- str_replace_all(
        html,
        fixed(sprintf('<span class="menu-text">%s</span>', rot)),
        sprintf('<span class="menu-text">%s</span>', ROTULOS[[rot]])
      )
    } else if (!rot %in% ROTULOS) {
      # já em inglês conta como conhecido; qualquer outra coisa, não
      desconhecidos <- c(desconhecidos, rot)
    }
  }
  writeLines(html, f, useBytes = TRUE)
  tocados <- tocados + 1L
}

if (length(desconhecidos) > 0) {
  stop("rótulo(s) de navbar sem tradução em scripts/render-site.R: ",
       paste(unique(desconhecidos), collapse = ", "),
       "\nAcrescente ao mapa ROTULOS antes de publicar.")
}

message(sprintf("  %d arquivo(s) em inglês com a barra traduzida.", tocados))

# ---- 3. redirecionamentos das URLs do site antigo ---------------------------
# O gh-pages de 08/01/2026 servia caminhos que o layout atual não gera:
# `publications/` (hoje `research/`) e as cópias `*.en.html` na raiz que a
# versão anterior do babelquarto emitia (hoje tudo em inglês mora em `en/`).
# Quem chega por link ou índice antigo cai aqui em vez de num 404.
#
# Por que não `aliases:` do Quarto: a versão em inglês é renderizada à parte
# e movida para `_site/en/`, então um alias declarado num `.en.qmd` nasceria
# DENTRO de `en/`, nunca na raiz. Mapa explícito, como o de rótulos acima: o
# destino tem de existir no `_site/` recém-gerado, senão o script para.
REDIRECIONAMENTOS <- c(
  "publications/index.html" = "research/index.html",
  "index.en.html"           = "en/index.html",
  "about.en.html"           = "en/about.html"
)

message("[3/3] redirecionamentos das URLs antigas ...")
for (antigo in names(REDIRECIONAMENTOS)) {
  novo <- REDIRECIONAMENTOS[[antigo]]
  if (!file.exists(file.path("_site", novo))) {
    stop("redirecionamento ", antigo, " -> ", novo,
         ": o destino não existe em _site/. Corrija o mapa REDIRECIONAMENTOS.")
  }
  dir.create(dirname(file.path("_site", antigo)), showWarnings = FALSE,
             recursive = TRUE)
  writeLines(c(
    "<!DOCTYPE html>",
    '<html><head><meta charset="utf-8">',
    sprintf('<meta http-equiv="refresh" content="0; url=/%s">', novo),
    sprintf('<link rel="canonical" href="/%s">', novo),
    '<meta name="robots" content="noindex">',
    "</head><body>",
    sprintf('<p>Esta página mudou de endereço: <a href="/%s">/%s</a></p>',
            novo, novo),
    "</body></html>"
  ), file.path("_site", antigo), useBytes = TRUE)
  message(sprintf("  /%s -> /%s", antigo, novo))
}

message("pronto: _site/ (pt na raiz, en em _site/en/)")
