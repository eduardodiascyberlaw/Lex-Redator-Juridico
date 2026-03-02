import axios, { AxiosInstance } from "axios";
import { config } from "../config";

// ── Types (espelham a API do Lex-Corpus) ────────────

export interface LexCorpusChunk {
  chunkId: number;
  chunkType: string;
  content: string;
  relevance: number;
}

export interface LexCorpusResult {
  documentId: number;
  contentType: string;
  tribunal: string;
  processo: string;
  dataAcordao: string | null;
  relator: string | null;
  descritores: string | null;
  sumario: string | null;
  url: string;
  relevance: number;
  matchingChunks: LexCorpusChunk[];
}

export interface LexCorpusSearchResponse {
  success: boolean;
  data: {
    query: string;
    totalResults: number;
    searchTimeMs: number;
    results: LexCorpusResult[];
  };
}

interface SearchOptions {
  topK?: number;
  tribunal?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ── HTTP Client ─────────────────────────────────────

let httpClient: AxiosInstance | null = null;

const getHttpClient = (): AxiosInstance => {
  if (!httpClient) {
    httpClient = axios.create({
      baseURL: config.lexCorpus.apiUrl,
      timeout: config.lexCorpus.timeoutMs,
      headers: { "Content-Type": "application/json" },
    });
  }
  return httpClient;
};

// ── Search functions ────────────────────────────────

export const searchLegislacao = async (
  query: string,
  options: SearchOptions = {}
): Promise<LexCorpusResult[]> => {
  const client = getHttpClient();
  const response = await client.post<LexCorpusSearchResponse>("/api/search", {
    query,
    contentType: "legislacao",
    topK: options.topK || config.search.topK,
    tribunal: options.tribunal,
    dateFrom: options.dateFrom,
    dateTo: options.dateTo,
  });

  if (!response.data.success) {
    throw new Error("Lex-Corpus search failed");
  }

  return response.data.data.results;
};

export const searchJurisprudencia = async (
  query: string,
  options: SearchOptions = {}
): Promise<LexCorpusResult[]> => {
  const client = getHttpClient();
  const response = await client.post<LexCorpusSearchResponse>("/api/search", {
    query,
    contentType: "jurisprudencia",
    topK: options.topK || config.search.topK,
    tribunal: options.tribunal,
    dateFrom: options.dateFrom,
    dateTo: options.dateTo,
  });

  if (!response.data.success) {
    throw new Error("Lex-Corpus search failed");
  }

  return response.data.data.results;
};

export const searchAll = async (
  query: string,
  options: SearchOptions = {}
): Promise<LexCorpusResult[]> => {
  const client = getHttpClient();
  const response = await client.post<LexCorpusSearchResponse>("/api/search", {
    query,
    topK: options.topK || config.search.topK,
    tribunal: options.tribunal,
    dateFrom: options.dateFrom,
    dateTo: options.dateTo,
  });

  if (!response.data.success) {
    throw new Error("Lex-Corpus search failed");
  }

  return response.data.data.results;
};

// ── Health check ────────────────────────────────────

export const checkHealth = async (): Promise<boolean> => {
  try {
    const client = getHttpClient();
    const response = await client.get("/api/health");
    return response.data.success === true;
  } catch {
    return false;
  }
};
