// ── Agente de Triagem Jurídica ───────────────────────
import { CaseContext, TriageResult, AgentOutput } from "./types";
import { callLlmJson } from "./llmClient";
import { buildSystemPrompt } from "./prompts";

const TRIAGE_PROMPT = `
És um jurista especialista em direito português. Analisa os
factos apresentados e identifica:

1. ÁREA DO DIREITO (legalArea): Classifica a área principal.
   Valores possíveis: administrativo, trabalho, civil, penal,
   constitucional, fiscal, família, comercial, imigração.

2. TIPO DE ACÇÃO (actionType): A acção judicial mais adequada.
   Valores possíveis: providencia_cautelar, acao_administrativa,
   impugnacao, intimacao, acao_administrativa_comum,
   recurso_contencioso, acao_declarativa, acao_executiva.

3. JURISDIÇÃO (jurisdiction): O tribunal competente.
   Exemplos: tac_lisboa, tac_porto, sta, tribunal_comarca,
   tribunal_trabalho, tribunal_familia.

4. DIREITOS APLICÁVEIS (applicableRights): Lista de direitos
   fundamentais ou legais potencialmente violados.

5. QUESTÕES JURÍDICAS CENTRAIS (keyIssues): As questões
   jurídicas que o caso levanta.

6. RACIOCÍNIO (reasoning): Explica o teu raciocínio para
   cada decisão de classificação.

Contexto: Direito português, com foco em direito administrativo,
imigração e nacionalidade (AIMA, SEF, Lei 23/2007, Lei 37/81).
Aplica também CPA, CPTA, CRP quando relevante.

Avalia também:
- ENTIDADE DEMANDADA: Quem seria o réu/entidade demandada
- PRESSUPOSTOS PROCESSUAIS: Legitimidade, interesse em agir, tempestividade
- URGÊNCIA: Há necessidade de tutela urgente (periculum in mora)?
- ELEMENTOS DE PROVA: Que documentos/provas seriam necessários

Responde em JSON com o seguinte schema:
{
  "legalArea": string,
  "actionType": string,
  "jurisdiction": string,
  "applicableRights": string[],
  "keyIssues": string[],
  "reasoning": string
}
`.trim();

export const runTriage = async (context: CaseContext): Promise<AgentOutput> => {
  const startTime = Date.now();

  const userMessage = `
CASO PARA TRIAGEM:

Cliente: ${context.clientName}
Nacionalidade: ${context.clientNationality || "Não especificada"}
Urgência declarada: ${context.urgency}

FACTOS:
${context.facts}

${context.documentsRef ? `DOCUMENTOS REFERIDOS:\n${context.documentsRef}` : ""}
${context.factsStructured ? `FACTOS ESTRUTURADOS:\n${JSON.stringify(context.factsStructured, null, 2)}` : ""}
  `.trim();

  try {
    const { data, inputTokens, outputTokens } = await callLlmJson<TriageResult>({
      systemPrompt: buildSystemPrompt(TRIAGE_PROMPT),
      userMessage,
      model: "sonnet",
      maxTokens: 2048,
      temperature: 0.3,
    });

    return {
      agentName: "triage",
      status: "completed",
      result: data,
      tokensUsed: inputTokens + outputTokens,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      agentName: "triage",
      status: "failed",
      result: { error: error instanceof Error ? error.message : "Erro desconhecido" },
      tokensUsed: 0,
      durationMs: Date.now() - startTime,
    };
  }
};
