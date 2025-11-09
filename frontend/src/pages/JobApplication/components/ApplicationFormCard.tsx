import type { FormEvent } from "react";
import {
  Box,
  Button,
  Card,
  Checkbox,
  Separator,
  Stack,
} from "@chakra-ui/react";
import type { LandInput } from "@/types/availableJobs";
import type { RoleDef } from "@/data/roles";
import { RoleForm } from "./RoleForm"; // thin proxy to keep relative path simple
// NOTE: RoleForm is assumed to exist at ./components/RoleForm in the original project.
// We re-export it via RoleFormProxy.tsx to avoid deep import hassles.

/**
 * Splittable form card. Receives all logic via props.
 */
export type ApplicationFormCardProps = {
  role: RoleDef;
  fields: Record<string, any>;
  errors: Record<string, string | undefined>;
  scheduleMask?: number[];
  lands: LandInput[];
  agree: boolean;
  isPending: boolean;
  isFormValid: boolean;
  onChangeField: (name: string, value: any) => void;
  onScheduleChange: (mask?: number[]) => void;
  onLandsChange: (lands: LandInput[]) => void;
  onCancel: () => void;
  onSubmit: () => Promise<void>;
};

export function ApplicationFormCard(props: ApplicationFormCardProps) {
  const {
    role,
    fields,
    errors,
    scheduleMask,
    lands,
    agree,
    isPending,
    isFormValid,
    onChangeField,
    onScheduleChange,
    onLandsChange,
    onCancel,
    onSubmit,
  } = props;

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit();
  };

  return (
    <Box>
      <form onSubmit={handleFormSubmit}>
        <Card.Root variant="subtle" borderRadius="2xl">
          <Card.Body p={{ base: 4, md: 6 }}>
            <Stack gap={6}>
              <RoleForm
                role={role}
                values={fields}
                onChange={onChangeField}
                columns={{ base: 1, md: 2 }}
                scheduleMask={scheduleMask}
                onScheduleChange={onScheduleChange}
                lands={lands}
                onLandsChange={onLandsChange}
                errors={errors}
              />

              <Separator />

              {/* Agreement */}
              <Checkbox.Root
                alignItems="flex-start"
                checked={agree}
                onCheckedChange={({ checked }) =>
                  onChangeField("__agree_internal__", checked === true)
                }
              >
                <Checkbox.HiddenInput />
                <Checkbox.Control mt="1" />
                <Checkbox.Label>
                  I certify that all information is accurate.
                </Checkbox.Label>
              </Checkbox.Root>

              <Stack direction={{ base: "column", sm: "row" }} gap="3">
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={isPending}
                  colorPalette="green"
                  disabled={!isFormValid}
                  flexGrow={1}
                >
                  Submit Application
                </Button>
              </Stack>
            </Stack>
          </Card.Body>
        </Card.Root>
      </form>
    </Box>
  );
}
