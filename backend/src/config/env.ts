// src/config/env.ts
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const Env = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // optional override
  PUBLIC_APP_BASE_URL : z.url().optional(),

  API_PREFIX: z.string().default('/api/v1'),

  // accept url() OR any mongodb-prefixed string
  MONGODB_URI: z.url().or(z.string().startsWith('mongodb')),

  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  CORS_ORIGIN: z.string().default('*'),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform(v => v?.toLowerCase() === 'true'),
  COOKIE_DOMAIN: z.string().optional(),
}).transform(v => {
  const isProd = v.NODE_ENV === 'production';
  const PUBLIC_APP_BASE_URL  =
    v.PUBLIC_APP_BASE_URL  ?? `${isProd ? 'https' : 'http'}://localhost:${v.PORT}`;

  return {
    ...v,
    PUBLIC_APP_BASE_URL ,
    COOKIE_SECURE: v.COOKIE_SECURE ?? isProd,
  };
});

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  // you said you're on the newer API that supports treeifyError
  console.error('❌ Invalid environment variables:', z.treeifyError(parsed.error));
  process.exit(1);
}

const cfg = Object.freeze(parsed.data);

// default single export
export const env = cfg;

// plus direct named exports
export const {
  NODE_ENV,
  PORT,
  PUBLIC_APP_BASE_URL ,
  API_PREFIX,
  MONGODB_URI,
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN,
  CORS_ORIGIN,
  COOKIE_SECURE,
  COOKIE_DOMAIN,
} = cfg;
