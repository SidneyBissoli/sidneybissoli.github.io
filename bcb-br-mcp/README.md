# BCB BR MCP Server

[![npm version](https://badge.fury.io/js/bcb-br-mcp.svg)](https://www.npmjs.com/package/bcb-br-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://github.com/modelcontextprotocol/servers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Servidor MCP (Model Context Protocol) para acesso às séries temporais do Banco Central do Brasil (SGS/BCB).

Permite consultar indicadores econômicos e financeiros como **Selic**, **IPCA**, **câmbio**, **PIB**, entre outros, diretamente em assistentes de IA como Claude.

## Funcionalidades

- **Consulta de séries históricas** - Busca valores de séries por código com filtro de datas
- **Últimos valores** - Obtém os N valores mais recentes de uma série
- **Metadados** - Informações detalhadas sobre séries (periodicidade, fonte, etc.)
- **Catálogo de séries populares** - Lista de indicadores econômicos mais utilizados
- **Busca por nome** - Encontra séries por termo de busca
- **Indicadores atuais** - Valores mais recentes dos principais indicadores econômicos

## Ferramentas Disponíveis

| Ferramenta | Descrição |
|------------|-----------|
| `bcb_serie_valores` | Consulta valores de uma série por código e período |
| `bcb_serie_ultimos` | Obtém os últimos N valores de uma série |
| `bcb_serie_metadados` | Retorna informações/metadados de uma série |
| `bcb_series_populares` | Lista séries populares agrupadas por categoria |
| `bcb_buscar_serie` | Busca séries por nome ou descrição |
| `bcb_indicadores_atuais` | Valores mais recentes: Selic, IPCA, Dólar, IBC-Br |

## Instalação

### Claude Desktop

Adicione ao arquivo de configuração do Claude Desktop:

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

#### Opção 1: Via npx (recomendado)

```json
{
  "mcpServers": {
    "bcb-br": {
      "command": "npx",
      "args": ["-y", "bcb-br-mcp"]
    }
  }
}
```

#### Opção 2: Instalação global

```bash
npm install -g bcb-br-mcp
```

```json
{
  "mcpServers": {
    "bcb-br": {
      "command": "bcb-br-mcp"
    }
  }
}
```

## Exemplos de Uso

### Consultar a Selic atual

```
Use bcb_serie_ultimos com código 432 para obter a Selic
```

### Histórico do IPCA em 2024

```
Use bcb_serie_valores com código 433, dataInicial 2024-01-01 e dataFinal 2024-12-31
```

### Listar indicadores de inflação

```
Use bcb_series_populares com categoria "Inflação"
```

### Buscar séries sobre dólar

```
Use bcb_buscar_serie com termo "dolar"
```

### Obter indicadores atuais

```
Use bcb_indicadores_atuais para ver Selic, IPCA, Dólar e IBC-Br atuais
```

## Séries Populares Incluídas

### Juros
- **11** - Taxa Selic acumulada no mês
- **432** - Taxa Selic anualizada base 252
- **4189** - Taxa Selic acumulada no mês anualizada

### Inflação
- **433** - IPCA - Variação mensal
- **13522** - IPCA - Variação acumulada em 12 meses
- **188** - INPC - Variação mensal
- **189** - IGP-M - Variação mensal
- **190** - IGP-DI - Variação mensal

### Câmbio
- **1** - Dólar americano (venda) - diário
- **10813** - Dólar americano (compra) - diário
- **3698** - Dólar PTAX (venda)
- **3697** - Dólar PTAX (compra)
- **21619** - Euro (venda)
- **21620** - Euro (compra)

### Atividade Econômica
- **4380** - PIB mensal - Valores correntes
- **4382** - PIB acumulado dos últimos 12 meses
- **24364** - Índice de Atividade Econômica (IBC-Br)

### Emprego
- **24369** - Taxa de desocupação - PNAD Contínua

### Outros
- **4503** - Dívida líquida do setor público (% PIB)
- **4513** - Dívida bruta do governo geral (% PIB)
- **3546** - Reservas internacionais
- **22707** - Balança comercial - Saldo
- **25** - Poupança - rendimento mensal

## Encontrar Outras Séries

O SGS possui mais de 18.000 séries temporais. Para encontrar o código de outras séries:

1. Acesse o [Portal SGS do BCB](https://www3.bcb.gov.br/sgspub/)
2. Use a busca para encontrar a série desejada
3. Anote o código da série
4. Use esse código nas ferramentas deste servidor

## Desenvolvimento

### Requisitos

- Node.js >= 18.0.0

### Setup

```bash
git clone https://github.com/SidneyBissoli/bcb-br-mcp.git
cd bcb-br-mcp
npm install
```

### Build

```bash
npm run build
```

### Teste local

```bash
npm run dev
```

Ou use o MCP Inspector:

```bash
npx @modelcontextprotocol/inspector npm run dev
```

## API do BCB

Este servidor utiliza a API pública do Banco Central do Brasil:

- **Endpoint base:** `https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados`
- **Formato:** JSON
- **Documentação:** [Dados Abertos BCB](https://dadosabertos.bcb.gov.br/)

## Contribuição

Contribuições são bem-vindas! Por favor:

1. Faça um fork do repositório
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## Licença

MIT - veja [LICENSE](LICENSE) para detalhes.

## Autor

**Sidney Bissoli**

- GitHub: [@SidneyBissoli](https://github.com/SidneyBissoli)
- Email: sbissoli76@gmail.com

## Links Úteis

- [Portal SGS BCB](https://www3.bcb.gov.br/sgspub/)
- [Dados Abertos BCB](https://dadosabertos.bcb.gov.br/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [MCP Registry](https://github.com/modelcontextprotocol/servers)
