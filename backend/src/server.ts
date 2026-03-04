import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "./config";
import routes from "./routes";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

// Segurança
app.use(helmet());
app.use(cors({ origin: config.cors.origin }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    success: false,
    message: "Demasiados pedidos. Tente novamente em 15 minutos.",
  },
});
app.use("/api/", limiter);

// Body parsing
app.use(express.json({ limit: "1mb" }));

// Rotas
app.use("/api", routes);

// Error handler
app.use(errorHandler);

// Iniciar servidor
app.listen(config.port, () => {
  console.log(`[LexBuild] API a correr na porta ${config.port}`);
  console.log(`[LexBuild] Ambiente: ${config.nodeEnv}`);
  console.log(`[LexBuild] Lex-Corpus API: ${config.lexCorpus.apiUrl}`);
});

export default app;
