import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { PATHS } from "@/routes/paths";

type Props = { children: ReactNode; allow: string[] };

export default function RoleGuard({ children, allow }: Props) {
  const role = useAuthStore((s) => s.role);
  if (!role || !allow.includes(role)) return <Navigate to={PATHS.dashboard} replace />;
  return <>{children}</>;
}
