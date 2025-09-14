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
import { RoleHeader } from "./components/RoleHeader";
import { RoleForm } from "./components/RoleForm";
import { createJobApplication } from "@/api/jobApplications";
import type {
  JobApplicationCreateInput,
  JobApplicationDTO,
} from "@/types/jobApplications";

// (keep LandInput if you use it for the lands UI)
import type { LandInput } from "@/api/applications";
import { meApi } from "@/api/auth";
import { toaster } from "@/components/ui/toaster";
import {
  buildSchema,
  extractErrors,
} from "./components/validation";

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function asWeeklySchedule(mask?: number[]): number[] | undefined {
  if (!mask) return undefined;
  // Ensure: length 7, integers, non-negative
  const seven = mask.slice(0, 7).map((v) => Math.max(0, Number.isFinite(v) ? Math.trunc(v) : 0));
  // If shorter than 7, pad with zeros
  while (seven.length < 7) seven.push(0);
  return seven;
}

function normalizeWeekly(mask?: number[]): number[] {
  const base = Array(7).fill(0);
  if (!Array.isArray(mask)) return base;
  return base.map((_, i) => {
    const v = mask[i] ?? 0;
    const n = (v as number) | 0;           // coerce to int
    return Math.max(0, Math.min(15, n));   // clamp to 4-bit (Morning=1, Afternoon=2, Evening=4, Night=8)
  });
}



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
        weeklySchedule: scheduleMask,
        lands,
      });
      setErrors(errs);
      return next;
    });
  };

  const updateSchedule = (m?: number[]) => {
    setScheduleMask(m);
    setErrors(validateAll({ ...fields, weeklySchedule: m, lands }));
  };

  const updateLands = (ls: LandInput[]) => {
    setLands(ls);
    setErrors(
      validateAll({ ...fields, weeklySchedule: scheduleMask, lands: ls })
    );
  };

  const { mutateAsync, isPending } = useMutation({
  mutationFn: (payload: JobApplicationCreateInput) => createJobApplication(payload),
  onSuccess: (app: JobApplicationDTO) => {
    toaster.create({
      type: "success",
      title: "Application submitted",
      description: "We’ll be in touch soon.",
    });
    // If you already have an application details route, this is ideal:
    navigate(`/applications/${app.id}`);

    // If not yet available, swap to your previous destination:
    // navigate("/dashboard");
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
    {console.log("role: ", role)}
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
  const full = { ...fields, weeklySchedule: scheduleMask, lands };
  const errs = validateAll(full);
  if (Object.keys(errs).length > 0 || !agree) {
    setErrors(errs);
    if (!agree) {
      toaster.create({ type: "warning", title: "Please certify the information" });
    } else {
      toaster.create({ type: "warning", title: "Please fix the highlighted fields" });
    }
    return;
  }

  const applicationData: Record<string, unknown> = { ...fields };

if (role.includeSchedule) {
  const weekly = normalizeWeekly(scheduleMask);
  if (!weekly) {
    toaster.create({ type: "warning", title: "Please select your weekly schedule" });
    return;
  }
  // Backend requires this exact field name:
  applicationData.weeklySchedule = weekly;
  // If you previously had scheduleBitmask in the form state, make sure it doesn’t ride along:
  delete (applicationData as any).scheduleBitmask;
}

if (role.includeLand) {
  applicationData.lands = lands;
  applicationData.agreementPercentage = 60;
}

// Strip any UI-only weekday keys
["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
  .forEach((d) => delete (applicationData as any)[d]);


  // Map to the new backend contract
  const payload: JobApplicationCreateInput = {
    appliedRole: role.name.toLowerCase() as JobApplicationCreateInput["appliedRole"],
    logisticCenterId: null,                                    // set if you collect it
    contactEmail: (me as any)?.email ?? null,                  // or from your form if present
    contactPhone: (fields as any)?.contactPhone ?? null,       // include if you have it
    notes: (fields as any)?.notes || undefined,                // include if you have it
    applicationData,                                           // everything role-specific
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
