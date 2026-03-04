import { Router } from "express";
import casesRoutes from "./cases";
import pipelineRoutes from "./pipeline";
import { checkHealth as checkLexCorpus } from "../services/lexCorpusClient";

const router = Router();

// Rotas
router.use("/cases", casesRoutes);
router.use("/pipeline", pipelineRoutes);

// Health check
router.get("/health", async (_req, res) => {
  const lexCorpusOk = await checkLexCorpus();

  res.json({
    success: true,
    message: "Lex Redator API operacional",
    timestamp: new Date().toISOString(),
    services: {
      lexCorpus: lexCorpusOk ? "online" : "offline",
    },
  });
});

export default router;
