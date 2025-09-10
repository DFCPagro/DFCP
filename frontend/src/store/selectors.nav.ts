// src/store/selectors.nav.ts
import { useSessionStore } from "./session";

/** "customer" | "work" */
export const useMode = () => useSessionStore((s) => s.mode);
/** active worker role string or null */
export const useActiveRole = () => useSessionStore((s) => s.activeWorkerRole);
/** boolean derived from active role existing */
export const useHasWorkRole = () => useSessionStore((s) => Boolean(s.activeWorkerRole));
/** region string or null */
export const useRegion = () => useSessionStore((s) => s.region);

// actions (handy to import directly in components)
export const useSessionActions = () =>
  useSessionStore((s) => ({
    setMode: s.setMode,
    toggleMode: s.toggleMode,
    setActiveWorkerRole: s.setActiveWorkerRole,
    setRegion: s.setRegion,
    resetForLogout: s.resetForLogout,
  }));
