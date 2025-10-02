import { Navigate, useLocation, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { PATHS } from "@/routes/paths";
import type { ReactNode } from "react";

type Props = {
  redirectTo?: string;
  children?: ReactNode; // <-- allow children
};

export default function GuestGuard({ redirectTo = PATHS.dashboard, children }: Props) {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();

  if (token) {
    const from = (location.state as any)?.from?.pathname || redirectTo;
    return <Navigate to={from} replace />;
  }

  // If no token, render children if provided, else use nested routes via <Outlet />
  return <>{children ?? <Outlet />}</>;
}
