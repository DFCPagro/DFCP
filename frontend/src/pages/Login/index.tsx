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
  AbsoluteCenter,
} from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import type { FormEvent } from "react";
import { PATHS } from "@/routes/paths";
import { getDefaultLanding } from "@/config/nav.defaults";
//import loginLogo from "@/public/images/loginLogo.png";
//import backgroundImgUrl from "@/public/images/loginBackground.png";

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
    <Box>
      <Box
        position="absolute"
        inset={0}
        maxH="100vh"
        maxW="100vw"
        pointerEvents="none"
        bgImage="url(/images/Entry.png)"
        bgSize="cover"
        bgPos="center"
        bgRepeat="no-repeat"
      />
 <AbsoluteCenter>
          <Box maxW="m" mx="auto" mt={20} p={10} width="70vh" borderWidth="1px" borderRadius="3xl" bg="white">

    <center><img  src="/images/loginLogo.png" alt="DFCP logo" /></center>
      <VStack as="form" gap={{ base: 10, md: 4 }}  onSubmit={submit} >
        <Heading size="4xl">Login</Heading>

         <Field.Root orientation="horizontal" alignItems="center" gap={4}>
  <Field.Label
    w={{ base: "32", md: "40" }}   // fixed label width
    textAlign="right" fontSize="xl"
  >
    Email
  </Field.Label>

  <Input
    flex="1"
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    autoComplete="email"
    required
    size="xl"
  />
</Field.Root>


        <Field.Root orientation="horizontal" alignItems="center" gap={4}>
    <Field.Label w={{ base: "32", md: "40" }} textAlign="right" fontSize="xl">
      Password
    </Field.Label>
    <Input
      flex="1"
      type="password"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      autoComplete="current-password"
      required
      size="xl"
    />
  </Field.Root>
        <Button type="submit" loading={isPending} width="500" size="2xl" borderRadius="4xl">
          Sign in
        </Button>

        <Text fontSize="lg">
          No account?{" "}
          <CLink asChild color="blue.400">
            <RouterLink to={PATHS.register}>Register</RouterLink>
          </CLink>
        </Text>
      </VStack>
</Box>
</AbsoluteCenter>
    </Box>

  );
}


