// seeds/utils/discovery.ts
import { pathToFileURL } from "url";
import path from "path";
import fg from "fast-glob";
import type { SeederModule, SeederDescriptor } from "../types";
import { adaptLegacyModule } from "../legacy/adapter";

export interface MigrationReportEntry {
  name: string;
  file: string;
  collection: string;
  dependsOn: string[];
  dataPaths: string[];
  upsertOn: string[];
  hasStatic: boolean;
  hasFaker: boolean;
  adapted: boolean;
}

export interface MigrationReport {
  seeders: MigrationReportEntry[];
  warnings: string[];
}

/* -------------------------------- Utilities -------------------------------- */

const toPosix = (p: string) => p.replace(/\\/g, "/");
const ensureArray = <T,>(x: T | T[] | undefined) =>
  !x ? [] : Array.isArray(x) ? x : [x];

const normalizeGlob = (g: string) => {
  let s = toPosix(String(g).trim());
  if (s.startsWith("./")) s = s.slice(2);
  return s;
};

const looksLikeDescriptor = (d: any): d is SeederDescriptor =>
  !!(
    d &&
    typeof d.name === "string" &&
    d.name &&
    typeof d.collection === "string" &&
    d.collection
  );

const rel = (abs: string) =>
  toPosix(path.relative(process.cwd(), abs)) || toPosix(abs);

/* ------------------------------ Main discovery ----------------------------- */

/**
 * Discover seeder modules by glob and normalize them to SeederModule.
 * - Accepts ESM/CJS, default/named exports, legacy shapes (via adapter).
 * - Never imports your models; only the seeder files.
 * - On bad/missing descriptor, synthesizes one from the filename so the
 *   pipeline continues (and logs a warning).
 * - Exports both named and default (works with CommonJS tsconfig).
 */
export async function discoverSeeders(
  seedGlobs: string | string[] = [],
  dataGlobs: string | string[] = []
): Promise<{ modules: SeederModule[]; report: MigrationReport }> {
  const report: MigrationReport = { seeders: [], warnings: [] };

  const seederPatterns = ensureArray(seedGlobs).map(normalizeGlob).filter(Boolean);
  const dataPatterns = ensureArray(dataGlobs).map(normalizeGlob).filter(Boolean);

  const effectiveSeederPatterns =
    seederPatterns.length ? seederPatterns : ["seeds/**/*.seeder.{ts,js}"];
  const effectiveDataPatterns =
    dataPatterns.length ? dataPatterns : ["seeds/data/**/*.{json,ndjson}"];

  // Expand files (keep type as string[] for fg version compatibility)
  const seederFiles: string[] = await fg(effectiveSeederPatterns, {
    cwd: process.cwd(),
    absolute: true,
    onlyFiles: true,
    unique: true,
    followSymbolicLinks: true,
    caseSensitiveMatch: false,
    dot: false,
  });

  const dataFiles: string[] = await fg(effectiveDataPatterns, {
    cwd: process.cwd(),
    absolute: true,
    onlyFiles: true,
    unique: true,
    followSymbolicLinks: true,
    caseSensitiveMatch: false,
    dot: false,
  });

  console.log(
    `[discovery] matched seeders: ${seederFiles.length} for ${effectiveSeederPatterns.join(", ")}`
  );

  const modules: SeederModule[] = [];
  const seen = new Set<string>();

  for (const abs of seederFiles) {
    try {
      // Dynamic import (tsx transpiles TS on the fly)
      const imported = await import(pathToFileURL(abs).href);

      // Normalizes ANY legacy shape to SeederModule
      const seeder = await adaptLegacyModule(imported, abs);
      let d = seeder?.descriptor;

      // If the adapter still left us without a good descriptor, synthesize one.
      if (!looksLikeDescriptor(d)) {
        const base = path
          .basename(abs)
          .replace(/\.[^.]+$/g, "")
          .replace(/\.seeder$/i, "");
        seeder.descriptor = {
          name: base.toLowerCase(),
          collection: base.toLowerCase(),
          dependsOn: [],
          dataPaths: [],
          upsertOn: [],
          hasStatic: !!seeder.seedStatic,
          hasFaker: !!seeder.seedFaker,
        };
        d = seeder.descriptor;
        report.warnings.push(
          `Descriptor synthesized for ${rel(abs)} (name="${d.name}", collection="${d.collection}").`
        );
      }

      const key = d.name.toLowerCase();
      if (seen.has(key)) {
        report.warnings.push(
          `Duplicate seeder name "${d.name}" at ${rel(abs)} (first occurrence wins).`
        );
        continue;
      }
      seen.add(key);

      modules.push(seeder);

      report.seeders.push({
        name: d.name,
        file: abs,
        collection: d.collection,
        dependsOn: d.dependsOn ?? [],
        dataPaths: d.dataPaths ?? [],
        upsertOn: d.upsertOn ?? [],
        hasStatic: !!d.hasStatic,
        hasFaker: !!d.hasFaker,
        adapted: !!imported && !(imported as any).descriptor,
      });
    } catch (err: any) {
      const msg = err?.stack || err?.message || String(err);
      report.warnings.push(`Failed to import ${rel(abs)} — ${msg}`);
    }
  }

  // FYI: unreferenced data files (visibility only; no behavior change)
  const referenced = new Set(
    report.seeders.flatMap((s) =>
      (s.dataPaths || []).map((p) => toPosix(path.resolve(p)))
    )
  );
  for (const dfAbs of dataFiles) {
    const resolved = toPosix(path.resolve(dfAbs));
    if (!referenced.has(resolved)) {
      report.warnings.push(`Unreferenced data file: ${rel(dfAbs)}`);
    }
  }

  return { modules, report };
}

/* Export both named and default for CJS/ESM interop */
export default discoverSeeders;
