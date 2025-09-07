"use client";

import { useEffect, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  registerApi,
  type RegisterPayload,
  type RegisterResponse,
} from "@/api/auth";
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
} from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import PhoneField, { type PhoneValue } from "@/components/feature/register/PhoneField";
import AddressAutocomplete from "@/components/common/AddressAutocomplete";
import MapPickerDialog from "@/components/common/MapPickerDialog";
import { loadGoogleMaps, reverseGeocode } from "@/utils/googleMaps";
import { LocateFixed } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";

type RegisterPayloadWithLoc = RegisterPayload & {
  latitude?: number;
  longitude?: number;
};

export default function Register() {
  const navigate = useNavigate();

  // maps + picker
  const [mapsReady, setMapsReady] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const countries = "IL"; // restrict autocomplete to Israel

  // form state
  const [form, setForm] = useState<RegisterPayload>({
    name: "",
    email: "",
    password: "",
    phone: "",
    birthday: "",
    address: "",
  });

  // location state
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);

  const [phoneState, setPhoneState] = useState<PhoneValue>({
    countryDial: "+44",
    national: "",
    e164: "",
  });

  const [errors, setErrors] = useState<
    Partial<Record<keyof RegisterPayload | "phone" | "address", string>>
  >({});

  // load Google Maps once
  useEffect(() => {
    loadGoogleMaps()
      .then(() => setMapsReady(true))
      .catch((e) =>
        toaster.create({
          type: "error",
          title: "Google Maps failed",
          description: e?.message || String(e),
        })
      );
  }, []);

  // register mutation
  const { mutate, isPending } = useMutation<
    RegisterResponse,
    any,
    RegisterPayloadWithLoc
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

  const handleChange = (key: keyof RegisterPayload, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
    if (key === "name") clearErrorIfValid("name", !!value.trim());
    if (key === "email") clearErrorIfValid("email", !!value.trim());
    if (key === "password") clearErrorIfValid("password", !!value);
    if (key === "birthday") clearErrorIfValid("birthday", !!value);
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
        if (!mapsReady) {
          await loadGoogleMaps();
          setMapsReady(true);
        }
        const addr = await reverseGeocode(lat, lng);
        if (addr) setAddress(addr);
      } catch {
        /* ignore reverse geocode failure */
      }

      toaster.create({ type: "success", title: "Location detected" });
    } catch (e: any) {
      toaster.create({
        type: "error",
        title: "Couldn’t detect location",
        description: e?.message || "Pick your location on the map.",
      });
      setPickerOpen(true);
    }
  };

  // submit
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};
    if (!form.name?.trim()) newErrors.name = "Name is required";
    if (!form.email?.trim()) newErrors.email = "Email is required";
    if (!form.password) newErrors.password = "Password is required";

    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    const payload: RegisterPayloadWithLoc = {
      ...form,
      phone: phoneState.e164 || undefined,
      address: address || undefined,
      latitude,
      longitude,
    };

    mutate(payload);
  };

  return (
    <Box maxW="sm" mx="auto" mt={16} p={6} borderWidth="1px" borderRadius="lg">
      <VStack as="form" gap={4} onSubmit={submit}>
        <Heading size="md">Register</Heading>

        <Field.Root invalid={!!errors.name}>
          <Field.Label>Name</Field.Label>
          <Input
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
          />
          {errors.name && <Field.ErrorText>{errors.name}</Field.ErrorText>}
        </Field.Root>

        <Field.Root invalid={!!errors.email}>
          <Field.Label>Email</Field.Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
          />
          {errors.email && <Field.ErrorText>{errors.email}</Field.ErrorText>}
        </Field.Root>

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

        <PhoneField
          value={phoneState}
          onChange={handlePhoneChange}
          helperText="Select country and enter your number"
          invalid={!!errors.phone}
        />
        {errors.phone && <Field.ErrorText>{errors.phone}</Field.ErrorText>}

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

        <Field.Root invalid={!!errors.address}>
          <Field.Label>Address</Field.Label>
          <AddressAutocomplete
            value={address}
            onChange={setAddress}
            onPlaceSelected={({ address, lat, lng }) => {
              setAddress(address);
              if (lat != null) setLatitude(lat);
              if (lng != null) setLongitude(lng);
            }}
            countries={countries}
            disabled={!mapsReady}
            placeholder="Search and pick an address"
          />
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

      <MapPickerDialog
        key={pickerOpen ? "open" : "closed"}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={(v) => {
          setAddress(v.address);
          setLatitude(v.lat);
          setLongitude(v.lng);
          setPickerOpen(false);
        }}
        initial={
          latitude != null && longitude != null
            ? { lat: latitude, lng: longitude, address }
            : undefined
        }
        countries={countries}
      />
    </Box>
  );
}
