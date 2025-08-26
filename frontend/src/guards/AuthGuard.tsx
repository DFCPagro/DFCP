import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { PATHS } from "@/routes/paths";

type Props = { children?: ReactNode };

export default function AuthGuard({ children }: Props) {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();

  if (!token) {
    return (
      <Navigate
        to={PATHS.login}
        replace
        state={{ from: location }}
      />
    );
  }

  // supports both wrapper style <AuthGuard><Component/></AuthGuard>
  // and route-outlet style <Route element={<AuthGuard/>} />
  return children ? <>{children}</> : <Outlet />;
}
