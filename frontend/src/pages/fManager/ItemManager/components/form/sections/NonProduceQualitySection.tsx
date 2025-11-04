// src/pages/items/form/sections/NonProduceQualitySection.tsx
import * as React from "react";
import { Box, Field, Input, Text } from "@chakra-ui/react";

export type NonProduceQuality = {
  /** Free text grade: A, AA, B, etc. */
  grade?: string | null;
};

type Props = {
  value?: NonProduceQuality | null;
  onChange: (next?: NonProduceQuality | null) => void;
  readOnly?: boolean;
};

export default function NonProduceQualitySection({
  value,
  onChange,
  readOnly,
}: Props) {
  const v = value ?? {};

  return (
    <Box bg="bg.panel" p={4} borderRadius="md" borderWidth="1px">
      <Field.Root>
        <Field.Label>Quality grade</Field.Label>
        <Input
          placeholder="e.g. A, AA, B"
          value={v.grade ?? ""}
          readOnly={readOnly}
          disabled={readOnly}
          onChange={(e) =>
            onChange({ ...v, grade: e.target.value?.trim() || null })
          }
        />
        <Text mt="2" fontSize="xs" color="fg.muted">
          Use the exact grade defined by your standard.
        </Text>
      </Field.Root>
    </Box>
  );
}
