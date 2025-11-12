import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { meApi } from "@/api/auth";
import { createJobApplication } from "@/api/jobApplications";
import type { LandInput } from "@/types/availableJobs";
import type {
  JobApplicationCreateInput,
  JobApplicationDTO,
} from "@/types/jobApplications";
import { RolesTable, type RoleDef } from "@/data/roles";
import { toaster } from "@/components/ui/toaster";
import {
  buildSchema,
  extractErrors,
} from "@/pages/JobApplication/components/validation";
import { cap, normalizeWeekly } from "@/utils/schedule";
import { mapLand } from "@/utils/landMapping";
import { PATHS as p } from "@/routes/paths";

export const roleImages: Record<string, string> = {
  deliverer:
    "https://img.freepik.com/premium-photo/cheerful-delivery-guy-with-box-hand-ai_431161-12363.jpg",
  picker:
    "https://source.unsplash.com/640x360/?warehouse,worker,scanner&sig=picker",
  industrialdeliverer:
    "https://i.pinimg.com/736x/0e/b0/be/0eb0be1ace7c9caf9211564c3b2eede3.jpg",
  farmer:
    "https://i.pinimg.com/originals/df/ae/83/dfae83290c2c77ae42d83b99e201b5f2.jpg",
  sorting:
    "https://source.unsplash.com/640x360/?warehouse,sorting,conveyor&sig=sorting",
  "warehouse-worker":
    "https://source.unsplash.com/640x360/?warehouse,forklift,worker&sig=warehouse-worker",
  default:
    "https://tse4.mm.bing.net/th/id/OIP.fPZcB-2duJR_eBOo2jS7YQAAAA?rs=1&pid=ImgDetMain&o=7&rm=3",
};

export function useEmploymentApplication() {
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
    // Shape UI into backend form before validating
    const shaped: Record<string, any> = { ...data };

    if (role?.includeLand) {
      shaped.lands = (data.lands ?? []).map(mapLand);
    }
    if (role?.includeSchedule) {
      shaped.weeklySchedule = normalizeWeekly(data.weeklySchedule);
    }

    const parsed = schema.safeParse(shaped);
    return extractErrors(parsed);
  };

  const updateField = (n: string, v: any) => {
    if (n === "__agree_internal__") {
      setAgree(Boolean(v));
      return;
    }
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
    // eslint-disable-next-line no-console
    console.log("[updateLands]", ls);
    setLands(ls);
    setErrors(validateAll({ ...fields, lands: ls }));
  };

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (payload: JobApplicationCreateInput) =>
      createJobApplication(payload),
    onSuccess: (app: JobApplicationDTO) => {
      toaster.create({
        type: "success",
        title: "Application submitted",
        description: "We’ll be in touch soon.",
      });
      navigate(p.market);
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

    const applicationData: Record<string, unknown> = { ...fields };

    if (role!.includeSchedule) {
      const weekly = normalizeWeekly(scheduleMask);
      if (!weekly) {
        toaster.create({
          type: "warning",
          title: "Please select your weekly schedule",
        });
        return;
      }
      (applicationData as any).weeklySchedule = weekly;
      delete (applicationData as any).scheduleBitmask;
    }

    if (role!.includeLand) {
      const mapped = (lands ?? []).map(mapLand);
      const invalid = mapped.find(
        (l: any) =>
          !l.name ||
          !l.address ||
          !l.address.address ||
          l.address.alt == null ||
          l.address.lnt == null
      );
      if (invalid) {
        toaster.create({
          type: "warning",
          title: "Please complete all land fields",
          description:
            "Each land needs a name, full address (coords + text), and measurements.",
        });
        return;
      }

      (applicationData as any).lands = mapped;
      if ((applicationData as any).agreementPercentage == null) {
        (applicationData as any).agreementPercentage = 60;
      }
    }

    if (
      role!.name.toLowerCase() === "deliverer" ||
      role!.name.toLowerCase() === "industrialdeliverer"
    ) {
      const val = (fields as any)?.vehicleCapacityValue;
      const unit = (fields as any)?.vehicleCapacityUnit ?? "kg";
      if (typeof val === "number") {
        (applicationData as any).vehicleCapacityKg =
          val * (unit === "t" ? 1000 : 1);
      }
      delete (applicationData as any).vehicleCapacityValue;
      delete (applicationData as any).vehicleCapacityUnit;
    }

    [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ].forEach((d) => delete (applicationData as any)[d]);

    const payload: JobApplicationCreateInput = {
      appliedRole:
        role!.name.toLowerCase() as JobApplicationCreateInput["appliedRole"],
      logisticCenterId: null,
      contactEmail: (me as any)?.email ?? null,
      contactPhone: (fields as any)?.contactPhone ?? null,
      notes: (fields as any)?.notes || undefined,
      applicationData,
    };

    await mutateAsync(payload);
  };

  const coverSrc =
    (role as any)?.image ??
    roleImages[role?.name.toLowerCase()] ??
    roleImages.default;
  return {
    // data
    role,
    roleName,
    me,
    loadingMe,

    // UI state
    fields,
    agree,
    scheduleMask,
    lands,
    errors,
    isPending,
    isFormValid,

    // handlers
    setAgree,
    updateField,
    updateSchedule,
    updateLands,
    handleSubmit,

    // helpers
    coverSrc,
    cap,
    navigate,
  };
}
