// src/store/auth.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, Role } from "../types/auth";
import { useSessionStore } from "@/store/session";

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
        const session = useSessionStore.getState();
        session.setMode("customer"); // authenticated UI baseline
        session.setActiveWorkerRole(isWorkRole(user.role) ? (user.role as string) : null);
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
          if (session.mode === "noUser") session.setMode("customer");
          session.setActiveWorkerRole(isWorkRole(user.role) ? (user.role as string) : null);
        }
      },

      /** Update role explicitly */
      setRole: (role) => {
        set({ role });

        // 🔗 Keep session worker role consistent
        const session = useSessionStore.getState();
        session.setActiveWorkerRole(isWorkRole(role) ? (role as string) : null);
        // If we somehow were "noUser" but a role arrived, ensure customer mode
        if (session.mode === "noUser" && get().token) session.setMode("customer");
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
            if (session.mode === "noUser") session.setMode("customer");
            session.setActiveWorkerRole(isWorkRole(s.role) ? (s.role as string) : null);
          } else {
            // No persisted auth → ensure guest UI
            session.resetForLogout(true);
          }
        });
      },
    }
  )
);
