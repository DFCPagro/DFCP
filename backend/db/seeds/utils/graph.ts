// seeds/utils/graph.ts
import type { SeederModule } from "../types";

/** Normalize a seeder name or dependency for stable matching. */
function norm(x: string): string {
  return String(x ?? "").normalize("NFKC").trim().toLowerCase();
}

/** Convert a glob-like pattern (supports `*` and `all`) to case-insensitive RegExp. */
function patToRe(pattern: string): RegExp {
  if (!pattern || pattern === "*" || pattern.toLowerCase() === "all") return /.*/i;
  const esc = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  return new RegExp("^" + esc.replace(/\*/g, ".*") + "$", "i");
}

/** true if value matches ANY patterns; empty => include ALL. */
function matchesAny(valueNorm: string, patterns?: string[]): boolean {
  if (!patterns || patterns.length === 0) return true;
  return patterns.some((p) => patToRe(p).test(valueNorm));
}

export function planRun(
  modules: SeederModule[],
  only: string[] = [],
  except: string[] = []
): { order: SeederModule[]; missing: string[] } {
  // Build normalized name -> module map
  const map = new Map<string, SeederModule>();
  for (const m of modules) {
    const n = norm(m.descriptor?.name ?? "");
    if (n) map.set(n, m);
  }
  const allNames = Array.from(map.keys()); // normalized names
  const onlyGiven = Array.isArray(only) && only.length > 0;

  // 1) Initial selection (empty `only` => include ALL)
  const selected = new Set<string>();
  if (!onlyGiven) {
    for (const n of allNames) selected.add(n);
  } else {
    for (const n of allNames) if (matchesAny(n, only)) selected.add(n);
  }

  // 2) Fallback: explicit --only but no matches -> try normalized equality
  if (onlyGiven && selected.size === 0) {
    const wanted = new Set(only.map(norm));
    for (const n of allNames) if (wanted.has(n)) selected.add(n);
  }

  // 3) Expand dependencies; collect missing (non-fatal)
  const missing: string[] = [];
  const addDeps = (n: string) => {
    const m = map.get(n);
    if (!m) return;
    for (const depRaw of m.descriptor.dependsOn || []) {
      const dep = norm(String(depRaw));
      if (!map.has(dep)) {
        if (!missing.includes(dep)) missing.push(dep);
        continue;
      }
      if (!selected.has(dep)) {
        selected.add(dep);
        addDeps(dep);
      }
    }
  };
  for (const n of Array.from(selected)) addDeps(n);

  // 4) Apply except
  for (const n of Array.from(selected)) if (matchesAny(n, except)) selected.delete(n);

  // 5) Topological sort among selected
  const order: SeederModule[] = [];
  const perm = new Set<string>();
  const temp = new Set<string>();

  const visit = (n: string, stack: string[]): void => {
    if (perm.has(n)) return;
    if (temp.has(n)) {
      const i = stack.indexOf(n);
      const cycle = stack.slice(i).concat(n).join(" -> ");
      throw new Error(`Dependency cycle detected: ${cycle}`);
    }
    temp.add(n);
    const m = map.get(n);
    if (m) {
      for (const d of m.descriptor.dependsOn || []) {
        const dn = norm(String(d));
        if (selected.has(dn)) visit(dn, stack.concat(n));
      }
      order.push(m);
    }
    temp.delete(n);
    perm.add(n);
  };

  for (const n of Array.from(selected)) visit(n, []);
  return { order, missing };
}

export default planRun;
