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
  censoSchema,
  ibgeCenso,
  // Phase 1 tools (v1.4.0)
  indicadoresSchema,
  ibgeIndicadores,
  cnaeSchema,
  ibgeCnae,
  geocodigoSchema,
  ibgeGeocodigo,
  // Phase 2 tools (v1.5.0)
  calendarioSchema,
  ibgeCalendario,
  compararSchema,
  ibgeComparar,
  // Phase 3 tools (v1.6.0)
  malhasTemaSchema,
  ibgeMalhasTema,
  vizinhosSchema,
  ibgeVizinhos,
  bcbSchema,
  ibgeBcb,
  datasaudeSchema,
  ibgeDatasaude,
  // Phase 4 tools (v1.9.0)
  paisesSchema,
  ibgePaises,
  cidadesSchema,
  ibgeCidades,
} from "./tools/index.js";

// Server metadata
const SERVER_NAME = "ibge-br-mcp";
const SERVER_VERSION = "1.9.0";

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

Níveis territoriais (todos suportados):
- 1: Brasil
- 2: Grande Região (Norte, Nordeste, etc.)
- 3: UF (Unidade da Federação)
- 6: Município
- 7: Região Metropolitana
- 8: Mesorregião Geográfica
- 9: Microrregião Geográfica
- 10: Distrito
- 11: Subdistrito
- 13: Região Metropolitana e RIDE
- 14: Região Integrada de Desenvolvimento
- 15: Aglomeração Urbana
- 17: Região Geográfica Imediata
- 18: Região Geográfica Intermediária
- 105: Macrorregião de Saúde
- 106: Região de Saúde
- 114: Aglomerado Subnormal
- 127: Amazônia Legal
- 128: Semiárido

Exemplos de uso:
- População do Brasil 2023: tabela="6579", periodos="2023"
- População por Região de Saúde: tabela="6579", nivel_territorial="106"
- Censo 2022 por município: tabela="9514", nivel_territorial="6", localidades="3550308"
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

  // Register ibge_censo tool
  server.tool(
    "ibge_censo",
    `Consulta dados dos Censos Demográficos do IBGE (1970-2022).

Ferramenta simplificada para acessar dados censitários sem precisar saber os códigos das tabelas SIDRA.

Anos disponíveis: 1970, 1980, 1991, 2000, 2010, 2022

Temas disponíveis:
- populacao: População residente por sexo e situação
- alfabetizacao: Taxa de alfabetização
- domicilios: Características dos domicílios
- idade_sexo: Pirâmide etária / grupos de idade
- religiao: Distribuição por religião
- cor_raca: Cor ou raça
- rendimento: Rendimento mensal
- migracao: Migração
- educacao: Nível de instrução
- trabalho: Ocupação e trabalho
- listar: Lista todas as tabelas disponíveis

Exemplos de uso:
- População 2022: ano="2022", tema="populacao"
- Série histórica: ano="todos", tema="populacao"
- Alfabetização 2010 por UF: ano="2010", tema="alfabetizacao", nivel_territorial="3"
- Ver tabelas disponíveis: tema="listar"
- População de um município: ano="2022", nivel_territorial="6", localidades="3550308"`,
    censoSchema.shape,
    async (args) => {
      const result = await ibgeCenso(args);
      return { content: [{ type: "text", text: result }] };
    }
  );

  // Register ibge_indicadores tool (Phase 1)
  server.tool(
    "ibge_indicadores",
    `Consulta indicadores econômicos e sociais do IBGE.

Indicadores disponíveis:

**Econômicos:**
- pib: PIB a preços correntes
- pib_variacao: Variação do PIB (%)
- pib_per_capita: PIB per capita
- industria: Produção industrial
- comercio: Vendas do comércio
- servicos: Volume de serviços

**Preços:**
- ipca: IPCA mensal
- ipca_acumulado: IPCA 12 meses
- inpc: INPC mensal

**Trabalho:**
- desemprego: Taxa de desocupação
- ocupacao: Pessoas ocupadas
- rendimento: Rendimento médio
- informalidade: Taxa de informalidade

**População:**
- populacao: Estimativa populacional
- densidade: Densidade demográfica

**Agropecuária:**
- agricultura: Produção agrícola
- pecuaria: Efetivo de rebanhos

Exemplos de uso:
- PIB: indicador="pib"
- IPCA últimos 12 meses: indicador="ipca", periodos="last 12"
- Desemprego por UF: indicador="desemprego", nivel_territorial="3"
- Listar indicadores: indicador="listar"
- Indicadores de preços: categoria="precos"`,
    indicadoresSchema.shape,
    async (args) => {
      const result = await ibgeIndicadores(args);
      return { content: [{ type: "text", text: result }] };
    }
  );

  // Register ibge_cnae tool (Phase 1)
  server.tool(
    "ibge_cnae",
    `Consulta a CNAE (Classificação Nacional de Atividades Econômicas) do IBGE.

A CNAE é a classificação oficial para identificar atividades econômicas no Brasil.

Estrutura hierárquica:
- Seção (letra A-U): 21 categorias principais
- Divisão (2 dígitos): 87 divisões
- Grupo (3 dígitos): 285 grupos
- Classe (4-5 dígitos): 673 classes
- Subclasse (7 dígitos): 1.332 subclasses

Funcionalidades:
- Busca por código CNAE
- Busca por descrição da atividade
- Listagem por nível hierárquico
- Mostra hierarquia completa

Exemplos de uso:
- Buscar software: busca="software"
- Código específico: codigo="6201-5/01"
- Ver seção: codigo="J"
- Listar divisões: nivel="divisoes"
- Ver estrutura: (sem parâmetros)`,
    cnaeSchema.shape,
    async (args) => {
      const result = await ibgeCnae(args);
      return { content: [{ type: "text", text: result }] };
    }
  );

  // Register ibge_geocodigo tool (Phase 1)
  server.tool(
    "ibge_geocodigo",
    `Decodifica códigos IBGE ou busca códigos pelo nome da localidade.

Funcionalidades:
- Decodifica códigos de região, UF, município ou distrito
- Busca código IBGE pelo nome
- Mostra hierarquia geográfica completa
- Retorna códigos relacionados

Estrutura dos códigos:
- 1 dígito: Região (1=Norte, 2=Nordeste, 3=Sudeste, 4=Sul, 5=Centro-Oeste)
- 2 dígitos: UF (11-53)
- 7 dígitos: Município
- 9 dígitos: Distrito

Exemplos de uso:
- Decodificar município: codigo="3550308"
- Decodificar UF: codigo="35"
- Buscar por nome: nome="São Paulo"
- Buscar município em UF: nome="Campinas", uf="SP"`,
    geocodigoSchema.shape,
    async (args) => {
      const result = await ibgeGeocodigo(args);
      return { content: [{ type: "text", text: result }] };
    }
  );

  // Register ibge_calendario tool (Phase 2)
  server.tool(
    "ibge_calendario",
    `Consulta o calendário de divulgações e coletas do IBGE.

Funcionalidades:
- Lista próximas divulgações de pesquisas
- Filtra por produto (IPCA, PNAD, PIB, etc.)
- Filtra por período
- Diferencia divulgações e coletas de campo

Tipos de eventos:
- **Divulgação**: Publicação de resultados de pesquisas
- **Coleta**: Período de pesquisa de campo

Exemplos de uso:
- Próximas divulgações: (sem parâmetros)
- Divulgações do IPCA: produto="IPCA"
- Calendário 2024: de="01-01-2024", ate="12-31-2024"
- Coletas de campo: tipo="coleta"`,
    calendarioSchema.shape,
    async (args) => {
      const result = await ibgeCalendario(args);
      return { content: [{ type: "text", text: result }] };
    }
  );

  // Register ibge_comparar tool (Phase 2)
  server.tool(
    "ibge_comparar",
    `Compara dados entre localidades (municípios ou UFs).

Indicadores disponíveis:
- populacao: Estimativa populacional atual
- populacao_censo: População do Censo 2022
- pib: PIB per capita
- area: Área territorial (km²)
- densidade: Densidade demográfica (hab/km²)
- alfabetizacao: Taxa de alfabetização
- domicilios: Número de domicílios

Funcionalidades:
- Compara até 10 localidades de uma vez
- Calcula estatísticas (maior, menor, média, variação)
- Gera ranking ordenado por valor
- Aceita códigos de municípios (7 dígitos) ou UFs (2 dígitos)

Exemplos de uso:
- Comparar capitais: localidades="3550308,3304557,4106902", indicador="populacao"
- Comparar estados: localidades="35,33,41", indicador="pib"
- Ranking por área: localidades="3550308,3304557", formato="ranking"
- Listar indicadores: indicador="listar"`,
    compararSchema.shape,
    async (args) => {
      const result = await ibgeComparar(args);
      return { content: [{ type: "text", text: result }] };
    }
  );

  // Register ibge_malhas_tema tool (Phase 3)
  server.tool(
    "ibge_malhas_tema",
    `Obtém malhas geográficas temáticas do IBGE.

Temas disponíveis:
- biomas: Biomas brasileiros (Amazônia, Cerrado, Mata Atlântica, Caatinga, Pampa, Pantanal)
- amazonia_legal: Área da Amazônia Legal
- semiarido: Região do semiárido brasileiro
- costeiro: Zona costeira
- fronteira: Faixa de fronteira
- metropolitana: Regiões metropolitanas
- ride: Regiões Integradas de Desenvolvimento

Códigos de Biomas:
- 1: Amazônia
- 2: Cerrado
- 3: Mata Atlântica
- 4: Caatinga
- 5: Pampa
- 6: Pantanal

Exemplos de uso:
- Todos os biomas: tema="biomas"
- Bioma Amazônia: tema="biomas", codigo="1"
- Amazônia Legal: tema="amazonia_legal"
- Regiões metropolitanas: tema="metropolitana"
- Com municípios: tema="biomas", resolucao="5"
- Listar temas: tema="listar"`,
    malhasTemaSchema.shape,
    async (args) => {
      const result = await ibgeMalhasTema(args);
      return { content: [{ type: "text", text: result }] };
    }
  );

  // Register ibge_vizinhos tool (Phase 3)
  server.tool(
    "ibge_vizinhos",
    `Busca municípios próximos/vizinhos de um município.

Funcionalidades:
- Busca por código IBGE (7 dígitos) ou nome do município
- Retorna municípios da mesma mesorregião (aproximação de vizinhança)
- Opcionalmente inclui dados populacionais

Nota: A busca usa mesorregião como proxy de proximidade geográfica.
Para vizinhança espacial exata, seria necessário processamento de malhas.

Exemplos de uso:
- Por código: municipio="3550308"
- Por nome: municipio="Campinas", uf="SP"
- Com população: municipio="3550308", incluir_dados=true`,
    vizinhosSchema.shape,
    async (args) => {
      const result = await ibgeVizinhos(args);
      return { content: [{ type: "text", text: result }] };
    }
  );

  // Register bcb tool (Phase 3)
  server.tool(
    "bcb",
    `Consulta dados do Banco Central do Brasil (BCB).

Indicadores de Taxas de Juros:
- selic: Taxa SELIC acumulada
- cdi: Taxa CDI
- tr: Taxa Referencial

Indicadores de Inflação:
- ipca: IPCA mensal
- ipca_acum: IPCA acumulado 12 meses
- igpm: IGP-M
- inpc: INPC

Indicadores de Câmbio:
- dolar_compra/dolar_venda: Dólar comercial
- euro: Euro

Indicadores Macroeconômicos:
- desemprego: Taxa de desemprego
- divida_pib: Dívida pública/PIB
- reservas: Reservas internacionais

Também aceita códigos numéricos do Sistema SGS do BCB.

Exemplos de uso:
- SELIC últimos 12 meses: indicador="selic", ultimos=12
- IPCA de 2023: indicador="ipca", dataInicio="01/01/2023", dataFim="31/12/2023"
- Dólar recente: indicador="dolar_venda", ultimos=30
- Listar indicadores: indicador="listar"`,
    bcbSchema.shape,
    async (args) => {
      const result = await ibgeBcb(args);
      return { content: [{ type: "text", text: result }] };
    }
  );

  // Register datasaude tool (Phase 3)
  server.tool(
    "datasaude",
    `Consulta indicadores de saúde do Brasil via IBGE/DataSUS.

Mortalidade e Natalidade:
- mortalidade_infantil: Taxa de mortalidade infantil
- nascidos_vivos: Nascidos vivos por local
- obitos: Óbitos por local de residência
- obitos_causas: Óbitos por causas (CID-10)

Indicadores Demográficos:
- esperanca_vida: Esperança de vida ao nascer
- fecundidade: Taxa de fecundidade

Saneamento:
- saneamento_agua: Abastecimento de água
- saneamento_esgoto: Esgotamento sanitário

Cobertura de Saúde:
- plano_saude: Cobertura de plano de saúde
- autoavaliacao_saude: Autoavaliação do estado de saúde

Níveis territoriais: 1=Brasil, 2=Região, 3=UF, 6=Município

Exemplos de uso:
- Mortalidade infantil: indicador="mortalidade_infantil"
- Esperança de vida por UF: indicador="esperanca_vida", nivel_territorial="3"
- Óbitos em SP: indicador="obitos", nivel_territorial="3", localidade="35"
- Listar indicadores: indicador="listar"`,
    datasaudeSchema.shape,
    async (args) => {
      const result = await ibgeDatasaude(args);
      return { content: [{ type: "text", text: result }] };
    }
  );

  // Register ibge_paises tool (Phase 4)
  server.tool(
    "ibge_paises",
    `Consulta dados de países e territórios internacionais via IBGE.

Funcionalidades:
- Lista todos os países (seguindo metodologia M49 da ONU)
- Detalhes de um país específico (área, línguas, moeda, localização)
- Busca países por nome
- Filtra por região/continente

Regiões disponíveis: americas, europa, africa, asia, oceania

Códigos de países: Use ISO-ALPHA-2 (ex: BR, US, AR, PT, JP)

Exemplos de uso:
- Listar todos: tipo="listar"
- Detalhes do Brasil: tipo="detalhes", pais="BR"
- Buscar: tipo="buscar", busca="Argentina"
- Países da América: tipo="listar", regiao="americas"
- Indicadores disponíveis: tipo="indicadores"`,
    paisesSchema.shape,
    async (args) => {
      const result = await ibgePaises(args);
      return { content: [{ type: "text", text: result }] };
    }
  );

  // Register ibge_cidades tool (Phase 4)
  server.tool(
    "ibge_cidades",
    `Consulta indicadores municipais do IBGE (similar ao portal Cidades@).

Funcionalidades:
- Panorama geral de um município (população, IDH, PIB, etc.)
- Consulta indicadores específicos
- Histórico de indicadores ao longo dos anos
- Lista pesquisas e indicadores disponíveis

Indicadores disponíveis: populacao, area, densidade, pib_per_capita, idh,
escolarizacao, mortalidade, salario_medio, receitas, despesas

Exemplos de uso:
- Panorama de São Paulo: tipo="panorama", municipio="3550308"
- Histórico de população: tipo="historico", municipio="3550308", indicador="populacao"
- Ver pesquisas: tipo="pesquisas"
- Indicadores disponíveis: tipo="indicador"`,
    cidadesSchema.shape,
    async (args) => {
      const result = await ibgeCidades(args);
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
