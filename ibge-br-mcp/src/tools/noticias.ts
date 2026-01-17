import { z } from "zod";
import { IBGE_API, type NoticiasResponse, type Noticia } from "../types.js";

// Schema for the tool input
export const noticiasSchema = z.object({
  busca: z
    .string()
    .optional()
    .describe("Termo para buscar nas notícias"),
  quantidade: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .default(10)
    .describe("Quantidade de notícias a retornar (padrão: 10, máximo: 100)"),
  pagina: z
    .number()
    .min(1)
    .optional()
    .default(1)
    .describe("Número da página para paginação"),
  de: z
    .string()
    .optional()
    .describe("Data inicial no formato MM-DD-AAAA (ex: 01-01-2024)"),
  ate: z
    .string()
    .optional()
    .describe("Data final no formato MM-DD-AAAA (ex: 12-31-2024)"),
  tipo: z
    .enum(["release", "noticia"])
    .optional()
    .describe("Tipo de publicação: 'release' ou 'noticia'"),
  destaque: z
    .boolean()
    .optional()
    .describe("Filtrar apenas notícias em destaque"),
});

export type NoticiasInput = z.infer<typeof noticiasSchema>;

/**
 * Fetches news from IBGE API
 */
export async function ibgeNoticias(input: NoticiasInput): Promise<string> {
  try {
    const params = new URLSearchParams();

    params.append("qtd", input.quantidade?.toString() || "10");
    params.append("page", input.pagina?.toString() || "1");

    if (input.busca) {
      params.append("busca", input.busca);
    }
    if (input.de) {
      params.append("de", input.de);
    }
    if (input.ate) {
      params.append("ate", input.ate);
    }
    if (input.tipo) {
      params.append("tipo", input.tipo);
    }
    if (input.destaque !== undefined) {
      params.append("destaque", input.destaque ? "1" : "0");
    }

    const url = `${IBGE_API.NOTICIAS}?${params.toString()}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Erro na API do IBGE: ${response.status} ${response.statusText}`);
    }

    const data: NoticiasResponse = await response.json();

    if (!data.items || data.items.length === 0) {
      return input.busca
        ? `Nenhuma notícia encontrada para: "${input.busca}"`
        : "Nenhuma notícia encontrada.";
    }

    return formatNoticiasResponse(data, input);
  } catch (error) {
    if (error instanceof Error) {
      return `Erro ao buscar notícias: ${error.message}`;
    }
    return "Erro desconhecido ao buscar notícias.";
  }
}

function formatNoticiasResponse(data: NoticiasResponse, input: NoticiasInput): string {
  let output = `## Notícias e Releases do IBGE\n\n`;

  if (input.busca) {
    output += `**Busca:** "${input.busca}"\n`;
  }

  output += `**Total:** ${data.count} notícias encontradas\n`;
  output += `**Página:** ${data.page} de ${data.totalPages}\n`;
  output += `**Mostrando:** ${data.showingFrom} a ${data.showingTo}\n\n`;

  output += "---\n\n";

  for (const noticia of data.items) {
    output += formatNoticia(noticia);
    output += "\n---\n\n";
  }

  // Pagination info
  if (data.totalPages > 1) {
    output += `_Página ${data.page} de ${data.totalPages}. `;
    if (data.nextPage) {
      output += `Use pagina=${data.nextPage} para a próxima página.`;
    }
    output += "_\n";
  }

  return output;
}

function formatNoticia(noticia: Noticia): string {
  let output = "";

  // Title with type badge
  const tipoBadge = noticia.tipo === "Release" ? "📢" : "📰";
  output += `### ${tipoBadge} ${noticia.titulo}\n\n`;

  // Publication date
  output += `**Data:** ${formatDate(noticia.data_publicacao)}\n`;

  // Category/editorias
  if (noticia.editorias) {
    output += `**Editoria:** ${noticia.editorias}\n`;
  }

  // Products
  if (noticia.produtos && noticia.produtos !== "null") {
    output += `**Produtos:** ${noticia.produtos}\n`;
  }

  // Highlight badge
  if (noticia.destaque) {
    output += `**⭐ Destaque**\n`;
  }

  output += "\n";

  // Introduction/summary
  if (noticia.introducao) {
    // Clean HTML tags from introduction
    const intro = noticia.introducao
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();

    output += `${intro}\n\n`;
  }

  // Link
  output += `🔗 [Leia mais](${noticia.link})\n`;

  return output;
}

function formatDate(dateStr: string): string {
  try {
    // IBGE format: "DD/MM/YYYY HH:MM:SS"
    const parts = dateStr.split(" ");
    const dateParts = parts[0].split("/");
    const timeParts = parts[1] ? parts[1].split(":") : ["00", "00"];

    const day = dateParts[0];
    const month = dateParts[1];
    const year = dateParts[2];

    const months = [
      "", "janeiro", "fevereiro", "março", "abril", "maio", "junho",
      "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
    ];

    const monthName = months[parseInt(month, 10)] || month;
    return `${day} de ${monthName} de ${year}, ${timeParts[0]}:${timeParts[1]}`;
  } catch {
    return dateStr;
  }
}

// Tool definition for MCP
export const noticiasTool = {
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
  inputSchema: noticiasSchema,
  handler: ibgeNoticias,
};
