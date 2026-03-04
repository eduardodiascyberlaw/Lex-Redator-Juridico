// ── Agente de Construção Argumentativa ────────────────
import { CaseContext, PipelineState, ArgumentationResult, AgentOutput } from "./types";
import { callLlmJson } from "./llmClient";
import { buildSystemPrompt } from "./prompts";

const ARGUMENTATION_PROMPT = `
És um jurista especialista em argumentação jurídica. Com base
nos factos, legislação e jurisprudência fornecidos, constrói:

1. TESE CENTRAL (thesis): A posição jurídica do cliente em 2-3 frases.

2. ARGUMENTOS (arguments): Lista ordenada por força argumentativa.
   Cada argumento deve ter:
   - title: Título claro e conciso
   - body: Desenvolvimento do argumento (2-4 parágrafos)
   - legalBasis: Artigos de lei específicos que sustentam o argumento
   - jurisprudenceBasis: Acórdãos específicos que sustentam o argumento

3. CONTRA-ARGUMENTOS PREVISÍVEIS (counterarguments): O que a parte
   contrária ou o tribunal poderiam objectar.
   Cada contra-argumento deve ter:
   - point: O contra-argumento
   - rebuttal: Como rebatê-lo

4. RACIOCÍNIO (reasoning): Explica a estratégia argumentativa geral.

Usa princípios gerais quando aplicável:
- Princípio da proporcionalidade
- Princípio da boa-fé
- Princípio da igualdade
- Tempus regit actum
- Venire contra factum proprium
- Tutela da confiança
- In dubio pro libertate

IMPORTANTE: Cada argumento DEVE citar fontes reais fornecidas
no contexto. NUNCA inventes referências legislativas ou
jurisprudenciais.

Responde em JSON:
{
  "thesis": string,
  "arguments": [
    {
      "title": string,
      "body": string,
      "legalBasis": string[],
      "jurisprudenceBasis": string[]
    }
  ],
  "counterarguments": [
    {
      "point": string,
      "rebuttal": string
    }
  ],
  "reasoning": string
}
`.trim();

export const runArgumentation = async (
  context: CaseContext,
  state: PipelineState
): Promise<AgentOutput> => {
  const startTime = Date.now();

  try {
    if (!state.triage) {
      throw new Error("TriageResult é necessário para o agente de argumentação");
    }

    const legislationSummary = state.legislation
      ? state.legislation.statutes
          .map((s) => `- ${s.diploma}, artigos ${s.articles.join(", ")}: ${s.relevance}\n  Excerto: "${s.excerpt}"`)
          .join("\n")
      : "Nenhuma legislação identificada.";

    const jurisprudenceSummary = state.jurisprudence
      ? state.jurisprudence.cases
          .map((c) => `- ${c.tribunal}, Proc. ${c.processo} (${c.date}), Rel. ${c.relator}\n  Decisão: ${c.holding}\n  Excerto: "${c.relevantExcerpt}"`)
          .join("\n")
      : "Nenhuma jurisprudência identificada.";

    const userMessage = `
CASO:
Cliente: ${context.clientName}
Nacionalidade: ${context.clientNationality || "Não especificada"}
Urgência: ${context.urgency}

FACTOS:
${context.facts}

TRIAGEM:
Área: ${state.triage.legalArea}
Tipo de acção: ${state.triage.actionType}
Jurisdição: ${state.triage.jurisdiction}
Direitos aplicáveis: ${state.triage.applicableRights.join(", ")}
Questões jurídicas: ${state.triage.keyIssues.join(", ")}

LEGISLAÇÃO IDENTIFICADA:
${legislationSummary}

JURISPRUDÊNCIA IDENTIFICADA:
${jurisprudenceSummary}
${state.jurisprudence?.trendAnalysis ? `\nANÁLISE DE TENDÊNCIAS:\n${state.jurisprudence.trendAnalysis}` : ""}
    `.trim();

    const { data, inputTokens, outputTokens } = await callLlmJson<ArgumentationResult>({
      systemPrompt: buildSystemPrompt(ARGUMENTATION_PROMPT),
      userMessage,
      model: "sonnet",
      maxTokens: 4096,
      temperature: 0.3,
    });

    return {
      agentName: "argumentation",
      status: "completed",
      result: data,
      tokensUsed: inputTokens + outputTokens,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      agentName: "argumentation",
      status: "failed",
      result: { error: error instanceof Error ? error.message : "Erro desconhecido" },
      tokensUsed: 0,
      durationMs: Date.now() - startTime,
    };
  }
};
