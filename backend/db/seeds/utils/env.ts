import fs from "fs";
import path from "path";
import dotenv from "dotenv";

export function loadEnv(explicitPath?: string) {
  // __dirname works in CJS
  const base = __dirname; // .../db/seeds/utils
  const candidates = [
    explicitPath,                                   // --env <file> wins
    path.resolve(process.cwd(), ".env"),            // CWD
    path.resolve(base, "../../../.env"),            // backend/.env
    path.resolve(base, "../../../src/.env"),        // backend/src/.env  ← your case
    path.resolve(base, "../../.env"),               // backend/db/.env
    path.resolve(base, "../.env"),                  // backend/db/seeds/.env
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      dotenv.config({ path: p });
      console.log(`[dotenv] loaded ${p}`);
      return p;
    }
  }
  console.warn("[dotenv] no .env found (proceeding without one)");
  return null;
}
