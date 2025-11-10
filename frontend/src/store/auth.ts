import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User, Role } from "../types/auth";
import { useSessionStore } from "@/store/session";

/** Treat anything that's not "customer" as a work role */
const isWorkRole = (role: Role | null | undefined) => !!role && role !== "customer";

function syncSessionForRole(role: Role | null | undefined) {
  const session = useSessionStore.getState();
  if (isWorkRole(role)) {
    // ORDER MATTERS: mode → role
    session.setMode("work");
    session.setActiveWorkerRole(role as string);
  } else {
    session.setMode("customer");
    session.setActiveWorkerRole(null);
  }
}

type AuthState = {
  user: User | null;
  token: string | null;
  role: Role | null;
  mdCoins: number | 0;

  /** The ONLY center identifier we store */
  logisticCenterId: string | null;

  // actions
  setAuth: (payload: { user: User; token: string; logisticCenterId?: string | null , mdCoins: number | 0}) => void;
  setUser: (user: User | null) => void;
  setRole: (role: Role | null) => void;
  logout: () => void;

  // helpers
  isAuthed: () => boolean;
  hasRole: (roles: Role[]) => boolean;
};

const STORAGE_KEY = "auth";
const PERSIST_VERSION = 3; // bumped: dropped legacy centerId

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      role: null,
      logisticCenterId: null,
      mdCoins: 0,

      /** Called after a successful login */
      setAuth: ({ user, token, logisticCenterId, mdCoins }) => {
        // Prefer explicit arg if backend sent it at top level; otherwise pick from user
        const lc: string | null =
          (typeof logisticCenterId === "string" ? logisticCenterId : null) ??
          (user?.logisticCenterId ? String(user.logisticCenterId) : null) ??
          null;

        set({
          user,
          token,
          role: user?.role ?? null,
          logisticCenterId: lc,
          mdCoins: mdCoins ?? 0,
        });

        // 🔗 Sync session mode + worker role
        syncSessionForRole(user?.role);
      },

      /** Update user object (e.g., /me refresh or profile edit) */
      setUser: (user) => {
        const lc: string | null = user?.logisticCenterId ? String(user.logisticCenterId) : null;

        set({
          user,
          role: user?.role ?? null,
          logisticCenterId: lc,
        });

        // 🔗 Keep session in sync when role changes via user
        const session = useSessionStore.getState();
        if (!user) {
          // If we lost the user unexpectedly, treat as logout → noUser
          session.resetForLogout(true);
        } else {
          // Ensure we're in an authenticated mode; default to customer
          syncSessionForRole(user.role);
        }
      },

      /** Update role explicitly */
      setRole: (role) => {
        set({ role });
        syncSessionForRole(role);
      },

      /** Full logout */
      logout: () => {
        set({
          user: null,
          token: null,
          role: null,
          logisticCenterId: null,
        });

        // 🔗 Reset session to noUser and clear worker role (preserve region by default)
        const session = useSessionStore.getState();
        session.resetForLogout(true);
      },

      isAuthed: () => !!get().token,

      hasRole: (roles) => {
        const current = get().role;
        return current ? roles.includes(current) : false;
      },
    }),
    {
      name: STORAGE_KEY,
      version: PERSIST_VERSION,
      storage: createJSONStorage(() => localStorage),

      /** Persist only needed primitives (functions are ignored anyway) */
      partialize: (s) => ({
        user: s.user,
        token: s.token,
        role: s.role,
        logisticCenterId: s.logisticCenterId,
      }),

      /** Migrate older snapshots to the single-field shape */
      migrate: (persisted, fromVersion) => {
        const base = (persisted ?? {}) as any;

        // v1/v2 stored both logisticCenterId and centerId; v0 may store neither.
        if ((fromVersion ?? 0) < 3) {
          const guessLC =
            base?.logisticCenterId ??
            base?.centerId ?? // drop this after migration
            base?.user?.logisticCenterId ??
            base?.user?.centerId ??
            null;

          return {
            user: base?.user ?? null,
            token: base?.token ?? null,
            role: base?.role ?? null,
            logisticCenterId: guessLC ? String(guessLC) : null,
          } as AuthState;
        }

        // Already new shape
        return {
          user: base?.user ?? null,
          token: base?.token ?? null,
          role: base?.role ?? null,
          logisticCenterId: base?.logisticCenterId ?? null,
        } as AuthState;
      },

      /** Keep session store consistent after rehydrate */
      onRehydrateStorage: () => () => {
        queueMicrotask(() => {
          const s = useAuthStore.getState();
          const session = useSessionStore.getState();

          if (s.token && s.user) {
            // Ensure session matches the restored role
            syncSessionForRole(s.role);
          } else {
            // No persisted auth → ensure guest UI
            session.resetForLogout(true);
          }
        });
      },
    }
  )
);
