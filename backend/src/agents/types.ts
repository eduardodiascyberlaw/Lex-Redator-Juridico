// ── Tipos base do sistema de agentes ─────────────────

export interface CaseContext {
  caseId: string;
  facts: string;
  factsStructured?: Record<string, unknown>;
  clientName: string;
  clientNationality?: string;
  documentsRef?: string;
  urgency: "normal" | "urgente" | "muito_urgente";
}

export interface TriageResult {
  legalArea: string;
  actionType: string;
  jurisdiction: string;
  applicableRights: string[];
  keyIssues: string[];
  reasoning: string;
}

export interface LegislationResult {
  statutes: Array<{
    diploma: string;
    articles: string[];
    relevance: string;
    excerpt: string;
    sourceUrl: string;
    sourceDocId: number;
  }>;
  reasoning: string;
}

export interface JurisprudenceResult {
  cases: Array<{
    tribunal: string;
    processo: string;
    date: string;
    relator: string;
    holding: string;
    relevantExcerpt: string;
    sourceUrl: string;
    sourceDocId: number;
  }>;
  trendAnalysis: string;
  reasoning: string;
}

export interface ArgumentationResult {
  thesis: string;
  arguments: Array<{
    title: string;
    body: string;
    legalBasis: string[];
    jurisprudenceBasis: string[];
  }>;
  counterarguments: Array<{
    point: string;
    rebuttal: string;
  }>;
  reasoning: string;
}

export interface DraftResult {
  sections: Array<{
    name: string;
    content: string;
  }>;
  fullText: string;
  reasoning: string;
}

export interface ReviewResult {
  approved: boolean;
  issues: Array<{
    section: string;
    severity: "critico" | "importante" | "menor";
    description: string;
    suggestion: string;
  }>;
  sourcesVerified: boolean;
  coherenceScore: number;
  finalText: string;
  reasoning: string;
}

export interface AgentOutput {
  agentName: string;
  status: "completed" | "failed";
  result: unknown;
  tokensUsed: number;
  durationMs: number;
}

export interface PipelineConfig {
  caseId: string;
  actionType: string;
  agents: string[];
  model: string;
}

export interface PipelineState {
  caseContext: CaseContext;
  triage?: TriageResult;
  legislation?: LegislationResult;
  jurisprudence?: JurisprudenceResult;
  argumentation?: ArgumentationResult;
  draft?: DraftResult;
  review?: ReviewResult;
}

export type PipelineEvent =
  | { type: "agent_start"; agent: string; order: number }
  | { type: "agent_progress"; agent: string; message: string }
  | { type: "agent_complete"; agent: string; durationMs: number }
  | { type: "agent_error"; agent: string; error: string }
  | { type: "pipeline_complete"; docUrl: string };
