# ibge-br-mcp

MCP Server para APIs do IBGE (Instituto Brasileiro de Geografia e Estatística).

Este servidor implementa o [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) para fornecer acesso às APIs públicas do IBGE, permitindo que assistentes de IA consultem dados geográficos, demográficos e estatísticos do Brasil.

## Ferramentas Disponíveis

| Ferramenta | Descrição |
|:-----------|:----------|
| `ibge_estados` | Lista estados brasileiros com filtro por região |
| `ibge_municipios` | Lista municípios por UF ou busca por nome |
| `ibge_localidade` | Detalhes de uma localidade pelo código IBGE |
| `ibge_populacao` | Projeção da população brasileira em tempo real |
| `ibge_sidra` | Consulta tabelas do SIDRA (Censo, PNAD, PIB, etc.) |
| `ibge_nomes` | Frequência e ranking de nomes no Brasil |
| `ibge_noticias` | Notícias e releases do IBGE |

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
- `nivel_territorial` (opcional): 1=Brasil, 2=Região, 3=UF, 6=Município
- `localidades` (opcional): Códigos das localidades (padrão: "all")
- `periodos` (opcional): Períodos (padrão: "last")
- `classificacoes` (opcional): Filtros de classificação
- `formato` (opcional): "json" ou "tabela"

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

## APIs do IBGE Utilizadas

Este MCP Server utiliza as seguintes APIs públicas do IBGE:

- **Localidades**: `https://servicodados.ibge.gov.br/api/v1/localidades`
- **Nomes**: `https://servicodados.ibge.gov.br/api/v2/censos/nomes`
- **Agregados/SIDRA**: `https://servicodados.ibge.gov.br/api/v3/agregados`
- **SIDRA API**: `https://apisidra.ibge.gov.br/values`
- **Notícias**: `https://servicodados.ibge.gov.br/api/v3/noticias`
- **População**: `https://servicodados.ibge.gov.br/api/v1/projecoes/populacao`

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
│   ├── index.ts          # Servidor MCP principal
│   ├── types.ts          # Tipos TypeScript
│   └── tools/
│       ├── index.ts      # Exportação das ferramentas
│       ├── estados.ts    # Tool: ibge_estados
│       ├── municipios.ts # Tool: ibge_municipios
│       ├── localidade.ts # Tool: ibge_localidade
│       ├── populacao.ts  # Tool: ibge_populacao
│       ├── sidra.ts      # Tool: ibge_sidra
│       ├── nomes.ts      # Tool: ibge_nomes
│       └── noticias.ts   # Tool: ibge_noticias
├── dist/                 # Arquivos compilados
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
