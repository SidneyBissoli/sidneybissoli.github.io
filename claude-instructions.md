# Especificacao Tecnica: Dashboard de Saude Publica do Brasil

> **Documento de referencia para Claude Code.**
> Todo o desenvolvimento deve seguir estritamente o que esta descrito aqui.
> Em caso de ambiguidade, perguntar ao usuario (Sidney) antes de tomar decisoes por conta propria.

---

## 1. Visao Geral do Projeto

### 1.1 O que e

Um dashboard interativo de saude publica brasileira, hospedado como parte do website pessoal de Sidney Bissoli em `sidneybissoli.github.io`. O dashboard apresenta indicadores epidemiologicos calculados a partir de dados oficiais do Ministerio da Saude e do IBGE, com tres niveis de granularidade geografica (Brasil, UF, municipio).

### 1.2 Stack tecnologico

| Componente | Tecnologia |
|---|---|
| Linguagem de programacao | R |
| Framework do website | Quarto |
| Hospedagem | GitHub Pages (site estatico) |
| Pacote de dados | `healthbR` (CRAN) |
| Visualizacoes interativas | `plotly` |
| Interatividade (filtros) | `crosstalk` |
| Tabelas | `reactable` (preferencial) ou `DT` |
| Desagregacoes | Quarto tabset panels (nativo) |
| Multilingue | `babelquarto` (PT principal, EN secundario) |
| Renderizacao | `babelquarto::render_website(".")` |
| Preview local | `servr::httw("_site")` |
| Publicacao | `quarto publish gh-pages` |

### 1.3 Restricao arquitetural fundamental

O site roda no GitHub Pages, que e **estatico**. Nao ha servidor R executando em tempo real. Portanto, o `healthbR` **nunca** executa quando o usuario final acessa o dashboard. Todo processamento de dados ocorre **antes** do deploy, na maquina local de Sidney.

---

## 2. Arquitetura do Sistema

### 2.1 Decisao arquitetural (ja tomada -- nao alterar)

A arquitetura segue o padrao **pre-processamento desacoplado**:

1. **Etapa 1 -- Pre-processamento (offline, maquina local):** scripts R na pasta `data-prep/` usam o `healthbR` para baixar dados brutos, calcular indicadores, agregar, e salvar os resultados como arquivos CSV leves na pasta `dashboard/data/`.
2. **Etapa 2 -- Visualizacao (build time):** as paginas `.qmd` do dashboard consomem os CSVs da pasta `data/` via chunks R, criam objetos `SharedData` (crosstalk) e geram graficos `plotly` que sao embutidos no HTML final.
3. **Etapa 3 -- Deploy:** o HTML estatico e publicado no GitHub Pages. O usuario final recebe apenas HTML/CSS/JS.

### 2.2 Por que essa arquitetura (justificativa para contexto)

- **Desempenho:** evita re-download de gigabytes de dados a cada render do site.
- **Independencia:** atualizar dados e atualizar conteudo do site sao processos separados.
- **Modularidade:** cada modulo tematico e independente; lancar um nao afeta os outros.
- **Escalabilidade:** o SIM tem milhoes de registros, mas os CSVs agregados tem centenas ou poucos milhares de linhas.

### 2.3 Diagrama do fluxo de dados

```
healthbR (API/download)
       |
       v
+--------------------+
|   data-prep/       |   <- Scripts R (rodam localmente, NAO vao para o site)
|   prep_modulo.R    |
+--------------------+
       |
       v salva CSVs agregados (por nivel geografico)
+--------------------+
| dashboard/data/    |   <- CSVs leves (vao para o repositorio git)
| mortalidade/       |
|   brasil.csv       |   <- nivel nacional
|   uf.csv           |   <- nivel estadual
|   municipal.csv    |   <- nivel municipal
+--------------------+
       |
       v le CSV no build, cria SharedData (crosstalk)
+--------------------+
| dashboard/         |   <- Paginas .qmd (Quarto dashboard)
| mortalidade.qmd    |      com tabset panels + filtros crosstalk
+--------------------+
       |
       v render
+--------------------+
| _site/             |   <- HTML estatico (GitHub Pages)
+--------------------+
```

---

## 3. Estrutura de Diretorios

A seguir esta a estrutura de diretorios **dentro do repositorio do website** (`sidneybissoli.github.io`). O dashboard e um subdiretorio do site.

```
sidneybissoli.github.io/
+-- _quarto.yml                    # configuracao global do site (ja existe)
+-- index.qmd                      # pagina inicial do site (ja existe)
+-- ...                            # demais paginas do site (ja existem)
|
+-- data-prep/                     # NAO vai para o site final
|   +-- _run_all.R                 # script mestre que executa todos os preps
|   +-- _utils.R                   # funcoes auxiliares compartilhadas
|   +-- _viz_utils.R               # funcoes auxiliares de visualizacao (crosstalk/plotly)
|   +-- prep_imunizacao.R
|   +-- prep_vigitel.R
|   +-- prep_mortalidade.R
|   +-- prep_mortalidade_materna_infantil.R
|   +-- prep_natalidade.R
|   +-- prep_morbidade_hospitalar.R
|   +-- prep_doencas_notificacao.R
|   +-- prep_saude_mental.R
|   +-- prep_pns.R
|
+-- dashboard/
|   +-- index.qmd                  # pagina de entrada do dashboard (hub)
|   +-- _metadata.yml              # metadados compartilhados das paginas do dashboard
|   +-- _viz_utils.R               # funcoes de visualizacao copiadas para uso nos .qmd
|   |
|   +-- data/                      # CSVs agregados (output do data-prep)
|   |   +-- imunizacao/
|   |   |   +-- brasil.csv
|   |   |   +-- uf.csv
|   |   |   +-- municipal.csv
|   |   +-- vigitel/
|   |   |   +-- capitais.csv       # vigitel so tem nivel de capitais
|   |   |   +-- regioes.csv
|   |   +-- mortalidade/
|   |   |   +-- brasil.csv
|   |   |   +-- uf.csv
|   |   |   +-- municipal.csv
|   |   +-- ... (demais modulos seguem o mesmo padrao)
|   |
|   +-- imunizacao.qmd
|   +-- vigitel.qmd
|   +-- mortalidade.qmd
|   +-- mortalidade-materna-infantil.qmd
|   +-- natalidade.qmd
|   +-- morbidade-hospitalar.qmd
|   +-- doencas-notificacao.qmd
|   +-- saude-mental.qmd
|   +-- pns.qmd
|
+-- .gitignore                     # deve incluir: data-prep/cache/
```

### 3.1 Regras do .gitignore

Adicionar ao `.gitignore` existente:

```gitignore
# cache dos dados brutos baixados pelo healthbR (pesados demais para git)
data-prep/cache/
data-prep/*.log
```

Os CSVs em `dashboard/data/` **devem** ir para o git (sao pequenos, sao o produto final do processamento).

---

## 4. Convencoes de Codigo R

### 4.1 Estilo obrigatorio

- Seguir convencoes **tidyverse**.
- Usar pipe nativo `|>` (NAO usar `%>%`).
- Comentarios em **letras minusculas** (ex: `# calcular taxa de mortalidade`).
- Nomes de variaveis em **snake_case**.
- Nomes de arquivos em **kebab-case** para `.qmd` e **snake_case** para `.R` e `.csv`.
- Encoding: **UTF-8** em todos os arquivos.
- Indentacao: **2 espacos** (padrao tidyverse).

### 4.2 Estrutura padrao de um script de preparacao

Todo script `prep_*.R` deve seguir este template:

```r
# =============================================================================
# prep_[nome_modulo].R
# descricao: prepara dados de [nome do modulo] para o dashboard
# fonte: [nome do sistema - ex: SI-PNI, SIM, Vigitel]
# autor: Sidney Bissoli
# ultima atualizacao: [data]
# =============================================================================

# dependencias ----------------------------------------------------------------
library(healthbR)
library(dplyr)
library(tidyr)
library(readr)
library(stringr)
library(janitor)

source("data-prep/_utils.R")

# parametros ------------------------------------------------------------------
ANOS <- 2010:2023 # ajustar conforme disponibilidade
OUTPUT_DIR <- "dashboard/data/[nome_modulo]/"

# criar diretorio de output se nao existir
if (!dir.exists(OUTPUT_DIR)) dir.create(OUTPUT_DIR, recursive = TRUE)

# download dos dados brutos ---------------------------------------------------
# IMPORTANTE: antes de escrever este bloco, consultar a documentacao do healthbR
# para verificar os nomes exatos das funcoes e seus parametros.
# Rodar: ?healthbR ou help(package = "healthbR") para listar funcoes disponiveis.

dados_brutos <- [chamada_healthbR]

# processamento e agregacao ---------------------------------------------------
# [logica de agregacao especifica do modulo]
# OBRIGATORIO: gerar 3 CSVs por modulo (brasil.csv, uf.csv, municipal.csv)
# ver secao 6 para schemas detalhados de cada nivel

# validacao -------------------------------------------------------------------
# verificar se o dataframe resultante tem as colunas esperadas
stopifnot(
  all(c("coluna1", "coluna2") %in% names(dados_agregados)),
  nrow(dados_agregados) > 0
)

# exportacao ------------------------------------------------------------------
write_csv(dados_brasil, paste0(OUTPUT_DIR, "brasil.csv"))
write_csv(dados_uf, paste0(OUTPUT_DIR, "uf.csv"))
write_csv(dados_municipal, paste0(OUTPUT_DIR, "municipal.csv"))

cat("[nome_modulo]: arquivos salvos -",
    nrow(dados_brasil), "linhas (brasil),",
    nrow(dados_uf), "linhas (uf),",
    nrow(dados_municipal), "linhas (municipal)\n")
```

### 4.3 Script de funcoes auxiliares compartilhadas (`_utils.R`)

Este arquivo contem funcoes usadas por multiplos scripts de preparacao:

```r
# =============================================================================
# _utils.R
# funcoes auxiliares compartilhadas entre scripts de preparacao
# =============================================================================

library(dplyr)

# populacao brasileira por UF e ano (necessaria para calcular taxas)
# INSTRUCAO: verificar se o healthbR ja fornece dados populacionais.
# Se nao fornecer, usar os dados do IBGE (Censos + estimativas intercensitarias).
# Ultima alternativa: usar o pacote `brpop` ou `sidrar`.

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
```

### 4.4 Script mestre (`_run_all.R`)

```r
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
```

---

## 5. Instrucao Critica sobre o Pacote healthbR

> **ATENCAO, Claude Code:** antes de escrever qualquer script de preparacao, voce **DEVE** inspecionar o pacote `healthbR` para descobrir os nomes exatos das funcoes e seus parametros. O pacote esta no CRAN.
>
> Execute os seguintes comandos no R:
>
> ```r
> # instalar se necessario
> install.packages("healthbR")
>
> # listar todas as funcoes exportadas
> ls("package:healthbR")
>
> # ver a documentacao geral
> help(package = "healthbR")
>
> # para cada funcao relevante, ler a documentacao
> ?nome_da_funcao
> ```
>
> **NAO INVENTE** nomes de funcoes. Se uma funcao nao existir, pergunte a Sidney ou busque alternativas (como os pacotes `microdatasus`, `datasus`, ou acesso direto via `httr`/`readr` aos repositorios do DATASUS).

### 5.1 Fontes de dados conhecidas que o healthbR acessa

Com base na descricao do CRAN, o `healthbR` prove acesso a:

| Sigla | Sistema | Descricao |
|---|---|---|
| Vigitel | Vigitel | Vigilancia de Fatores de Risco e Protecao para Doencas Cronicas por Inquerito Telefonico |
| PNS | PNS | Pesquisa Nacional de Saude (IBGE) |
| SIM | SIM | Sistema de Informacoes sobre Mortalidade |
| SINASC | SINASC | Sistema de Informacoes sobre Nascidos Vivos |

Outros sistemas que podem estar disponiveis (verificar na documentacao):

| Sigla | Sistema | Descricao |
|---|---|---|
| SIH | SIH-SUS | Sistema de Informacoes Hospitalares |
| SI-PNI | SI-PNI | Sistema de Informacoes do Programa Nacional de Imunizacoes |
| SINAN | SINAN | Sistema de Informacao de Agravos de Notificacao |
| CNES | CNES | Cadastro Nacional de Estabelecimentos de Saude |

---

## 6. Granularidade Geografica

### 6.1 Principio geral

O dashboard opera em **tres niveis geograficos** dentro de um unico dashboard por modulo (NAO em tres dashboards separados). Um seletor de nivel geografico controla o que e exibido. Os tres niveis sao:

| Nivel | Descricao | Volume de dados | Observacoes |
|---|---|---|---|
| Brasil | Series temporais nacionais, comparacao entre regioes | Dezenas de linhas por indicador | Sempre disponivel |
| UF | Comparacao entre estados, series por UF | Centenas de linhas por indicador | Sempre disponivel |
| Municipal | Comparacao entre municipios de uma UF selecionada | Milhares de linhas por indicador | Disponivel quando a fonte permite (ex: SIM sim, Vigitel nao) |

### 6.2 Regras para o nivel municipal

O nivel municipal apresenta desafios estatisticos que devem ser tratados no pre-processamento:

1. **Suavizacao trienal obrigatoria:** taxas municipais devem ser calculadas como medias de trienios (3 anos consecutivos), nao de anos isolados. Municipios pequenos produzem taxas extremamente instaveis ano a ano.

2. **Filtro de populacao:** o dashboard deve oferecer ao usuario a opcao de filtrar municipios por populacao minima (ex: > 10.000, > 50.000, > 100.000 habitantes). O valor padrao deve ser > 10.000.

3. **Selecao por UF obrigatoria:** o usuario primeiro seleciona uma UF e entao ve os municipios daquela UF. Nunca exibir os 5.570 municipios simultaneamente.

4. **Nem todo modulo tem nivel municipal:** o Vigitel, por exemplo, so tem dados de capitais. A PNS tem representatividade por UF, nao por municipio. Indicar claramente no dashboard quando o nivel municipal nao esta disponivel.

### 6.3 Impacto na arquitetura de dados

Cada modulo gera **CSVs separados por nivel geografico**:

| Arquivo | Conteudo | Tamanho tipico |
|---|---|---|
| `brasil.csv` | Agregacoes nacionais e por regiao | < 100 KB |
| `uf.csv` | Agregacoes por UF | < 500 KB |
| `municipal.csv` | Agregacoes por municipio (trienios) | 1-5 MB |

O CSV municipal e o maior, mas como contem dados ja agregados em trienios, permanece dentro dos limites aceitaveis para um site estatico.

### 6.4 Nivel geografico e crosstalk

Cada nivel geografico constitui uma **aba principal** do dashboard (ver secao 8). Dentro de cada aba de nivel geografico, as desagregacoes sao apresentadas em sub-abas (ver secao 7). Os filtros crosstalk operam dentro de cada nivel.

---

## 7. Arquitetura de Interatividade e Principios de Visualizacao de Dados

Esta secao define as decisoes de design que regem toda a interatividade do dashboard. Claude Code deve segui-las rigorosamente.

### 7.1 Principio fundamental: separacao entre desagregacoes

> **"Geral" nao e uma desagregacao -- e a ausencia de desagregacao.**

Cada tipo de desagregacao (sexo, raca/cor, faixa etaria) produz um grafico com numero diferente de categorias, escalas diferentes, e por vezes ate tipos de grafico diferentes. Forcar todas num unico grafico com dropdown cria confusao visual e conceitual.

A melhor pratica em dataviz epidemiologica (seguida pelo Global Burden of Disease/IHME, Our World in Data, e paineis da OMS) e: **abas (tabs) para alternar entre desagregacoes, filtros interativos dentro de cada aba.**

### 7.2 Mecanismo de abas: Quarto tabset panels

As desagregacoes sao apresentadas em **tabset panels nativos do Quarto**. Isso nao requer nenhuma dependencia extra, nenhum JavaScript customizado, e e semanticamente correto.

Exemplo de estrutura para um indicador:

```
+-------------------------------------------------------------+
| [Visao Geral]  [Por Sexo]  [Por Raca/Cor]  [Por Idade]     |  <- abas Quarto
+-------------------------------------------------------------+
|                                                             |
|  Filtro: [Selecione UF v]   Filtro: [Periodo v]            |  <- crosstalk
|                                                             |
|  +--------------------------------------+                   |
|  |         grafico plotly               |                   |
|  |    (otimizado para esta aba)         |                   |
|  +--------------------------------------+                   |
|                                                             |
|  +--------------------------------------+                   |
|  |    tabela reactable                  |                   |  <- sincronizada
|  |    (mesmos filtros)                  |                   |     via crosstalk
|  +--------------------------------------+                   |
|                                                             |
+-------------------------------------------------------------+
```

### 7.3 Mecanismo de filtros: crosstalk

O `crosstalk` e o unico mecanismo de filtragem interativa do dashboard. Ele conecta graficos plotly e tabelas reactable/DT, permitindo que o usuario filtre por UF, periodo, municipio etc., e todos os widgets reajam simultaneamente.

O crosstalk opera por **filtragem de linhas** de um `SharedData` compartilhado. Todas as categorias de uma desagregacao (ex: "masculino" e "feminino") sao linhas do mesmo dataframe, e o crosstalk mostra/esconde linhas conforme os filtros.

**Padrao de implementacao no .qmd:**

```r
# dentro de um chunk R do .qmd
library(crosstalk)
library(plotly)
library(reactable)

# ler dados ja agregados
dados_uf <- read_csv("data/mortalidade/uf.csv")

# criar SharedData para a aba "Por Sexo"
sd_sexo <- SharedData$new(
  dados_uf |> filter(desagregacao == "sexo"),
  key = ~id_linha  # identificador unico por linha
)

# filtro crosstalk
filter_select("filtro_uf", "Selecione a UF:", sd_sexo, ~uf)

# grafico plotly conectado ao SharedData
plot_ly(sd_sexo, x = ~ano, y = ~taxa_1000, color = ~categoria,
        type = "scatter", mode = "lines") |>
  layout_padrao(titulo = "Taxa de mortalidade por sexo",
                eixo_x = "Ano", eixo_y = "por 1.000 hab.")

# tabela reactable conectada ao mesmo SharedData
reactable(sd_sexo, columns = list(...))
```

### 7.4 O que NAO usar para interatividade

| Tecnologia | Razao para NAO usar |
|---|---|
| Shiny | Requer servidor. O site e estatico. |
| Observable JS | Adiciona complexidade desnecessaria; crosstalk resolve o caso. |
| plotly `updatemenus` | Desnecessario; as abas do Quarto substituem essa funcao de forma mais limpa. |
| JavaScript customizado | Dificil de manter; crosstalk e abas Quarto sao suficientes. |

### 7.5 Cada aba e otimizada para sua desagregacao

Este e um principio central de dataviz: o tipo de grafico deve ser adequado ao numero e natureza das categorias. NAO usar o mesmo tipo de grafico para todas as abas mecanicamente.

Diretrizes por tipo de desagregacao:

| Aba | Categorias tipicas | Tipo de grafico recomendado |
|---|---|---|
| Visao Geral | 1 serie (ou 5 regioes) | Line chart limpo, serie temporal |
| Por Sexo | 2 categorias | Line chart com 2 linhas contrastantes |
| Por Raca/Cor | 5 categorias | Line chart com 5 linhas OU small multiples (facets) |
| Por Faixa Etaria | 10-18 categorias | Heatmap (ano x faixa, cor = taxa) -- linhas sobrepostas seriam ilegíveis |

Claude Code deve avaliar o numero de categorias ao construir cada aba e escolher o tipo de grafico mais legivel. **Se uma desagregacao tem mais de 6 categorias, NAO usar line chart com linhas sobrepostas.** Preferir heatmap, small multiples, ou graficos de barras facetados.

### 7.6 Hierarquia completa de abas (niveis geograficos + desagregacoes)

A estrutura completa de abas para um modulo como mortalidade e:

```
Nivel 1 (abas principais): nivel geografico
  [Brasil]  [Por UF]  [Por Municipio]

Nivel 2 (sub-abas dentro de cada nivel): desagregacao
  [Visao Geral]  [Por Sexo]  [Por Raca/Cor]  [Por Idade]
```

Na sintaxe Quarto, isso se implementa como tabsets aninhados:

```markdown
::: {.panel-tabset}

## Brasil

::: {.panel-tabset}

### Visao Geral
[grafico + tabela com filtros crosstalk]

### Por Sexo
[grafico + tabela com filtros crosstalk]

### Por Raca/Cor
[grafico + tabela com filtros crosstalk]

### Por Faixa Etaria
[grafico + tabela com filtros crosstalk]

:::

## Por UF

::: {.panel-tabset}

### Visao Geral
[grafico + tabela com filtros crosstalk -- inclui seletor de UF]

### Por Sexo
[grafico + tabela com filtros crosstalk -- inclui seletor de UF]

...

:::

## Por Municipio

::: {.panel-tabset}

### Visao Geral
[grafico + tabela com filtros crosstalk -- inclui seletor de UF + filtro de populacao]

...

:::

:::
```

### 7.7 Nota sobre a aba "Visao Geral"

A aba "Visao Geral" e a **ausencia de desagregacao**, nao uma desagregacao chamada "geral". Ela mostra o indicador agregado (total), sem quebra por sexo, raca/cor ou idade. No nivel Brasil, mostra a serie temporal nacional (podendo comparar regioes). No nivel UF, mostra a serie temporal da UF selecionada. No nivel municipal, mostra o ranking de municipios da UF selecionada.

A aba "Visao Geral" e sempre a **primeira aba** (aba default).

---

## 8. Especificacoes Visuais

### 8.1 Paleta de cores

Usar paleta em tons de **azul e cinza**, consistente com o restante do site.

```r
# paleta padrao do dashboard
cores_dashboard <- list(
  primaria     = "#2563EB",
  secundaria   = "#64748B",
  sucesso      = "#16A34A",
  alerta       = "#EAB308",
  perigo       = "#DC2626",
  fundo        = "#F8FAFC",
  texto        = "#1E293B",
  gradiente    = c("#DBEAFE", "#3B82F6", "#1E3A8A")
)

# paleta para regioes brasileiras (usada no nivel Brasil)
cores_regioes <- c(
  "Norte"        = "#22C55E",
  "Nordeste"     = "#EAB308",
  "Sudeste"      = "#3B82F6",
  "Sul"          = "#8B5CF6",
  "Centro-Oeste" = "#F97316"
)

# paleta para sexo (usada na aba Por Sexo)
cores_sexo <- c(
  "masculino" = "#3B82F6",
  "feminino"  = "#EC4899"
)

# paleta para raca/cor (usada na aba Por Raca/Cor)
# usar paleta com bom contraste e acessibilidade
cores_raca <- c(
  "branca"   = "#3B82F6",
  "preta"    = "#1E293B",
  "parda"    = "#F59E0B",
  "amarela"  = "#10B981",
  "indigena" = "#8B5CF6"
)
```

### 8.2 Padroes de graficos plotly

Todos os graficos devem seguir estas convencoes:

```r
# tema base para plotly
layout_padrao <- function(p, titulo = NULL, eixo_x = NULL, eixo_y = NULL) {
  p |>
    plotly::layout(
      title = list(
        text = titulo,
        font = list(size = 16, color = "#1E293B")
      ),
      xaxis = list(
        title = eixo_x,
        gridcolor = "#E2E8F0",
        zerolinecolor = "#CBD5E1"
      ),
      yaxis = list(
        title = eixo_y,
        gridcolor = "#E2E8F0",
        zerolinecolor = "#CBD5E1"
      ),
      plot_bgcolor = "#FFFFFF",
      paper_bgcolor = "#F8FAFC",
      font = list(family = "system-ui, sans-serif", color = "#1E293B"),
      hoverlabel = list(
        bgcolor = "#1E293B",
        font = list(color = "#FFFFFF", size = 12)
      ),
      margin = list(t = 60, b = 60, l = 60, r = 40)
    )
}
```

### 8.3 Formato de eixos

- **Eixo Y numerico:** sempre usar 1 casa decimal para consistencia. Usar `tickformat = ".1f"` em plotly.
- **Eixo X temporal:** formato "YYYY" para dados anuais. Para trienios: "YYYY-YYYY".
- **Tooltip:** incluir nome do local (pais/UF/municipio), valor do indicador com unidade, e ano/periodo.

### 8.4 Responsividade

Os graficos plotly devem ser responsivos. No YAML do `.qmd`:

```yaml
format:
  html:
    page-layout: full
```

---

## 9. Modulos do Dashboard -- Especificacao Detalhada

### 9.0 Ordem de desenvolvimento (prioridade)

Desenvolver nesta ordem, comecando pelos modulos com dados menores para validar o workflow:

1. **Imunizacao (SI-PNI)** -- dados menores, ja tabulados
2. **Vigitel** -- dados menores, series temporais desde 2006
3. **Mortalidade (SIM)** -- dados volumosos, mas alto valor analitico
4. **Mortalidade Materno-Infantil (SIM + SINASC)** -- derivado do modulo anterior
5. **Natalidade (SINASC)** -- complemento do anterior
6. **Morbidade Hospitalar (SIH)** -- dados volumosos
7. **Doencas de Notificacao (SINAN)** -- multiplas doencas
8. **Saude Mental** -- integracao de multiplas fontes
9. **PNS** -- inquerito populacional

> Claude Code: implemente **um modulo de cada vez**. Comece pelo modulo 1 (Imunizacao) e so avance para o proximo quando o anterior estiver completo e validado.

### 9.1 Estrutura padrao de dados para TODOS os modulos

Todo modulo que suporta desagregacoes deve organizar seus CSVs no formato **long**, com colunas padronizadas para permitir o uso uniforme de crosstalk e tabsets.

**Colunas obrigatorias em todo CSV de nivel UF e municipal:**

| Coluna | Tipo | Descricao |
|---|---|---|
| ano | integer | Ano de referencia (ou ano central do trienio para municipal) |
| periodo | character | "2020" para dados anuais, "2019-2021" para trienios |
| nivel_geo | character | "brasil", "regiao", "uf", "municipio" |
| cod_local | character | Codigo IBGE do local |
| nome_local | character | Nome legivel do local |
| uf | character | Sigla da UF (para filtragem no nivel municipal) |
| regiao | character | Regiao (Norte, Nordeste, etc.) |
| populacao | integer | Populacao do local no ano/periodo |
| desagregacao | character | "geral", "sexo", "raca_cor", "faixa_etaria" |
| categoria | character | Valor da desagregacao: "total", "masculino", "branca", "0-4", etc. |

**Colunas especificas do indicador** (variam por modulo):

| Coluna | Tipo | Descricao |
|---|---|---|
| numerador | integer | Contagem bruta (obitos, doses, internacoes, etc.) |
| denominador | integer | Denominador (populacao, nascidos vivos, etc.) |
| taxa | numeric | Indicador calculado (taxa, proporcao, razao) |
| unidade | character | "por 1.000 hab.", "%", "por 100.000 NV", etc. |

**Exemplo de dados para mortalidade (taxa de mortalidade geral), nivel UF:**

```
ano,periodo,nivel_geo,cod_local,nome_local,uf,regiao,populacao,desagregacao,categoria,numerador,denominador,taxa,unidade
2023,2023,uf,35,Sao Paulo,SP,Sudeste,44000000,geral,total,290000,44000000,6.6,por 1.000 hab.
2023,2023,uf,35,Sao Paulo,SP,Sudeste,21500000,sexo,masculino,155000,21500000,7.2,por 1.000 hab.
2023,2023,uf,35,Sao Paulo,SP,Sudeste,22500000,sexo,feminino,135000,22500000,6.0,por 1.000 hab.
2023,2023,uf,35,Sao Paulo,SP,Sudeste,30000000,raca_cor,branca,180000,30000000,6.0,por 1.000 hab.
2023,2023,uf,35,Sao Paulo,SP,Sudeste,5000000,raca_cor,preta,42000,5000000,8.4,por 1.000 hab.
...
```

Este formato permite que o crosstalk filtre por `desagregacao` (via tabsets), por `uf` (via filter_select), e por `ano` (via filter_slider), tudo de forma uniforme entre modulos.

---

### 9.2 Modulo: Imunizacao (SI-PNI)

**Fonte:** SI-PNI (Sistema de Informacoes do Programa Nacional de Imunizacoes)
**Niveis geograficos disponiveis:** Brasil, UF, Municipal

#### Indicadores a calcular

| ID | Indicador | Formula | Unidade |
|---|---|---|---|
| IMU-01 | Cobertura vacinal | (doses aplicadas / populacao-alvo) x 100 | % |
| IMU-02 | Taxa de abandono vacinal | ((dose 1 - ultima dose) / dose 1) x 100 | % |
| IMU-03 | Homogeneidade da cobertura | (municipios com cobertura >= meta / total) x 100 | % |

#### Imunobiologicos prioritarios

BCG, Pentavalente, Poliomielite (VIP/VOP), Triplice viral, Febre amarela, HPV, COVID-19 (se disponivel).

#### Desagregacoes disponiveis

Este modulo tem uma particularidade: a "desagregacao" principal e por **imunobiologico**, nao por sexo/raca/idade. Portanto, as abas de desagregacao sao:

- Visao Geral (todos os imunobiologicos, grafico comparativo)
- Por Imunobiologico (seletor de imunobiologico via crosstalk)

#### Visualizacoes por nivel e aba

**Brasil > Visao Geral:** heatmap (imunobiologico x ano, cor = cobertura), com linha de meta.
**Brasil > Por Imunobiologico:** line chart com serie temporal da cobertura, com linha de meta (95%).
**Por UF > Visao Geral:** mapa coropletico (cobertura por UF, ultimo ano), seletor de imunobiologico.
**Por UF > Por Imunobiologico:** ranking de barras horizontais das UFs.
**Por Municipio:** ranking de municipios da UF selecionada (barras), com filtro de populacao.

---

### 9.3 Modulo: Vigitel

**Fonte:** Vigitel (dados disponiveis de 2006 em diante, apenas capitais brasileiras)
**Niveis geograficos disponiveis:** Brasil (agregado de capitais), Capitais (NAO tem nivel municipal)

> ATENCAO: o Vigitel NAO tem dados municipais. O nivel mais granular e por capital. O CSV `municipal.csv` NAO deve ser gerado para este modulo.

#### Indicadores a calcular

| ID | Indicador | Unidade |
|---|---|---|
| VIG-01 | Prevalencia de tabagismo | % |
| VIG-02 | Consumo abusivo de alcool | % |
| VIG-03 | Excesso de peso (IMC >= 25) | % |
| VIG-04 | Obesidade (IMC >= 30) | % |
| VIG-05 | Inatividade fisica | % |
| VIG-06 | Consumo regular de frutas e hortalicas | % |
| VIG-07 | Hipertensao autorreferida | % |
| VIG-08 | Diabetes autorreferida | % |
| VIG-09 | Realizacao de mamografia (>= 50 anos) | % |
| VIG-10 | Realizacao de Papanicolau (25-64 anos) | % |

#### Desagregacoes disponiveis

- Visao Geral (serie temporal do indicador selecionado, total)
- Por Sexo (masculino, feminino)

O indicador especifico e selecionado via filtro crosstalk (nao via aba), pois todos tem a mesma estrutura visual.

#### Visualizacoes

**Brasil > Visao Geral:** line chart, serie temporal de cada indicador, por regiao.
**Brasil > Por Sexo:** line chart, 2 linhas (M/F), seletor de indicador.
**Por Capital:** ranking de barras das 27 capitais, seletor de indicador e ano.

---

### 9.4 Modulo: Mortalidade (SIM)

**Fonte:** SIM -- Sistema de Informacoes sobre Mortalidade
**Niveis geograficos disponiveis:** Brasil, UF, Municipal

Este e o modulo mais completo e serve como **referencia de implementacao** para os demais.

#### Indicadores a calcular

| ID | Indicador | Formula | Unidade |
|---|---|---|---|
| MOR-01 | Taxa de mortalidade geral | (obitos / populacao) x 1.000 | por 1.000 hab. |
| MOR-02 | Taxa de mortalidade especifica por causa | (obitos por causa / populacao) x 100.000 | por 100.000 hab. |
| MOR-03 | Mortalidade proporcional por grupo de causas | (obitos por grupo / total obitos) x 100 | % |
| MOR-04 | Indicador de Swaroop-Uemura | (obitos >= 50 anos / total obitos) x 100 | % |
| MOR-05 | Mortalidade prematura por DCNT (30-69 anos) | (obitos DCNT 30-69 / pop 30-69) x 100.000 | por 100.000 hab. |
| MOR-06 | Anos potenciais de vida perdidos (APVP) | somatorio(70 - idade ao obito), para obitos < 70 | anos |

#### Grupos de causas CID-10 prioritarios

- Doencas do aparelho circulatorio (Cap. IX: I00-I99)
- Neoplasias (Cap. II: C00-D48)
- Causas externas (Cap. XX: V01-Y98)
- Doencas do aparelho respiratorio (Cap. X: J00-J99)
- Doencas endocrinas/diabetes (Cap. IV: E00-E90)
- Doencas infecciosas e parasitarias (Cap. I: A00-B99)

#### Desagregacoes disponiveis

- Visao Geral (total, sem quebra)
- Por Sexo (masculino, feminino)
- Por Raca/Cor (branca, preta, parda, amarela, indigena)
- Por Faixa Etaria (0-4, 5-9, 10-14, 15-19, 20-29, 30-39, 40-49, 50-59, 60-69, 70-79, 80+)

#### Estrutura completa de abas para este modulo

```
[Brasil]  [Por UF]  [Por Municipio]
   |
   +-- [Visao Geral]: line chart, serie temporal BR, comparacao entre regioes
   +-- [Por Sexo]: line chart, 2 linhas (M/F)
   +-- [Por Raca/Cor]: line chart com 5 linhas OU small multiples
   +-- [Por Faixa Etaria]: HEATMAP (ano x faixa, cor = taxa) -- NAO line chart

[Por UF]
   |
   +-- [Visao Geral]: line chart da UF selecionada (filtro crosstalk)
   |                   OU ranking de barras horizontais de todas UFs
   +-- [Por Sexo]: line chart, 2 linhas, UF selecionada
   +-- [Por Raca/Cor]: line chart 5 linhas OU small multiples, UF selecionada
   +-- [Por Faixa Etaria]: heatmap, UF selecionada

[Por Municipio]
   |
   +-- [Visao Geral]: ranking de barras dos municipios da UF selecionada (trienio)
   |                   + filtro de populacao minima
   +-- [Por Sexo]: ranking de barras por municipio, M e F lado a lado
   +-- [Por Raca/Cor]: ranking de barras por municipio
   +-- [Por Faixa Etaria]: heatmap (municipio x faixa, cor = taxa)
```

#### Visualizacoes adicionais (presentes em todas as abas de nivel)

Alem dos graficos de taxa de mortalidade geral acima, este modulo inclui:

1. **Stacked area chart:** mortalidade proporcional por grupo de causas ao longo do tempo (transicao epidemiologica). Presente apenas no nivel Brasil, aba Visao Geral.
2. **Mapa coropletico:** taxa de mortalidade especifica por causa selecionada (ultimo ano). Presente no nivel Por UF, aba Visao Geral.
3. **Tabela resumo:** presente em todas as abas, sincronizada via crosstalk.

---

### 9.5 Modulo: Mortalidade Materno-Infantil (SIM + SINASC)

**Fontes:** SIM + SINASC
**Niveis geograficos disponiveis:** Brasil, UF, Municipal

#### Indicadores a calcular

| ID | Indicador | Formula | Unidade |
|---|---|---|---|
| MMI-01 | Razao de mortalidade materna | (obitos maternos / NV) x 100.000 | por 100.000 NV |
| MMI-02 | Taxa de mortalidade infantil | (obitos < 1 ano / NV) x 1.000 | por 1.000 NV |
| MMI-03 | TMI neonatal precoce | (obitos 0-6 dias / NV) x 1.000 | por 1.000 NV |
| MMI-04 | TMI neonatal tardia | (obitos 7-27 dias / NV) x 1.000 | por 1.000 NV |
| MMI-05 | TMI pos-neonatal | (obitos 28-364 dias / NV) x 1.000 | por 1.000 NV |
| MMI-06 | Taxa de mortalidade < 5 anos | (obitos < 5 anos / NV) x 1.000 | por 1.000 NV |

> NV = nascidos vivos (denominador vem do SINASC).

#### Desagregacoes: sexo, raca/cor.

---

### 9.6 Modulo: Natalidade (SINASC)

**Fonte:** SINASC
**Niveis geograficos disponiveis:** Brasil, UF, Municipal

#### Indicadores a calcular

| ID | Indicador | Formula | Unidade |
|---|---|---|---|
| NAT-01 | Taxa de natalidade | (NV / populacao) x 1.000 | por 1.000 hab. |
| NAT-02 | Proporcao de baixo peso ao nascer | (NV < 2.500g / total NV) x 100 | % |
| NAT-03 | Proporcao de prematuros | (NV < 37 semanas / total NV) x 100 | % |
| NAT-04 | Proporcao de partos cesareos | (cesareas / total partos) x 100 | % |
| NAT-05 | Proporcao de maes adolescentes | (NV maes 10-19 anos / total NV) x 100 | % |
| NAT-06 | Proporcao com 7+ consultas pre-natal | (NV 7+ consultas / total NV) x 100 | % |

#### Desagregacoes: raca/cor, faixa etaria da mae, escolaridade da mae.

---

### 9.7 Modulo: Morbidade Hospitalar (SIH-SUS)

**Fonte:** SIH-SUS
**Niveis geograficos disponiveis:** Brasil, UF, Municipal

#### Indicadores a calcular

| ID | Indicador | Formula | Unidade |
|---|---|---|---|
| SIH-01 | Taxa de internacao por ICSAP | (internacoes ICSAP / populacao) x 10.000 | por 10.000 hab. |
| SIH-02 | Taxa de internacao por grupo de causas | (internacoes por causa / populacao) x 10.000 | por 10.000 hab. |
| SIH-03 | Tempo medio de permanencia | dias totais / internacoes | dias |
| SIH-04 | Taxa de mortalidade hospitalar | (obitos hospitalares / internacoes) x 100 | % |
| SIH-05 | Custo medio por internacao | valor pago / internacoes | R$ |

> ICSAP: usar Lista Brasileira (Portaria SAS/MS n. 221/2008).

#### Desagregacoes: sexo, faixa etaria, grupo de causas CID-10.

---

### 9.8 Modulo: Doencas de Notificacao Compulsoria (SINAN)

**Fonte:** SINAN
**Niveis geograficos disponiveis:** Brasil, UF, Municipal

#### Indicadores a calcular

| ID | Indicador | Doencas | Unidade |
|---|---|---|---|
| SIN-01 | Taxa de incidencia | Dengue, TB, hanseniase, sifilis congenita, HIV/AIDS, hepatites | por 100.000 hab. |
| SIN-02 | Taxa de deteccao de hanseniase | Hanseniase | por 100.000 hab. |
| SIN-03 | Taxa de incidencia de TB | Tuberculose | por 100.000 hab. |
| SIN-04 | Taxa de cura de TB | Tuberculose | % |
| SIN-05 | Taxa de incidencia de sifilis congenita | Sifilis congenita | por 1.000 NV |
| SIN-06 | Taxa de incidencia de dengue | Dengue (+ semana epidemiologica) | por 100.000 hab. |

#### Desagregacoes: sexo, faixa etaria, raca/cor (conforme disponibilidade por doenca).

---

### 9.9 Modulo: Saude Mental

**Fontes:** SIM + SIH + SINAN + CNES
**Niveis geograficos disponiveis:** Brasil, UF (municipal limitado)

#### Indicadores a calcular

| ID | Indicador | Fonte | Unidade |
|---|---|---|---|
| SM-01 | Taxa de mortalidade por suicidio (CID X60-X84) | SIM | por 100.000 hab. |
| SM-02 | Taxa de internacoes psiquiatricas | SIH | por 10.000 hab. |
| SM-03 | Notificacoes de violencia autoprovocada | SINAN | contagem e taxa |
| SM-04 | Cobertura de CAPS por habitante | CNES | CAPS por 100.000 hab. |

#### Desagregacoes: sexo, faixa etaria.

---

### 9.10 Modulo: PNS (Pesquisa Nacional de Saude)

**Fonte:** PNS (IBGE)
**Niveis geograficos disponiveis:** Brasil, UF (NAO tem nivel municipal)

#### Indicadores a calcular

| ID | Indicador | Unidade |
|---|---|---|
| PNS-01 | Autoavaliacao do estado de saude (ruim/muito ruim) | % |
| PNS-02 | Cobertura de plano de saude | % |
| PNS-03 | Acesso a servicos de saude | % |
| PNS-04 | Prevalencia de depressao (PHQ-9) | % |
| PNS-05 | Acesso a tratamento odontologico | % |
| PNS-06 | Prevalencia de limitacao funcional | % |

#### Desagregacoes: sexo, faixa etaria, raca/cor, escolaridade.

---

## 10. Estrutura das Paginas .qmd do Dashboard

### 10.1 Pagina de entrada (`dashboard/index.qmd`)

Uma pagina hub que lista todos os modulos disponiveis com cards visuais, breve descricao, e link para cada modulo. Estilo clean, academico.

```yaml
---
title: "Dashboard de Saude Publica do Brasil"
subtitle: "Indicadores epidemiologicos a partir de dados oficiais do Ministerio da Saude e IBGE"
---
```

### 10.2 Template de um modulo (`dashboard/[modulo].qmd`)

```yaml
---
title: "[Nome do Modulo]"
subtitle: "[Fonte dos dados]"
format:
  html:
    page-layout: full
    toc: true
    toc-depth: 2
    code-fold: true
    code-summary: "Ver codigo"
---
```

### 10.3 Estrutura interna de cada modulo

Cada modulo segue esta estrutura sequencial:

1. **Resumo metodologico** (1 paragrafo): fonte dos dados, periodo, notas sobre limitacoes.
2. **Value boxes / KPIs** no topo: 3-4 indicadores-chave do ultimo ano disponivel (usando Quarto value boxes).
3. **Tabset de nivel geografico** (nivel 1):
   - Aba Brasil
   - Aba Por UF
   - Aba Por Municipio (quando disponivel)
4. **Dentro de cada aba de nivel, tabset de desagregacao** (nivel 2):
   - Aba Visao Geral (sempre primeira/default)
   - Aba Por Sexo
   - Aba Por Raca/Cor
   - Aba Por Faixa Etaria
   - (outras conforme o modulo)
5. **Dentro de cada aba de desagregacao:**
   - Filtros crosstalk (filter_select para UF, filter_slider para ano)
   - Grafico plotly conectado ao SharedData
   - Tabela reactable conectada ao mesmo SharedData
6. **Notas tecnicas** (no final, fora dos tabsets): definicoes, limitacoes, referencias.

### 10.4 Exemplo concreto de implementacao (mortalidade.qmd)

```markdown
---
title: "Mortalidade"
subtitle: "Sistema de Informacoes sobre Mortalidade (SIM)"
format:
  html:
    page-layout: full
    toc: true
    toc-depth: 2
    code-fold: true
    code-summary: "Ver codigo"
---

[paragrafo metodologico]

[value boxes com KPIs]

::: {.panel-tabset}

## Brasil

```{r}
#| label: setup-brasil
#| echo: false
library(crosstalk)
library(plotly)
library(reactable)
library(readr)
library(dplyr)
source("_viz_utils.R")

dados_brasil <- read_csv("data/mortalidade/brasil.csv")
```

::: {.panel-tabset}

### Visao Geral

```{r}
#| label: brasil-geral
sd_br_geral <- SharedData$new(
  dados_brasil |> filter(desagregacao == "geral")
)

filter_slider("ano_br_g", "Periodo:", sd_br_geral, ~ano, width = "100%")

plot_ly(sd_br_geral, x = ~ano, y = ~taxa, color = ~regiao,
        colors = cores_regioes,
        type = "scatter", mode = "lines+markers") |>
  layout_padrao(
    titulo = "Taxa de mortalidade geral por regiao",
    eixo_x = "Ano",
    eixo_y = "por 1.000 hab."
  )

reactable(sd_br_geral, ...)
```

### Por Sexo

```{r}
#| label: brasil-sexo
sd_br_sexo <- SharedData$new(
  dados_brasil |> filter(desagregacao == "sexo")
)

filter_slider("ano_br_s", "Periodo:", sd_br_sexo, ~ano, width = "100%")

plot_ly(sd_br_sexo, x = ~ano, y = ~taxa, color = ~categoria,
        colors = cores_sexo,
        type = "scatter", mode = "lines+markers") |>
  layout_padrao(
    titulo = "Taxa de mortalidade geral por sexo",
    eixo_x = "Ano",
    eixo_y = "por 1.000 hab."
  )

reactable(sd_br_sexo, ...)
```

### Por Raca/Cor

[mesmo padrao, com cores_raca]

### Por Faixa Etaria

```{r}
#| label: brasil-idade
# HEATMAP -- NAO line chart (muitas categorias)
sd_br_idade <- SharedData$new(
  dados_brasil |> filter(desagregacao == "faixa_etaria")
)

plot_ly(sd_br_idade, x = ~ano, y = ~categoria, z = ~taxa,
        type = "heatmap",
        colorscale = list(c(0, "#DBEAFE"), c(1, "#1E3A8A"))) |>
  layout_padrao(
    titulo = "Taxa de mortalidade por faixa etaria",
    eixo_x = "Ano",
    eixo_y = "Faixa etaria"
  )
```

:::

## Por UF

[mesmo padrao, com filter_select para UF via crosstalk]

## Por Municipio

[mesmo padrao, com filter_select para UF + filter_select para populacao minima]

:::

[notas tecnicas no final]
```

> **ATENCAO, Claude Code:** o exemplo acima e ilustrativo. Os nomes exatos dos parametros do plotly e crosstalk devem ser verificados na documentacao oficial. O principio e: tabsets Quarto para nivel geografico e desagregacoes, crosstalk para filtros interativos dentro de cada aba, plotly para graficos, reactable para tabelas.

---

## 11. Dados Populacionais (Denominadores)

Varios indicadores requerem denominadores populacionais (populacao por UF, ano, sexo, faixa etaria, municipio).

### 11.1 Estrategia para obter dados populacionais

**Verificar nesta ordem:**

1. O `healthbR` ja fornece dados populacionais? Se sim, usar.
2. Caso contrario, usar o pacote `sidrar` para acessar dados do IBGE via API SIDRA.
3. Caso contrario, usar o pacote `brpop` que contem estimativas populacionais do IBGE.
4. Ultima alternativa: baixar manualmente do IBGE e incluir como CSV na pasta `data-prep/populacao/`.

### 11.2 Niveis populacionais necessarios

| Nivel | Desagregacoes necessarias | Fonte preferencial |
|---|---|---|
| Brasil/Regiao | ano, sexo, faixa etaria, raca/cor | IBGE estimativas |
| UF | ano, sexo, faixa etaria, raca/cor | IBGE estimativas |
| Municipal | ano (populacao total e por sexo) | IBGE estimativas municipais |

> Nota: estimativas municipais por raca/cor e faixa etaria podem nao estar disponiveis para todos os anos. Nesse caso, usar apenas populacao total do municipio para calcular taxas brutas.

---

## 12. Checklist de Validacao (para cada modulo)

Antes de considerar um modulo pronto, verificar:

- [ ] Script `prep_*.R` executa sem erros
- [ ] CSVs gerados (`brasil.csv`, `uf.csv`, `municipal.csv`) tem as colunas padronizadas (secao 9.1)
- [ ] Nenhum CSV excede 5 MB (ideal: < 1 MB para brasil e uf, < 5 MB para municipal)
- [ ] Nenhuma coluna tem mais de 5% de `NA` sem explicacao
- [ ] UFs conferem com a lista oficial de 27 UFs
- [ ] Series temporais nao tem "buracos" inexplicados
- [ ] Taxas e proporcoes estao em faixas plausíveis (ex: TMI entre 5 e 50 por 1.000 NV)
- [ ] Dados municipais usam trienios (nao anos isolados)
- [ ] Pagina `.qmd` renderiza sem erros
- [ ] Tabsets de nivel geografico funcionam (Brasil / UF / Municipal)
- [ ] Tabsets de desagregacao funcionam (Visao Geral / Sexo / Raca / Idade)
- [ ] Filtros crosstalk funcionam e sincronizam grafico + tabela
- [ ] Aba "Por Faixa Etaria" usa heatmap (NAO line chart)
- [ ] Graficos plotly sao interativos e responsivos
- [ ] Tooltips mostram informacao correta
- [ ] Paleta de cores segue o padrao definido
- [ ] Codigo R nos chunks esta com `code-fold: true`

---

## 13. Workflow de Atualizacao de Dados

Quando o Ministerio da Saude publicar dados novos:

```bash
# 1. rodar script(s) de preparacao relevante(s)
# no R console:
source("data-prep/prep_imunizacao.R")

# 2. verificar CSVs gerados
# inspecionar visualmente dashboard/data/imunizacao/

# 3. renderizar o site
babelquarto::render_website(".")

# 4. preview local
servr::httw("_site")

# 5. publicar
# no terminal:
quarto publish gh-pages
```

---

## 14. Dependencias R do Projeto

Instalar todas as dependencias antes de comecar:

```r
install.packages(c(
  # dados
  "healthbR",

  # manipulacao
  "dplyr",
  "tidyr",
  "readr",
  "stringr",
  "janitor",
  "slider",        # para suavizacao trienal (slide_dbl)

  # visualizacao e interatividade
  "plotly",
  "crosstalk",     # interatividade sem servidor
  "reactable",     # tabelas interativas (preferencial)
  "DT",            # tabelas interativas (alternativa)
  "scales",

  # website
  "babelquarto",
  "servr",

  # auxiliares
  "jsonlite",
  "geojsonsf"      # para mapas coropleticos
))

# verificar se ja estao instalados
# (o sidrar e brpop podem ser necessarios para dados populacionais)
# install.packages("sidrar")
# install.packages("brpop")
```

---

## 15. Resumo de Decisoes Ja Tomadas (NAO renegociar)

| Decisao | Valor | Justificativa |
|---|---|---|
| Hospedagem | GitHub Pages (estatico) | Ja existe, gratuito |
| Framework | Quarto + babelquarto | Ja em uso no site |
| Pacote de dados | healthbR | Desenvolvido pelo proprio Sidney |
| Arquitetura de dados | Pre-processamento desacoplado | Performance e modularidade |
| Formato de dados intermediarios | CSV (formato long padronizado) | Legivel, leve, versionavel, compativel com crosstalk |
| Niveis geograficos | Brasil + UF + Municipal (em um unico dashboard) | Cobertura completa sem fragmentacao |
| Dados municipais | Trienios (media de 3 anos) + filtro de populacao | Estabilidade estatistica |
| Desagregacoes | Tabset panels do Quarto (abas nativas) | Cada desagregacao e otimizada visualmente |
| Filtros interativos | crosstalk (SharedData + filter_select/slider) | Funciona em site estatico, sem servidor |
| Visualizacoes | plotly (conectado ao crosstalk) | Interatividade no navegador |
| Tabelas | reactable (conectado ao crosstalk) | Sincronizacao com graficos |
| Faixa etaria (muitas categorias) | Heatmap, NAO line chart | Legibilidade com 10+ categorias |
| "Visao Geral" | E a primeira aba (ausencia de desagregacao), NAO uma categoria chamada "total" | Correcao conceitual |
| Idioma principal | Portugues | Publico-alvo brasileiro |
| Paleta de cores | Azul e cinza (com paletas especificas por desagregacao) | Consistencia e acessibilidade |
| Pipe | `\|>` nativo | Convencao do Sidney |
| Estilo de codigo | Tidyverse, snake_case, comentarios minusculos | Convencao do Sidney |
| Ordem de desenvolvimento | Imunizacao primeiro, depois Vigitel | Validar workflow com dados menores |

---

## 16. O que Claude Code NAO deve fazer

1. **NAO inventar nomes de funcoes** do healthbR. Consultar `help(package = "healthbR")` antes.
2. **NAO usar Shiny.** O site e estatico.
3. **NAO usar Observable JS.** A decisao e usar crosstalk + plotly.
4. **NAO usar `plotly::updatemenus`** para alternar desagregacoes. Usar tabset panels do Quarto.
5. **NAO colocar download de dados nos arquivos .qmd.** Dados sao pre-processados nos scripts `prep_*.R`.
6. **NAO criar bancos de dados SQLite ou similares.** Usar CSV como formato intermediario.
7. **NAO alterar a estrutura existente do site** (paginas fora do dashboard).
8. **NAO usar `%>%`** (magrittr). Usar `|>` (pipe nativo).
9. **NAO usar emojis** em codigo ou documentacao.
10. **NAO commitar dados brutos** (gigabytes) no git. Apenas CSVs agregados.
11. **NAO avancar para o proximo modulo** sem validar o anterior com Sidney.
12. **NAO usar line chart para desagregacoes com mais de 6 categorias.** Usar heatmap ou small multiples.
13. **NAO tratar "geral/total" como uma desagregacao.** E uma aba separada (Visao Geral = ausencia de desagregacao).
14. **NAO exibir todos os 5.570 municipios simultaneamente.** Sempre filtrar por UF primeiro.
15. **NAO usar dados anuais isolados para municipios.** Obrigatorio usar trienios.
16. **NAO criar um SharedData unico para todas as abas.** Cada aba de desagregacao tem seu proprio SharedData para evitar conflitos de filtros.
