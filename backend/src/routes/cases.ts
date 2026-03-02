import { Router, Request, Response, NextFunction } from "express";
import * as caseService from "../services/caseService";

const router = Router();

/**
 * POST /api/cases — Criar novo caso (intake)
 */
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clientName, clientNationality, factsSummary, factsDetailed, documentsRef, urgency } = req.body;

    if (!clientName || typeof clientName !== "string" || clientName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Nome do cliente é obrigatório (mínimo 2 caracteres).",
      });
    }

    if (!factsSummary || typeof factsSummary !== "string" || factsSummary.trim().length < 50) {
      return res.status(400).json({
        success: false,
        message: "Resumo dos factos é obrigatório (mínimo 50 caracteres).",
      });
    }

    const validUrgencies = ["normal", "urgente", "muito_urgente"];
    if (urgency && !validUrgencies.includes(urgency)) {
      return res.status(400).json({
        success: false,
        message: `Urgência inválida. Valores aceites: ${validUrgencies.join(", ")}`,
      });
    }

    const newCase = await caseService.createCase({
      clientName: clientName.trim(),
      clientNationality: clientNationality?.trim(),
      factsSummary: factsSummary.trim(),
      factsDetailed,
      documentsRef: documentsRef?.trim(),
      urgency,
      createdBy: "operador", // TODO: auth user
    });

    res.status(201).json({ success: true, data: newCase });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/cases — Listar casos
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, limit, offset } = req.query;

    const result = await caseService.listCases({
      status: status as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/cases/:id — Obter caso com runs e docs
 */
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const caseRecord = await caseService.getCaseById(req.params.id);
    res.json({ success: true, data: caseRecord });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/cases/:id — Actualizar dados do caso
 */
router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      clientName, clientNationality, factsSummary, factsDetailed,
      documentsRef, urgency, status, legalArea, actionType,
      jurisdiction, applicableRights, triageReasoning,
    } = req.body;

    const validUrgencies = ["normal", "urgente", "muito_urgente"];
    if (urgency && !validUrgencies.includes(urgency)) {
      return res.status(400).json({
        success: false,
        message: `Urgência inválida. Valores aceites: ${validUrgencies.join(", ")}`,
      });
    }

    const updated = await caseService.updateCase(req.params.id, {
      clientName: clientName?.trim(),
      clientNationality: clientNationality?.trim(),
      factsSummary: factsSummary?.trim(),
      factsDetailed,
      documentsRef: documentsRef?.trim(),
      urgency,
      status,
      legalArea,
      actionType,
      jurisdiction,
      applicableRights,
      triageReasoning,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
