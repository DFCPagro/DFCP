"use client";

import { useMemo } from "react";
import {
  Field,
  Input,
  Select,
  HStack,
  Portal,
  createListCollection,
  Box,
  Text,
} from "@chakra-ui/react";

export type PhoneValue = {
  countryDial: string; // e.g. "+44"
  national: string; // digits only, e.g. "7911123456"
  e164: string; // e.g. "+447911123456"
};

type CountryOption = {
  iso2: string;
  dial: string; // "+44"
  label: string; // "United Kingdom (+44)"
  value: string; // required by Chakra Select; equals dial
  example?: string; // example national format hint
};

const COUNTRY_COLLECTION = createListCollection<CountryOption>({
  items: [
    { iso2: "GB", dial: "+44", value: "+44", label: "United Kingdom (+44)", example: "7400123456" },
    { iso2: "US", dial: "+1", value: "+1", label: "United States (+1)", example: "4155550123" },
    { iso2: "IL", dial: "+972", value: "+972", label: "Israel (+972)", example: "541234567" },
    { iso2: "FR", dial: "+33", value: "+33", label: "France (+33)", example: "612345678" },
    { iso2: "DE", dial: "+49", value: "+49", label: "Germany (+49)", example: "1512345678" },
    { iso2: "IN", dial: "+91", value: "+91", label: "India (+91)", example: "9812345678" },
  ],
});

type Props = {
  value: PhoneValue;
  onChange: (v: PhoneValue) => void;
  required?: boolean;
  invalid?: boolean;
  errorText?: string;
  helperText?: string;
  defaultCountryDial?: string; // e.g. "+44"
  selectWidth?: string | number; // e.g. "40%"
};

export default function PhoneFieldControl({
  value,
  onChange,
  required,
  invalid,
  errorText,
  helperText = "Select country and enter your number",
  defaultCountryDial = "+44",
  selectWidth = "42%",
}: Props) {
  const selectedDial = value.countryDial || defaultCountryDial;
  const selectValue = useMemo(() => [selectedDial], [selectedDial]);

  const selectedCountry = useMemo(
    () => COUNTRY_COLLECTION.items.find((c) => c.dial === selectedDial) ?? COUNTRY_COLLECTION.items[0],
    [selectedDial]
  );

  const placeholder = useMemo(
    () =>
      selectedCountry?.example
        ? `${selectedCountry.example.replace(/\d/g, "•")}`
        : "Phone number",
    [selectedCountry]
  );

  const internalValidation = useMemo(() => {
    // minimal, user-friendly checks (can be replaced with libphonenumber-js if installed)
    if (!value.national) return undefined;
    const tooShort = value.national.length < 6;
    const nonDigits = /\D/.test(value.national);
    if (nonDigits) return "Digits only";
    if (tooShort) return "Too short";
    return undefined;
  }, [value.national]);

  const composedError = errorText || internalValidation;
  const isInvalid = !!(invalid || composedError);

  const handleCountryChange = (dial: string) => {
    const e164 = composeE164(dial, value.national);
    onChange({ countryDial: dial, national: value.national, e164 });
  };

  const handleNationalChange = (raw: string) => {
    const national = raw.replace(/\D/g, "");
    const e164 = composeE164(selectedDial, national);
    onChange({ countryDial: selectedDial, national, e164 });
  };

  return (
    <Field.Root invalid={isInvalid} required={required}>
      <Field.Label>
        Phone number
        {required && <Field.RequiredIndicator />}
      </Field.Label>

      <HStack align="start" gap="2">
        {/* Country dial-code select */}
        <Select.Root
          collection={COUNTRY_COLLECTION}
          value={selectValue}
          onValueChange={(e) => handleCountryChange(e.value[0] ?? defaultCountryDial)}
          size="sm"
          width={selectWidth}
        >
          <Select.HiddenSelect name="countryDial" />
          <Select.Control>
            <Select.Trigger aria-label="Country dial code">
              <Box as="span" mr="2">
                {flagEmoji(selectedCountry.iso2)}
              </Box>
              <Select.ValueText placeholder="Dial code" />
            </Select.Trigger>
            <Select.IndicatorGroup>
              <Select.Indicator />
            </Select.IndicatorGroup>
          </Select.Control>

          <Portal>
            <Select.Positioner>
              <Select.Content>
                {COUNTRY_COLLECTION.items.map((country) => (
                  <Select.Item item={country} key={country.value}>
                    <HStack gap="2">
                      <Text>{flagEmoji(country.iso2)}</Text>
                      <Text>{country.label}</Text>
                    </HStack>
                    <Select.ItemIndicator />
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Portal>
        </Select.Root>

        {/* National number input */}
        <Input
          name="phone"
          aria-label="Phone number"
          placeholder={placeholder}
          inputMode="numeric"
          pattern="[0-9]*"
          value={value.national}
          onChange={(e) => handleNationalChange(e.target.value)}
          autoComplete="tel-national"
        />
      </HStack>

      {isInvalid ? (
        <Field.ErrorText>{composedError}</Field.ErrorText>
      ) : (
        <Field.HelperText>
          {helperText}{" "}
          {value.e164 ? (
            <Box as="span" color="fg.subtle">
              ({value.e164})
            </Box>
          ) : null}
        </Field.HelperText>
      )}

      {/* Hidden full E.164 for native forms if needed */}
      <input type="hidden" name="phoneE164" value={value.e164} />
    </Field.Root>
  );
}

function composeE164(dial: string, national: string) {
  if (!dial || !national) return "";
  return `${dial}${national}`;
}

function flagEmoji(iso2: string) {
  // ISO2 to regional indicator symbols
  return iso2
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}
