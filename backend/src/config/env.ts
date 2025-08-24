// src/config/env.ts
import dotenv from "dotenv";
import { z } from "zod";
dotenv.config();

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  MONGODB_URI: z.string().url().or(z.string().startsWith("mongodb")),
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("*"),
  COOKIE_SECURE: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  COOKIE_DOMAIN: z.string().optional(),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error(
    "❌ Invalid environment variables:",
    parsed.error.flatten().fieldErrors
  );
  process.exit(1);
}
const cfg = parsed.data;
// Named exports (preferred in most files)
export const PORT = cfg.PORT;
export const NODE_ENV = cfg.NODE_ENV;
export const MONGODB_URI = cfg.MONGODB_URI;
export const JWT_ACCESS_SECRET = cfg.JWT_ACCESS_SECRET;
export const JWT_REFRESH_SECRET = cfg.JWT_REFRESH_SECRET;
export const JWT_ACCESS_EXPIRES_IN = cfg.JWT_ACCESS_EXPIRES_IN;
export const JWT_REFRESH_EXPIRES_IN = cfg.JWT_REFRESH_EXPIRES_IN;
export const CORS_ORIGIN = cfg.CORS_ORIGIN;
export const COOKIE_SECURE = String(cfg.COOKIE_SECURE).toLowerCase() === 'true'
export const COOKIE_DOMAIN = cfg.COOKIE_DOMAIN;

// Optional grouped export for places you like namespacing
export const env = {
  PORT,
  NODE_ENV,
  MONGODB_URI,
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN,
  CORS_ORIGIN,
  COOKIE_SECURE,
  COOKIE_DOMAIN,
};
