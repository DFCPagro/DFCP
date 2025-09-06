import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Box,
  Button,
  Card,
  Checkbox,
  Heading,
  Separator,
  Stack,
  Text,
} from "@chakra-ui/react";
import { RolesTable, type RoleDef } from "@/data/roles";
import { RoleHeader } from "@/components/feature/employmentApplication/RoleHeader";
import { DynamicFields } from "@/components/feature/employmentApplication/DynamicFields";
import { ScheduleGrid } from "@/components/feature/employmentApplication/ScheduleGrid";
import { LandList } from "@/components/feature/employmentApplication/LandList";
import {
  submitEmploymentApplication,
  type EmploymentApplicationPayload,
  type LandInput,
} from "@/api/applications";
import { meApi } from "@/api/auth";
import { toaster } from "@/components/ui/toaster";

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export default function EmploymentApplication() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const roleName = (params.get("role") || "").toLowerCase();
  const role: RoleDef | undefined = useMemo(
    () => RolesTable.find((r) => r.name.toLowerCase() === roleName),
    [roleName]
  );

  const { data: me, isLoading: loadingMe } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: meApi,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!loadingMe && !me) {
      toaster.create({
        type: "warning",
        title: "Please log in",
        description: "You must be logged in to apply.",
      });
      navigate("/login");
    }
  }, [loadingMe, me, navigate]);

  const [fields, setFields] = useState<Record<string, any>>({});
  const [agree, setAgree] = useState(false);
  const [scheduleMask, setScheduleMask] = useState<number[] | undefined>(
    undefined
  );
  const [lands, setLands] = useState<LandInput[]>([]);

  const { mutateAsync, isPending } = useMutation({
    mutationFn: submitEmploymentApplication,
    onSuccess: (res) => {
      toaster.create({
        type: "success",
        title: "Application submitted",
        description: res?.message ?? "We'll be in touch soon.",
      });
      navigate("/dashboard");
    },
    onError: (err: any) => {
      toaster.create({
        type: "error",
        title: "Submission failed",
        description:
          err?.response?.data?.message ?? err?.message ?? "Unknown error",
      });
    },
  });

  if (!role) {
    return (
      <Box p={6}>
        <Heading size="md">Invalid role</Heading>
        <Text mt={2}>No role called “{roleName}”.</Text>
        <Button mt={4} onClick={() => navigate("/jobs")}>
          Back to roles
        </Button>
      </Box>
    );
  }

  const handleSubmit = async () => {
    if (!agree) {
      toaster.create({
        type: "warning",
        title: "Please certify accuracy",
      });
      return;
    }

    const extra: Record<string, unknown> = { ...fields };

    if (role.includeSchedule && scheduleMask)
      extra.scheduleBitmask = scheduleMask;
    if (role.includeLand) {
      extra.lands = lands;
      extra.agreementPercentage = 60;
    }

    [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ].forEach((d) => delete (extra as any)[d]);

    const payload: EmploymentApplicationPayload = {
      role: role.name,
      certifyAccuracy: agree,
      submittedAt: new Date().toISOString(),
      extraFields: extra,
    };

    await mutateAsync(payload);
  };

  return (
    <Box p={{ base: 4, md: 8 }}>
      <RoleHeader roleName={cap(role.name)} description={role.description} />

      <Card.Root>
        <Card.Body>
          <Stack gap={6}>
            <DynamicFields
              fields={role.fields}
              values={fields}
              onChange={(n, v) => setFields((s) => ({ ...s, [n]: v }))}
            />

            {role.includeSchedule && (
              <>
                <Separator />
                <Box>
                  <Heading size="sm" mb={3}>
                    Availability Schedule
                  </Heading>
                  <ScheduleGrid
                    value={scheduleMask}
                    onChange={setScheduleMask}
                  />
                </Box>
              </>
            )}

            {role.includeLand && (
              <>
                <Separator />
                <Box>
                  <Heading size="sm" mb={3}>
                    Lands
                  </Heading>
                  <LandList value={lands} onChange={setLands} />
                </Box>
              </>
            )}

            <Checkbox.Root
              checked={agree}
              onCheckedChange={(state) => {
                if (typeof state === "boolean") {
                  setAgree(state);
                } else {
                  // Optional: handle "indeterminate" if needed
                  setAgree(false); // or ignore
                }
              }}
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Label>
                I certify that all information is accurate.
              </Checkbox.Label>
            </Checkbox.Root>

            <Button
              onClick={handleSubmit}
              loading={isPending}
              colorPalette="green"
            >
              Submit Application
            </Button>
          </Stack>
        </Card.Body>
      </Card.Root>
    </Box>
  );
}
