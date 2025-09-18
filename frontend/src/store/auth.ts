// src/store/auth.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, Role } from "../types/auth";
import { useSessionStore } from "@/store/session";

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


/** Treat anything that's not "customer" as a work role */
const isWorkRole = (role: Role | null | undefined) => !!role && role !== "customer";

type AuthState = {
  user: User | null;
  token: string | null;
  role: Role | null;

  setAuth: (payload: { user: User; token: string }) => void;
  setUser: (user: User | null) => void;
  setRole: (role: Role | null) => void;
  logout: () => void;

  isAuthed: () => boolean;
  hasRole: (roles: Role[]) => boolean;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      role: null,

      /** Called after a successful login */
      setAuth: ({ user, token }) => {
        set({ user, token, role: user.role });

        // 🔗 Sync session mode + worker role
        syncSessionForRole(user.role);
      },

      /** Update user object (e.g., /me refresh or profile edit) */
      setUser: (user) => {
        set({ user, role: user?.role ?? null });

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
        set({ user: null, token: null, role: null });

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
      name: "auth", // localStorage key

      /** On rehydrate, ensure session store is consistent with persisted auth */
      onRehydrateStorage: () => (state) => {
        // Runs after auth state is loaded from storage
        // We schedule sync after next tick to ensure `state` is populated.
        queueMicrotask(() => {
          const s = useAuthStore.getState();
          const session = useSessionStore.getState();

          if (s.token && s.user) {
            // Persisted login → ensure UI is authenticated
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
