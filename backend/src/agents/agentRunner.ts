// ── Orquestrador do Pipeline de Agentes ──────────────
import prisma from "../config/prisma";
import * as caseService from "../services/caseService";
import { CaseContext, PipelineState, PipelineEvent, AgentOutput, TriageResult, LegislationResult, JurisprudenceResult, ArgumentationResult, DraftResult, ReviewResult } from "./types";
import { runTriage } from "./triageAgent";
import { runLegislation } from "./legislationAgent";
import { runJurisprudence } from "./jurisprudenceAgent";
import { runArgumentation } from "./argumentationAgent";
import { runDrafting } from "./draftingAgent";
import { runReview } from "./reviewAgent";
import { Prisma } from "@prisma/client";

type EmitFn = (event: PipelineEvent) => void;

const AGENT_SEQUENCE = [
  "triage",
  "legislation",
  "jurisprudence",
  "argumentation",
  "drafting",
  "review",
] as const;

const buildCaseContext = (caseRecord: {
  id: string;
  clientName: string;
  clientNationality: string | null;
  factsSummary: string;
  factsDetailed: Prisma.JsonValue;
  documentsRef: string | null;
  urgency: string;
}): CaseContext => ({
  caseId: caseRecord.id,
  facts: caseRecord.factsSummary,
  factsStructured: caseRecord.factsDetailed as Record<string, unknown> | undefined,
  clientName: caseRecord.clientName,
  clientNationality: caseRecord.clientNationality || undefined,
  documentsRef: caseRecord.documentsRef || undefined,
  urgency: caseRecord.urgency as CaseContext["urgency"],
});

const executeAgent = async (
  agentName: string,
  context: CaseContext,
  state: PipelineState
): Promise<AgentOutput> => {
  switch (agentName) {
    case "triage":
      return runTriage(context);
    case "legislation":
      return runLegislation(context, state);
    case "jurisprudence":
      return runJurisprudence(context, state);
    case "argumentation":
      return runArgumentation(context, state);
    case "drafting":
      return runDrafting(context, state);
    case "review":
      return runReview(context, state);
    default:
      throw new Error(`Agente desconhecido: ${agentName}`);
  }
};

const persistAgentRun = async (
  caseId: string,
  agentName: string,
  order: number,
  output: AgentOutput,
  startedAt: Date
): Promise<void> => {
  await prisma.agentRun.create({
    data: {
      caseId,
      agentName,
      agentOrder: order,
      status: output.status,
      output: output.result as Prisma.InputJsonValue,
      tokensUsed: output.tokensUsed,
      durationMs: output.durationMs,
      model: "sonnet",
      startedAt,
      completedAt: new Date(),
      errorMsg: output.status === "failed"
        ? JSON.stringify((output.result as Record<string, unknown>)?.error || "Erro desconhecido")
        : null,
    },
  });
};

const updatePipelineState = (
  state: PipelineState,
  agentName: string,
  result: unknown
): void => {
  switch (agentName) {
    case "triage":
      state.triage = result as TriageResult;
      break;
    case "legislation":
      state.legislation = result as LegislationResult;
      break;
    case "jurisprudence":
      state.jurisprudence = result as JurisprudenceResult;
      break;
    case "argumentation":
      state.argumentation = result as ArgumentationResult;
      break;
    case "drafting":
      state.draft = result as DraftResult;
      break;
    case "review":
      state.review = result as ReviewResult;
      break;
  }
};

export const runPipeline = async (
  caseId: string,
  emit: EmitFn
): Promise<PipelineState> => {
  // 1. Buscar caso do DB
  const caseRecord = await caseService.getCaseById(caseId);
  const context = buildCaseContext(caseRecord);
  const state: PipelineState = { caseContext: context };

  // 2. Actualizar status para processamento
  await caseService.updateCase(caseId, { status: "processamento" });

  try {
    // 3. Executar agentes sequencialmente
    for (let i = 0; i < AGENT_SEQUENCE.length; i++) {
      const agentName = AGENT_SEQUENCE[i];
      const order = i + 1;
      const startedAt = new Date();

      emit({ type: "agent_start", agent: agentName, order });

      const output = await executeAgent(agentName, context, state);

      // Persistir AgentRun
      await persistAgentRun(caseId, agentName, order, output, startedAt);

      if (output.status === "failed") {
        emit({ type: "agent_error", agent: agentName, error: JSON.stringify(output.result) });
        await caseService.updateCase(caseId, { status: "erro" });
        throw new Error(`Agente ${agentName} falhou: ${JSON.stringify(output.result)}`);
      }

      // Actualizar pipeline state
      updatePipelineState(state, agentName, output.result);

      emit({ type: "agent_complete", agent: agentName, durationMs: output.durationMs });

      // Após triage: actualizar Case com classificação
      if (agentName === "triage" && state.triage) {
        await caseService.updateCase(caseId, {
          status: "triagem",
          legalArea: state.triage.legalArea,
          actionType: state.triage.actionType,
          jurisdiction: state.triage.jurisdiction,
          applicableRights: state.triage.applicableRights as unknown as Prisma.InputJsonValue,
          triageReasoning: state.triage.reasoning,
        });
      }
    }

    // 4. Criar GeneratedDoc com texto final
    const finalText = state.review?.finalText || state.draft?.fullText || "";
    const docTitle = `${state.triage?.actionType || "peca"}_${caseRecord.clientName.replace(/\s/g, "_")}`;

    await prisma.generatedDoc.create({
      data: {
        caseId,
        docType: state.triage?.actionType || "peca_processual",
        title: docTitle,
        content: finalText,
        sourcesUsed: {
          legislation: state.legislation?.statutes.map((s) => ({
            diploma: s.diploma,
            articles: s.articles,
            sourceDocId: s.sourceDocId,
          })) || [],
          jurisprudence: state.jurisprudence?.cases.map((c) => ({
            tribunal: c.tribunal,
            processo: c.processo,
            sourceDocId: c.sourceDocId,
          })) || [],
        } as Prisma.InputJsonValue,
      },
    });

    // 5. Actualizar status para concluído
    await caseService.updateCase(caseId, { status: "concluido" });

    emit({ type: "pipeline_complete", docUrl: `/api/cases/${caseId}` });

    return state;
  } catch (error) {
    // Garantir que o status é actualizado para erro
    await caseService.updateCase(caseId, { status: "erro" }).catch(() => {});
    throw error;
  }
};
