#!/usr/bin/env node

/**
 * BCB BR MCP Server
 * MCP Server for Brazilian Central Bank Time Series (SGS/BCB)
 *
 * Author: Sidney Bissoli
 * License: MIT
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// API Base URL
const BCB_API_BASE = "https://api.bcb.gov.br/dados/serie/bcdata.sgs";

// Popular series catalog
const SERIES_POPULARES = [
  // Juros
  { codigo: 11, nome: "Taxa de juros - Selic acumulada no mês", categoria: "Juros", periodicidade: "Mensal" },
  { codigo: 432, nome: "Taxa de juros - Selic anualizada base 252", categoria: "Juros", periodicidade: "Diária" },
  { codigo: 4189, nome: "Taxa de juros - Selic acumulada no mês anualizada", categoria: "Juros", periodicidade: "Mensal" },

  // Inflação
  { codigo: 433, nome: "IPCA - Variação mensal", categoria: "Inflação", periodicidade: "Mensal" },
  { codigo: 13522, nome: "IPCA - Variação acumulada em 12 meses", categoria: "Inflação", periodicidade: "Mensal" },
  { codigo: 188, nome: "INPC - Variação mensal", categoria: "Inflação", periodicidade: "Mensal" },
  { codigo: 189, nome: "IGP-M - Variação mensal", categoria: "Inflação", periodicidade: "Mensal" },
  { codigo: 190, nome: "IGP-DI - Variação mensal", categoria: "Inflação", periodicidade: "Mensal" },

  // Câmbio
  { codigo: 1, nome: "Taxa de câmbio - Livre - Dólar americano (venda) - diário", categoria: "Câmbio", periodicidade: "Diária" },
  { codigo: 10813, nome: "Taxa de câmbio - Livre - Dólar americano (compra) - diário", categoria: "Câmbio", periodicidade: "Diária" },
  { codigo: 21619, nome: "Taxa de câmbio - Euro (venda)", categoria: "Câmbio", periodicidade: "Diária" },
  { codigo: 21620, nome: "Taxa de câmbio - Euro (compra)", categoria: "Câmbio", periodicidade: "Diária" },
  { codigo: 3698, nome: "Taxa de câmbio - PTAX - Dólar americano (venda)", categoria: "Câmbio", periodicidade: "Diária" },
  { codigo: 3697, nome: "Taxa de câmbio - PTAX - Dólar americano (compra)", categoria: "Câmbio", periodicidade: "Diária" },

  // PIB e Atividade Econômica
  { codigo: 4380, nome: "PIB mensal - Valores correntes", categoria: "Atividade Econômica", periodicidade: "Mensal" },
  { codigo: 4382, nome: "PIB acumulado dos últimos 12 meses - Valores correntes", categoria: "Atividade Econômica", periodicidade: "Mensal" },
  { codigo: 24364, nome: "Índice de Atividade Econômica do Banco Central (IBC-Br)", categoria: "Atividade Econômica", periodicidade: "Mensal" },

  // Emprego
  { codigo: 24369, nome: "Taxa de desocupação - PNAD Contínua", categoria: "Emprego", periodicidade: "Mensal" },

  // Dívida Pública
  { codigo: 4503, nome: "Dívida líquida do setor público (% PIB)", categoria: "Dívida Pública", periodicidade: "Mensal" },
  { codigo: 4513, nome: "Dívida bruta do governo geral (% PIB)", categoria: "Dívida Pública", periodicidade: "Mensal" },

  // Reservas Internacionais
  { codigo: 3546, nome: "Reservas internacionais - Conceito liquidez - Total", categoria: "Setor Externo", periodicidade: "Diária" },

  // Balança Comercial
  { codigo: 22707, nome: "Balança comercial - Saldo", categoria: "Setor Externo", periodicidade: "Mensal" },

  // Crédito
  { codigo: 20539, nome: "Saldo da carteira de crédito - Total", categoria: "Crédito", periodicidade: "Mensal" },
  { codigo: 20542, nome: "Saldo da carteira de crédito com recursos livres - Total", categoria: "Crédito", periodicidade: "Mensal" },

  // Poupança
  { codigo: 25, nome: "Poupança - rendimento no mês de referência", categoria: "Poupança", periodicidade: "Mensal" },
  { codigo: 195, nome: "Poupança - saldo", categoria: "Poupança", periodicidade: "Mensal" }
];

// Types for API responses
interface SerieValor {
  data: string;
  valor: string;
}

interface SerieMetadados {
  codigo: number;
  nome: string;
  unidade: string;
  periodicidade: string;
  fonte: string;
  especial: boolean;
}

// Helper function to format date for API (dd/MM/yyyy)
function formatDateForApi(dateStr: string): string {
  // Accept formats: yyyy-MM-dd, dd/MM/yyyy
  if (dateStr.includes("-")) {
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  }
  return dateStr;
}

// Helper function to fetch from BCB API
async function fetchBcbApi(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "bcb-br-mcp/1.0.0"
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Série não encontrada ou sem dados para o período solicitado`);
    }
    throw new Error(`Erro na API do BCB: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Create MCP server
const server = new McpServer({
  name: "bcb-br-mcp",
  version: "1.0.0"
});

// Tool: Get series values
server.tool(
  "bcb_serie_valores",
  "Consulta valores de uma série temporal do BCB por código. Retorna dados históricos com data e valor.",
  {
    codigo: z.number().describe("Código da série no SGS/BCB (ex: 433 para IPCA mensal, 11 para Selic)"),
    dataInicial: z.string().optional().describe("Data inicial no formato yyyy-MM-dd ou dd/MM/yyyy (opcional)"),
    dataFinal: z.string().optional().describe("Data final no formato yyyy-MM-dd ou dd/MM/yyyy (opcional)")
  },
  async ({ codigo, dataInicial, dataFinal }) => {
    try {
      let url = `${BCB_API_BASE}.${codigo}/dados?formato=json`;

      if (dataInicial) {
        url += `&dataInicial=${formatDateForApi(dataInicial)}`;
      }
      if (dataFinal) {
        url += `&dataFinal=${formatDateForApi(dataFinal)}`;
      }

      const data = await fetchBcbApi(url) as SerieValor[];

      if (!Array.isArray(data) || data.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: `Nenhum dado encontrado para a série ${codigo} no período solicitado.`
          }]
        };
      }

      // Find series info if available
      const serieInfo = SERIES_POPULARES.find(s => s.codigo === codigo);

      const result = {
        serie: {
          codigo,
          nome: serieInfo?.nome || `Série ${codigo}`,
          categoria: serieInfo?.categoria || "Desconhecida",
          periodicidade: serieInfo?.periodicidade || "Desconhecida"
        },
        totalRegistros: data.length,
        periodoInicial: data[0].data,
        periodoFinal: data[data.length - 1].data,
        dados: data.map(d => ({
          data: d.data,
          valor: parseFloat(d.valor)
        }))
      };

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: `Erro ao consultar série ${codigo}: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// Tool: Get last N values
server.tool(
  "bcb_serie_ultimos",
  "Obtém os últimos N valores de uma série temporal do BCB. Útil para consultar dados mais recentes.",
  {
    codigo: z.number().describe("Código da série no SGS/BCB"),
    quantidade: z.number().min(1).max(1000).default(10).describe("Quantidade de valores a retornar (1-1000, padrão: 10)")
  },
  async ({ codigo, quantidade }) => {
    try {
      const url = `${BCB_API_BASE}.${codigo}/dados/ultimos/${quantidade}?formato=json`;
      const data = await fetchBcbApi(url) as SerieValor[];

      if (!Array.isArray(data) || data.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: `Nenhum dado encontrado para a série ${codigo}.`
          }]
        };
      }

      const serieInfo = SERIES_POPULARES.find(s => s.codigo === codigo);

      const result = {
        serie: {
          codigo,
          nome: serieInfo?.nome || `Série ${codigo}`,
          categoria: serieInfo?.categoria || "Desconhecida",
          periodicidade: serieInfo?.periodicidade || "Desconhecida"
        },
        totalRegistros: data.length,
        dados: data.map(d => ({
          data: d.data,
          valor: parseFloat(d.valor)
        }))
      };

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: `Erro ao consultar últimos valores da série ${codigo}: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// Tool: Get series metadata
server.tool(
  "bcb_serie_metadados",
  "Obtém informações/metadados de uma série temporal do BCB. Retorna nome, periodicidade, categoria e outros detalhes.",
  {
    codigo: z.number().describe("Código da série no SGS/BCB")
  },
  async ({ codigo }) => {
    try {
      // Try to fetch metadata from API endpoint
      const metadataUrl = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/metadados?formato=json`;

      try {
        const metadata = await fetchBcbApi(metadataUrl) as SerieMetadados;

        const serieInfo = SERIES_POPULARES.find(s => s.codigo === codigo);

        const result = {
          codigo: metadata.codigo || codigo,
          nome: metadata.nome || serieInfo?.nome || `Série ${codigo}`,
          unidade: metadata.unidade || "Não informada",
          periodicidade: metadata.periodicidade || serieInfo?.periodicidade || "Não informada",
          fonte: metadata.fonte || "Banco Central do Brasil",
          categoria: serieInfo?.categoria || "Não categorizada",
          especial: metadata.especial || false,
          urlConsulta: `${BCB_API_BASE}.${codigo}/dados?formato=json`,
          urlUltimos10: `${BCB_API_BASE}.${codigo}/dados/ultimos/10?formato=json`
        };

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(result, null, 2)
          }]
        };
      } catch {
        // If metadata endpoint fails, try to get info from popular series or fetch sample data
        const serieInfo = SERIES_POPULARES.find(s => s.codigo === codigo);

        if (serieInfo) {
          const result = {
            codigo,
            nome: serieInfo.nome,
            periodicidade: serieInfo.periodicidade,
            categoria: serieInfo.categoria,
            fonte: "Banco Central do Brasil",
            urlConsulta: `${BCB_API_BASE}.${codigo}/dados?formato=json`,
            urlUltimos10: `${BCB_API_BASE}.${codigo}/dados/ultimos/10?formato=json`,
            observacao: "Metadados obtidos do catálogo interno"
          };

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(result, null, 2)
            }]
          };
        }

        // Try to verify if series exists by fetching last value
        const url = `${BCB_API_BASE}.${codigo}/dados/ultimos/1?formato=json`;
        const data = await fetchBcbApi(url) as SerieValor[];

        if (Array.isArray(data) && data.length > 0) {
          const result = {
            codigo,
            nome: `Série ${codigo}`,
            ultimoValor: {
              data: data[0].data,
              valor: parseFloat(data[0].valor)
            },
            fonte: "Banco Central do Brasil",
            urlConsulta: `${BCB_API_BASE}.${codigo}/dados?formato=json`,
            observacao: "Série encontrada, mas metadados detalhados não disponíveis"
          };

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(result, null, 2)
            }]
          };
        }

        throw new Error("Série não encontrada");
      }
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: `Erro ao consultar metadados da série ${codigo}: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// Tool: List popular series
server.tool(
  "bcb_series_populares",
  "Lista séries temporais populares do BCB com seus códigos. Inclui IPCA, Selic, câmbio, PIB e outros indicadores econômicos.",
  {
    categoria: z.string().optional().describe("Filtrar por categoria (ex: Juros, Inflação, Câmbio, Atividade Econômica, Emprego, Dívida Pública, Setor Externo, Crédito, Poupança)")
  },
  async ({ categoria }) => {
    try {
      let series = SERIES_POPULARES;

      if (categoria) {
        series = series.filter(s =>
          s.categoria.toLowerCase().includes(categoria.toLowerCase())
        );
      }

      // Group by category
      const porCategoria: Record<string, typeof series> = {};
      for (const serie of series) {
        if (!porCategoria[serie.categoria]) {
          porCategoria[serie.categoria] = [];
        }
        porCategoria[serie.categoria].push(serie);
      }

      const result = {
        totalSeries: series.length,
        categorias: Object.keys(porCategoria).length,
        series: categoria ? series : porCategoria,
        observacao: "Use bcb_serie_valores ou bcb_serie_ultimos com o código para consultar os dados"
      };

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: `Erro ao listar séries: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// Tool: Search series by name
server.tool(
  "bcb_buscar_serie",
  "Busca séries no catálogo interno por nome ou descrição. Retorna séries que correspondem ao termo buscado.",
  {
    termo: z.string().min(2).describe("Termo de busca (mínimo 2 caracteres)")
  },
  async ({ termo }) => {
    try {
      const termoLower = termo.toLowerCase();

      const encontradas = SERIES_POPULARES.filter(s =>
        s.nome.toLowerCase().includes(termoLower) ||
        s.categoria.toLowerCase().includes(termoLower)
      );

      if (encontradas.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              termo,
              totalEncontradas: 0,
              mensagem: "Nenhuma série encontrada no catálogo interno. Use o portal SGS do BCB para buscar outras séries: https://www3.bcb.gov.br/sgspub/",
              sugestao: "Tente termos como: selic, ipca, dolar, cambio, pib, inflacao"
            }, null, 2)
          }]
        };
      }

      const result = {
        termo,
        totalEncontradas: encontradas.length,
        series: encontradas
      };

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: `Erro ao buscar séries: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// Tool: Get current indicators (convenience)
server.tool(
  "bcb_indicadores_atuais",
  "Obtém os valores mais recentes dos principais indicadores econômicos: Selic, IPCA, Dólar PTAX e IBC-Br.",
  {},
  async () => {
    try {
      const indicadores = [
        { codigo: 432, nome: "Selic (a.a.)" },
        { codigo: 433, nome: "IPCA mensal (%)" },
        { codigo: 13522, nome: "IPCA 12 meses (%)" },
        { codigo: 3698, nome: "Dólar PTAX (venda)" },
        { codigo: 24364, nome: "IBC-Br" }
      ];

      const resultados = await Promise.all(
        indicadores.map(async (ind) => {
          try {
            const url = `${BCB_API_BASE}.${ind.codigo}/dados/ultimos/1?formato=json`;
            const data = await fetchBcbApi(url) as SerieValor[];

            if (Array.isArray(data) && data.length > 0) {
              return {
                indicador: ind.nome,
                codigo: ind.codigo,
                data: data[0].data,
                valor: parseFloat(data[0].valor)
              };
            }
            return {
              indicador: ind.nome,
              codigo: ind.codigo,
              erro: "Sem dados disponíveis"
            };
          } catch (err) {
            return {
              indicador: ind.nome,
              codigo: ind.codigo,
              erro: err instanceof Error ? err.message : "Erro desconhecido"
            };
          }
        })
      );

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            consultadoEm: new Date().toISOString(),
            indicadores: resultados
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: `Erro ao consultar indicadores: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
