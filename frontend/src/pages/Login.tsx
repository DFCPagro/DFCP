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
import type { User } from "@/types/auth";

type LoginForm = { email: string; password: string };
type LoginResponse = { user: User; token: string };

// If you want to avoid casting at call sites:
type RouteState = { from?: { pathname?: string } } | null;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as RouteState) ?? null;

  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { mutate, isPending } = useMutation<LoginResponse, unknown, LoginForm>({
    mutationFn: loginApi,
    onSuccess: ({ user, token }) => {
      setAuth({ user, token });
      toaster.create({ title: "Welcome back!", type: "success" });

      const to = state?.from?.pathname ?? PATHS.home;
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

        {/* Chakra UI v3 Button uses `loading` */}
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
