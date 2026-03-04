// ── Rotas do Pipeline de Agentes ─────────────────────
import { Router, Request, Response, NextFunction } from "express";
import { runPipeline } from "../agents/agentRunner";
import * as caseService from "../services/caseService";
import { PipelineEvent } from "../agents/types";
import { AppError } from "../middleware/errorHandler";

const router = Router();

// Map de SSE listeners por caseId (para broadcast de eventos)
const sseClients = new Map<string, Set<Response>>();

const broadcastEvent = (caseId: string, event: PipelineEvent): void => {
  const clients = sseClients.get(caseId);
  if (!clients) return;
  const data = JSON.stringify(event);
  clients.forEach((res) => {
    res.write(`data: ${data}\n\n`);
  });
};

/**
 * POST /api/pipeline/:caseId/run — Inicia o pipeline de agentes
 */
router.post("/:caseId/run", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { caseId } = req.params;

    // Validar que o caso existe
    const caseRecord = await caseService.getCaseById(caseId);

    // Validar status (só permite iniciar de intake ou erro)
    const allowedStatuses = ["intake", "erro"];
    if (!allowedStatuses.includes(caseRecord.status)) {
      throw new AppError(
        `Não é possível iniciar o pipeline. Status actual: "${caseRecord.status}". Permitido: ${allowedStatuses.join(", ")}`,
        409
      );
    }

    // Retornar 202 imediatamente
    res.status(202).json({
      success: true,
      message: "Pipeline iniciado. Use GET /api/pipeline/:caseId/stream para acompanhar o progresso.",
      caseId,
    });

    // Executar pipeline em background
    const emit = (event: PipelineEvent): void => {
      broadcastEvent(caseId, event);
      console.log(`[Pipeline ${caseId}] ${event.type}:`, JSON.stringify(event));
    };

    runPipeline(caseId, emit).catch((error) => {
      console.error(`[Pipeline ${caseId}] Erro fatal:`, error);
      broadcastEvent(caseId, {
        type: "agent_error",
        agent: "pipeline",
        error: error instanceof Error ? error.message : "Erro fatal no pipeline",
      });
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/pipeline/:caseId/stream — SSE para progresso do pipeline
 */
router.get("/:caseId/stream", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { caseId } = req.params;

    // Validar que o caso existe
    await caseService.getCaseById(caseId);

    // Configurar SSE
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // Enviar evento inicial
    res.write(`data: ${JSON.stringify({ type: "connected", caseId })}\n\n`);

    // Registar cliente
    if (!sseClients.has(caseId)) {
      sseClients.set(caseId, new Set());
    }
    sseClients.get(caseId)!.add(res);

    // Heartbeat a cada 15s
    const heartbeat = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 15000);

    // Cleanup ao desligar
    const cleanup = (): void => {
      clearInterval(heartbeat);
      const clients = sseClients.get(caseId);
      if (clients) {
        clients.delete(res);
        if (clients.size === 0) {
          sseClients.delete(caseId);
        }
      }
    };

    req.on("close", cleanup);
    req.on("error", cleanup);
  } catch (error) {
    next(error);
  }
});

export default router;
