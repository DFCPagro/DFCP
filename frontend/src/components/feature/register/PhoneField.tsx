"use client";

import { useMemo } from "react";
import {
  Field,
  Input,
  Select,
  HStack,
  Portal,
  createListCollection,
} from "@chakra-ui/react";
// Optional validation if you install libphonenumber-js
// import { parsePhoneNumberFromString } from "libphonenumber-js";

export type PhoneValue = {
  countryDial: string; // "+44"
  national: string;    // "7911123456"
  e164: string;        // "+447911123456"
};

type CountryOption = {
  iso2: string;
  dial: string;   // "+44"
  label: string;  // "United Kingdom (+44)"
  value: string;  // must exist for Chakra Select; equal to dial
};

const COUNTRY_COLLECTION = createListCollection<CountryOption>({
  items: [
    { iso2: "GB", dial: "+44",  label: "United Kingdom (+44)", value: "+44" },
    { iso2: "US", dial: "+1",   label: "United States (+1)",  value: "+1" },
    { iso2: "IL", dial: "+972", label: "Israel (+972)",       value: "+972" },
    { iso2: "FR", dial: "+33",  label: "France (+33)",        value: "+33" },
    { iso2: "DE", dial: "+49",  label: "Germany (+49)",       value: "+49" },
    { iso2: "IN", dial: "+91",  label: "India (+91)",         value: "+91" },
  ],
});

type PhoneFieldProps = {
  value: PhoneValue;
  onChange: (v: PhoneValue) => void;
  helperText?: string;
  invalid?: boolean;
  defaultCountryDial?: string; // e.g. "+44"
  selectWidth?: string | number; // e.g. "45%"
};

export default function PhoneField({
  value,
  onChange,
  helperText,
  invalid,
  defaultCountryDial = "+44",
  selectWidth = "45%",
}: PhoneFieldProps) {
  const selectedDial = value.countryDial || defaultCountryDial;
  const selectValue = useMemo(() => [selectedDial], [selectedDial]);

  const handleCountryChange = (dial: string) => {
    const e164 = composeE164(dial, value.national);
    onChange({ countryDial: dial, national: value.national, e164 });
  };

  const handleNationalChange = (nationalRaw: string) => {
    const national = nationalRaw.replace(/\D/g, "");
    const e164 = composeE164(selectedDial, national);
    onChange({ countryDial: selectedDial, national, e164 });
  };

  // Optional extra validation if libphonenumber-js is installed
  const validationMessage = useMemo(() => {
    // if (!value.e164) return undefined;
    // const p = parsePhoneNumberFromString(value.e164);
    // if (!p?.isValid()) return "Invalid phone number for selected country";
    return undefined;
  }, [value.e164]);

  return (
    <Field.Root invalid={invalid || !!validationMessage}>
      <Field.Label>Phone</Field.Label>

      <HStack align="start">
        {/* Country code select (Chakra UI 3) */}
        <Select.Root
          collection={COUNTRY_COLLECTION}
          value={selectValue}
          onValueChange={(e) => handleCountryChange(e.value[0] ?? defaultCountryDial)}
          size="sm"
          width={selectWidth}
        >
          <Select.HiddenSelect name="countryDial" />
          <Select.Control>
            <Select.Trigger>
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
                    {country.label}
                    <Select.ItemIndicator />
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Portal>
        </Select.Root>

        {/* National number input */}
        <Input
          placeholder="Phone number"
          inputMode="numeric"
          value={value.national}
          onChange={(e) => handleNationalChange(e.target.value)}
        />
      </HStack>

      {(helperText || validationMessage) && (
        <Field.HelperText>{validationMessage ?? helperText}</Field.HelperText>
      )}
    </Field.Root>
  );
}

function composeE164(dial: string, national: string) {
  if (!dial || !national) return "";
  return `${dial}${national}`;
}
