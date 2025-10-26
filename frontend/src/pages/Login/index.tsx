import { useState } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { loginApi } from "@/api/auth";
import { useAuthStore } from "@/store/auth";
import {
  Box,
  Button,
  Heading,
  Link as CLink,
  Text,
  VStack,
  Field,
  Input,
} from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import type { FormEvent } from "react";
import { PATHS } from "@/routes/paths";
import { getDefaultLanding } from "@/config/nav.defaults";

type LoginForm = { email: string; password: string };
type RouteState = { from?: { pathname?: string } } | null;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as RouteState) ?? null;

  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: (form: LoginForm) => loginApi(form),
    onSuccess: ({ user, token, logisticCenterId }) => {
      // setAuth is already called inside loginApi, but keeping this as a no-op safety
      setAuth({ user, token, logisticCenterId });

      // 2) Nice toast
      toaster.create({ title: "Welcome back!", type: "success" });

      // 3) Role-aware landing
      const role = user?.role;
      let to: string;

      to = getDefaultLanding(role);
      // Basic sanity—ensure center id is present for work dashboards
      if (!logisticCenterId && user.role !== "customer") {
        toaster.create({
          title: "No logistics center linked to your account.",
          description: "Ask an admin to assign a center before continuing.",
          type: "warning",
        });
      }

      toaster.create({ title: "Welcome back!", type: "success" });

      // Role-aware landing (fall back to `from` if provided)
      const redirectFromState = state?.from?.pathname;
      if (redirectFromState) {
        navigate(redirectFromState, { replace: true });
        return;
      }

      navigate(to, { replace: true });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? "Login failed";
      toaster.create({ title: msg, type: "error" });
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    mutate({ email, password });
  };

  return (
    <Box maxW="sm" mx="auto" mt={16} p={6} borderWidth="1px" borderRadius="lg">
      <VStack as="form" gap={4} onSubmit={submit}>
        <Heading size="md">Login</Heading>

        <Field.Root>
          <Field.Label>Email</Field.Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </Field.Root>

        <Field.Root>
          <Field.Label>Password</Field.Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </Field.Root>

        <Button type="submit" loading={isPending} width="full">
          Sign in
        </Button>

        <Text fontSize="sm">
          No account?{" "}
          <CLink asChild color="blue.400">
            <RouterLink to={PATHS.register}>Register</RouterLink>
          </CLink>
        </Text>
      </VStack>
    </Box>
  );
}


