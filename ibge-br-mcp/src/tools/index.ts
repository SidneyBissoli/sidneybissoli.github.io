// Export all tools
export { estadosTool, ibgeEstados, estadosSchema } from "./estados.js";
export { municipiosTool, ibgeMunicipios, municipiosSchema } from "./municipios.js";
export { localidadeTool, ibgeLocalidade, localidadeSchema } from "./localidade.js";
export { populacaoTool, ibgePopulacao, populacaoSchema } from "./populacao.js";
export { sidraTool, ibgeSidra, sidraSchema } from "./sidra.js";
export { nomesTool, ibgeNomes, nomesSchema } from "./nomes.js";
export { noticiasTool, ibgeNoticias, noticiasSchema } from "./noticias.js";

// New tools
export { sidraTabelasTool, ibgeSidraTabelas, sidraTabelasSchema } from "./sidra-tabelas.js";
export { sidraMetadadosTool, ibgeSidraMetadados, sidraMetadadosSchema } from "./sidra-metadados.js";
export { malhasTool, ibgeMalhas, malhasSchema } from "./malhas.js";
export { pesquisasTool, ibgePesquisas, pesquisasSchema } from "./pesquisas.js";

// Tool definitions array for registration
export const tools = [
  {
    name: "ibge_estados",
    description: `Lista todos os estados brasileiros do IBGE.

Funcionalidades:
- Lista todos os 27 estados (26 estados + DF)
- Filtra por região (Norte, Nordeste, Sudeste, Sul, Centro-Oeste)
- Ordena por ID, nome ou sigla

Exemplo de uso:
- Listar todos os estados
- Listar estados do Nordeste
- Listar estados ordenados por sigla`,
  },
  {
    name: "ibge_municipios",
    description: `Lista municípios brasileiros do IBGE.

Funcionalidades:
- Lista municípios de um estado específico (usando a sigla da UF)
- Lista todos os municípios do Brasil (5.570 municípios)
- Busca por nome do município
- Retorna código IBGE de 7 dígitos

Exemplo de uso:
- Listar municípios de São Paulo: uf="SP"
- Buscar município por nome: busca="Campinas"
- Listar municípios de MG que contenham "Belo": uf="MG", busca="Belo"`,
  },
  {
    name: "ibge_localidade",
    description: `Retorna detalhes de uma localidade específica pelo código IBGE.

Funcionalidades:
- Busca informações de estados (código de 2 dígitos)
- Busca informações de municípios (código de 7 dígitos)
- Busca informações de distritos (código de 9 dígitos)
- Retorna hierarquia completa (região, mesorregião, microrregião)

Exemplo de uso:
- Detalhes de São Paulo (estado): codigo=35
- Detalhes de São Paulo (município): codigo=3550308
- Detalhes de um distrito: codigo=355030805`,
  },
  {
    name: "ibge_populacao",
    description: `Retorna a projeção da população brasileira em tempo real.

Funcionalidades:
- Estimativa da população atual do Brasil
- Taxa de nascimentos (tempo médio entre nascimentos)
- Taxa de óbitos (tempo médio entre óbitos)
- Incremento populacional diário

Fonte: IBGE - Projeção da População do Brasil

Nota: Para dados históricos ou por município, use a ferramenta ibge_sidra com as tabelas:
- 6579: Estimativas de população
- 9514: População do Censo 2022`,
  },
  {
    name: "ibge_sidra",
    description: `Consulta tabelas do SIDRA (Sistema IBGE de Recuperação Automática).

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
  },
  {
    name: "ibge_nomes",
    description: `Consulta frequência e ranking de nomes no Brasil (IBGE).

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
  },
  {
    name: "ibge_noticias",
    description: `Busca notícias e releases do IBGE.

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
  },
  {
    name: "ibge_sidra_tabelas",
    description: `Lista e busca tabelas disponíveis no SIDRA (Sistema IBGE de Recuperação Automática).

Funcionalidades:
- Lista todas as tabelas (agregados) do SIDRA
- Busca por termo no nome da tabela
- Filtra por pesquisa (Censo, PNAD, PIB, etc.)
- Mostra o código e nome de cada tabela

Exemplos de uso:
- Listar tabelas: (sem parâmetros)
- Buscar tabelas de população: busca="população"
- Tabelas do Censo: pesquisa="censo"`,
  },
  {
    name: "ibge_sidra_metadados",
    description: `Retorna os metadados de uma tabela SIDRA específica.

Funcionalidades:
- Informações gerais (nome, pesquisa, assunto, periodicidade)
- Níveis territoriais disponíveis (Brasil, UF, município, etc.)
- Lista de variáveis com unidades
- Classificações e categorias de cada variável
- Períodos disponíveis

Exemplos de uso:
- Metadados da tabela de população: tabela="6579"
- Metadados do Censo 2022: tabela="9514"`,
  },
  {
    name: "ibge_malhas",
    description: `Obtém malhas geográficas (mapas) do IBGE em formato GeoJSON, TopoJSON ou SVG.

Funcionalidades:
- Malhas do Brasil, regiões, estados, municípios
- Diferentes níveis de resolução (divisões internas)
- Diferentes níveis de qualidade do traçado
- Formatos: GeoJSON, TopoJSON, SVG

Exemplos de uso:
- Brasil com estados: localidade="BR", resolucao="2"
- São Paulo com municípios: localidade="SP", resolucao="5"
- Município específico: localidade="3550308"`,
  },
  {
    name: "ibge_pesquisas",
    description: `Lista as pesquisas disponíveis no IBGE e suas tabelas.

Funcionalidades:
- Lista todas as pesquisas do IBGE (Censos, PNAD, PIB, etc.)
- Busca por nome ou código da pesquisa
- Mostra detalhes e tabelas de uma pesquisa específica
- Categoriza pesquisas por tema

Exemplos de uso:
- Listar todas as pesquisas: (sem parâmetros)
- Buscar pesquisas de população: busca="população"
- Detalhes da PNAD: detalhes="pnad"`,
  },
];
