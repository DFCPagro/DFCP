// src/store/auth.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "../types/auth";

type AuthState = {
  user: User | null;
  token: string | null;
  setAuth: (payload: { user: User; token: string }) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
  isAuthed: () => boolean;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      setAuth: ({ user, token }) => set({ user, token }),
      setUser: (user) => set({ user }),
      logout: () => set({ user: null, token: null }),
      isAuthed: () => !!get().token,
    }),
    { name: "auth" } // localStorage key
  )
);
