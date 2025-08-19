// src/pages/Login.tsx
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

export default function Login() {
  const navigate = useNavigate();
  const { state } = useLocation() as { state?: { from?: { pathname?: string } } };
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: loginApi,
    onSuccess: ({ user, token }) => {
      setAuth({ user, token });
      toaster.create({ title: "Welcome back!", type: "success" });
      const to = state?.from?.pathname ?? "/dashboard";
      navigate(to, { replace: true });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? "Login failed";
      toaster.create({ title: msg, type: "error" });
    },
  });

  const submit = (e: React.FormEvent) => {
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
          />
        </Field.Root>

        <Field.Root>
          <Field.Label>Password</Field.Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field.Root>

        {/* v3: Button -> use `loading` (not `isLoading`) */}
        <Button type="submit" loading={isPending} width="full">
          Sign in
        </Button>

        <Text fontSize="sm">
          No account?{" "}
          {/* v3: compose router links via `asChild` */}
          <CLink asChild color="blue.400">
            <RouterLink to="/register">Register</RouterLink>
          </CLink>
        </Text>
      </VStack>
    </Box>
  );
}
