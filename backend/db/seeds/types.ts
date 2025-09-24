// seeds/types.ts
import type { Connection } from "mongoose";
// ⬇️ import the class type
import type { IDMap as IDMapImpl } from "./utils/ids";

export type SeedMode = "static" | "faker" | "both";

export interface SeedContext {
  db: Connection;
  dryRun: boolean;
  batchSize: number;
  concurrency: number;
  mode: SeedMode;
  flags: { fresh: boolean; append: boolean; strict: boolean };
  counts: Record<string, number>;
  topUp: Record<string, number>;
  upsertOn: Record<string, string[]>;
  idMap: IDMap;               // stays the same name
  log: (...args: any[]) => void;
}

export interface SeederDescriptor {
  name: string;
  collection: string;
  dependsOn?: string[];
  dataPaths?: string[];
  upsertOn?: string[];
  hasStatic?: boolean;
  hasFaker?: boolean;
}

export interface SeederModule {
  descriptor: SeederDescriptor;
  clear?: (ctx: SeedContext) => Promise<void>;
  seedStatic?: (ctx: SeedContext) => Promise<{ inserted: number; upserted: number }>;
  seedFaker?: (ctx: SeedContext, count: number) => Promise<{ inserted: number; upserted: number }>;
}

// ⬇️ unify the IDMap type with the class from utils/ids
export type IDMap = IDMapImpl;
