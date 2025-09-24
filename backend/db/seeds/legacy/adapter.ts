// seeds/legacy/adapter.ts
import path from "path";
import type { SeederModule, SeederDescriptor, SeedContext } from "../types";

/** Detect if a value is a SeederModule with a minimally valid descriptor. */
function isSeederModule(v: any): v is SeederModule {
  return !!(
    v &&
    v.descriptor &&
    typeof v.descriptor === "object" &&
    typeof v.descriptor.name === "string" &&
    v.descriptor.name &&
    typeof v.descriptor.collection === "string" &&
    v.descriptor.collection
  );
}

/** Pull out legacy-ish hints for descriptor fields. */
function extractLegacyDescriptor(obj: any): Partial<SeederDescriptor> {
  if (!obj || typeof obj !== "object") return {};
  const name =
    typeof obj.name === "string" && obj.name ? obj.name :
    typeof obj.key === "string" && obj.key ? obj.key : undefined;

  const collection =
    typeof obj.collection === "string" && obj.collection ? obj.collection :
    typeof obj.collectionName === "string" && obj.collectionName ? obj.collectionName :
    name;

  const dependsOn = Array.isArray(obj.dependsOn) ? obj.dependsOn :
                    Array.isArray(obj.dependencies) ? obj.dependencies : undefined;

  const upsertOn = Array.isArray(obj.upsertOn) ? obj.upsertOn :
                   Array.isArray(obj.uniqueKeys) ? obj.uniqueKeys : undefined;

  const dataPaths =
    Array.isArray(obj.dataPaths) ? obj.dataPaths :
    typeof obj.dataPath === "string" ? [obj.dataPath] : undefined;

  return { name, collection, dependsOn, upsertOn, dataPaths };
}

/** Grab commonly named functions from legacy exports. */
function extractLegacyFns(obj: any): {
  clear?: SeederModule["clear"];
  seedStatic?: SeederModule["seedStatic"];
  seedFaker?: SeederModule["seedFaker"];
} {
  const fn = (k: string) => (typeof obj?.[k] === "function" ? obj[k].bind(obj) : undefined);

  const clear = fn("clear") || fn("reset") || fn("truncate");
  const seedStatic =
    fn("seedStatic") || fn("seed") || fn("run") || fn("load") || fn("upsert");
  const seedFaker = fn("seedFaker") || fn("faker") || fn("generate");

  return { clear, seedStatic, seedFaker };
}

/**
 * Adapt **any** module shape into a valid SeederModule.
 * Accepts:
 *  - default/named objects with descriptor
 *  - default/named objects without descriptor (infer)
 *  - default/named functions (wrap as seedStatic)
 *  - CJS exports (module.exports)
 */
export async function adaptLegacyModule(mod: any, fileAbs: string): Promise<SeederModule> {
  const root = mod;
  const def = mod?.default;
  const fileBase = path.basename(fileAbs).replace(/\.[^.]+$/g, "");
  // infer a canonical name from file name (strip ".seeder")
  const inferredName = fileBase.replace(/\.seeder$/i, "").replace(/[_\s]+/g, "-").toLowerCase();

  // 1) If something already looks like a proper SeederModule, return it.
  for (const cand of [root, def]) {
    if (isSeederModule(cand)) {
      const d = cand.descriptor;
      // Ensure mode flags are booleans
      const descriptor: SeederDescriptor = {
        name: d.name,
        collection: d.collection,
        dependsOn: Array.isArray(d.dependsOn) ? d.dependsOn : [],
        dataPaths: Array.isArray(d.dataPaths) ? d.dataPaths : [],
        upsertOn: Array.isArray(d.upsertOn) ? d.upsertOn : [],
        hasStatic: !!(cand.seedStatic),
        hasFaker: !!(cand.seedFaker),
      };
      return {
        descriptor,
        clear: typeof cand.clear === "function" ? cand.clear.bind(cand) : undefined,
        seedStatic: typeof cand.seedStatic === "function" ? cand.seedStatic.bind(cand) : undefined,
        seedFaker: typeof cand.seedFaker === "function" ? cand.seedFaker.bind(cand) : undefined,
      };
    }
  }

  // 2) If default or root export is a **function**, treat it as seedStatic.
  for (const cand of [def, root]) {
    if (typeof cand === "function") {
      const seedStatic = async (ctx: SeedContext) => cand(ctx);
      const descriptor: SeederDescriptor = {
        name: inferredName,
        collection: inferredName,
        dependsOn: [],
        dataPaths: [],
        upsertOn: [],
        hasStatic: true,
        hasFaker: false,
      };
      return { descriptor, seedStatic };
    }
  }

  // 3) Otherwise, try to read descriptor-ish fields and legacy funcs from an object.
  const legacyObj = def ?? root ?? {};
  const partial = extractLegacyDescriptor(legacyObj);
  const fns = extractLegacyFns(legacyObj);

  const descriptor: SeederDescriptor = {
    name: partial.name || inferredName,
    collection: partial.collection || partial.name || inferredName,
    dependsOn: partial.dependsOn || [],
    dataPaths: partial.dataPaths || [],
    upsertOn: partial.upsertOn || [],
    hasStatic: !!fns.seedStatic,
    hasFaker: !!fns.seedFaker,
  };

  return {
    descriptor,
    clear: fns.clear,
    seedStatic: fns.seedStatic,
    seedFaker: fns.seedFaker,
  };
}
