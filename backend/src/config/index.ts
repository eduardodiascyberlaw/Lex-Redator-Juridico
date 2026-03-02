import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "3003", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:5175",
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    modelSonnet: process.env.CLAUDE_MODEL_SONNET || "claude-sonnet-4-5-20250514",
    modelHaiku: process.env.CLAUDE_MODEL_HAIKU || "claude-haiku-4-5-20251001",
  },
  lexCorpus: {
    apiUrl: process.env.LEX_CORPUS_API_URL || "http://localhost:3002",
    timeoutMs: parseInt(process.env.LEX_CORPUS_TIMEOUT_MS || "15000", 10),
  },
  search: {
    topK: parseInt(process.env.SEARCH_TOP_K || "20", 10),
    maxDocuments: parseInt(process.env.RAG_MAX_DOCUMENTS || "8", 10),
    maxChunksPerDoc: parseInt(process.env.RAG_MAX_CHUNKS_PER_DOC || "2", 10),
  },
};
