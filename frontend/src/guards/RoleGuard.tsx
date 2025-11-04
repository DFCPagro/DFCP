// src/guards/RoleGuard.tsx
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { PATHS } from "@/routes/paths";
import { getDefaultLanding } from "@/config/nav.defaults"; // named import

type Props = { children: ReactNode; allow: string[] };

export default function RoleGuard({ children, allow }: Props) {
  const role = useAuthStore((s) => s.role);
  const location = useLocation();

  if (!role) {
    return (
      <Navigate
        to={PATHS.login}
        replace
        state={{ from: { pathname: location.pathname + location.search } }}
      />
    );
  }

  const permitted = allow.includes("*") || allow.includes(role);
  if (!permitted) {
    return <Navigate to={getDefaultLanding(role)} replace />;
  }

  return <>{children}</>;
}
