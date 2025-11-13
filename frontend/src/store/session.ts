// src/store/session.ts
import { create } from "zustand";
import { load, save, clear } from "@/utils/persist";
import type { Mode } from "@/types/menu";

const PERSIST_KEY = "session";

export type Region = string | null; // e.g. "east" | "west" | "north" | null

export interface SessionState {
  /** "noUser" | "customer" | "work" */
  mode: Mode;
  /** Exactly one work role (or null). e.g., "manager" | "farmer" | "deliverer" */
  activeWorkerRole: string | null;
  /** Selected service region */
  region: Region;

  // actions
  setMode: (mode: Mode) => void;
  toggleMode: () => void;
  setActiveWorkerRole: (role: string | null) => void;
  setRegion: (region: Region) => void;

  /** Reset state on logout. If preserveRegion=true, keep region selection. */
  resetForLogout: (preserveRegion?: boolean) => void;
}

/** Persisted shape only (exclude functions). */
type PersistedSession = Pick<SessionState, "mode" | "activeWorkerRole" | "region">;

/** Default when nothing is stored or state is invalid. */
const DEFAULT_SESSION: PersistedSession = {
  mode: "noUser",
  activeWorkerRole: null,
  region: null,
};

function sanitize(snapshot: Partial<PersistedSession> | null | undefined): PersistedSession {
  const s = { ...DEFAULT_SESSION, ...(snapshot ?? {}) };

  // Ensure mode is one of the supported values
  const validModes: Mode[] = ["noUser", "customer", "work"];
  if (!validModes.includes(s.mode as Mode)) s.mode = "noUser";

  // If not in work mode, force worker role to null
  if (s.mode !== "work") s.activeWorkerRole = null;

  // Region is free-form or null; no extra checks here
  return s;
}

function loadInitial(): PersistedSession {
  const loaded = load<PersistedSession>(PERSIST_KEY, DEFAULT_SESSION);
  return sanitize(loaded);
}

export const useSessionStore = create<SessionState>((set, get) => {
  // hydrate from storage once at module init
  const initial = loadInitial();

  // helper to persist only the data part (after sanitizing)
  function persistPartial() {
    const { mode, activeWorkerRole, region } = sanitize({
      mode: get().mode,
      activeWorkerRole: get().activeWorkerRole,
      region: get().region,
    });
    save<PersistedSession>(PERSIST_KEY, { mode, activeWorkerRole, region });
  }

  const store: SessionState = {
    ...DEFAULT_SESSION,
    ...initial,

    setMode: (mode) => {
      // When moving away from "work", drop any worker role
      if (mode !== "work" && get().activeWorkerRole) {
        set({ mode, activeWorkerRole: null });
      } else {
        set({ mode });
      }
      persistPartial();
    },

    toggleMode: () => {
      const curr = get().mode;

      // No mode switching from "noUser" (guests shouldn't see Switch Mode)
      if (curr === "noUser") return;

      // Flip between customer and work
      const next: Mode = curr === "customer" ? "work" : "customer";

      // Leaving work? clear the role
      if (next !== "work" && get().activeWorkerRole) {
        set({ mode: next, activeWorkerRole: null });
      } else {
        set({ mode: next });
      }
      persistPartial();
    },

    setActiveWorkerRole: (role) => {
      // Only allow setting a worker role in "work" mode; otherwise null it
      if (get().mode !== "work") {
        set({ activeWorkerRole: null });
      } else {
        set({ activeWorkerRole: role });
      }
      persistPartial();
    },

    setRegion: (region) => {
      set({ region });
      persistPartial();
    },

    resetForLogout: (preserveRegion = true) => {
      const region = preserveRegion ? get().region : null;

      // Full logout: return to "noUser", clear role
      const next: PersistedSession = {
        mode: "noUser",
        activeWorkerRole: null,
        region,
        
      };
      set(next);

      // Overwrite persisted state with the new snapshot
      save<PersistedSession>(PERSIST_KEY, next);
    },
  };

  return store;
});
