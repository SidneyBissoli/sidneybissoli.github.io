# ibge-br-mcp

MCP Server para APIs do IBGE (Instituto Brasileiro de Geografia e Estatística).

Este servidor implementa o [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) para fornecer acesso às APIs públicas do IBGE, permitindo que assistentes de IA consultem dados geográficos, demográficos e estatísticos do Brasil.

## Ferramentas Disponíveis

### Localidades
| Ferramenta | Descrição |
|:-----------|:----------|
| `ibge_estados` | Lista estados brasileiros com filtro por região |
| `ibge_municipios` | Lista municípios por UF ou busca por nome |
| `ibge_localidade` | Detalhes de uma localidade pelo código IBGE |
| `ibge_geocodigo` | **NOVO** - Decodifica códigos IBGE ou busca por nome |

### Dados Estatísticos (SIDRA)
| Ferramenta | Descrição |
|:-----------|:----------|
| `ibge_sidra` | Consulta tabelas do SIDRA (Censo, PNAD, PIB, etc.) |
| `ibge_sidra_tabelas` | Lista e busca tabelas disponíveis no SIDRA |
| `ibge_sidra_metadados` | Metadados de uma tabela (variáveis, períodos, níveis) |
| `ibge_pesquisas` | Lista pesquisas do IBGE e suas tabelas |

### Indicadores Econômicos e Sociais
| Ferramenta | Descrição |
|:-----------|:----------|
| `ibge_indicadores` | **NOVO** - Indicadores econômicos e sociais (PIB, IPCA, desemprego, etc.) |

### Censos Demográficos
| Ferramenta | Descrição |
|:-----------|:----------|
| `ibge_censo` | Dados dos Censos 1970-2022 (16 temas: população, indígenas, quilombolas, saneamento, etc.) |

### Classificações
| Ferramenta | Descrição |
|:-----------|:----------|
| `ibge_cnae` | CNAE (Classificação Nacional de Atividades Econômicas) |

### Demografia e População
| Ferramenta | Descrição |
|:-----------|:----------|
| `ibge_populacao` | Projeção da população brasileira em tempo real |
| `ibge_nomes` | Frequência e ranking de nomes no Brasil |

### Comparação de Dados
| Ferramenta | Descrição |
|:-----------|:----------|
| `ibge_comparar` | **NOVO** - Compara indicadores entre localidades com ranking e estatísticas |

### Mapas e Geolocalização
| Ferramenta | Descrição |
|:-----------|:----------|
| `ibge_malhas` | Malhas geográficas (GeoJSON, TopoJSON, SVG) |
| `ibge_malhas_tema` | **NOVO** - Malhas temáticas (biomas, Amazônia Legal, semiárido, etc.) |
| `ibge_vizinhos` | **NOVO** - Municípios próximos/vizinhos |

### Dados Externos (BCB e Saúde)
| Ferramenta | Descrição |
|:-----------|:----------|
| `bcb` | **NOVO** - Dados do Banco Central (SELIC, IPCA, câmbio, etc.) |
| `datasaude` | **NOVO** - Indicadores de saúde via IBGE/DataSUS |

### Informações e Calendário
| Ferramenta | Descrição |
|:-----------|:----------|
| `ibge_noticias` | Notícias e releases do IBGE |
| `ibge_calendario` | **NOVO** - Calendário de divulgações e coletas do IBGE |

## Instalação

### Pré-requisitos

- Node.js 18.x ou superior
- npm ou yarn

### Passos

```bash
# Clone o repositório
git clone https://github.com/SidneyBissoli/ibge-br-mcp.git
cd ibge-br-mcp

# Instale as dependências
npm install

# Compile o projeto
npm run build
```

## Configuração

### Claude Desktop

Adicione ao arquivo de configuração do Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "ibge-br-mcp": {
      "command": "node",
      "args": ["/caminho/para/ibge-br-mcp/dist/index.js"]
    }
  }
}
```

### Claude Code

```json
{
  "mcpServers": {
    "ibge-br-mcp": {
      "command": "node",
      "args": ["/caminho/para/ibge-br-mcp/dist/index.js"]
    }
  }
}
```

## Uso das Ferramentas

### ibge_estados

Lista todos os estados brasileiros.

**Parâmetros:**
- `regiao` (opcional): Filtrar por região - `N` (Norte), `NE` (Nordeste), `SE` (Sudeste), `S` (Sul), `CO` (Centro-Oeste)
- `ordenar` (opcional): Campo para ordenação - `id`, `nome`, `sigla`

**Exemplos:**
```
# Listar todos os estados
ibge_estados

# Estados do Nordeste
ibge_estados(regiao="NE")

# Estados ordenados por sigla
ibge_estados(ordenar="sigla")
```

### ibge_municipios

Lista municípios brasileiros.

**Parâmetros:**
- `uf` (opcional): Sigla do estado (ex: SP, RJ, MG)
- `busca` (opcional): Termo para buscar no nome
- `limite` (opcional): Número máximo de resultados (padrão: 100)

**Exemplos:**
```
# Municípios de São Paulo
ibge_municipios(uf="SP")

# Buscar municípios com "Campinas"
ibge_municipios(busca="Campinas")

# Municípios de MG com "Belo"
ibge_municipios(uf="MG", busca="Belo")
```

### ibge_localidade

Retorna detalhes de uma localidade pelo código IBGE.

**Parâmetros:**
- `codigo` (obrigatório): Código IBGE (2 dígitos = estado, 7 dígitos = município)
- `tipo` (opcional): Tipo da localidade - `estado`, `municipio`, `distrito`

**Exemplos:**
```
# Detalhes de São Paulo (estado)
ibge_localidade(codigo=35)

# Detalhes de São Paulo (município)
ibge_localidade(codigo=3550308)
```

### ibge_censo

Consulta dados dos Censos Demográficos do IBGE (1970-2022).

Interface simplificada que abstrai os códigos das tabelas SIDRA, permitindo consultar dados censitários de forma intuitiva.

**Parâmetros:**
- `ano` (opcional): Ano do censo (1970, 1980, 1991, 2000, 2010, 2022) ou "todos" para série histórica
- `tema` (opcional): Tipo de dado a consultar (padrão: "populacao")
- `nivel_territorial` (opcional): 1=Brasil, 2=Região, 3=UF, 6=Município
- `localidades` (opcional): Códigos das localidades ou "all"
- `formato` (opcional): "tabela" ou "json"

**Temas disponíveis:**

| Tema | Descrição |
|:-----|:----------|
| populacao | População residente por sexo e situação |
| alfabetizacao | Taxa de alfabetização |
| domicilios | Características dos domicílios |
| idade_sexo | Pirâmide etária / grupos de idade |
| religiao | Distribuição por religião |
| cor_raca | Cor ou raça |
| rendimento | Rendimento mensal |
| migracao | Migração |
| educacao | Nível de instrução |
| trabalho | Ocupação e trabalho |
| listar | Lista todas as tabelas disponíveis |

**Exemplos:**
```
# População do Censo 2022
ibge_censo(ano="2022", tema="populacao")

# Série histórica de população (1970-2010)
ibge_censo(ano="todos", tema="populacao")

# Alfabetização em 2010 por UF
ibge_censo(ano="2010", tema="alfabetizacao", nivel_territorial="3")

# População de um município específico
ibge_censo(ano="2022", tema="populacao", nivel_territorial="6", localidades="3550308")

# Ver todas as tabelas disponíveis
ibge_censo(tema="listar")

# Tabelas disponíveis para o Censo 2022
ibge_censo(tema="listar", ano="2022")
```

### ibge_populacao

Retorna a projeção da população brasileira em tempo real.

**Parâmetros:**
- `localidade` (opcional): Apenas "BR" disponível atualmente

**Exemplo:**
```
ibge_populacao()
```

**Retorna:**
- População atual estimada
- Taxa de nascimentos (tempo médio entre nascimentos)
- Taxa de óbitos (tempo médio entre óbitos)
- Incremento populacional diário

### ibge_sidra

Consulta tabelas do SIDRA (Sistema IBGE de Recuperação Automática).

**Parâmetros:**
- `tabela` (obrigatório): Código da tabela SIDRA
- `variaveis` (opcional): IDs das variáveis (padrão: "allxp")
- `nivel_territorial` (opcional): Código do nível territorial (ver tabela abaixo)
- `localidades` (opcional): Códigos das localidades (padrão: "all")
- `periodos` (opcional): Períodos (padrão: "last")
- `classificacoes` (opcional): Filtros de classificação
- `formato` (opcional): "json" ou "tabela"

**Níveis territoriais suportados:**

| Código | Nível Territorial |
|-------:|:------------------|
| 1 | Brasil |
| 2 | Grande Região (Norte, Nordeste, etc.) |
| 3 | UF (Unidade da Federação) |
| 6 | Município |
| 7 | Região Metropolitana |
| 8 | Mesorregião Geográfica |
| 9 | Microrregião Geográfica |
| 10 | Distrito |
| 11 | Subdistrito |
| 13 | Região Metropolitana e RIDE |
| 14 | Região Integrada de Desenvolvimento |
| 15 | Aglomeração Urbana |
| 17 | Região Geográfica Imediata |
| 18 | Região Geográfica Intermediária |
| 105 | Macrorregião de Saúde |
| 106 | Região de Saúde |
| 114 | Aglomerado Subnormal |
| 127 | Amazônia Legal |
| 128 | Semiárido |

**Tabelas mais utilizadas:**

| Código | Descrição |
|-------:|:----------|
| 6579 | Estimativas de população (anual) |
| 9514 | População do Censo 2022 |
| 200 | População dos Censos (1970-2010) |
| 4714 | Taxa de desocupação (PNAD Contínua) |
| 6381 | Rendimento médio (PNAD Contínua) |
| 6706 | PIB a preços correntes |
| 5938 | PIB per capita |
| 1705 | Área territorial |
| 1712 | Densidade demográfica |

**Exemplos:**
```
# População do Brasil em 2023
ibge_sidra(tabela="6579", periodos="2023")

# População por UF
ibge_sidra(tabela="6579", nivel_territorial="3", periodos="2023")

# População por Região de Saúde
ibge_sidra(tabela="6579", nivel_territorial="106")

# Censo 2022 por município de São Paulo
ibge_sidra(tabela="9514", nivel_territorial="6", localidades="3550308")

# PIB do Brasil
ibge_sidra(tabela="6706", periodos="last")
```

### ibge_nomes

Consulta frequência e ranking de nomes no Brasil.

**Parâmetros:**
- `tipo` (obrigatório): "frequencia" ou "ranking"
- `nomes` (para frequencia): Nome ou nomes separados por vírgula
- `decada` (para ranking): Década do ranking (ex: 1990, 2000, 2010)
- `sexo` (opcional): "M" (masculino) ou "F" (feminino)
- `localidade` (opcional): Código IBGE da UF ou município
- `limite` (para ranking): Número de nomes (padrão: 20)

**Exemplos:**
```
# Frequência do nome "Maria"
ibge_nomes(tipo="frequencia", nomes="Maria")

# Comparar nomes
ibge_nomes(tipo="frequencia", nomes="João,José,Pedro")

# Ranking de nomes dos anos 2000
ibge_nomes(tipo="ranking", decada=2000)

# Nomes femininos mais populares
ibge_nomes(tipo="ranking", sexo="F")

# Nomes populares em SP
ibge_nomes(tipo="ranking", localidade="35")
```

### ibge_noticias

Busca notícias e releases do IBGE.

**Parâmetros:**
- `busca` (opcional): Termo para buscar
- `quantidade` (opcional): Número de notícias (padrão: 10)
- `pagina` (opcional): Número da página
- `de` (opcional): Data inicial (MM-DD-AAAA)
- `ate` (opcional): Data final (MM-DD-AAAA)
- `tipo` (opcional): "release" ou "noticia"
- `destaque` (opcional): Filtrar destaques

**Exemplos:**
```
# Últimas notícias
ibge_noticias()

# Buscar sobre censo
ibge_noticias(busca="censo")

# Notícias de 2024
ibge_noticias(de="01-01-2024", ate="12-31-2024")

# Apenas releases
ibge_noticias(tipo="release")
```

### ibge_sidra_tabelas

Lista e busca tabelas disponíveis no SIDRA.

**Parâmetros:**
- `busca` (opcional): Termo para buscar no nome das tabelas
- `pesquisa` (opcional): Filtrar por pesquisa (ex: "censo", "pnad")
- `limite` (opcional): Número máximo de resultados (padrão: 20)

**Exemplos:**
```
# Listar tabelas
ibge_sidra_tabelas()

# Buscar tabelas de população
ibge_sidra_tabelas(busca="população")

# Tabelas do Censo
ibge_sidra_tabelas(pesquisa="censo")
```

### ibge_sidra_metadados

Retorna os metadados de uma tabela SIDRA específica.

**Parâmetros:**
- `tabela` (obrigatório): Código da tabela SIDRA
- `incluir_periodos` (opcional): Incluir períodos disponíveis (padrão: true)
- `incluir_localidades` (opcional): Incluir níveis territoriais (padrão: false)

**Exemplos:**
```
# Metadados da tabela de população
ibge_sidra_metadados(tabela="6579")

# Metadados do Censo 2022
ibge_sidra_metadados(tabela="9514")

# Sem períodos
ibge_sidra_metadados(tabela="6579", incluir_periodos=false)
```

**Retorna:**
- Informações gerais (nome, pesquisa, periodicidade)
- Níveis territoriais disponíveis
- Lista de variáveis com unidades
- Classificações e categorias
- Períodos disponíveis

### ibge_malhas

Obtém malhas geográficas (mapas) do IBGE.

**Parâmetros:**
- `localidade` (obrigatório): Código IBGE ou sigla ("BR", "SP", "35", "3550308")
- `tipo` (opcional): Tipo de divisão territorial
- `formato` (opcional): "geojson", "topojson" ou "svg" (padrão: geojson)
- `resolucao` (opcional): Divisões internas (0-5)
- `qualidade` (opcional): Qualidade do traçado (1-4, padrão: 4)

**Resolução:**
| Valor | Divisões Internas |
|:-----:|:------------------|
| 0 | Sem divisões (apenas contorno) |
| 1 | Macrorregiões |
| 2 | Unidades da Federação |
| 3 | Mesorregiões |
| 4 | Microrregiões |
| 5 | Municípios |

**Exemplos:**
```
# Brasil com estados
ibge_malhas(localidade="BR", resolucao="2")

# São Paulo com municípios
ibge_malhas(localidade="SP", resolucao="5")

# Município específico
ibge_malhas(localidade="3550308")

# Em formato SVG
ibge_malhas(localidade="BR", formato="svg")
```

### ibge_pesquisas

Lista as pesquisas disponíveis no IBGE.

**Parâmetros:**
- `busca` (opcional): Termo para buscar no nome da pesquisa
- `detalhes` (opcional): Código da pesquisa para ver detalhes e tabelas

**Exemplos:**
```
# Listar todas as pesquisas
ibge_pesquisas()

# Buscar pesquisas de população
ibge_pesquisas(busca="população")

# Detalhes da PNAD
ibge_pesquisas(detalhes="pnad")

# Detalhes do Censo
ibge_pesquisas(detalhes="CD")
```

### ibge_indicadores

Consulta indicadores econômicos e sociais do IBGE.

**Parâmetros:**
- `indicador` (opcional): Nome do indicador (pib, ipca, desemprego, etc.) ou "listar"
- `categoria` (opcional): Filtrar por categoria (economico, precos, trabalho, populacao, agropecuaria)
- `nivel_territorial` (opcional): 1=Brasil, 2=Região, 3=UF
- `localidades` (opcional): Códigos das localidades ou "all"
- `periodos` (opcional): Períodos (padrão: "last")
- `formato` (opcional): "tabela" ou "json"

**Indicadores disponíveis:**

| Categoria | Indicadores |
|:----------|:------------|
| Econômicos | pib, pib_variacao, pib_per_capita, industria, comercio, servicos |
| Preços | ipca, ipca_acumulado, inpc |
| Trabalho | desemprego, ocupacao, rendimento, informalidade |
| População | populacao, densidade |
| Agropecuária | agricultura, pecuaria |

**Exemplos:**
```
# PIB do Brasil
ibge_indicadores(indicador="pib")

# IPCA dos últimos 12 meses
ibge_indicadores(indicador="ipca", periodos="last 12")

# Taxa de desemprego por UF
ibge_indicadores(indicador="desemprego", nivel_territorial="3")

# Listar todos os indicadores
ibge_indicadores(indicador="listar")

# Indicadores de preços
ibge_indicadores(categoria="precos")
```

### ibge_cnae

Consulta a CNAE (Classificação Nacional de Atividades Econômicas) do IBGE.

**Parâmetros:**
- `codigo` (opcional): Código CNAE (seção, divisão, grupo, classe ou subclasse)
- `busca` (opcional): Termo para buscar na descrição das atividades
- `nivel` (opcional): Nível hierárquico (secoes, divisoes, grupos, classes, subclasses)
- `limite` (opcional): Número máximo de resultados (padrão: 20)

**Estrutura hierárquica:**

| Nível | Formato | Exemplo |
|:------|:--------|:--------|
| Seção | 1 letra | A |
| Divisão | 2 dígitos | 01 |
| Grupo | 3 dígitos | 01.1 |
| Classe | 4-5 dígitos | 01.11-3 |
| Subclasse | 7 dígitos | 0111-3/01 |

**Exemplos:**
```
# Buscar atividades de software
ibge_cnae(busca="software")

# Detalhes de uma seção
ibge_cnae(codigo="J")

# Detalhes de um código específico
ibge_cnae(codigo="6201-5/01")

# Listar todas as divisões
ibge_cnae(nivel="divisoes", limite=50)

# Ver estrutura geral
ibge_cnae()
```

### ibge_geocodigo

Decodifica códigos IBGE ou busca códigos pelo nome da localidade.

**Parâmetros:**
- `codigo` (opcional): Código IBGE para decodificar (1, 2, 7 ou 9 dígitos)
- `nome` (opcional): Nome da localidade para encontrar o código
- `uf` (opcional): Sigla da UF para restringir a busca por município

**Estrutura dos códigos:**

| Dígitos | Nível | Exemplo |
|:-------:|:------|:--------|
| 1 | Região | 3 (Sudeste) |
| 2 | UF | 35 (São Paulo) |
| 7 | Município | 3550308 (São Paulo capital) |
| 9 | Distrito | 355030805 (Sé) |

**Exemplos:**
```
# Decodificar um código de município
ibge_geocodigo(codigo="3550308")

# Decodificar um código de UF
ibge_geocodigo(codigo="35")

# Buscar código pelo nome
ibge_geocodigo(nome="São Paulo")

# Buscar município em um estado específico
ibge_geocodigo(nome="Campinas", uf="SP")

# Ver ajuda
ibge_geocodigo()
```

### ibge_calendario

Consulta o calendário de divulgações e coletas do IBGE.

**Parâmetros:**
- `de` (opcional): Data inicial no formato MM-DD-AAAA
- `ate` (opcional): Data final no formato MM-DD-AAAA
- `produto` (opcional): Filtrar por produto/pesquisa (ex: "IPCA", "PNAD")
- `tipo` (opcional): "divulgacao", "coleta" ou "todos" (padrão: "divulgacao")
- `pagina` (opcional): Página de resultados (padrão: 1)
- `quantidade` (opcional): Resultados por página (padrão: 20)

**Exemplos:**
```
# Próximas divulgações
ibge_calendario()

# Divulgações do mês
ibge_calendario(de="01-01-2024", ate="01-31-2024")

# Buscar divulgações do IPCA
ibge_calendario(produto="IPCA")

# Calendário de coletas
ibge_calendario(tipo="coleta")

# Todos os eventos (divulgação e coleta)
ibge_calendario(tipo="todos", quantidade=50)
```

### ibge_comparar

Compara dados entre múltiplas localidades (estados, municípios).

**Parâmetros:**
- `localidades` (obrigatório): Códigos IBGE separados por vírgula (ex: "35,33,31" para SP, RJ, MG)
- `indicador` (opcional): Tipo de comparação:
  - "populacao" (padrão): População estimada atual
  - "populacao_censo": População do Censo 2022
  - "pib": PIB (Produto Interno Bruto)
  - "area": Área territorial em km²
  - "densidade": Densidade demográfica
  - "alfabetizacao": Taxa de alfabetização
  - "domicilios": Número de domicílios
  - "listar": Lista indicadores disponíveis
- `formato` (opcional): "tabela", "json" ou "ranking" (padrão: "tabela")

**Exemplos:**
```
# Comparar população dos estados do Sudeste
ibge_comparar(localidades="35,33,31,32", indicador="populacao")

# Ranking de PIB das capitais
ibge_comparar(localidades="3550308,3304557,3106200,4106902,5300108", indicador="pib", formato="ranking")

# Comparar densidade de municípios
ibge_comparar(localidades="3550308,3509502,3518800", indicador="densidade")

# Comparação de alfabetização
ibge_comparar(localidades="35,33", indicador="alfabetizacao")

# Ver indicadores disponíveis
ibge_comparar(indicador="listar")
```

### ibge_malhas_tema

Obtém malhas geográficas temáticas do IBGE (biomas, regiões especiais).

**Parâmetros:**
- `tema` (obrigatório): Tema da malha:
  - "biomas": Biomas brasileiros
  - "amazonia_legal": Área da Amazônia Legal
  - "semiarido": Região do semiárido
  - "costeiro": Zona costeira
  - "fronteira": Faixa de fronteira
  - "metropolitana": Regiões metropolitanas
  - "ride": Regiões Integradas de Desenvolvimento
  - "listar": Lista temas disponíveis
- `codigo` (opcional): Código específico do tema (ex: código do bioma)
- `formato` (opcional): "geojson", "topojson" ou "svg" (padrão: "geojson")
- `resolucao` (opcional): "0" = contorno, "5" = com municípios

**Códigos de Biomas:** 1=Amazônia, 2=Cerrado, 3=Mata Atlântica, 4=Caatinga, 5=Pampa, 6=Pantanal

**Exemplos:**
```
# Todos os biomas
ibge_malhas_tema(tema="biomas")

# Bioma Amazônia
ibge_malhas_tema(tema="biomas", codigo="1")

# Amazônia Legal com municípios
ibge_malhas_tema(tema="amazonia_legal", resolucao="5")

# Regiões metropolitanas
ibge_malhas_tema(tema="metropolitana")

# Listar temas
ibge_malhas_tema(tema="listar")
```

### ibge_vizinhos

Busca municípios próximos/vizinhos de um município.

**Parâmetros:**
- `municipio` (obrigatório): Código IBGE (7 dígitos) ou nome do município
- `uf` (opcional): Sigla da UF (obrigatório se usar nome)
- `incluir_dados` (opcional): Se true, inclui dados populacionais

**Exemplos:**
```
# Por código IBGE
ibge_vizinhos(municipio="3550308")

# Por nome com UF
ibge_vizinhos(municipio="Campinas", uf="SP")

# Com dados populacionais
ibge_vizinhos(municipio="3550308", incluir_dados=true)
```

### bcb

Consulta dados do Banco Central do Brasil (taxas, câmbio, inflação).

**Parâmetros:**
- `indicador` (obrigatório): Nome ou código do indicador:
  - Taxas: "selic", "cdi", "tr"
  - Inflação: "ipca", "ipca_acum", "igpm", "inpc"
  - Câmbio: "dolar_compra", "dolar_venda", "euro"
  - Outros: "desemprego", "divida_pib", "reservas"
  - "listar": Lista indicadores disponíveis
- `dataInicio` (opcional): Data inicial no formato DD/MM/AAAA
- `dataFim` (opcional): Data final no formato DD/MM/AAAA
- `ultimos` (opcional): Retornar apenas os últimos N valores
- `formato` (opcional): "tabela" ou "json" (padrão: "tabela")

**Exemplos:**
```
# SELIC últimos 12 meses
bcb(indicador="selic", ultimos=12)

# IPCA de 2023
bcb(indicador="ipca", dataInicio="01/01/2023", dataFim="31/12/2023")

# Dólar últimos 30 dias
bcb(indicador="dolar_venda", ultimos=30)

# Listar indicadores
bcb(indicador="listar")
```

### datasaude

Consulta indicadores de saúde do Brasil via IBGE/DataSUS.

**Parâmetros:**
- `indicador` (obrigatório): Indicador de saúde:
  - "mortalidade_infantil": Taxa de mortalidade infantil
  - "esperanca_vida": Esperança de vida ao nascer
  - "nascidos_vivos": Nascidos vivos
  - "obitos": Óbitos por local
  - "obitos_causas": Óbitos por causas (CID-10)
  - "fecundidade": Taxa de fecundidade
  - "saneamento_agua": Abastecimento de água
  - "saneamento_esgoto": Esgotamento sanitário
  - "plano_saude": Cobertura de plano de saúde
  - "listar": Lista indicadores disponíveis
- `nivel_territorial` (opcional): 1=Brasil, 2=Região, 3=UF, 6=Município
- `localidade` (opcional): Código da localidade ou "all"
- `periodo` (opcional): "last", "all" ou ano específico

**Exemplos:**
```
# Mortalidade infantil no Brasil
datasaude(indicador="mortalidade_infantil")

# Esperança de vida por UF
datasaude(indicador="esperanca_vida", nivel_territorial="3")

# Óbitos em São Paulo
datasaude(indicador="obitos", nivel_territorial="3", localidade="35")

# Série histórica de nascidos vivos
datasaude(indicador="nascidos_vivos", periodo="all")

# Listar indicadores
datasaude(indicador="listar")
```

## APIs Utilizadas

### APIs do IBGE

- **Localidades**: `https://servicodados.ibge.gov.br/api/v1/localidades`
- **Nomes**: `https://servicodados.ibge.gov.br/api/v2/censos/nomes`
- **Agregados/SIDRA**: `https://servicodados.ibge.gov.br/api/v3/agregados`
- **SIDRA API**: `https://apisidra.ibge.gov.br/values`
- **Malhas**: `https://servicodados.ibge.gov.br/api/v3/malhas`
- **Notícias**: `https://servicodados.ibge.gov.br/api/v3/noticias`
- **População**: `https://servicodados.ibge.gov.br/api/v1/projecoes/populacao`
- **CNAE**: `https://servicodados.ibge.gov.br/api/v2/cnae`
- **Calendário**: `https://servicodados.ibge.gov.br/api/v3/calendario`

### APIs Externas

- **Banco Central (BCB)**: `https://api.bcb.gov.br/dados/serie/bcdata.sgs` - Taxas de juros, câmbio, inflação

## Desenvolvimento

```bash
# Compilar em modo watch
npm run watch

# Testar com o inspector do MCP
npm run inspector
```

## Estrutura do Projeto

```
ibge-br-mcp/
├── src/
│   ├── index.ts              # Servidor MCP principal
│   ├── types.ts              # Tipos TypeScript
│   ├── cache.ts              # Sistema de cache de requisições
│   ├── errors.ts             # Tratamento padronizado de erros
│   ├── validation.ts         # Helpers de validação de entrada
│   ├── metrics.ts            # Sistema de métricas e logging
│   └── tools/
│       ├── index.ts          # Exportação das ferramentas
│       ├── estados.ts        # Tool: ibge_estados
│       ├── municipios.ts     # Tool: ibge_municipios
│       ├── localidade.ts     # Tool: ibge_localidade
│       ├── geocodigo.ts      # Tool: ibge_geocodigo
│       ├── censo.ts          # Tool: ibge_censo
│       ├── populacao.ts      # Tool: ibge_populacao
│       ├── sidra.ts          # Tool: ibge_sidra
│       ├── sidra-tabelas.ts  # Tool: ibge_sidra_tabelas
│       ├── sidra-metadados.ts# Tool: ibge_sidra_metadados
│       ├── indicadores.ts    # Tool: ibge_indicadores
│       ├── cnae.ts           # Tool: ibge_cnae
│       ├── calendario.ts     # Tool: ibge_calendario
│       ├── comparar.ts       # Tool: ibge_comparar
│       ├── malhas.ts         # Tool: ibge_malhas
│       ├── malhas-tema.ts    # Tool: ibge_malhas_tema
│       ├── vizinhos.ts       # Tool: ibge_vizinhos
│       ├── bcb.ts            # Tool: bcb
│       ├── datasaude.ts      # Tool: datasaude
│       ├── pesquisas.ts      # Tool: ibge_pesquisas
│       ├── nomes.ts          # Tool: ibge_nomes
│       └── noticias.ts       # Tool: ibge_noticias
├── dist/                     # Arquivos compilados
├── package.json
├── tsconfig.json
└── README.md
```

## Licença

MIT

## Referências

- [IBGE - Serviço de Dados](https://servicodados.ibge.gov.br/api/docs/)
- [SIDRA - Sistema IBGE de Recuperação Automática](https://sidra.ibge.gov.br/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
