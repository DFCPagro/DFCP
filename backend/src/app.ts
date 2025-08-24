import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import routes from "./routes";
import notFound from "./middlewares/notFound";
import { errorConverter, errorHandler } from "./middlewares/error";
import { CORS_ORIGIN,NODE_ENV } from "./config/env";

const app = express();

// Security & common middleware
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());

// CORS
const corsOrigin = CORS_ORIGIN || "*";
app.use(cors({ origin: corsOrigin, credentials: true }));

// Logging
if (NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// Rate limit auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/v1/auth", authLimiter);

// Health
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Routes
app.use("/v1", routes);

// 404
app.use(notFound);

// Error conversion & handling
app.use(errorConverter);
app.use(errorHandler);

export default app;
