#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  estadosSchema,
  ibgeEstados,
  municipiosSchema,
  ibgeMunicipios,
  localidadeSchema,
  ibgeLocalidade,
  populacaoSchema,
  ibgePopulacao,
  sidraSchema,
  ibgeSidra,
  nomesSchema,
  ibgeNomes,
  noticiasSchema,
  ibgeNoticias,
  sidraTabelasSchema,
  ibgeSidraTabelas,
  sidraMetadadosSchema,
  ibgeSidraMetadados,
  malhasSchema,
  ibgeMalhas,
  pesquisasSchema,
  ibgePesquisas,
} from "./tools/index.js";

// Server metadata
const SERVER_NAME = "ibge-br-mcp";
const SERVER_VERSION = "1.1.0";

/**
 * IBGE MCP Server
 *
 * Provides tools to access IBGE (Instituto Brasileiro de Geografia e Estatística) APIs:
 * - Localidades: Estados, Municípios, Distritos
 * - SIDRA: Dados agregados de pesquisas (Censo, PNAD, PIB, etc.)
 * - Nomes: Frequência e ranking de nomes no Brasil
 * - Notícias: Releases e notícias do IBGE
 * - População: Projeção populacional em tempo real
 */
async function main() {
  // Create MCP server instance
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // Register ibge_estados tool
  server.tool(
    "ibge_estados",
    `Lista todos os estados brasileiros do IBGE.

Funcionalidades:
- Lista todos os 27 estados (26 estados + DF)
- Filtra por região (Norte, Nordeste, Sudeste, Sul, Centro-Oeste)
- Ordena por ID, nome ou sigla

Exemplo de uso:
- Listar todos os estados
- Listar estados do Nordeste
- Listar estados ordenados por sigla`,
    estadosSchema.shape,
    async (args) => {
      const result = await ibgeEstados(args);
      return { content: [{ type: "text", text: result }] };
    }
  );

  // Register ibge_municipios tool
  server.tool(
    "ibge_municipios",
    `Lista municípios brasileiros do IBGE.

Funcionalidades:
- Lista municípios de um estado específico (usando a sigla da UF)
- Lista todos os municípios do Brasil (5.570 municípios)
- Busca por nome do município
- Retorna código IBGE de 7 dígitos

Exemplo de uso:
- Listar municípios de São Paulo: uf="SP"
- Buscar município por nome: busca="Campinas"
- Listar municípios de MG que contenham "Belo": uf="MG", busca="Belo"`,
    municipiosSchema.shape,
    async (args) => {
      const result = await ibgeMunicipios(args);
      return { content: [{ type: "text", text: result }] };
    }
  );

  // Register ibge_localidade tool
  server.tool(
    "ibge_localidade",
    `Retorna detalhes de uma localidade específica pelo código IBGE.

Funcionalidades:
- Busca informações de estados (código de 2 dígitos)
- Busca informações de municípios (código de 7 dígitos)
- Busca informações de distritos (código de 9 dígitos)
- Retorna hierarquia completa (região, mesorregião, microrregião)

Exemplo de uso:
- Detalhes de São Paulo (estado): codigo=35
- Detalhes de São Paulo (município): codigo=3550308
- Detalhes de um distrito: codigo=355030805`,
    localidadeSchema.shape,
    async (args) => {
      const result = await ibgeLocalidade(args);
      return { content: [{ type: "text", text: result }] };
    }
  );

  // Register ibge_populacao tool
  server.tool(
    "ibge_populacao",
    `Retorna a projeção da população brasileira em tempo real.

Funcionalidades:
- Estimativa da população atual do Brasil
- Taxa de nascimentos (tempo médio entre nascimentos)
- Taxa de óbitos (tempo médio entre óbitos)
- Incremento populacional diário

Fonte: IBGE - Projeção da População do Brasil

Nota: Para dados históricos ou por município, use a ferramenta ibge_sidra com as tabelas:
- 6579: Estimativas de população
- 9514: População do Censo 2022`,
    populacaoSchema.shape,
    async (args) => {
      const result = await ibgePopulacao(args);
      return { content: [{ type: "text", text: result }] };
    }
  );

  // Register ibge_sidra tool
  server.tool(
    "ibge_sidra",
    `Consulta tabelas do SIDRA (Sistema IBGE de Recuperação Automática).

O SIDRA contém dados de pesquisas do IBGE como Censo, PNAD, PIB, etc.

Tabelas mais utilizadas:
- 6579: Estimativas de população (anual)
- 9514: População do Censo 2022
- 200: População dos Censos (1970-2010)
- 4714: Taxa de desocupação (PNAD Contínua)
- 6381: Rendimento médio (PNAD Contínua)
- 6706: PIB a preços correntes
- 5938: PIB per capita
- 1705: Área territorial
- 1712: Densidade demográfica

Níveis territoriais:
- 1: Brasil
- 2: Região
- 3: UF (Unidade da Federação)
- 6: Município
- 7: Região Metropolitana
- 8: Mesorregião
- 9: Microrregião

Exemplo de uso:
- População do Brasil 2023: tabela="6579", periodos="2023"
- População de SP por município: tabela="6579", nivel_territorial="6", localidades="3500105,3550308"
- PIB do Brasil: tabela="6706", periodos="last"`,
    sidraSchema.shape,
    async (args) => {
      const result = await ibgeSidra(args);
      return { content: [{ type: "text", text: result }] };
    }
  );

  // Register ibge_nomes tool
  server.tool(
    "ibge_nomes",
    `Consulta frequência e ranking de nomes no Brasil (IBGE).

Funcionalidades:
1. **Frequência de nomes** (tipo='frequencia'):
   - Busca a frequência de nascimentos por década
   - Aceita múltiplos nomes separados por vírgula
   - Filtra por sexo e localidade

2. **Ranking de nomes** (tipo='ranking'):
   - Lista os nomes mais populares
   - Filtra por década, sexo e localidade

Décadas disponíveis: 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010

Exemplos de uso:
- Frequência de "Maria": tipo="frequencia", nomes="Maria"
- Comparar nomes: tipo="frequencia", nomes="João,José,Pedro"
- Ranking anos 2000: tipo="ranking", decada=2000
- Nomes femininos mais populares: tipo="ranking", sexo="F"
- Nomes populares em SP: tipo="ranking", localidade="35"`,
    nomesSchema.shape,
    async (args) => {
      const result = await ibgeNomes(args);
      return { content: [{ type: "text", text: result }] };
    }
  );

  // Register ibge_noticias tool
  server.tool(
    "ibge_noticias",
    `Busca notícias e releases do IBGE.

Funcionalidades:
- Lista as últimas notícias e releases do IBGE
- Busca por termo específico
- Filtra por período (data inicial e final)
- Filtra por tipo (release ou notícia)
- Filtra notícias em destaque
- Suporta paginação

Exemplos de uso:
- Últimas 10 notícias: (sem parâmetros)
- Buscar sobre censo: busca="censo"
- Notícias de 2024: de="01-01-2024", ate="12-31-2024"
- Apenas releases: tipo="release"
- Apenas destaques: destaque=true
- Segunda página: pagina=2`,
    noticiasSchema.shape,
    async (args) => {
      const result = await ibgeNoticias(args);
      return { content: [{ type: "text", text: result }] };
    }
  );

  // Register ibge_sidra_tabelas tool
  server.tool(
    "ibge_sidra_tabelas",
    `Lista e busca tabelas disponíveis no SIDRA (Sistema IBGE de Recuperação Automática).

Funcionalidades:
- Lista todas as tabelas (agregados) do SIDRA
- Busca por termo no nome da tabela
- Filtra por pesquisa (Censo, PNAD, PIB, etc.)
- Mostra o código e nome de cada tabela

O SIDRA contém dados de diversas pesquisas:
- Censo Demográfico
- PNAD Contínua (emprego, renda)
- Contas Nacionais (PIB)
- Pesquisa Industrial
- Pesquisa Agrícola
- E muitas outras

Exemplos de uso:
- Listar tabelas: (sem parâmetros)
- Buscar tabelas de população: busca="população"
- Tabelas do Censo: pesquisa="censo"
- Tabelas de emprego: busca="desocupação"`,
    sidraTabelasSchema.shape,
    async (args) => {
      const result = await ibgeSidraTabelas(args);
      return { content: [{ type: "text", text: result }] };
    }
  );

  // Register ibge_sidra_metadados tool
  server.tool(
    "ibge_sidra_metadados",
    `Retorna os metadados de uma tabela SIDRA específica.

Funcionalidades:
- Informações gerais (nome, pesquisa, assunto, periodicidade)
- Níveis territoriais disponíveis (Brasil, UF, município, etc.)
- Lista de variáveis com unidades
- Classificações e categorias de cada variável
- Períodos disponíveis

Use esta ferramenta para entender a estrutura de uma tabela
ANTES de consultar os dados com ibge_sidra.

Exemplos de uso:
- Metadados da tabela de população: tabela="6579"
- Metadados do Censo 2022: tabela="9514"
- Metadados da PNAD (desocupação): tabela="4714"
- Sem períodos: tabela="6579", incluir_periodos=false`,
    sidraMetadadosSchema.shape,
    async (args) => {
      const result = await ibgeSidraMetadados(args);
      return { content: [{ type: "text", text: result }] };
    }
  );

  // Register ibge_malhas tool
  server.tool(
    "ibge_malhas",
    `Obtém malhas geográficas (mapas) do IBGE em formato GeoJSON, TopoJSON ou SVG.

Funcionalidades:
- Malhas do Brasil, regiões, estados, municípios, etc.
- Diferentes níveis de resolução (divisões internas)
- Diferentes níveis de qualidade do traçado
- Formatos: GeoJSON (dados), TopoJSON (compacto), SVG (imagem)

Tipos de localidade:
- "BR" ou "1" = Brasil inteiro
- Sigla do estado (ex: "SP", "RJ", "MG")
- Código do estado (ex: "35" para SP)
- Código do município (7 dígitos, ex: "3550308" para São Paulo)

Resolução (divisões internas):
- 0 = Apenas o contorno
- 1 = Macrorregiões (só para BR)
- 2 = Unidades da Federação
- 3 = Mesorregiões
- 4 = Microrregiões
- 5 = Municípios

Qualidade:
- 1 = Mínima (menor arquivo)
- 4 = Máxima (mais detalhado)

Exemplos de uso:
- Brasil com estados: localidade="BR", resolucao="2"
- São Paulo com municípios: localidade="SP", resolucao="5"
- Município específico: localidade="3550308"
- Em formato SVG: localidade="BR", formato="svg"`,
    malhasSchema.shape,
    async (args) => {
      const result = await ibgeMalhas(args);
      return { content: [{ type: "text", text: result }] };
    }
  );

  // Register ibge_pesquisas tool
  server.tool(
    "ibge_pesquisas",
    `Lista as pesquisas disponíveis no IBGE e suas tabelas.

Funcionalidades:
- Lista todas as pesquisas do IBGE (Censos, PNAD, PIB, etc.)
- Busca por nome ou código da pesquisa
- Mostra detalhes e tabelas de uma pesquisa específica
- Categoriza pesquisas por tema

Principais pesquisas:
- **Censos**: Demográfico, Agropecuário, MUNIC
- **PNAD Contínua**: Trabalho, renda, educação
- **Contas Nacionais**: PIB, investimentos
- **Pesquisas Econômicas**: Indústria, Comércio, Serviços
- **Pesquisas Agropecuárias**: Produção, safras, abate
- **Índices de Preços**: IPCA, INPC, custos

Exemplos de uso:
- Listar todas as pesquisas: (sem parâmetros)
- Buscar pesquisas de população: busca="população"
- Detalhes da PNAD: detalhes="pnad"
- Detalhes do Censo: detalhes="CD"`,
    pesquisasSchema.shape,
    async (args) => {
      const result = await ibgePesquisas(args);
      return { content: [{ type: "text", text: result }] };
    }
  );

  // Create STDIO transport
  const transport = new StdioServerTransport();

  // Connect server to transport
  await server.connect(transport);

  // Log startup (to stderr to avoid interfering with STDIO protocol)
  console.error(`${SERVER_NAME} v${SERVER_VERSION} started`);
}

// Run the server
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
