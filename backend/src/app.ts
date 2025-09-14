// src/app.ts
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import path from "node:path";

import routes from "./routes";
import notFound from "./middlewares/notFound";
import { errorConverter, errorHandler } from "./middlewares/error";
import { CORS_ORIGIN, NODE_ENV, API_PREFIX } from "./config/env";

const app = express();

/* ----------------------------- Core middleware ---------------------------- */
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());

// CORS
const corsOrigin = CORS_ORIGIN || "*";
app.use(
  cors(
    corsOrigin === "*"
      ? { origin: false, credentials: false }
      : { origin: corsOrigin, credentials: true }
  )
);

// Logging
if (NODE_ENV !== "test") app.use(morgan("dev"));

/* ------------------------------- Rate limiting ---------------------------- */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(`${API_PREFIX}/auth`, authLimiter);

/* --------------------------------- Swagger -------------------------------- */
// const swaggerSpec = swaggerJSDoc({
//   definition: {
//     openapi: "3.0.0",
//     info: { title: "API", version: "1.0.0" },
//     // Put the prefix here so JSDoc paths don't include /api/v1
//     servers: [{ url: API_PREFIX }],
//   },
//   apis: [
//     // scan your source files
//     path.join(process.cwd(), "src/**/*.ts"),
//     path.join(process.cwd(), "src/**/*.js"),
//   ],
// });

const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: { title: "API", version: "1.0.0" },
    servers: [{ url: API_PREFIX }],
  },
  apis: [
    // keep other JSDoc if you need it, but to be safe for Orders, use YAML:
    path.join(process.cwd(), "src/docs/**/*.yaml"),
    // If you still want to scan code comments elsewhere, keep this:
    // path.join(process.cwd(), "src/**/*.ts"),
  ],
});


// Serve UI + raw JSON
app.use(`${API_PREFIX}/docs`, swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
app.get(`${API_PREFIX}/docs.json`, (_req, res) => res.json(swaggerSpec));

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [System]
 *     summary: Health check
 *     responses:
 *       '200':
 *         description: OK
 */
app.get(`${API_PREFIX}/health`, (_req, res) => res.json({ status: "ok" }));

/* --------------------------------- Routes --------------------------------- */
app.use(API_PREFIX, routes);

// Optional: redirect root -> API base
app.get("/", (_req, res) => res.redirect(API_PREFIX));

/* --------------------------------- 404 & Errors --------------------------- */
app.use(notFound);
app.use(errorConverter);
app.use(errorHandler);

export default app;
