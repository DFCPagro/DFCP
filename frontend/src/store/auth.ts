import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, Role } from "../types/auth";

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

      setAuth: ({ user, token }) => set({ user, token, role: user.role }),
      setUser: (user) => set({ user, role: user?.role ?? null }),
      setRole: (role) => set({ role }),

      logout: () => set({ user: null, token: null, role: null }),
      isAuthed: () => !!get().token,

      hasRole: (roles) => {
        const current = get().role;
        return current ? roles.includes(current) : false;
      },
    }),
    { name: "auth" } // localStorage key
  )
);
