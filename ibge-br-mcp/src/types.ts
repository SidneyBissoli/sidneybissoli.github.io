// ============================================================================
// IBGE API Types - Localidades
// ============================================================================

export interface Regiao {
  id: number;
  sigla: string;
  nome: string;
}

export interface UF {
  id: number;
  sigla: string;
  nome: string;
  regiao: Regiao;
}

export interface Mesorregiao {
  id: number;
  nome: string;
  UF: UF;
}

export interface Microrregiao {
  id: number;
  nome: string;
  mesorregiao: Mesorregiao;
}

export interface RegiaoImediata {
  id: number;
  nome: string;
  "regiao-intermediaria": RegiaoIntermediaria;
}

export interface RegiaoIntermediaria {
  id: number;
  nome: string;
  UF: UF;
}

export interface Municipio {
  id: number;
  nome: string;
  microrregiao: Microrregiao;
  "regiao-imediata": RegiaoImediata;
}

export interface MunicipioSimples {
  id: number;
  nome: string;
}

export interface Distrito {
  id: number;
  nome: string;
  municipio: Municipio;
}

export interface Subdistrito {
  id: number;
  nome: string;
  distrito: Distrito;
}

// ============================================================================
// IBGE API Types - Nomes
// ============================================================================

export interface NomeFrequencia {
  nome: string;
  sexo: string | null;
  localidade: string;
  res: NomePeriodo[];
}

export interface NomePeriodo {
  periodo: string;
  frequencia: number;
}

export interface NomeRanking {
  localidade: string;
  sexo: string | null;
  res: NomeRankingItem[];
}

export interface NomeRankingItem {
  nome: string;
  frequencia: number;
  ranking: number;
}

// ============================================================================
// IBGE API Types - SIDRA (Agregados)
// ============================================================================

export interface Agregado {
  id: string;
  nome: string;
  URL: string;
  pesquisa: string;
  assunto: string;
  periodicidade: {
    frequencia: string;
    inicio: number;
    fim: number;
  };
  nivelTerritorial: {
    Administrativo: string[];
    Especial: string[];
    IBGE: string[];
  };
  variaveis: Variavel[];
}

export interface Variavel {
  id: number;
  nome: string;
  unidade: string;
  supimaId?: number;
  classificacoes?: Classificacao[];
}

export interface Classificacao {
  id: number;
  nome: string;
  categorias: Categoria[];
}

export interface Categoria {
  id: number;
  nome: string;
  unidade?: string;
  nivel?: number;
}

export interface SidraResultado {
  [key: string]: string | number;
}

export interface Pesquisa {
  id: string;
  nome: string;
  agregados: AgregadoSimples[];
}

export interface AgregadoSimples {
  id: string;
  nome: string;
}

// ============================================================================
// IBGE API Types - Notícias
// ============================================================================

export interface Noticia {
  id: number;
  tipo: string;
  titulo: string;
  introducao: string;
  data_publicacao: string;
  produto_id: number;
  produtos: string;
  editorias: string;
  imagens: string;
  produtos_relacionados: string;
  destaque: boolean;
  link: string;
}

export interface NoticiasResponse {
  count: number;
  page: number;
  totalPages: number;
  nextPage: number;
  previousPage: number;
  showingFrom: number;
  showingTo: number;
  items: Noticia[];
}

// ============================================================================
// IBGE API Types - População
// ============================================================================

export interface PopulacaoEstimativa {
  localidade: string;
  horario: string;
  projecao: {
    populacao: number;
    periodoMedio: {
      incrementoPopulacional: number;
      nascimento: number;
      obito: number;
    };
  };
}

// ============================================================================
// API Base URLs
// ============================================================================

export const IBGE_API = {
  LOCALIDADES: "https://servicodados.ibge.gov.br/api/v1/localidades",
  NOMES: "https://servicodados.ibge.gov.br/api/v2/censos/nomes",
  AGREGADOS: "https://servicodados.ibge.gov.br/api/v3/agregados",
  SIDRA: "https://apisidra.ibge.gov.br/values",
  NOTICIAS: "https://servicodados.ibge.gov.br/api/v3/noticias",
  POPULACAO: "https://servicodados.ibge.gov.br/api/v1/projecoes/populacao",
} as const;

// ============================================================================
// Helper Types
// ============================================================================

export type SexoFilter = "M" | "F" | null;

export interface FetchOptions {
  timeout?: number;
}

export type NivelTerritorial =
  | "N1" // Brasil
  | "N2" // Região
  | "N3" // UF
  | "N6" // Município
  | "N7" // Região Metropolitana
  | "N8" // Mesorregião
  | "N9" // Microrregião
  | "N10" // Distrito
  | "N11" // Subdistrito
  | "N13" // Região Metropolitana
  | "N14" // Região Integrada de Desenvolvimento
  | "N15"; // Aglomeração Urbana
