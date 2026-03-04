// ── Agente de Jurisprudência (RAG) ───────────────────
import { CaseContext, PipelineState, JurisprudenceResult, AgentOutput } from "./types";
import { callLlmJson } from "./llmClient";
import { buildSystemPrompt } from "./prompts";
import { searchJurisprudencia, LexCorpusResult } from "../services/lexCorpusClient";
import { config } from "../config";

const QUERY_GENERATION_PROMPT = `
És um jurista especialista em pesquisa jurisprudencial portuguesa.
Com base na triagem e legislação identificada, gera queries de
pesquisa semântica para encontrar jurisprudência relevante.

Foca as queries em:
- Acórdãos sobre os mesmos direitos e artigos em causa
- Decisões do tribunal competente identificado
- Casos semelhantes na mesma área do direito

Gera entre 3 e 5 queries distintas em português com
terminologia jurídica precisa.

Responde em JSON:
{
  "queries": ["query1", "query2", "query3"]
}
`.trim();

const ANALYSIS_PROMPT = `
És um jurista especialista em análise jurisprudencial portuguesa.
Analisa os acórdãos encontrados pela pesquisa RAG e organiza-os.

Para cada acórdão relevante, identifica:
- tribunal: Nome do tribunal (STA, TCA Sul, TCA Norte, TAC Lisboa, etc.)
- processo: Número do processo
- date: Data do acórdão
- relator: Nome do relator
- holding: Resumo da decisão (holding)
- relevantExcerpt: Excerto mais relevante para o caso
- sourceUrl: URL da fonte no Lex-Corpus
- sourceDocId: ID do documento na base

Analisa também:
- trendAnalysis: Posição maioritária vs minoritária, evolução temporal
- reasoning: Raciocínio sobre a relevância da jurisprudência encontrada

Responde em JSON:
{
  "cases": [
    {
      "tribunal": string,
      "processo": string,
      "date": string,
      "relator": string,
      "holding": string,
      "relevantExcerpt": string,
      "sourceUrl": string,
      "sourceDocId": number
    }
  ],
  "trendAnalysis": string,
  "reasoning": string
}
`.trim();

interface QueryResult {
  queries: string[];
}

const deduplicateResults = (results: LexCorpusResult[]): LexCorpusResult[] => {
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = `${r.documentId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const formatResultsForLlm = (results: LexCorpusResult[]): string => {
  return results
    .map((r, i) => {
      const chunks = r.matchingChunks
        .slice(0, config.search.maxChunksPerDoc)
        .map((c) => c.content)
        .join("\n---\n");
      return `
[ACÓRDÃO ${i + 1}]
ID: ${r.documentId}
Tribunal: ${r.tribunal || "N/A"}
Processo: ${r.processo || "N/A"}
Data: ${r.dataAcordao || "N/A"}
Relator: ${r.relator || "N/A"}
URL: ${r.url || "N/A"}
Relevância: ${r.relevance}

CONTEÚDO:
${chunks}
      `.trim();
    })
    .join("\n\n========\n\n");
};

export const runJurisprudence = async (
  context: CaseContext,
  state: PipelineState
): Promise<AgentOutput> => {
  const startTime = Date.now();
  let totalTokens = 0;

  try {
    if (!state.triage) {
      throw new Error("TriageResult é necessário para o agente de jurisprudência");
    }

    // Passo 1: Gerar queries com Haiku
    const legislationSummary = state.legislation
      ? state.legislation.statutes.map((s) => `${s.diploma}: ${s.articles.join(", ")}`).join("\n")
      : "Nenhuma legislação identificada ainda.";

    const queryUserMessage = `
TRIAGEM DO CASO:
Área: ${state.triage.legalArea}
Tipo de acção: ${state.triage.actionType}
Jurisdição: ${state.triage.jurisdiction}
Direitos: ${state.triage.applicableRights.join(", ")}
Questões: ${state.triage.keyIssues.join(", ")}

LEGISLAÇÃO IDENTIFICADA:
${legislationSummary}

FACTOS:
${context.facts}
    `.trim();

    const { data: queryData, inputTokens: qIn, outputTokens: qOut } =
      await callLlmJson<QueryResult>({
        systemPrompt: QUERY_GENERATION_PROMPT,
        userMessage: queryUserMessage,
        model: "haiku",
        maxTokens: 512,
        temperature: 0.4,
      });
    totalTokens += qIn + qOut;

    // Passo 2: Pesquisar no Lex-Corpus em paralelo
    const searchPromises = queryData.queries.map((query) =>
      searchJurisprudencia(query, { topK: config.search.topK }).catch(() => [] as LexCorpusResult[])
    );
    const searchResults = await Promise.all(searchPromises);
    const allResults = deduplicateResults(searchResults.flat());
    const topResults = allResults
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, config.search.maxDocuments);

    // Passo 3: Analisar com Sonnet
    const analysisUserMessage = `
CASO:
${context.facts}

TRIAGEM:
Área: ${state.triage.legalArea}
Tipo de acção: ${state.triage.actionType}
Direitos: ${state.triage.applicableRights.join(", ")}

LEGISLAÇÃO IDENTIFICADA:
${legislationSummary}

RESULTADOS DA PESQUISA RAG (${topResults.length} acórdãos):

${topResults.length > 0 ? formatResultsForLlm(topResults) : "Nenhum resultado encontrado na base. Indica que não foi possível encontrar jurisprudência e marca com [VERIFICAR]."}
    `.trim();

    const { data, inputTokens: aIn, outputTokens: aOut } =
      await callLlmJson<JurisprudenceResult>({
        systemPrompt: buildSystemPrompt(ANALYSIS_PROMPT),
        userMessage: analysisUserMessage,
        model: "sonnet",
        maxTokens: 4096,
        temperature: 0.2,
      });
    totalTokens += aIn + aOut;

    return {
      agentName: "jurisprudence",
      status: "completed",
      result: data,
      tokensUsed: totalTokens,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      agentName: "jurisprudence",
      status: "failed",
      result: { error: error instanceof Error ? error.message : "Erro desconhecido" },
      tokensUsed: totalTokens,
      durationMs: Date.now() - startTime,
    };
  }
};
