import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Box,
  Button,
  Card,
  Checkbox,
  Heading,
  Stack,
  Text,
} from "@chakra-ui/react";
import { RolesTable, type RoleDef } from "@/data/roles";
import { RoleHeader } from "@/components/feature/employmentApplication/RoleHeader";
import { RoleForm } from "@/components/feature/employmentApplication/DynamicFields";
import {
  submitEmploymentApplication,
  type EmploymentApplicationPayload,
  type LandInput,
} from "@/api/applications";
import { meApi } from "@/api/auth";
import { toaster } from "@/components/ui/toaster";
import {
  buildSchema,
  extractErrors,
} from "@/components/feature/employmentApplication/validation";

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
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const schema = useMemo(() => (role ? buildSchema(role) : null), [role]);

  const validateAll = (data: Record<string, any>) => {
    if (!schema) return {};
    const parsed = schema.safeParse(data);
    return extractErrors(parsed);
  };

  const updateField = (n: string, v: any) => {
    setFields((prev) => {
      const next = { ...prev, [n]: v };
      const errs = validateAll({
        ...next,
        scheduleBitmask: scheduleMask,
        lands,
      });
      setErrors(errs);
      return next;
    });
  };

  const updateSchedule = (m?: number[]) => {
    setScheduleMask(m);
    setErrors(validateAll({ ...fields, scheduleBitmask: m, lands }));
  };

  const updateLands = (ls: LandInput[]) => {
    setLands(ls);
    setErrors(
      validateAll({ ...fields, scheduleBitmask: scheduleMask, lands: ls })
    );
  };

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

  const isFormValid = useMemo(
    () => Object.keys(errors).length === 0 && agree,
    [errors, agree]
  );

  const handleSubmit = async () => {
    const full = { ...fields, scheduleBitmask: scheduleMask, lands };
    const errs = validateAll(full);
    if (Object.keys(errs).length > 0 || !agree) {
      setErrors(errs);
      if (!agree) {
        toaster.create({
          type: "warning",
          title: "Please certify the information",
        });
      } else {
        toaster.create({
          type: "warning",
          title: "Please fix the highlighted fields",
        });
      }
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

      {/* single-page form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <Card.Root border={"none"}>
          <Card.Body>
            <Stack gap={6}>
              <RoleForm
                role={role}
                values={fields}
                onChange={updateField}
                columns={{ base: 1, md: 2 }}
                scheduleMask={scheduleMask}
                onScheduleChange={updateSchedule}
                lands={lands}
                onLandsChange={updateLands}
                errors={errors}
              />

              {/* Agreement */}
              <Checkbox.Root>
                <Checkbox.HiddenInput
                  checked={agree}
                  onChange={(e) => setAgree(e.currentTarget.checked)}
                />
                <Checkbox.Control />
                <Checkbox.Label>
                  I certify that all information is accurate.
                </Checkbox.Label>
              </Checkbox.Root>

              <Button
                type="submit"
                loading={isPending}
                colorPalette="green"
                disabled={!isFormValid}
              >
                Submit Application
              </Button>
            </Stack>
          </Card.Body>
        </Card.Root>
      </form>
    </Box>
  );
}
