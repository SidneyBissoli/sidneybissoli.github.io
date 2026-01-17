import { z } from "zod";
import { IBGE_API, type Municipio, type MunicipioSimples } from "../types.js";

// Schema for the tool input
export const municipiosSchema = z.object({
  uf: z
    .string()
    .length(2)
    .optional()
    .describe("Sigla do estado (ex: SP, RJ, MG). Se não informado, retorna todos os municípios do Brasil."),
  busca: z
    .string()
    .optional()
    .describe("Termo para buscar no nome do município"),
  limite: z
    .number()
    .min(1)
    .max(5570)
    .optional()
    .default(100)
    .describe("Número máximo de resultados (padrão: 100, máximo: 5570)"),
});

export type MunicipiosInput = z.infer<typeof municipiosSchema>;

// Map of state abbreviations to IDs
const UF_IDS: Record<string, number> = {
  RO: 11, AC: 12, AM: 13, RR: 14, PA: 15, AP: 16, TO: 17,
  MA: 21, PI: 22, CE: 23, RN: 24, PB: 25, PE: 26, AL: 27, SE: 28, BA: 29,
  MG: 31, ES: 32, RJ: 33, SP: 35,
  PR: 41, SC: 42, RS: 43,
  MS: 50, MT: 51, GO: 52, DF: 53,
};

/**
 * Fetches municipalities from IBGE API
 */
export async function ibgeMunicipios(input: MunicipiosInput): Promise<string> {
  try {
    let url: string;

    if (input.uf) {
      const ufUpper = input.uf.toUpperCase();
      const ufId = UF_IDS[ufUpper];

      if (!ufId) {
        return `UF inválida: ${input.uf}. Use a sigla do estado (ex: SP, RJ, MG).`;
      }

      url = `${IBGE_API.LOCALIDADES}/estados/${ufId}/municipios`;
    } else {
      url = `${IBGE_API.LOCALIDADES}/municipios`;
    }

    url += "?orderBy=nome";

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Erro na API do IBGE: ${response.status} ${response.statusText}`);
    }

    let municipios: (Municipio | MunicipioSimples)[] = await response.json();

    // Filter by search term if provided
    if (input.busca) {
      const busca = input.busca.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      municipios = municipios.filter((m) => {
        const nome = m.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return nome.includes(busca);
      });
    }

    const total = municipios.length;

    // Apply limit
    if (input.limite && input.limite < municipios.length) {
      municipios = municipios.slice(0, input.limite);
    }

    if (municipios.length === 0) {
      return input.busca
        ? `Nenhum município encontrado com o termo "${input.busca}"${input.uf ? ` em ${input.uf.toUpperCase()}` : ""}.`
        : "Nenhum município encontrado.";
    }

    // Format the response
    let output = `## Municípios${input.uf ? ` - ${input.uf.toUpperCase()}` : " do Brasil"}\n\n`;

    if (input.busca) {
      output += `Busca: "${input.busca}"\n`;
    }

    output += `Mostrando: ${municipios.length} de ${total} municípios\n\n`;
    output += "| Código IBGE | Nome |\n";
    output += "|------------:|:-----|\n";

    for (const municipio of municipios) {
      output += `| ${municipio.id} | ${municipio.nome} |\n`;
    }

    if (municipios.length < total) {
      output += `\n_Resultados limitados a ${input.limite}. Use o parâmetro 'limite' para ver mais._\n`;
    }

    return output;
  } catch (error) {
    if (error instanceof Error) {
      return `Erro ao buscar municípios: ${error.message}`;
    }
    return "Erro desconhecido ao buscar municípios.";
  }
}

// Tool definition for MCP
export const municipiosTool = {
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
  inputSchema: municipiosSchema,
  handler: ibgeMunicipios,
};
