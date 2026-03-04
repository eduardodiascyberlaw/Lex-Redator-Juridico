// ── Agente de Revisão ────────────────────────────────
import { CaseContext, PipelineState, ReviewResult, AgentOutput } from "./types";
import { callLlmJson } from "./llmClient";
import { buildSystemPrompt } from "./prompts";

const REVIEW_PROMPT = `
És um jurista sénior revisor de peças processuais portuguesas.
Realiza o controlo de qualidade final da peça redigida.

VERIFICAÇÕES OBRIGATÓRIAS:

1. COERÊNCIA INTERNA: Os factos na secção de "Direito"
   correspondem aos factos na secção de "Factos"?

2. REFERÊNCIAS CRUZADAS: Cada artigo de lei citado no texto
   aparece na lista de legislação fornecida? Cada acórdão
   citado aparece na lista de jurisprudência?

3. ESTRUTURA FORMAL: A peça segue o template correcto?
   Todas as secções obrigatórias estão presentes?

4. PEDIDO vs FUNDAMENTAÇÃO: O pedido é sustentado
   pela argumentação desenvolvida?

5. PRESSUPOSTOS PROCESSUAIS: Legitimidade, tempestividade,
   competência estão abordados?

6. LINGUAGEM: Tom formal, sem coloquialismos, terminologia
   jurídica correcta, português de Portugal (PT-PT).

7. SINALIZAÇÃO: Marca com [VERIFICAR] qualquer ponto
   que necessite confirmação humana.

Para cada problema encontrado, classifica a severidade:
- "critico": Erro que invalida a peça (referência inexistente,
  contradição, falta de pressupostos)
- "importante": Erro que enfraquece a peça mas não a invalida
- "menor": Sugestão de melhoria (estilo, clareza)

Produz também uma versão corrigida (finalText) com as
correcções aplicadas e os pontos [VERIFICAR] sinalizados.

Responde em JSON:
{
  "approved": boolean,
  "issues": [
    {
      "section": string,
      "severity": "critico" | "importante" | "menor",
      "description": string,
      "suggestion": string
    }
  ],
  "sourcesVerified": boolean,
  "coherenceScore": number (0-100),
  "finalText": string,
  "reasoning": string
}

"approved" deve ser true se não houver issues com severity "critico".
"coherenceScore" é uma nota de 0 a 100 sobre a coerência geral.
"finalText" é a peça final corrigida.
`.trim();

export const runReview = async (
  context: CaseContext,
  state: PipelineState
): Promise<AgentOutput> => {
  const startTime = Date.now();

  try {
    if (!state.draft) {
      throw new Error("DraftResult é necessário para o agente de revisão");
    }

    const legislationList = state.legislation
      ? state.legislation.statutes
          .map((s) => `- ${s.diploma}: artigos ${s.articles.join(", ")} [DocID: ${s.sourceDocId}]`)
          .join("\n")
      : "Nenhuma legislação na base.";

    const jurisprudenceList = state.jurisprudence
      ? state.jurisprudence.cases
          .map((c) => `- ${c.tribunal}, Proc. ${c.processo} (${c.date}) [DocID: ${c.sourceDocId}]`)
          .join("\n")
      : "Nenhuma jurisprudência na base.";

    const userMessage = `
PEÇA PROCESSUAL PARA REVISÃO:

${state.draft.fullText}

---

FONTES ORIGINAIS DISPONÍVEIS:

LEGISLAÇÃO (do RAG):
${legislationList}

JURISPRUDÊNCIA (do RAG):
${jurisprudenceList}

---

CONTEXTO DO CASO:
Cliente: ${context.clientName}
Factos originais: ${context.facts}
Tipo de acção: ${state.triage?.actionType || "N/A"}
Jurisdição: ${state.triage?.jurisdiction || "N/A"}
    `.trim();

    const { data, inputTokens, outputTokens } = await callLlmJson<ReviewResult>({
      systemPrompt: buildSystemPrompt(REVIEW_PROMPT),
      userMessage,
      model: "sonnet",
      maxTokens: 8192,
      temperature: 0.2,
    });

    return {
      agentName: "review",
      status: "completed",
      result: data,
      tokensUsed: inputTokens + outputTokens,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      agentName: "review",
      status: "failed",
      result: { error: error instanceof Error ? error.message : "Erro desconhecido" },
      tokensUsed: 0,
      durationMs: Date.now() - startTime,
    };
  }
};
