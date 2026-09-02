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

message("[1/4] renderizando os dois idiomas...")
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

message("[2/4] traduzindo a barra em _site/en/ ...")
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

# ---- 3. redirecionamentos (arquivo _redirects do Worker) --------------------
# O site do GitHub Pages (até 01/09/2026) servia caminhos que o layout atual
# não gera: `publications/` (hoje `research/`) e as cópias `*.en.html` na raiz
# que a versão anterior do babelquarto emitia (hoje tudo em inglês mora em
# `en/`). Quem chega por link ou índice antigo recebe um 301 para o lugar
# novo — 301 de verdade, que o buscador trata como mudança de endereço
# (no GitHub Pages só havia `meta refresh`).
#
# Por que não `aliases:` do Quarto: a versão em inglês é renderizada à parte
# e movida para `_site/en/`, então um alias declarado num `.en.qmd` nasceria
# DENTRO de `en/`, nunca na raiz. Mapa explícito, como o de rótulos acima: o
# destino tem de existir no `_site/` recém-gerado, senão o script para.
#
# O `_redirects` é lido pelo Worker com assets (wrangler.jsonc) e não é
# servido como arquivo. Formato: "origem destino código", um por linha. Só
# aceita caminhos RELATIVOS (o deploy recusa "https://www..." com "Only
# relative URLs are allowed", medido em 02/09/2026) — por isso o www -> apex
# não está aqui: é uma Redirect Rule da zona no painel da Cloudflare.
REDIRECIONAMENTOS <- c(
  "/publications/index.html" = "/research/index.html",
  "/publications/"           = "/research/",
  "/index.en.html"           = "/en/index.html",
  "/about.en.html"           = "/en/about.html"
)

message("[3/4] escrevendo _site/_redirects ...")
for (antigo in names(REDIRECIONAMENTOS)) {
  novo  <- REDIRECIONAMENTOS[[antigo]]
  alvo  <- if (endsWith(novo, "/")) paste0(novo, "index.html") else novo
  if (!file.exists(file.path("_site", sub("^/", "", alvo)))) {
    stop("redirecionamento ", antigo, " -> ", novo,
         ": o destino não existe em _site/. Corrija o mapa REDIRECIONAMENTOS.")
  }
  message(sprintf("  %s -> %s", antigo, novo))
}
linhas <- c(
  "# Gerado por scripts/render-site.R — não editar à mão.",
  sprintf("%s %s 301", names(REDIRECIONAMENTOS), REDIRECIONAMENTOS)
)
writeLines(linhas, "_site/_redirects", useBytes = TRUE)

# ---- 4. superfície para agentes: llms.txt e llms-full.txt ------------------
# Agentes e LLMs já pedem `/llms.txt` aqui (medido na zona em 02/09/2026: sete
# pedidos em uma semana, todos em 404, de diretórios de agentes e de robôs de
# inventário). O que se publica é o equivalente à mão do "Markdown para
# agentes" que a Cloudflare só vende no plano Pro: cada documento que declara
# `format: gfm` no frontmatter sai do render como `index.md` AO LADO do
# `index.html` (mesmo caminho, extensão trocada), e o `llms.txt` da raiz lista
# esses `.md` no formato de llmstxt.org. O `llms-full.txt` é a concatenação
# deles, para quem lê tudo de uma vez.
#
# NADA aqui é listado à mão. A lista esperada vem dos `.qmd` que declaram
# `gfm`; o arquivo só sai se TODOS os `.md` esperados existirem em `_site/`
# (o babelquarto move os da versão em inglês para `_site/en/` — conferido em
# 02/09/2026), e um `.md` em `_site/` que nenhum `.qmd` explique é render
# velho: também para o script. Título e resumo vêm do frontmatter
# (`title`, `subtitle`); a data, dos posts, para ordenar do mais novo ao mais
# antigo. Página sem `subtitle` entra sem resumo, não com resumo inventado.
DOMINIO <- "https://sidneybissoli.com"

fontes <- list.files(".", pattern = "\\.qmd$", recursive = TRUE)
fontes <- fontes[!grepl("^(_site|dashboard)/", fontes)]
paginas <- lapply(fontes, function(f) {
  fm <- rmarkdown::yaml_front_matter(f)
  if (is.null(fm$format$gfm)) return(NULL)
  en   <- grepl("\\.en\\.qmd$", f)
  rel  <- sub("\\.en\\.qmd$|\\.qmd$", ".md", f)
  md   <- file.path("_site", if (en) file.path("en", rel) else rel)
  list(
    fonte  = f,
    md     = md,
    url    = paste0(DOMINIO, "/", if (en) file.path("en", rel) else rel),
    idioma = if (en) "en" else "pt",
    post   = grepl("^blog/posts/", f),
    titulo = fm$title,
    resumo = fm$subtitle,
    data   = if (!is.null(fm$date)) as.Date(fm$date) else as.Date(NA)
  )
})
paginas <- Filter(Negate(is.null), paginas)

message("[4/4] escrevendo _site/llms.txt e _site/llms-full.txt ...")
if (length(paginas) == 0) stop("nenhum .qmd declara `format: gfm` — o llms.txt ficaria vazio.")

esperados <- vapply(paginas, `[[`, "", "md")
faltam <- esperados[!file.exists(esperados)]
if (length(faltam) > 0) {
  stop(".md esperado(s) e ausente(s) em _site/: ", paste(faltam, collapse = ", "),
       "\nO documento declara `gfm` mas o render não o produziu (ou não o moveu para en/).")
}
existentes <- list.files("_site", pattern = "\\.md$", recursive = TRUE, full.names = TRUE)
existentes <- existentes[!grepl("^_site/site_libs/", existentes)]
sobras <- setdiff(normalizePath(existentes), normalizePath(esperados))
if (length(sobras) > 0) {
  stop(".md em _site/ sem .qmd que o explique (render velho?): ",
       paste(sobras, collapse = ", "))
}

# Linha do llmstxt.org: "- [título](url): resumo" (resumo só quando existe).
linha_llms <- function(p) {
  sprintf("- [%s](%s)%s", p$titulo, p$url,
          if (is.null(p$resumo) || !nzchar(p$resumo)) "" else paste0(": ", p$resumo))
}
# Páginas na ordem da barra; posts do mais novo ao mais antigo.
ordem_paginas <- c("tools", "packages", "research", "about")
ordenar <- function(ps, posts) {
  ps <- Filter(function(p) p$post == posts, ps)
  if (posts) {
    ps[order(vapply(ps, function(p) as.numeric(p$data), 0), decreasing = TRUE)]
  } else {
    chave <- vapply(ps, function(p) sub("/.*$|\\.qmd$|\\.en\\.qmd$", "", p$fonte), "")
    pos <- match(chave, ordem_paginas)
    pos[is.na(pos)] <- length(ordem_paginas) + seq_len(sum(is.na(pos)))
    ps[order(pos)]
  }
}
secao <- function(titulo, ps) {
  if (length(ps) == 0) return(character())
  c(sprintf("## %s", titulo), vapply(ps, linha_llms, ""), "")
}
pt <- Filter(function(p) p$idioma == "pt", paginas)
en <- Filter(function(p) p$idioma == "en", paginas)

llms <- c(
  "# Sidney Bissoli",
  "",
  "> Psicólogo, pesquisador em saúde pública e cientista de dados. Servidores MCP",
  "> e pacotes R que entregam dado público brasileiro (IBGE, Banco Central,",
  "> Senado, DATASUS) a assistentes de IA e ao R, com procedência em toda resposta.",
  "",
  "Cada link abaixo é a versão Markdown de uma página; o HTML correspondente está",
  "no mesmo caminho, com `.html` no lugar de `.md`. O site é em português, com",
  "versão em inglês em `/en/`. Tudo o que está listado aqui, concatenado:",
  sprintf("%s/llms-full.txt", DOMINIO),
  "",
  secao("Páginas", ordenar(pt, posts = FALSE)),
  secao("Escritos", ordenar(pt, posts = TRUE)),
  secao("English", c(ordenar(en, posts = FALSE), ordenar(en, posts = TRUE)))
)
writeLines(llms, "_site/llms.txt", useBytes = TRUE)

ordem_full <- c(ordenar(pt, posts = FALSE), ordenar(pt, posts = TRUE),
                ordenar(en, posts = FALSE), ordenar(en, posts = TRUE))
full <- unlist(lapply(ordem_full, function(p) {
  c(sprintf("<!-- %s -->", p$url),
    readLines(p$md, warn = FALSE, encoding = "UTF-8"),
    "", "---", "")
}))
writeLines(c(llms, "", "---", "", full), "_site/llms-full.txt", useBytes = TRUE)

message(sprintf("  %d documento(s) em Markdown (%d pt, %d en) listados no llms.txt; llms-full.txt com %d linhas.",
                length(paginas), length(pt), length(en), length(full)))

message("pronto: _site/ (pt na raiz, en em _site/en/)")
