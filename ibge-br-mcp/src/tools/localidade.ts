import { z } from "zod";
import { IBGE_API, type Municipio, type UF, type Distrito } from "../types.js";
import { cacheKey, CACHE_TTL, cachedFetch } from "../cache.js";
import { withMetrics } from "../metrics.js";
import { createKeyValueTable } from "../utils/index.js";

// Schema for the tool input
export const localidadeSchema = z.object({
  codigo: z
    .number()
    .describe(
      "Código IBGE da localidade (estado: 2 dígitos, município: 7 dígitos, distrito: 9 dígitos)"
    ),
  tipo: z
    .enum(["estado", "municipio", "distrito"])
    .optional()
    .describe("Tipo da localidade. Se não informado, será inferido pelo tamanho do código."),
});

export type LocalidadeInput = z.infer<typeof localidadeSchema>;

/**
 * Fetches details of a specific location from IBGE API
 */
export async function ibgeLocalidade(input: LocalidadeInput): Promise<string> {
  return withMetrics("ibge_localidade", "localidades", async () => {
    try {
      const codigoStr = input.codigo.toString();
      let tipo = input.tipo;

      // Infer type from code length if not provided
      if (!tipo) {
        if (codigoStr.length <= 2) {
          tipo = "estado";
        } else if (codigoStr.length <= 7) {
          tipo = "municipio";
        } else {
          tipo = "distrito";
        }
      }

      let url: string;
      switch (tipo) {
        case "estado":
          url = `${IBGE_API.LOCALIDADES}/estados/${input.codigo}`;
          break;
        case "municipio":
          url = `${IBGE_API.LOCALIDADES}/municipios/${input.codigo}`;
          break;
        case "distrito":
          url = `${IBGE_API.LOCALIDADES}/distritos/${input.codigo}`;
          break;
        default:
          return "Tipo de localidade inválido.";
      }

      // Use cache for static location data (24 hours TTL)
      const key = cacheKey(url);
      let data: unknown;

      try {
        data = await cachedFetch<unknown>(url, key, CACHE_TTL.STATIC);
      } catch (error) {
        if (error instanceof Error && error.message.includes("404")) {
          return `Localidade não encontrada com o código ${input.codigo}.`;
        }
        throw error;
      }

      // Check if empty response
      if (!data || (Array.isArray(data) && data.length === 0)) {
        return `Localidade não encontrada com o código ${input.codigo}.`;
      }

      // Handle array response (some endpoints return arrays)
      const localidade = Array.isArray(data) ? data[0] : data;

      if (!localidade) {
        return `Localidade não encontrada com o código ${input.codigo}.`;
      }

      // Format response based on type
      switch (tipo) {
        case "estado":
          return formatEstado(localidade as UF);
        case "municipio":
          return formatMunicipio(localidade as Municipio);
        case "distrito":
          return formatDistrito(localidade as Distrito);
        default:
          return "Tipo de localidade não suportado.";
      }
    } catch (error) {
      if (error instanceof Error) {
        return `Erro ao buscar localidade: ${error.message}`;
      }
      return "Erro desconhecido ao buscar localidade.";
    }
  });
}

function formatEstado(estado: UF): string {
  let output = `## Estado: ${estado.nome}\n\n`;

  output += createKeyValueTable({
    "**Código IBGE**": estado.id,
    "**Sigla**": estado.sigla,
    "**Nome**": estado.nome,
    "**Região**": `${estado.regiao.nome} (${estado.regiao.sigla})`,
  });

  return output;
}

function formatMunicipio(municipio: Municipio): string {
  let output = `## Município: ${municipio.nome}\n\n`;

  const data: Record<string, string | number | undefined> = {
    "**Código IBGE**": municipio.id,
    "**Nome**": municipio.nome,
  };

  if (municipio.microrregiao) {
    data["**Microrregião**"] = municipio.microrregiao.nome;

    if (municipio.microrregiao.mesorregiao) {
      data["**Mesorregião**"] = municipio.microrregiao.mesorregiao.nome;

      if (municipio.microrregiao.mesorregiao.UF) {
        const uf = municipio.microrregiao.mesorregiao.UF;
        data["**Estado**"] = `${uf.nome} (${uf.sigla})`;
        data["**Região**"] = uf.regiao.nome;
      }
    }
  }

  if (municipio["regiao-imediata"]) {
    data["**Região Imediata**"] = municipio["regiao-imediata"].nome;

    if (municipio["regiao-imediata"]["regiao-intermediaria"]) {
      data["**Região Intermediária**"] = municipio["regiao-imediata"]["regiao-intermediaria"].nome;
    }
  }

  output += createKeyValueTable(data);

  return output;
}

function formatDistrito(distrito: Distrito): string {
  let output = `## Distrito: ${distrito.nome}\n\n`;

  const data: Record<string, string | number | undefined> = {
    "**Código IBGE**": distrito.id,
    "**Nome**": distrito.nome,
  };

  if (distrito.municipio) {
    data["**Município**"] = distrito.municipio.nome;

    if (distrito.municipio.microrregiao?.mesorregiao?.UF) {
      const uf = distrito.municipio.microrregiao.mesorregiao.UF;
      data["**Estado**"] = `${uf.nome} (${uf.sigla})`;
    }
  }

  output += createKeyValueTable(data);

  return output;
}

// Tool definition for MCP
export const localidadeTool = {
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
  inputSchema: localidadeSchema,
  handler: ibgeLocalidade,
};
