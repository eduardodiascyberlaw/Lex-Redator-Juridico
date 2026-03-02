import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// ── Types ───────────────────────────────────────────

export interface CaseRecord {
  id: string;
  status: string;
  clientName: string;
  clientNationality: string | null;
  factsSummary: string;
  factsDetailed: Record<string, unknown> | null;
  documentsRef: string | null;
  urgency: string;
  legalArea: string | null;
  actionType: string | null;
  jurisdiction: string | null;
  applicableRights: string[] | null;
  triageReasoning: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  agentRuns?: AgentRunRecord[];
  generatedDocs?: GeneratedDocRecord[];
}

export interface AgentRunRecord {
  id: string;
  caseId: string;
  agentName: string;
  agentOrder: number;
  status: string;
  input: unknown;
  output: unknown;
  reasoning: string | null;
  tokensUsed: number | null;
  durationMs: number | null;
  errorMsg: string | null;
  model: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface GeneratedDocRecord {
  id: string;
  caseId: string;
  docType: string;
  version: number;
  title: string;
  content: string;
  filePath: string | null;
  sourcesUsed: unknown;
  createdAt: string;
  updatedAt: string;
}

interface CreateCaseInput {
  clientName: string;
  clientNationality?: string;
  factsSummary: string;
  factsDetailed?: Record<string, unknown>;
  documentsRef?: string;
  urgency?: string;
}

// ── API calls ───────────────────────────────────────

export const createCase = async (input: CreateCaseInput): Promise<CaseRecord> => {
  const { data } = await api.post("/cases", input);
  return data.data;
};

export const listCases = async (params?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ cases: CaseRecord[]; total: number }> => {
  const { data } = await api.get("/cases", { params });
  return data.data;
};

export const getCase = async (id: string): Promise<CaseRecord> => {
  const { data } = await api.get(`/cases/${id}`);
  return data.data;
};

export const updateCase = async (
  id: string,
  input: Partial<CreateCaseInput>
): Promise<CaseRecord> => {
  const { data } = await api.put(`/cases/${id}`, input);
  return data.data;
};

export const checkHealth = async (): Promise<{
  success: boolean;
  services: { lexCorpus: string };
}> => {
  const { data } = await api.get("/health");
  return data;
};
