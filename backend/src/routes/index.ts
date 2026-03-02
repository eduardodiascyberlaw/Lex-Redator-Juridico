import { Router } from "express";
import casesRoutes from "./cases";
import { checkHealth as checkLexCorpus } from "../services/lexCorpusClient";

const router = Router();

// Rotas
router.use("/cases", casesRoutes);

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
