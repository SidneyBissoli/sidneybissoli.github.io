import { z } from "zod";
import { cacheKey, CACHE_TTL, cachedFetch } from "../cache.js";

// OpenDataSUS and IBGE APIs for health data
const API_URLS = {
  // IBGE health indicators via SIDRA
  SIDRA: "https://apisidra.ibge.gov.br/values",
  // Direct health data sources
  VACINACAO: "https://imunizacao-es.saude.gov.br/_search",
};

// Health indicators available via IBGE SIDRA
const INDICADORES_SAUDE: Record<string, {
  tabela: string;
  variaveis?: string;
  nome: string;
  descricao: string;
  fonte: string;
}> = {
  mortalidade_infantil: {
    tabela: "793",
    nome: "Mortalidade Infantil",
    descricao: "Taxa de mortalidade infantil (por mil nascidos vivos)",
    fonte: "IBGE - Estatísticas do Registro Civil",
  },
  esperanca_vida: {
    tabela: "7362",
    nome: "Esperança de Vida",
    descricao: "Esperança de vida ao nascer",
    fonte: "IBGE - Projeções da População",
  },
  nascidos_vivos: {
    tabela: "2612",
    nome: "Nascidos Vivos",
    descricao: "Nascidos vivos por local de residência da mãe",
    fonte: "IBGE - Estatísticas do Registro Civil",
  },
  obitos: {
    tabela: "2681",
    nome: "Óbitos",
    descricao: "Óbitos por local de residência",
    fonte: "IBGE - Estatísticas do Registro Civil",
  },
  obitos_causas: {
    tabela: "5457",
    nome: "Óbitos por Causas",
    descricao: "Óbitos por grupos de causas - CID-10",
    fonte: "IBGE - Estatísticas do Registro Civil",
  },
  fecundidade: {
    tabela: "7358",
    nome: "Taxa de Fecundidade",
    descricao: "Taxa de fecundidade total",
    fonte: "IBGE - Projeções da População",
  },
  saneamento_agua: {
    tabela: "1395",
    nome: "Abastecimento de Água",
    descricao: "Domicílios por forma de abastecimento de água",
    fonte: "IBGE - Censo Demográfico / PNAD",
  },
  saneamento_esgoto: {
    tabela: "1396",
    nome: "Esgotamento Sanitário",
    descricao: "Domicílios por tipo de esgotamento sanitário",
    fonte: "IBGE - Censo Demográfico / PNAD",
  },
  plano_saude: {
    tabela: "6037",
    nome: "Cobertura de Plano de Saúde",
    descricao: "Pessoas com plano de saúde",
    fonte: "IBGE - PNAD",
  },
  autoavaliacao_saude: {
    tabela: "6034",
    nome: "Autoavaliação de Saúde",
    descricao: "Pessoas por autoavaliação do estado de saúde",
    fonte: "IBGE - PNS",
  },
};

// Schema for the tool input
export const datasaudeSchema = z.object({
  indicador: z
    .string()
    .describe(`Indicador de saúde. Disponíveis:
- mortalidade_infantil: Taxa de mortalidade infantil
- esperanca_vida: Esperança de vida ao nascer
- nascidos_vivos: Nascidos vivos
- obitos: Óbitos por local de residência
- obitos_causas: Óbitos por causas (CID-10)
- fecundidade: Taxa de fecundidade
- saneamento_agua: Abastecimento de água
- saneamento_esgoto: Esgotamento sanitário
- plano_saude: Cobertura de plano de saúde
- listar: Lista indicadores disponíveis`),
  nivel_territorial: z
    .string()
    .optional()
    .default("1")
    .describe("1=Brasil, 2=Região, 3=UF, 6=Município"),
  localidade: z
    .string()
    .optional()
    .default("all")
    .describe("Código da localidade ou 'all'"),
  periodo: z
    .string()
    .optional()
    .default("last")
    .describe("Período: 'last', 'all', ou ano específico"),
  formato: z
    .enum(["tabela", "json"])
    .optional()
    .default("tabela")
    .describe("Formato de saída"),
});

export type DatasaudeInput = z.infer<typeof datasaudeSchema>;

/**
 * Fetches health data from IBGE and DataSUS
 */
export async function ibgeDatasaude(input: DatasaudeInput): Promise<string> {
  // List indicators
  if (input.indicador === "listar") {
    return listHealthIndicators();
  }

  const indicadorInfo = INDICADORES_SAUDE[input.indicador.toLowerCase()];

  if (!indicadorInfo) {
    return `Indicador "${input.indicador}" não encontrado.\n\n` +
           `Use indicador="listar" para ver indicadores disponíveis.`;
  }

  try {
    // Build SIDRA query
    const url = buildSidraUrl(
      indicadorInfo.tabela,
      input.nivel_territorial!,
      input.localidade!,
      input.periodo!
    );

    const key = cacheKey(url);

    // Try to fetch with cache (shorter TTL for health data)
    let data: SidraData[];
    try {
      data = await cachedFetch<SidraData[]>(url, key, CACHE_TTL.SHORT);
    } catch {
      // Fallback without cache
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Erro na API SIDRA: ${response.status}`);
      }
      data = await response.json();
    }

    if (!data || data.length === 0) {
      return `Nenhum dado encontrado para ${indicadorInfo.nome}.`;
    }

    return formatResponse(data, indicadorInfo, input);
  } catch (error) {
    if (error instanceof Error) {
      return `Erro ao consultar dados de saúde: ${error.message}`;
    }
    return "Erro desconhecido ao consultar dados de saúde.";
  }
}

interface SidraData {
  [key: string]: string;
}

function buildSidraUrl(
  tabela: string,
  nivel: string,
  localidade: string,
  periodo: string
): string {
  let path = `/t/${tabela}`;
  path += `/n${nivel}/${localidade}`;
  path += `/v/allxp`;
  path += `/p/${periodo}`;

  return `${API_URLS.SIDRA}${path}`;
}

function listHealthIndicators(): string {
  let output = "## Indicadores de Saúde Disponíveis\n\n";

  output += "### Mortalidade e Natalidade\n\n";
  output += "| Indicador | Nome | Descrição |\n";
  output += "|:----------|:-----|:----------|\n";
  output += `| \`mortalidade_infantil\` | ${INDICADORES_SAUDE.mortalidade_infantil.nome} | ${INDICADORES_SAUDE.mortalidade_infantil.descricao} |\n`;
  output += `| \`nascidos_vivos\` | ${INDICADORES_SAUDE.nascidos_vivos.nome} | ${INDICADORES_SAUDE.nascidos_vivos.descricao} |\n`;
  output += `| \`obitos\` | ${INDICADORES_SAUDE.obitos.nome} | ${INDICADORES_SAUDE.obitos.descricao} |\n`;
  output += `| \`obitos_causas\` | ${INDICADORES_SAUDE.obitos_causas.nome} | ${INDICADORES_SAUDE.obitos_causas.descricao} |\n`;

  output += "\n### Indicadores Demográficos\n\n";
  output += "| Indicador | Nome | Descrição |\n";
  output += "|:----------|:-----|:----------|\n";
  output += `| \`esperanca_vida\` | ${INDICADORES_SAUDE.esperanca_vida.nome} | ${INDICADORES_SAUDE.esperanca_vida.descricao} |\n`;
  output += `| \`fecundidade\` | ${INDICADORES_SAUDE.fecundidade.nome} | ${INDICADORES_SAUDE.fecundidade.descricao} |\n`;

  output += "\n### Saneamento\n\n";
  output += "| Indicador | Nome | Descrição |\n";
  output += "|:----------|:-----|:----------|\n";
  output += `| \`saneamento_agua\` | ${INDICADORES_SAUDE.saneamento_agua.nome} | ${INDICADORES_SAUDE.saneamento_agua.descricao} |\n`;
  output += `| \`saneamento_esgoto\` | ${INDICADORES_SAUDE.saneamento_esgoto.nome} | ${INDICADORES_SAUDE.saneamento_esgoto.descricao} |\n`;

  output += "\n### Cobertura de Saúde\n\n";
  output += "| Indicador | Nome | Descrição |\n";
  output += "|:----------|:-----|:----------|\n";
  output += `| \`plano_saude\` | ${INDICADORES_SAUDE.plano_saude.nome} | ${INDICADORES_SAUDE.plano_saude.descricao} |\n`;
  output += `| \`autoavaliacao_saude\` | ${INDICADORES_SAUDE.autoavaliacao_saude.nome} | ${INDICADORES_SAUDE.autoavaliacao_saude.descricao} |\n`;

  output += "\n### Níveis Territoriais\n\n";
  output += "| Código | Descrição |\n";
  output += "|:------:|:----------|\n";
  output += "| 1 | Brasil |\n";
  output += "| 2 | Grande Região |\n";
  output += "| 3 | Unidade da Federação |\n";
  output += "| 6 | Município |\n";

  output += "\n### Exemplos de Uso\n\n";
  output += "```\n";
  output += "# Mortalidade infantil no Brasil\n";
  output += 'datasaude(indicador="mortalidade_infantil")\n\n';
  output += "# Esperança de vida por UF\n";
  output += 'datasaude(indicador="esperanca_vida", nivel_territorial="3")\n\n';
  output += "# Óbitos em São Paulo (código 35)\n";
  output += 'datasaude(indicador="obitos", nivel_territorial="3", localidade="35")\n\n';
  output += "# Série histórica de nascidos vivos\n";
  output += 'datasaude(indicador="nascidos_vivos", periodo="all")\n';
  output += "```\n";

  return output;
}

function formatResponse(
  data: SidraData[],
  indicadorInfo: typeof INDICADORES_SAUDE[string],
  input: DatasaudeInput
): string {
  let output = `## ${indicadorInfo.nome}\n\n`;
  output += `**Descrição:** ${indicadorInfo.descricao}\n`;
  output += `**Fonte:** ${indicadorInfo.fonte}\n\n`;

  if (data.length === 0) {
    return output + "Nenhum dado encontrado.\n";
  }

  // Get headers from first row
  const headers = data[0];
  const rows = data.slice(1);

  if (input.formato === "json") {
    output += "### Dados\n\n```json\n";
    output += JSON.stringify(rows, null, 2);
    output += "\n```\n";
    return output;
  }

  // Table format
  output += "### Dados\n\n";

  const columns = Object.keys(headers);

  // Build table header
  output += "| " + columns.map((col) => headers[col] || col).join(" | ") + " |\n";
  output += "|" + columns.map(() => "---").join("|") + "|\n";

  // Build table rows (limit to 30)
  const displayRows = rows.slice(0, 30);

  for (const row of displayRows) {
    const values = columns.map((col) => {
      const value = row[col];
      // Format numbers
      if (value && !isNaN(Number(value)) && value.length > 3) {
        return Number(value).toLocaleString("pt-BR");
      }
      return value || "-";
    });
    output += "| " + values.join(" | ") + " |\n";
  }

  if (rows.length > 30) {
    output += `\n_Mostrando 30 de ${rows.length} registros._\n`;
  }

  return output;
}

// Tool definition
export const datasaudeTool = {
  name: "datasaude",
  description: `Consulta indicadores de saúde do Brasil via IBGE/DataSUS.

Indicadores disponíveis:
- mortalidade_infantil: Taxa de mortalidade infantil
- esperanca_vida: Esperança de vida ao nascer
- nascidos_vivos: Nascidos vivos
- obitos: Óbitos por local
- obitos_causas: Óbitos por causas (CID-10)
- fecundidade: Taxa de fecundidade
- saneamento_agua/saneamento_esgoto: Saneamento básico
- plano_saude: Cobertura de plano de saúde
- listar: Lista todos os indicadores

Níveis territoriais: 1=Brasil, 2=Região, 3=UF, 6=Município

Exemplos:
- Mortalidade infantil: indicador="mortalidade_infantil"
- Esperança de vida por UF: indicador="esperanca_vida", nivel_territorial="3"
- Óbitos em SP: indicador="obitos", nivel_territorial="3", localidade="35"`,
  inputSchema: datasaudeSchema,
  handler: ibgeDatasaude,
};
