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

# ---- 0. card de produto sem contagem de ferramentas ------------------------
# Contagem escrita à mão envelhece em silêncio: os seis cards de MCP diziam
# "21 ferramentas", "15 ferramentas"... desde 31/08/2026 e, quando os
# servidores ganharam search/fetch, ficaram todos 2 abaixo do ar até 12/10.
# O número certo é o tools/list do servidor, não um texto copiado dele — por
# isso os cards não trazem número, e esta guarda impede que ele volte.
message("[0/7] conferindo os cards de ferramentas sem contagem...")
cards <- list.files("tools", pattern = "\\.qmd$", full.names = TRUE)
contagens <- unlist(lapply(cards, function(f) {
  linhas <- readLines(f, encoding = "UTF-8", warn = FALSE)
  i <- which(str_detect(linhas, regex("\\b\\d+\\s+(ferramentas|tools)\\b", ignore_case = TRUE)))
  if (length(i)) paste0(f, ":", i, ": ", str_trim(linhas[i])) else character()
}))
if (length(contagens)) {
  stop("contagem de ferramentas escrita à mão num card (envelhece a cada tool nova; ",
       "descreva o que o servidor cobre, sem número):\n", paste(contagens, collapse = "\n"),
       call. = FALSE)
}

message("[1/7] renderizando os dois idiomas...")
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

message("[2/7] traduzindo a barra em _site/en/ ...")
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

# ---- 3. barra invertida nas URLs (defeito do Quarto no Windows) ------------
# Achado em 14/09/2026, ao validar o feed no validador do W3C: o feed do blog
# não passava por "Invalid character in a URI: ../../..\\blog/posts/...". Não
# era do feed. O Quarto, ao rodar no Windows, resolve link relativo juntando os
# pedaços com o separador do SISTEMA, e a barra invertida sai no HTML:
#
#   href="../../..\\blog/posts/sidra-tabela-certa/"      (dentro dos posts)
#   href="/.\\en/"   href="..\\projects/"                (barra e rodapé)
#
# A varredura do `_site/` naquele dia achou 15 URLs assim, em páginas de todo o
# site — não só nos dois posts que se citam. Ninguém tinha visto porque o
# NAVEGADOR normaliza `\\` para `/` em URL de esquema http (regra do WHATWG);
# quem não normaliza é o resto: validador de feed, leitor de RSS, rastreador, e
# o passo de hreflang aqui embaixo, que não acha o arquivo e REMOVE o alternate
# em silêncio.
#
# Consertar os links no fonte não resolveria: `/.\\en/` é gerado pelo próprio
# Quarto, não está escrito em .qmd nenhum. Por isso a normalização é aqui, no
# HTML já gerado, como a tradução da barra — e vem ANTES do passo de hreflang,
# que depende de href legível. Barra invertida em URL nunca é válida (teria de
# ser %5C), então a troca é segura por definição.
message("[3/7] normalizando barra invertida nas URLs ...")
# A barra invertida é escrita UMA vez e conferida: montar o padrão a partir
# dela evita a armadilha de contar escapadas, que foi como este passo nasceu
# quebrado (o padrão saiu casando DUAS barras e não achava nada).
UMA_BARRA <- "\\"
stopifnot(nchar(UMA_BARRA) == 1L)
PADRAO_URL_TORTA <- paste0('(href|src)="([^"]*[', UMA_BARRA, UMA_BARRA, '][^"]*)"')

arquivos_url <- list.files("_site", pattern = "\\.(html|xml)$",
                           recursive = TRUE, full.names = TRUE)
arquivos_url <- arquivos_url[!grepl("_site/site_libs/", arquivos_url, fixed = TRUE)]
urls_corrigidas <- 0L; arquivos_tocados <- 0L
for (f in arquivos_url) {
  linhas_antes <- readLines(f, warn = FALSE, encoding = "UTF-8")
  txt <- paste(linhas_antes, collapse = "\n")
  achados <- str_match_all(txt, PADRAO_URL_TORTA)[[1]]
  if (nrow(achados) == 0) next
  for (i in seq_len(nrow(achados))) {
    novo <- sprintf('%s="%s"', achados[i, 2],
                    str_replace_all(achados[i, 3], fixed(UMA_BARRA), "/"))
    txt <- str_replace_all(txt, fixed(achados[i, 1]), novo)
    urls_corrigidas <- urls_corrigidas + 1L
  }
  # Este passo troca CARACTERES dentro de atributos; o número de linhas não
  # pode mudar. A conferência existe porque a primeira versão dele juntou as
  # linhas com um "\\n" LITERAL em vez de quebra de linha e publicou 13
  # arquivos numa linha só — HTML e feed — sem nada acusar: o passo dizia
  # "31 URL(s) corrigidas" e estava destruindo os arquivos que consertava.
  if (length(str_split(txt, fixed("\n"))[[1]]) != length(linhas_antes)) {
    stop("normalização de URL mudou o número de linhas de ", f,
         " (", length(linhas_antes), " -> ", length(str_split(txt, fixed("\n"))[[1]]), ")")
  }
  writeLines(txt, f, useBytes = TRUE)
  arquivos_tocados <- arquivos_tocados + 1L
}
message(sprintf("  %d URL(s) em %d arquivo(s).", urls_corrigidas, arquivos_tocados))

# Guarda por um caminho INDEPENDENTE do padrão acima: extrai TODO valor de
# href/src com um padrão que não contém barra nenhuma e procura a barra com
# fixed(). Guarda que reusa o padrão do consertador compartilha o defeito dele
# — foi o que aconteceu aqui em 14/09/2026: o passo dizia "0 URL(s)" e havia 31,
# e quem achou foi uma varredura escrita fora do R.
sobraram <- character()
for (f in arquivos_url) {
  txt <- paste(readLines(f, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  valores <- str_match_all(txt, '(?:href|src)="([^"]*)"')[[1]]
  if (nrow(valores) == 0) next
  v <- valores[, 2]
  sobraram <- c(sobraram, v[str_detect(v, fixed(UMA_BARRA))])
}
if (length(sobraram) > 0) {
  stop("ainda há ", length(sobraram), " URL(s) com barra invertida em _site/: ",
       paste(unique(sobraram), collapse = ", "))
}

# ---- 3b. link para o inglês que o movimento para en/ entortou --------------
# Achado em 13/10/2026, ao medir os 404 dos robôs na zona: o fonte escreve
# `[texto](/en/blog/posts/sidra-tabela-certa/)`, absoluto e certo, e o Quarto o
# converte em relativo a partir de ONDE O .en.qmd É RENDERIZADO
# (`blog/posts/sidra-via-mcp/`) — `../../../en/blog/...`. O babelquarto depois
# move a página um nível abaixo, para `en/blog/posts/...`, e o mesmo relativo
# passa a resolver em `/en/en/blog/...`: 404. Três links assim naquele dia (os
# dois posts do SIDRA, que se citam, e a página de pacotes), mais as cópias no
# feed em inglês. Só links para a árvore inglesa: link para o português
# (`../../../blog/...`) não sofre, porque o fonte em inglês não o escreve.
#
# Volta ao que o autor escreveu: caminho absoluto a partir da raiz. Funciona
# na página e no feed (leitor de RSS resolve relativo pelo link do ITEM, não
# pelo do feed). Vale só dentro de `_site/en/`: na raiz, `../en/` é legítimo.
PADRAO_EN_RELATIVO <- '(href|src)="(?:\\.\\./)+en/([^"]*)"'
arquivos_en <- arquivos_url[startsWith(arquivos_url, "_site/en/")]
links_en <- 0L
for (f in arquivos_en) {
  txt <- paste(readLines(f, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  n <- str_count(txt, PADRAO_EN_RELATIVO)
  if (n == 0) next
  writeLines(str_replace_all(txt, PADRAO_EN_RELATIVO, '\\1="/en/\\2"'), f, useBytes = TRUE)
  links_en <- links_en + n
}
message(sprintf("  %d link(s) relativos para en/ reescritos como absolutos.", links_en))

# Guarda por um caminho INDEPENDENTE do consertador (a mesma lição do passo 3):
# não procura o padrão, resolve TODO link relativo interno contra a pasta do
# arquivo, como o navegador faria, e exige que o alvo exista no _site/. Pega
# esta classe e qualquer outra que gere link interno para o vazio.
resolve_relativo <- function(pasta, href) {
  pilha <- character()
  for (x in c(str_split(pasta, "/")[[1]], str_split(href, "/")[[1]])) {
    if (x %in% c("", ".")) next
    if (x == "..") { pilha <- head(pilha, -1); next }
    pilha <- c(pilha, x)
  }
  paste(pilha, collapse = "/")
}
sem_alvo <- character()
for (f in arquivos_url) {
  txt <- paste(readLines(f, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  v <- unique(str_match_all(txt, '(?:href|src)="([^"]*)"')[[1]][, 2])
  v <- v[!str_detect(v, "^([a-zA-Z][a-zA-Z0-9+.-]*:|#|//)") & nzchar(v)]
  for (h in v) {
    caminho <- URLdecode(sub("[?#].*$", "", h))
    alvo <- if (startsWith(caminho, "/")) file.path("_site", sub("^/", "", caminho))
            else file.path("_site", resolve_relativo(sub("^_site/?", "", dirname(f)), caminho))
    if (!file.exists(alvo) && !file.exists(file.path(alvo, "index.html"))) {
      sem_alvo <- c(sem_alvo, sprintf("%s -> %s", sub("^_site/", "", f), h))
    }
  }
}
if (length(sem_alvo) > 0) {
  stop(length(sem_alvo), " link(s) interno(s) sem alvo em _site/:\n  ",
       paste(unique(sem_alvo), collapse = "\n  "))
}

# ---- 4. redirecionamentos (arquivo _redirects do Worker) --------------------
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

message("[4/7] escrevendo _site/_redirects ...")
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

# ---- 5. superfície para agentes: llms.txt e llms-full.txt ------------------
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

message("[5/7] escrevendo _site/llms.txt e _site/llms-full.txt ...")
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

# ---- 5. URLs canônicas: hreflang e sitemap ---------------------------------
# O Worker serve com `html_handling: auto-trailing-slash` (wrangler.jsonc):
# `/x/index.html` responde 307 para `/x/` e `/about.html` para `/about`. A URL
# que devolve 200 é essa forma curta — e é a que o buscador tem de receber
# como oficial. Só que o Quarto escreve `index.html` no sitemap e o babelquarto
# escreve os `hreflang` com o NOME DO FONTE (`/en/about.en.html`), que não
# existe em `_site/`: em 02/09/2026 os 13 alternates `en` do site eram 404
# (o seletor de idioma, que é outro link, estava certo). Uma regra só,
# `url_canonica()`, espelha o Worker; vale para hreflang, `<loc>` do sitemap
# e o `Link: canonical` dos `.md` no `_headers` (passo 6).
#
# Alternate que aponta para tradução que NÃO existe (a 404 e a página
# pt-only de projetos) é removido — hreflang para 404 é pior que nenhum.
url_canonica <- function(url) {
  url <- sub("/index\\.html$", "/", url)
  sub("\\.html$", "", url)
}
# caminho de arquivo em _site/ (relativo) a partir de um href absoluto
arquivo_de <- function(href) {
  p <- sub(paste0("^", DOMINIO), "", href)
  p <- sub("/$", "/index.html", p)
  file.path("_site", sub("^/", "", p))
}

message("[6/7] URLs canônicas nos hreflang e no sitemap ...")
todos_html <- list.files("_site", pattern = "\\.html$", recursive = TRUE, full.names = TRUE)
todos_html <- todos_html[!grepl("^_site/site_libs/", todos_html)]
alt_corrigidos <- 0L; alt_removidos <- 0L
for (f in todos_html) {
  html <- paste(readLines(f, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  alts <- str_match_all(html, '<link rel="alternate" hreflang="([a-z]+)" href="([^"]+)" />')[[1]]
  if (nrow(alts) == 0) next
  for (i in seq_len(nrow(alts))) {
    tag <- alts[i, 1]; href <- alts[i, 3]
    # o nome do fonte (`.en.html`) vira o nome publicado (`.html`)
    real <- sub("\\.en\\.html$", ".html", href)
    if (!file.exists(arquivo_de(real))) {
      html <- str_replace(html, fixed(paste0(tag, "\n")), "")
      html <- str_replace(html, fixed(tag), "")
      alt_removidos <- alt_removidos + 1L
      next
    }
    novo <- sprintf('<link rel="alternate" hreflang="%s" href="%s" />', alts[i, 2], url_canonica(real))
    if (novo != tag) alt_corrigidos <- alt_corrigidos + 1L
    html <- str_replace(html, fixed(tag), novo)
  }
  writeLines(html, f, useBytes = TRUE)
}
message(sprintf("  hreflang: %d corrigido(s), %d removido(s) (sem tradução).",
                alt_corrigidos, alt_removidos))

sitemap <- paste(readLines("_site/sitemap.xml", warn = FALSE, encoding = "UTF-8"), collapse = "\n")
locs <- str_match_all(sitemap, "<loc>([^<]+)</loc>")[[1]][, 2]
if (length(locs) == 0) stop("sitemap.xml sem <loc> — o render falhou?")
sem_arquivo <- locs[!file.exists(arquivo_de(locs))]
if (length(sem_arquivo) > 0) {
  stop("sitemap lista URL sem arquivo em _site/: ", paste(sem_arquivo, collapse = ", "))
}
for (u in unique(locs)) {
  sitemap <- str_replace_all(sitemap, fixed(paste0("<loc>", u, "</loc>")),
                             paste0("<loc>", url_canonica(u), "</loc>"))
}
writeLines(sitemap, "_site/sitemap.xml", useBytes = TRUE)
message(sprintf("  sitemap: %d URL(s) na forma canônica.", length(locs)))

# ---- 7. cabeçalhos (arquivo _headers do Worker) ----------------------------
# Lido pelo Worker com assets, como o `_redirects`; não é servido. Regras em
# blocos "caminho + cabeçalhos indentados"; cabeçalho repetido em duas regras
# que casam é CONCATENADO com vírgula (doc), por isso o `/en/*` DESTACA
# (`! Nome`) o Content-Language do `/*` antes de pôr o seu. Limite: 100
# regras, 2.000 caracteres por linha.
#
# O que cada bloco resolve (medido ao vivo em 02/09/2026, antes deste passo):
# - `.md` e `llms*.txt` saíam SEM charset (o Worker deduz o tipo da extensão
#   e para por aí): texto em português com acento, navegador pode exibir
#   lixo. Aqui ganham `charset=utf-8`.
# - Content-Language por pasta: pt-BR na raiz, en em `/en/`.
# - `Link: canonical` em cada `.md` apontando para o HTML (forma canônica do
#   passo 5): o `.md` é cópia para agentes, não página concorrente. Um bloco
#   por `.md`, DERIVADO da lista do passo 4.
# - `site_libs/` cacheável por uma semana (o bootstrap tem hash no nome; os
#   .js do Quarto não, e uma semana é o teto aceitável de atraso quando o
#   Quarto mudar de versão). O resto fica no default (max-age=0 + ETag).
# - Higiene: nosniff, referrer, frame, permissions. Sem CSP (o Quarto usa
#   script inline) e sem HSTS — HSTS é decisão da ZONA (afeta os produtos),
#   não deste Worker.
message("[7/7] escrevendo _site/_headers ...")

# Os feeds gerados pelas listagens com `feed:` — derivados do _site/, nunca de
# uma lista à mão: o sitemap.xml e qualquer outro XML que não seja RSS ficam de
# fora pelo conteúdo, não pelo nome. Se um dia não houver feed nenhum, o script
# PARA: o blog sem feed foi o defeito que isto existe para não ter de volta
# (14/09/2026, r-bloggers não sindicaliza sem RSS).
feeds_publicados <- local({
  xmls <- list.files("_site", pattern = "\\.xml$", recursive = TRUE, full.names = TRUE)
  eh_rss <- vapply(xmls, function(f) {
    cab <- paste(readLines(f, n = 8, warn = FALSE, encoding = "UTF-8"), collapse = " ")
    grepl("<rss", cab, fixed = TRUE)
  }, logical(1))
  sub("^_site", "", xmls[eh_rss])
})
if (length(feeds_publicados) == 0) {
  stop("nenhum feed RSS em _site/ — alguma listagem perdeu o `feed:`? ",
       "Sem feed o blog não existe para agregador (r-bloggers, leitores de feed).")
}
message(sprintf("  feeds: %s", paste(feeds_publicados, collapse = ", ")))

cabecalhos <- c(
  "# Gerado por scripts/render-site.R — não editar à mão.",
  "/*",
  "  X-Content-Type-Options: nosniff",
  "  Referrer-Policy: strict-origin-when-cross-origin",
  "  X-Frame-Options: SAMEORIGIN",
  "  Permissions-Policy: camera=(), microphone=(), geolocation=()",
  "  Content-Language: pt-BR",
  "/en/*",
  "  ! Content-Language",
  "  Content-Language: en",
  "/*.md",
  "  Content-Type: text/markdown; charset=utf-8",
  "/llms.txt",
  "  Content-Type: text/plain; charset=utf-8",
  "/llms-full.txt",
  "  Content-Type: text/plain; charset=utf-8",
  # Feeds RSS, um por listagem e por idioma. Declarados UM A UM de propósito:
  # uma regra `/*.xml` pegaria também o sitemap.xml, que não é RSS. A lista sai
  # do próprio _site/ (feeds_publicados, acima), então listagem nova com
  # `feed:` entra aqui sozinha e feed que deixar de existir sai.
  unlist(lapply(feeds_publicados, function(p) c(
    p, "  Content-Type: application/rss+xml; charset=utf-8"
  ))),
  "/site_libs/*",
  "  Cache-Control: public, max-age=604800",
  unlist(lapply(paginas, function(p) c(
    sub(paste0("^", DOMINIO), "", p$url),
    sprintf('  Link: <%s>; rel="canonical"', url_canonica(sub("\\.md$", ".html", p$url)))
  )))
)
n_regras <- sum(grepl("^/", cabecalhos))
if (n_regras > 100) stop("_headers com ", n_regras, " regras — o limite do Worker é 100.")
if (any(nchar(cabecalhos) > 2000)) stop("_headers com linha acima de 2.000 caracteres.")
writeLines(cabecalhos, "_site/_headers", useBytes = TRUE)
message(sprintf("  %d regra(s), %d delas de canonical dos .md.", n_regras, length(paginas)))

message("pronto: _site/ (pt na raiz, en em _site/en/)")
