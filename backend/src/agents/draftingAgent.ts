// ── Agente de Redacção da Peça Processual ─────────────
import { CaseContext, PipelineState, DraftResult, AgentOutput } from "./types";
import { callLlmJson } from "./llmClient";
import { buildSystemPrompt } from "./prompts";

const DRAFTING_PROMPT = `
És um jurista especialista em redacção de peças processuais
portuguesas. Redige a peça processual completa com a estrutura
formal correcta.

A peça deve seguir a estrutura formal de uma PROVIDÊNCIA CAUTELAR
(CPTA — Código de Processo nos Tribunais Administrativos),
adaptando conforme o tipo de acção.

ESTRUTURA DA PEÇA:

1. CABEÇALHO — Tribunal competente
2. IDENTIFICAÇÃO — "Exmo.(a) Senhor(a) Juiz(a)..."
3. REQUERENTE — Identificação completa do cliente
4. REQUERIDO — Identificação da entidade demandada
5. OBJECTO — Tipo de providência/acção requerida
6. FACTOS — Factos provados (numerados) e factos instrumentais
7. DIREITO — Enquadramento normativo, subsunção dos factos ao
   direito, fumus boni iuris, periculum in mora (se cautelar),
   ponderação de interesses
8. PEDIDO — Formulação precisa do pedido
9. REQUERIMENTOS PROBATÓRIOS — Documentos juntos, testemunhas
10. VALOR DA CAUSA
11. JUNTADA DE DOCUMENTOS
12. ASSINATURA E DATA — "[Local], [Data]"

REGRAS DE REDACÇÃO:
- Tom formal e técnico
- Português de Portugal (PT-PT)
- Numeração de factos com alíneas a), b), c)...
- Citações legais com formato: "artigo X.º do [Diploma]"
- Citações jurisprudenciais: "Acórdão do [Tribunal], Proc. [N.º], de [Data]"
- Usar "V. Exa." para se dirigir ao juiz
- Pedidos formulados de forma precisa e objectiva

Responde em JSON:
{
  "sections": [
    {
      "name": string,
      "content": string
    }
  ],
  "fullText": string,
  "reasoning": string
}

O campo "fullText" deve conter a peça completa como texto
corrido (todas as secções concatenadas), pronta para o gerador
de documentos.
`.trim();

export const runDrafting = async (
  context: CaseContext,
  state: PipelineState
): Promise<AgentOutput> => {
  const startTime = Date.now();

  try {
    if (!state.triage || !state.argumentation) {
      throw new Error("TriageResult e ArgumentationResult são necessários para o agente de redacção");
    }

    const legislationSummary = state.legislation
      ? state.legislation.statutes
          .map((s) => `- ${s.diploma}, artigos ${s.articles.join(", ")}: ${s.relevance}\n  Excerto: "${s.excerpt}"`)
          .join("\n")
      : "Nenhuma legislação identificada.";

    const jurisprudenceSummary = state.jurisprudence
      ? state.jurisprudence.cases
          .map((c) => `- ${c.tribunal}, Proc. ${c.processo} (${c.date}), Rel. ${c.relator}\n  Decisão: ${c.holding}`)
          .join("\n")
      : "Nenhuma jurisprudência identificada.";

    const argumentsSummary = state.argumentation.arguments
      .map((a, i) => `${i + 1}. ${a.title}\n   ${a.body}\n   Base legal: ${a.legalBasis.join("; ")}\n   Base jurisprudencial: ${a.jurisprudenceBasis.join("; ")}`)
      .join("\n\n");

    const counterargumentsSummary = state.argumentation.counterarguments
      .map((c) => `- Contra: ${c.point}\n  Refutação: ${c.rebuttal}`)
      .join("\n");

    const userMessage = `
DADOS DO CASO:
Cliente: ${context.clientName}
Nacionalidade: ${context.clientNationality || "Não especificada"}
Urgência: ${context.urgency}

FACTOS:
${context.facts}

${context.documentsRef ? `DOCUMENTOS REFERIDOS:\n${context.documentsRef}` : ""}

TRIAGEM:
Área: ${state.triage.legalArea}
Tipo de acção: ${state.triage.actionType}
Jurisdição: ${state.triage.jurisdiction}
Direitos: ${state.triage.applicableRights.join(", ")}
Questões: ${state.triage.keyIssues.join(", ")}

LEGISLAÇÃO:
${legislationSummary}

JURISPRUDÊNCIA:
${jurisprudenceSummary}

TESE CENTRAL:
${state.argumentation.thesis}

ARGUMENTOS:
${argumentsSummary}

CONTRA-ARGUMENTOS E REFUTAÇÕES:
${counterargumentsSummary}
    `.trim();

    const { data, inputTokens, outputTokens } = await callLlmJson<DraftResult>({
      systemPrompt: buildSystemPrompt(DRAFTING_PROMPT),
      userMessage,
      model: "sonnet",
      maxTokens: 8192,
      temperature: 0.3,
    });

    return {
      agentName: "drafting",
      status: "completed",
      result: data,
      tokensUsed: inputTokens + outputTokens,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      agentName: "drafting",
      status: "failed",
      result: { error: error instanceof Error ? error.message : "Erro desconhecido" },
      tokensUsed: 0,
      durationMs: Date.now() - startTime,
    };
  }
};
