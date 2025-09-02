"use client";

import { useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { registerApi, type RegisterPayload } from "@/api/auth";
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
import PhoneField, { type PhoneValue } from "@/components/feature/register/PhoneField";

export default function Register() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [form, setForm] = useState<RegisterPayload>({
    name: "",
    email: "",
    password: "",
    phone: "",     // set from phoneState.e164 on submit
    birthday: "",
    address: "",
  });

  const [phoneState, setPhoneState] = useState<PhoneValue>({
    countryDial: "+44",
    national: "",
    e164: "",
  });

  const [errors, setErrors] = useState<
    Partial<Record<keyof RegisterPayload | "phone", string>>
  >({});

  const { mutate, isPending } = useMutation({
    mutationFn: (payload: RegisterPayload) => registerApi(payload),
    onSuccess: ({ user, token }) => {
      setAuth({ user, token });
      toaster.create({ title: "Account created!", type: "success" });
      navigate("/dashboard", { replace: true });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? "Registration failed";
      toaster.create({ title: msg, type: "error" });
    },
  });

  // --- helpers ---------------------------------------------------------------

  // Clear a specific field error if condition is now valid
  const clearErrorIfValid = (key: keyof RegisterPayload | "phone", isValid: boolean) => {
    if (!isValid) return;
    setErrors((prev) => {
      if (!prev[key]) return prev; // nothing to clear
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Handle text input changes + clear their errors when non-empty
  const handleChange = (key: keyof RegisterPayload, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));

    // Basic inline validation (adjust as needed)
    if (key === "name") clearErrorIfValid("name", !!value.trim());
    if (key === "email") clearErrorIfValid("email", !!value.trim());
    if (key === "password") clearErrorIfValid("password", !!value);
    if (key === "birthday") clearErrorIfValid("birthday", !!value); // only if you ever set this error
    if (key === "address") clearErrorIfValid("address", !!value);   // only if you ever set this error
  };

  // Wrap PhoneField onChange to also clear its error when it becomes valid
  const handlePhoneChange = (next: PhoneValue) => {
    setPhoneState(next);
    // If you require phone, clear when E.164 present. If optional, this still clears any existing error.
    clearErrorIfValid("phone", !!next.e164);
  };

  // --- submit ----------------------------------------------------------------

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};

    if (!form.name?.trim()) newErrors.name = "Name is required";
    if (!form.email?.trim()) newErrors.email = "Email is required";
    if (!form.password) newErrors.password = "Password is required";

    // If you want to require phone, uncomment next line:
    // if (!phoneState.e164) newErrors.phone = "Phone is required";

    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }

    // All good → ensure we clear any stale errors
    setErrors({});

    const payload: RegisterPayload = {
      ...form,
      phone: phoneState.e164 || undefined, // E.164 to backend
    };

    mutate(payload);
  };

  // --- render ----------------------------------------------------------------

  return (
    <Box maxW="sm" mx="auto" mt={16} p={6} borderWidth="1px" borderRadius="lg">
      <VStack as="form" gap={4} onSubmit={submit}>
        <Heading size="md">Register</Heading>

        {/* Name */}
        <Field.Root invalid={!!errors.name}>
          <Field.Label>Name</Field.Label>
          <Input
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
          />
          {errors.name && <Field.ErrorText>{errors.name}</Field.ErrorText>}
        </Field.Root>

        {/* Email */}
        <Field.Root invalid={!!errors.email}>
          <Field.Label>Email</Field.Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
          />
          {errors.email && <Field.ErrorText>{errors.email}</Field.ErrorText>}
        </Field.Root>

        {/* Password */}
        <Field.Root invalid={!!errors.password}>
          <Field.Label>Password</Field.Label>
          <Input
            type="password"
            value={form.password}
            onChange={(e) => handleChange("password", e.target.value)}
          />
          {errors.password && (
            <Field.ErrorText>{errors.password}</Field.ErrorText>
          )}
        </Field.Root>

        {/* Phone */}
        <PhoneField
          value={phoneState}
          onChange={handlePhoneChange}
          helperText="Select country and enter your number"
          invalid={!!errors.phone}
        />
        {errors.phone && <Field.ErrorText>{errors.phone}</Field.ErrorText>}

        {/* Birthday (optional) */}
        <Field.Root invalid={!!errors.birthday}>
          <Field.Label>Birthday</Field.Label>
          <Input
            type="date"
            value={form.birthday ?? ""}
            onChange={(e) => handleChange("birthday", e.target.value)}
          />
          {errors.birthday && (
            <Field.ErrorText>{errors.birthday}</Field.ErrorText>
          )}
        </Field.Root>

        {/* Address (optional) */}
        <Field.Root invalid={!!errors.address}>
          <Field.Label>Address</Field.Label>
          <Input
            value={form.address ?? ""}
            onChange={(e) => handleChange("address", e.target.value)}
            placeholder="Street, City, ZIP"
          />
          {errors.address && (
            <Field.ErrorText>{errors.address}</Field.ErrorText>
          )}
        </Field.Root>

        <Button type="submit" loading={isPending} width="full">
          Create account
        </Button>

        <Text fontSize="sm">
          Already have an account?{" "}
          <CLink asChild color="blue.400">
            <RouterLink to="/login">Login</RouterLink>
          </CLink>
        </Text>
      </VStack>
    </Box>
  );
}
