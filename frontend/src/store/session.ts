// src/store/session.ts
import { create } from "zustand";
import { load, save, clear } from "@/utils/persist";
import type { Mode } from "@/types/menu";

const PERSIST_KEY = "session";

export type Region = string | null; // keep flexible (e.g., "east" | "west" | "north", etc.)

export interface SessionState {
  /** "customer" or "work" */
  mode: Mode;
  /** Exactly one work role (or null if the user has none). e.g., "manager" | "farmer" | "deliverer" */
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

/** What we persist (exclude functions). */
type PersistedSession = Pick<SessionState, "mode" | "activeWorkerRole" | "region">;

const DEFAULT_SESSION: PersistedSession = {
  mode: "customer",
  activeWorkerRole: null,
  region: null,
};

function loadInitial(): PersistedSession {
  return load<PersistedSession>(PERSIST_KEY, DEFAULT_SESSION);
}

export const useSessionStore = create<SessionState>((set, get) => {
  // hydrate from storage once at module init
  const initial = loadInitial();

  // create the store
  const store: SessionState = {
    ...DEFAULT_SESSION,
    ...initial,

    setMode: (mode) => {
      set({ mode });
      persistPartial();
    },

    toggleMode: () => {
      const next: Mode = get().mode === "customer" ? "work" : "customer";
      set({ mode: next });
      persistPartial();
    },

    setActiveWorkerRole: (role) => {
      set({ activeWorkerRole: role });
      persistPartial();
    },

    setRegion: (region) => {
      set({ region });
      persistPartial();
    },

    resetForLogout: (preserveRegion = true) => {
      const region = preserveRegion ? get().region : null;
      const next: PersistedSession = {
        mode: "customer",
        activeWorkerRole: null,
        region,
      };
      set(next);
      // overwrite persisted state with the new snapshot
      save<PersistedSession>(PERSIST_KEY, next);
    },
  };

  // helper to persist only the data part
  function persistPartial() {
    const { mode, activeWorkerRole, region } = get();
    const snap: PersistedSession = { mode, activeWorkerRole, region };
    save<PersistedSession>(PERSIST_KEY, snap);
  }

  return store;
});
