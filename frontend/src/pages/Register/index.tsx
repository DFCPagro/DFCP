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
  Grid as CGrid,
  Image,
  HStack,
  Checkbox,
} from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import AddressAutocomplete from "@/components/common/AddressAutocomplete";
import MapPickerDialog from "@/components/common/SingleLocationPicker";
import { reverseGeocode } from "@/utils/googleMaps";
import { LocateFixed, Eye, EyeOff, ChevronLeft, ChevronRight } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import PhoneFieldControl, { type PhoneValue } from "./components/PhoneFieldControl";
import { isAtLeast16, isValidEmail, isValidName } from "@/validations/registration.validation";

type FormWithoutAddress = Omit<RegisterPayload, "address">;

export default function Register() {
  const navigate = useNavigate();

  const [pickerOpen, setPickerOpen] = useState(false);
  const countries = "IL";

  const [form, setForm] = useState<FormWithoutAddress>({
    name: "",
    email: "",
    password: "",
    phone: "",
    birthday: "",
  });

  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [addressText, setAddressText] = useState("");
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);

  const [phoneState, setPhoneState] = useState<PhoneValue>({
    countryDial: "+44",
    national: "",
    e164: "",
  });

  const [agreeTerms, setAgreeTerms] = useState(false);

  const [errors, setErrors] = useState<
    Partial<
      Record<
        keyof RegisterPayload | "phone" | "address" | "confirmPassword" | "terms",
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
    if (key === "name") clearErrorIfValid("name", isValidName(value));
    if (key === "email") clearErrorIfValid("email", isValidEmail(value));
    if (key === "password") {
      clearErrorIfValid("password", value.length >= 8);
      clearErrorIfValid("confirmPassword", !!confirmPassword && confirmPassword === value);
    }
    if (key === "birthday") clearErrorIfValid("birthday", !!value && isAtLeast16(value));
  };

  const handleBlur = (key: keyof FormWithoutAddress | "confirmPassword") => {
    if (key === "name") {
      if (!form.name.trim()) setErrors((p) => ({ ...p, name: "Name is required" }));
      else if (!isValidName(form.name))
        setErrors((p) => ({ ...p, name: "Only letters and single spaces are allowed" }));
    }
    if (key === "email") {
      if (!form.email.trim()) setErrors((p) => ({ ...p, email: "Email is required" }));
      else if (!isValidEmail(form.email))
        setErrors((p) => ({ ...p, email: "Enter a valid email" }));
    }
    if (key === "password") {
      if (!form.password) setErrors((p) => ({ ...p, password: "Password is required" }));
      else if (form.password.length < 8)
        setErrors((p) => ({ ...p, password: "Use at least 8 characters" }));
      if (confirmPassword && confirmPassword !== form.password) {
        setErrors((p) => ({ ...p, confirmPassword: "Passwords do not match" }));
      } else {
        clearErrorIfValid("confirmPassword", true);
      }
    }
    if (key === "birthday") {
      if (!form.birthday) setErrors((p) => ({ ...p, birthday: "Birthday is required" }));
      else if (!isAtLeast16(form.birthday))
        setErrors((p) => ({ ...p, birthday: "You must be at least 16 years old" }));
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
        const addr = await reverseGeocode(lat, lng);
        if (addr) setAddressText(addr);
      } catch {}

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

  const isAddressValid = !!addressText.trim() && latitude != null && longitude != null;
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
      isAddressValid &&
      agreeTerms,
    [form, isConfirmValid, isPhoneValid, isBirthdayValid, isAddressValid, agreeTerms]
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: typeof errors = {};
    if (!form.name?.trim()) newErrors.name = "Name is required";
    else if (!isValidName(form.name)) newErrors.name = "Only letters and single spaces are allowed";

    if (!form.email?.trim()) newErrors.email = "Email is required";
    else if (!isValidEmail(form.email)) newErrors.email = "Enter a valid email";

    if (!form.password) newErrors.password = "Password is required";
    else if (form.password.length < 8) newErrors.password = "Use at least 8 characters";

    if (!confirmPassword) newErrors.confirmPassword = "Confirm your password";
    else if (confirmPassword !== form.password) newErrors.confirmPassword = "Passwords do not match";

    if (!isBirthdayValid) {
      newErrors.birthday = form.birthday ? "You must be at least 16 years old" : "Birthday is required";
    }

    if (!isPhoneValid) newErrors.phone = "Phone number is required";

    if (!addressText?.trim()) newErrors.address = "Address is required";
    if (latitude == null || longitude == null) newErrors.address = "Please select a point on the map";

    if (!agreeTerms) newErrors.terms = "You must agree to the Terms to continue";

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

  const images = [
    { src: "/images/reg1.png", alt: "Register step 1" },
    { src: "/images/reg2.png", alt: "Register step 2" },
    { src: "/images/reg3.png", alt: "Register step 3" },
  ] as const;

  const [active, setActive] = useState(0);

  const prev = () => setActive((i) => (i === 0 ? images.length - 1 : i - 1));
  const next = () => setActive((i) => (i + 1) % images.length);

  return (
    <CGrid templateColumns="repeat(2, 1fr)" bg="#4a6f1eff">
      <Box mx="auto" mt={10} p={5} borderWidth="1px" borderRadius="2xl" w="80%" h="100hv" bg="white">
        <VStack as="form" gap={2} onSubmit={submit} w="100%">
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
              <Field.HelperText>We’ll send a confirmation email.</Field.HelperText>
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
              <Field.HelperText>Use a strong password you don’t reuse elsewhere.</Field.HelperText>
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
              <Field.HelperText>You must be at least 16 years old.</Field.HelperText>
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
                  clearErrorIfValid("address", !!v.trim() && latitude != null && longitude != null);
                }}
                onPlaceSelected={({ address, lat, lng }) => {
                  setAddressText(address);
                  if (lat != null) setLatitude(lat);
                  if (lng != null) setLongitude(lng);
                  clearErrorIfValid("address", !!address && lat != null && lng != null);
                }}
                countries={countries}
                placeholder="Search and pick an address"
                flex={1}
              />
            </Flex>
            {errors.address && <Field.ErrorText>{errors.address}</Field.ErrorText>}
          </Field.Root>

          <Flex gap={3} align="center" w="full">
            <Button variant="subtle" onClick={() => setPickerOpen(true)}>
              Pick on map
            </Button>
            <Tooltip content="Use my current location" openDelay={0}>
              <IconButton size="xs" variant="ghost" onClick={useMyLocation} aria-label="Use my location">
                <LocateFixed size={14} />
              </IconButton>
            </Tooltip>
            {latitude != null && longitude != null && (
              <Text fontSize="xs" color="gray.500" ml="auto">
                ({latitude.toFixed(4)}, {longitude.toFixed(4)})
              </Text>
            )}
          </Flex>

          {/* Terms */}
          <Field.Root invalid={!!errors.terms} required>
            <Checkbox.Root
              checked={agreeTerms}
              onCheckedChange={(d) => {
                const checked = typeof d.checked === "boolean" ? d.checked : false;
                setAgreeTerms(checked);
                clearErrorIfValid("terms", checked);
              }}
            >
              <Checkbox.Control />
              <Checkbox.Label>
                I agree to the{" "}
                <CLink asChild color="blue.500" textDecoration="underline">
                  <RouterLink to="/terms">Terms of Service</RouterLink>
                </CLink>{" "}
                and{" "}
                <CLink asChild color="blue.500" textDecoration="underline">
                  <RouterLink to="/privacy">Privacy Policy</RouterLink>
                </CLink>
                .
              </Checkbox.Label>
            </Checkbox.Root>
            {errors.terms && <Field.ErrorText>{errors.terms}</Field.ErrorText>}
          </Field.Root>

          <Button type="submit" loading={isPending} width="full" disabled={!isFormValid || isPending}>
            Create account
          </Button>

          <Text fontSize="sm">
            Already have an account?{" "}
            <CLink asChild color="blue.400">
              <RouterLink to="/login">Login</RouterLink>
            </CLink>
          </Text>

          {/* Advertisement-style promo */}
          <Box
            role="group"
            w="full"
            borderRadius="xl"
            p="4"
            bgGradient="linear(to-r, #1a202c, #2d3748)"
            position="relative"
            overflow="hidden"
            shadow="lg"
            _hover={{ shadow: "xl" }}
          >
            <Box
              position="absolute"
              inset="0"
              opacity="0.15"
              bgImage="radial-gradient(circle at 20% 20%, #6ca51e 0.5px, transparent 1px), radial-gradient(circle at 80% 30%, #4a6f1e 0.5px, transparent 1px)"
              bgSize="20px 20px"
            />
            <Flex align="center" gap="3">
              <Box
                flex="0 0 auto"
                p="2"
                borderRadius="full"
                bg="whiteAlpha.200"
                transform="translateZ(0)"
                _groupHover={{ transform: "scale(1.05)" }}
                transition="transform 0.2s ease"
              >
                <Image
                  src="/images/MDcoin3.png"
                  alt="Affiliate"
                  loading="lazy"
                  boxSize="48px"
                  objectFit="contain"
                />
              </Box>

              <Box flex="1" color="white">
                <Text fontSize="sm" opacity="0.8" mb="1" color=" #4a6f1e">
                  Sponsored
                </Text>
                <Heading size="md" lineHeight="short" mb="1" color=" #4a6f1e">
                  Earn with our Affiliate Program
                </Heading>
                <Text fontSize="md" opacity="0.9" color=" #4a6f1e">
                  Share, refer, and receive payouts on every successful signup.
                </Text>
              </Box>

              <Button
                asChild
                size="xs"
                variant="solid"
                colorPalette="teal"
                borderRadius="full"
                px="4"
                _groupHover={{ translateY: "-1px" }}
              >
                <RouterLink to="#">Join now</RouterLink>
              </Button>
            </Flex>
          </Box>
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
            clearErrorIfValid("address", !!v.address && v.lat != null && v.lng != null);
          }}
          initial={
            latitude != null && longitude != null
              ? { lat: latitude, lng: longitude, address: addressText }
              : undefined
          }
          countries="IL"
        />
      </Box>

      <Box mx="auto" mt={10} w="80%" h="100hv">
        <Box
          position="relative"
          minH="85vh"
          maxW="720px"
          aspectRatio="16 / 9"
          overflow="hidden"
          borderRadius="2xl"
          bg="black"
        >
          <Image
            key={images[active].src}
            src={images[active].src}
            alt={images[active].alt}
            objectFit="contain"
            loading="lazy"
            w="full"
            h="full"
          />

          <IconButton
            aria-label="Previous image"
            onClick={prev}
            variant="ghost"
            position="absolute"
            top="50%"
            left="2"
            transform="translateY(-50%)"
            size="sm"
          >
            <ChevronLeft size={18} />
          </IconButton>
          <IconButton
            aria-label="Next image"
            onClick={next}
            variant="ghost"
            position="absolute"
            top="50%"
            right="2"
            transform="translateY(-50%)"
            size="sm"
          >
            <ChevronRight size={18} />
          </IconButton>

          <HStack position="absolute" bottom="3" left="50%" transform="translateX(-50%)" gap="2">
            {images.map((_, i) => (
              <Box
                key={i}
                w="2"
                h="2"
                borderRadius="full"
                bg={i === active ? "white" : "whiteAlpha.600"}
                cursor="pointer"
                onClick={() => setActive(i)}
                border="1px solid"
                borderColor="blackAlpha.700"
              />
            ))}
          </HStack>
        </Box>
      </Box>
    </CGrid>
  );
}
