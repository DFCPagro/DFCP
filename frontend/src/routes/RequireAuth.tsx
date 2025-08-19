// src/routes/RequireAuth.tsx
import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { meApi } from "@/api/auth";
import { useAuthStore } from "@/store/auth";
import { Box, Spinner } from "@chakra-ui/react";

export default function RequireAuth() {
  const location = useLocation();
  const token = useAuthStore((s) => s.token);
  const setUser = useAuthStore((s) => s.setUser);

  const { data, isPending, isError } = useQuery({
    queryKey: ["me"],
    queryFn: meApi,          // returns Promise<{ user: User }>
    enabled: !!token,        // only run when we have a token
    retry: 1,
  });

  // hydrate user when query returns
  useEffect(() => {
    if (data?.user) setUser(data.user);
  }, [data, setUser]);

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isPending) {
    return (
      <Box p={6}>
        <Spinner /> Loading…
      </Box>
    );
  }

  if (isError) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
