// src/pages/FarmerManager/FarmerList/hooks/useContactInfo.ts
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getContactInfoById } from "@/api/user";
import type { ContactInfo } from "@/types/user";

export type UseContactInfoProps = {
  userId?: string | null;
  enabled?: boolean;
};

export type UseContactInfoResult = {
  contact?: ContactInfo;

  /** Convenience links for UI */
  emailHref?: string;
  telHref?: string;

  /** Quick flags */
  hasEmail: boolean;
  hasPhone: boolean;
  hasLogisticCenter: boolean;

  /** React Query state */
  isLoading: boolean;
  isFetching: boolean;
  isRefetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
};

/**
 * Fetches contact info for a given user id (GET /user/contact-info/:id).
 * - Returns raw parsed ContactInfo plus a couple of handy hrefs for UI.
 * - No shared utilities; normalization stays inside the hook.
 */
export function useContactInfo({
  userId,
  enabled = true,
}: UseContactInfoProps): UseContactInfoResult {
  const isEnabled = enabled && Boolean(userId);

  const query = useQuery({
    queryKey: userId
      ? ["users", "contactInfo", userId]
      : ["users", "contactInfo", "empty"],
    queryFn: ({ signal }) => getContactInfoById(userId as string),
    enabled: isEnabled,
    retry: 1,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });

  const contact = query.data;

  const { emailHref, telHref, hasEmail, hasPhone, hasLogisticCenter } =
    useMemo(() => {
      const email = contact?.email ?? undefined;
      const phone = contact?.phone ?? undefined;

      const emailHref = email ? `mailto:${email}` : undefined;

      // simple phone normalization for tel: link (keeps +, strips spaces/dashes)
      const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : undefined;

      return {
        emailHref,
        telHref,
        hasEmail: Boolean(email),
        hasPhone: Boolean(phone),
        hasLogisticCenter: Boolean(contact?.logisticCenterId),
      };
    }, [contact]);

  return {
    contact,
    emailHref,
    telHref,
    hasEmail,
    hasPhone,
    hasLogisticCenter,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching,
    isError: query.isError,
    error: query.error,
    refetch: () => query.refetch(),
  };
}
