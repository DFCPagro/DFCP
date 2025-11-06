"use client";

import { useMemo, useState } from "react";

import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { registerApi } from "@/api/auth";
import type { RegisterPayload, RegisterResponse } from "@/types/auth";

import {
  Box,
  Button,
  Heading,
  Link as CLink,
  Text,
  VStack,
  Field,
  Input,
  Flex,
  IconButton,
  Grid as CGrid

} from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import AddressAutocomplete from "@/components/common/AddressAutocomplete";
import MapPickerDialog from "@/components/common/SingleLocationPicker";
import { reverseGeocode } from "@/utils/googleMaps";
import { LocateFixed, Eye, EyeOff, Grid, MoveLeft } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import PhoneFieldControl, {
  type PhoneValue,
} from "./components/PhoneFieldControl";
import {
  isAtLeast16,
  isValidEmail,
  isValidName,
} from "@/validations/registration.validation";

type FormWithoutAddress = Omit<RegisterPayload, "address">;

export default function Register() {
  const navigate = useNavigate();

  // picker dialog + country restriction
  const [pickerOpen, setPickerOpen] = useState(false);
  const countries = "IL";

  // form (without address object)
  const [form, setForm] = useState<FormWithoutAddress>({
    name: "",
    email: "",
    password: "",
    phone: "",
    birthday: "",
  });

  // local UI state
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // address state → backend `address` object will be built from these
  const [addressText, setAddressText] = useState("");
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);

  const [phoneState, setPhoneState] = useState<PhoneValue>({
    countryDial: "+44",
    national: "",
    e164: "",
  });

  const [errors, setErrors] = useState<
    Partial<
      Record<
        keyof RegisterPayload | "phone" | "address" | "confirmPassword",
        string
      >
    >
  >({});

  const { mutate, isPending } = useMutation<
    RegisterResponse,
    any,
    RegisterPayload
  >({
    mutationFn: (payload) => registerApi(payload),
    onSuccess: () => {
      toaster.create({
        title: "Account created! Please login.",
        type: "success",
      });
      navigate("/login", { replace: true });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? "Registration failed";
      toaster.create({ title: msg, type: "error" });
    },
  });

  // helpers
  const clearErrorIfValid = (key: keyof typeof errors, ok: boolean) => {
    if (!ok) return;
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleChange = (key: keyof FormWithoutAddress, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));

    // live validations
    if (key === "name") clearErrorIfValid("name", isValidName(value));
    if (key === "email") clearErrorIfValid("email", isValidEmail(value));
    if (key === "password") {
      clearErrorIfValid("password", value.length >= 8);
      clearErrorIfValid(
        "confirmPassword",
        !!confirmPassword && confirmPassword === value
      );
    }
    if (key === "birthday")
      clearErrorIfValid("birthday", !!value && isAtLeast16(value));
  };

  const handleBlur = (key: keyof FormWithoutAddress | "confirmPassword") => {
    if (key === "name") {
      if (!form.name.trim())
        setErrors((p) => ({ ...p, name: "Name is required" }));
      else if (!isValidName(form.name))
        setErrors((p) => ({
          ...p,
          name: "Only letters and single spaces are allowed",
        }));
    }
    if (key === "email") {
      if (!form.email.trim())
        setErrors((p) => ({ ...p, email: "Email is required" }));
      else if (!isValidEmail(form.email))
        setErrors((p) => ({ ...p, email: "Enter a valid email" }));
    }
    if (key === "password") {
      if (!form.password)
        setErrors((p) => ({ ...p, password: "Password is required" }));
      else if (form.password.length < 8)
        setErrors((p) => ({ ...p, password: "Use at least 8 characters" }));
      if (confirmPassword && confirmPassword !== form.password) {
        setErrors((p) => ({ ...p, confirmPassword: "Passwords do not match" }));
      } else {
        clearErrorIfValid("confirmPassword", true);
      }
    }
    if (key === "birthday") {
      if (!form.birthday)
        setErrors((p) => ({ ...p, birthday: "Birthday is required" }));
      else if (!isAtLeast16(form.birthday))
        setErrors((p) => ({
          ...p,
          birthday: "You must be at least 16 years old",
        }));
    }
    if (key === "confirmPassword") {
      if (!confirmPassword)
        setErrors((p) => ({ ...p, confirmPassword: "Confirm your password" }));
      else if (confirmPassword !== form.password)
        setErrors((p) => ({ ...p, confirmPassword: "Passwords do not match" }));
    }
  };

  const handleConfirmChange = (value: string) => {
    setConfirmPassword(value);
    clearErrorIfValid("confirmPassword", !!value && value === form.password);
  };

  const handlePhoneChange = (next: PhoneValue) => {
    setPhoneState(next);
    clearErrorIfValid("phone", !!next.e164);
  };

  // geolocate
  const useMyLocation = async () => {
    if (!navigator.geolocation) {
      toaster.create({
        type: "error",
        title: "Geolocation not supported",
        description: "Your browser does not support geolocation.",
      });
      setPickerOpen(true);
      return;
    }

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        })
      );

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setLatitude(lat);
      setLongitude(lng);

      try {
        const addr = await reverseGeocode(lat, lng); // reverseGeocode loads maps internally
        if (addr) setAddressText(addr);
      } catch {
        /* ignore reverse geocode failure */
      }

      toaster.create({ type: "success", title: "Location detected" });
      clearErrorIfValid("address", true);
    } catch (e: any) {
      toaster.create({
        type: "error",
        title: "Couldn’t detect location",
        description: e?.message || "Pick your location on the map.",
      });
      setPickerOpen(true);
    }
  };

  // computed validity
  const isAddressValid =
    !!addressText.trim() && latitude != null && longitude != null;
  const isPhoneValid = !!phoneState.e164;
  const isBirthdayValid = !!form.birthday && isAtLeast16(form.birthday);
  const isConfirmValid = !!confirmPassword && confirmPassword === form.password;

  const isFormValid = useMemo(
    () =>
      isValidName(form.name) &&
      isValidEmail(form.email) &&
      form.password.length >= 8 &&
      isConfirmValid &&
      isPhoneValid &&
      isBirthdayValid &&
      isAddressValid,
    [form, isConfirmValid, isPhoneValid, isBirthdayValid, isAddressValid]
  );

  // submit
  const submit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: typeof errors = {};
    if (!form.name?.trim()) newErrors.name = "Name is required";
    else if (!isValidName(form.name))
      newErrors.name = "Only letters and single spaces are allowed";

    if (!form.email?.trim()) newErrors.email = "Email is required";
    else if (!isValidEmail(form.email)) newErrors.email = "Enter a valid email";

    if (!form.password) newErrors.password = "Password is required";
    else if (form.password.length < 8)
      newErrors.password = "Use at least 8 characters";

    if (!confirmPassword) newErrors.confirmPassword = "Confirm your password";
    else if (confirmPassword !== form.password)
      newErrors.confirmPassword = "Passwords do not match";

    if (!isBirthdayValid) {
      newErrors.birthday = form.birthday
        ? "You must be at least 16 years old"
        : "Birthday is required";
    }

    if (!isPhoneValid) newErrors.phone = "Phone number is required";

    if (!addressText?.trim()) newErrors.address = "Address is required";
    if (latitude == null || longitude == null)
      newErrors.address = "Please select a point on the map";

    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    const payload: RegisterPayload = {
      ...form,
      phone: phoneState.e164 || undefined,
      address: {
        lnt: longitude as number,
        alt: latitude as number,
        address: addressText.trim(),
      },
    };

    mutate(payload);
  };

  return (
    <CGrid templateColumns="repeat(2, 1fr)" bg="#1C2E09">
      
    <Box mx="auto" mt={10} p={5} borderWidth="1px" borderRadius="2xl" w="90%" bg="white">
      <VStack as="form"  gap={2} onSubmit={submit} w="100%">
        <Heading size="2xl">Register</Heading>

        <Field.Root invalid={!!errors.name} required>
        <Flex align="center" gap={1} w="100%">
  <Field.Label mb="0" fontSize="lg">
    Name <Field.RequiredIndicator />
  </Field.Label>
  <Input
    value={form.name}
    onChange={(e) => handleChange("name", e.target.value)}
    onBlur={() => handleBlur("name")}
    required
    placeholder="Full name"
    autoComplete="name"
    aria-invalid={!!errors.name}
    width="auto"
    flex="1"
  />
</Flex>
          {errors.name ? (
            <Field.ErrorText>{errors.name}</Field.ErrorText>
          ) : (
            <Field.HelperText>Letters and spaces only.</Field.HelperText>
          )}
        </Field.Root>

        <Field.Root invalid={!!errors.email} required>
             <Flex align="center" gap={3} w="100%">
          <Field.Label fontSize="lg">
            Email <Field.RequiredIndicator />
          </Field.Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
            onBlur={() => handleBlur("email")}
            required
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
            width="100%"
            flex="1"
            aria-invalid={!!errors.email}
          />
          </Flex>
          {errors.email ? (
            <Field.ErrorText>{errors.email}</Field.ErrorText>
          ) : (
            <Field.HelperText>
              We’ll send a confirmation email.
            </Field.HelperText>
          )}
        </Field.Root>

        <Field.Root invalid={!!errors.password} required>
         <Flex align="center" gap={3} w="100%">
          <Field.Label fontSize="lg">

            Password <Field.RequiredIndicator />
          </Field.Label>
          <Box position="relative" w="100%">
            <Input
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(e) => handleChange("password", e.target.value)}
              onBlur={() => handleBlur("password")}
              required
              placeholder="At least 8 characters"
              autoComplete="new-password"
              pr="10"
              w="100%"
              flex="1"
            />
            <IconButton
              aria-label={showPassword ? "Hide password" : "Show password"}
              size="xs"
              variant="ghost"
              onClick={() => setShowPassword((v) => !v)}
              position="absolute"
              top="50%"
              right="2"
              transform="translateY(-50%)"
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </IconButton>
          
          </Box>
          </Flex>
          {errors.password ? (
            <Field.ErrorText>{errors.password}</Field.ErrorText>
          ) : (
            <Field.HelperText>
              Use a strong password you don’t reuse elsewhere.
            </Field.HelperText>
          )}
        </Field.Root>

        <Field.Root invalid={!!errors.confirmPassword} required>
                       <Flex align="center" gap={3} w="100%">
          <Field.Label fontSize="lg" mb="0" whiteSpace="nowrap">
            Confirm password <Field.RequiredIndicator />
          </Field.Label>
          <Box position="relative" w="100%">
            <Input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => handleConfirmChange(e.target.value)}
              onBlur={() => handleBlur("confirmPassword")}
              required
              placeholder="Re-enter your password"
              autoComplete="new-password"
              pr="10"
              width="100%"
              flex={1}
            />
            <IconButton
              aria-label={showConfirm ? "Hide password" : "Show password"}
              size="xs"
              variant="ghost"
              onClick={() => setShowConfirm((v) => !v)}
              position="absolute"
              top="50%"
              right="2"
              transform="translateY(-50%)"
            >
              {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
            </IconButton>
          </Box>
          </Flex>
          {errors.confirmPassword ? (
            <Field.ErrorText>{errors.confirmPassword}</Field.ErrorText>
          ) : (
            <Field.HelperText>Must match the password above.</Field.HelperText>
          )}
        </Field.Root>
        <PhoneFieldControl
          value={phoneState}
          onChange={handlePhoneChange}
          required
          invalid={!!errors.phone}
          errorText={errors.phone}
          helperText="We’ll use this for account security."
        />

        <Field.Root invalid={!!errors.birthday} required>
          <Flex gap={3} w="100%">
          <Field.Label fontSize="lg">
            Birthday <Field.RequiredIndicator />
          </Field.Label>
          <Input
            type="date"
            value={form.birthday ?? ""}
            onChange={(e) => handleChange("birthday", e.target.value)}
            onBlur={() => handleBlur("birthday")}
            required
            max={new Date().toISOString().slice(0, 10)}
            flex={1}
            w="100%"
          />
          </Flex>
          {errors.birthday ? (
            <Field.ErrorText>{errors.birthday}</Field.ErrorText>
          ) : (
            <Field.HelperText>
              You must be at least 16 years old.
            </Field.HelperText>
          )}
        </Field.Root>

        <Field.Root invalid={!!errors.address} required>
          <Flex gap={3} w="100%">
          <Field.Label fontSize="lg">
            Address <Field.RequiredIndicator />
          </Field.Label>
          <AddressAutocomplete
            value={addressText}
            onChange={(v) => {
              setAddressText(v);
              clearErrorIfValid(
                "address",
                !!v.trim() && latitude != null && longitude != null
              );
            }}
            onPlaceSelected={({ address, lat, lng }) => {
              setAddressText(address);
              if (lat != null) setLatitude(lat);
              if (lng != null) setLongitude(lng);
              clearErrorIfValid(
                "address",
                !!address && lat != null && lng != null
              );
            }}
            countries={countries}
            placeholder="Search and pick an address"
            flex={1}
          />
          </Flex>
          {errors.address && (
            <Field.ErrorText>{errors.address}</Field.ErrorText>
          )}
        </Field.Root>

        <Flex gap={3} align="center" w="full">
          <Button variant="subtle" onClick={() => setPickerOpen(true)}>
            Pick on map
          </Button>
          <Tooltip content="Use my current location" openDelay={0}>
            <IconButton
              size="xs"
              variant="ghost"
              onClick={useMyLocation}
              aria-label="Use my location"
            >
              <LocateFixed size={14} />
            </IconButton>
          </Tooltip>
          {latitude != null && longitude != null && (
            <Text fontSize="xs" color="gray.500" ml="auto">
              ({latitude.toFixed(4)}, {longitude.toFixed(4)})
            </Text>
          )}
        </Flex>

        <Button
          type="submit"
          loading={isPending}
          width="full"
          disabled={!isFormValid || isPending}
        >
          Create account
        </Button>

        <Text fontSize="sm">
          Already have an account?{" "}
          <CLink asChild color="blue.400">
            <RouterLink to="/login">Login</RouterLink>
          </CLink>
        </Text>
      </VStack>

      <MapPickerDialog
        key={pickerOpen ? "open" : "closed"}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={(v) => {
          setAddressText(v.address);
          setLatitude(v.lat);
          setLongitude(v.lng);
          setPickerOpen(false);
          clearErrorIfValid(
            "address",
            !!v.address && v.lat != null && v.lng != null
          );
        }}
          initial={latitude != null && longitude != null ? { lat: latitude, lng: longitude, address: addressText } : undefined}
  countries="IL"
      />
    </Box>
    <Box 
    w="full"
  minH="100vh"      // pick the height you need
  p={0}
  bgImage="url(/images/reg.jpeg)"
  bgSize="contain"
  bgPos="center"
  bgRepeat="no-repeat"
>
      
    </Box>
    </CGrid>
  );
}
