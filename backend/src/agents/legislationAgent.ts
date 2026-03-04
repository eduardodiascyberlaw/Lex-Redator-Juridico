// ── Agente de Fundamentação Legal (RAG) ──────────────
import { CaseContext, PipelineState, LegislationResult, AgentOutput } from "./types";
import { callLlmJson } from "./llmClient";
import { buildSystemPrompt } from "./prompts";
import { searchLegislacao, LexCorpusResult } from "../services/lexCorpusClient";
import { config } from "../config";

const QUERY_GENERATION_PROMPT = `
És um jurista especialista em pesquisa legislativa portuguesa.
Com base na triagem jurídica fornecida, gera queries de pesquisa
semântica para encontrar legislação relevante.

Gera entre 3 e 5 queries distintas, cada uma focada num aspecto
diferente do caso. As queries devem ser em português e usar
terminologia jurídica precisa.

Responde em JSON:
{
  "queries": ["query1", "query2", "query3"]
}
`.trim();

const ORGANIZATION_PROMPT = `
És um jurista especialista em direito português. Organiza a
legislação encontrada pela pesquisa RAG, eliminando duplicados
e ordenando por hierarquia normativa:

1. Constituição da República Portuguesa (CRP)
2. Leis e Decretos-Lei
3. Regulamentos e Portarias
4. Directivas e regulamentos da UE (quando aplicável)

Para cada diploma, identifica:
- diploma: Nome completo do diploma (ex: "Lei n.º 23/2007, de 4 de Julho")
- articles: Artigos específicos relevantes
- relevance: Porquê é relevante para o caso
- excerpt: Excerto mais relevante do texto
- sourceUrl: URL da fonte no Lex-Corpus
- sourceDocId: ID do documento na base

Responde em JSON:
{
  "statutes": [
    {
      "diploma": string,
      "articles": string[],
      "relevance": string,
      "excerpt": string,
      "sourceUrl": string,
      "sourceDocId": number
    }
  ],
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
[DOCUMENTO ${i + 1}]
ID: ${r.documentId}
Tipo: ${r.contentType}
Tribunal: ${r.tribunal || "N/A"}
Processo: ${r.processo || "N/A"}
URL: ${r.url || "N/A"}
Relevância: ${r.relevance}

CONTEÚDO:
${chunks}
      `.trim();
    })
    .join("\n\n========\n\n");
};

export const runLegislation = async (
  context: CaseContext,
  state: PipelineState
): Promise<AgentOutput> => {
  const startTime = Date.now();
  let totalTokens = 0;

  try {
    if (!state.triage) {
      throw new Error("TriageResult é necessário para o agente de legislação");
    }

    // Passo 1: Gerar queries de pesquisa com Haiku
    const queryUserMessage = `
TRIAGEM DO CASO:
Área do direito: ${state.triage.legalArea}
Tipo de acção: ${state.triage.actionType}
Jurisdição: ${state.triage.jurisdiction}
Direitos aplicáveis: ${state.triage.applicableRights.join(", ")}
Questões jurídicas: ${state.triage.keyIssues.join(", ")}

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
      searchLegislacao(query, { topK: config.search.topK }).catch(() => [] as LexCorpusResult[])
    );
    const searchResults = await Promise.all(searchPromises);
    const allResults = deduplicateResults(searchResults.flat());
    const topResults = allResults
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, config.search.maxDocuments);

    // Passo 3: Organizar com Sonnet
    const orgUserMessage = `
CASO:
${context.facts}

TRIAGEM:
Área: ${state.triage.legalArea}
Tipo de acção: ${state.triage.actionType}
Direitos: ${state.triage.applicableRights.join(", ")}
Questões: ${state.triage.keyIssues.join(", ")}

RESULTADOS DA PESQUISA RAG (${topResults.length} documentos):

${topResults.length > 0 ? formatResultsForLlm(topResults) : "Nenhum resultado encontrado na base. Usa o teu conhecimento para identificar legislação relevante, mas marca com [VERIFICAR]."}
    `.trim();

    const { data, inputTokens: oIn, outputTokens: oOut } =
      await callLlmJson<LegislationResult>({
        systemPrompt: buildSystemPrompt(ORGANIZATION_PROMPT),
        userMessage: orgUserMessage,
        model: "sonnet",
        maxTokens: 4096,
        temperature: 0.2,
      });
    totalTokens += oIn + oOut;

    return {
      agentName: "legislation",
      status: "completed",
      result: data,
      tokensUsed: totalTokens,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      agentName: "legislation",
      status: "failed",
      result: { error: error instanceof Error ? error.message : "Erro desconhecido" },
      tokensUsed: totalTokens,
      durationMs: Date.now() - startTime,
    };
  }
};
