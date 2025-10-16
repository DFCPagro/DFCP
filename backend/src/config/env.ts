// src/config/env.ts
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const Env = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  PUBLIC_APP_BASE_URL: z.string().url().optional(),
  API_PREFIX: z.string().default("/api/v1"),
  /**
   * Database connection URI.  Historically some scripts set MONGO_URI
   * (without the trailing "DB"), while the application code expects
   * MONGODB_URI.  Accept both environment variables here and allow
   * either to be defined.  If both are provided MONGODB_URI takes
   * precedence.  Downstream consumers should reference `MONGODB_URI`
   * only.  Validation is deferred to connect.ts.
   */
  MONGODB_URI: z.string().optional(),
  MONGO_URI: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  CORS_ORIGIN: z.string().default("*"),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform(v => v?.toLowerCase() === "true"),
  COOKIE_DOMAIN: z.string().optional(),

  // ✅ add this
  QR_HMAC_SECRET: z.string().min(1, "QR_HMAC_SECRET is required"),
}).transform(v => {
  const isProd = v.NODE_ENV === "production";
  const PUBLIC_APP_BASE_URL =
    v.PUBLIC_APP_BASE_URL ?? `${isProd ? "https" : "http"}://localhost:${v.PORT}`;

  // Normalise database URI: prefer MONGODB_URI but fall back to MONGO_URI.
  const dbUri = v.MONGODB_URI || v.MONGO_URI;

  return {
    ...v,
    PUBLIC_APP_BASE_URL,
    COOKIE_SECURE: v.COOKIE_SECURE ?? isProd,
    // Expose the normalised MONGODB_URI so downstream code only references one key
    MONGODB_URI: dbUri,
  };
});

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment variables:", z.treeifyError(parsed.error));
  process.exit(1);
}

const cfg = Object.freeze(parsed.data);
export const env = cfg;

export const {
  NODE_ENV,
  PORT,
  PUBLIC_APP_BASE_URL,
  API_PREFIX,
  MONGODB_URI,
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN,
  CORS_ORIGIN,
  COOKIE_SECURE,
  COOKIE_DOMAIN,
  // ✅ export this too
  QR_HMAC_SECRET,
} = cfg;
