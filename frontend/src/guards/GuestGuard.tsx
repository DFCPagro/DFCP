import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { PATHS } from "@/routes/paths";

type Props = { children: ReactNode; redirectTo?: string };

export default function GuestGuard({ children, redirectTo = PATHS.dashboard }: Props) {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();

  if (token) {
    const from = (location.state as any)?.from?.pathname || redirectTo;
    return <Navigate to={from} replace />;
  }

  return <>{children}</>;
}
