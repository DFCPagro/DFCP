import { Navigate, useLocation, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { PATHS } from "@/routes/paths";

type Props = { redirectTo?: string };

export default function GuestGuard({ redirectTo = PATHS.dashboard }: Props) {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();

  if (token) {
    const from = (location.state as any)?.from?.pathname || redirectTo;
    return <Navigate to={from} replace />;
  }

  // If no token, render nested routes via Outlet
  return <Outlet />;
}
