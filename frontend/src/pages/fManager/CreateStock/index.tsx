import { useMemo, useCallback } from "react";
import {
  Box,
  Stack,
  Heading,
  Separator,
  Text,
  Button,
  Badge,
  Card,
} from "@chakra-ui/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toaster } from "@/components/ui/toaster";
import { ShiftEnum, IsoDateString } from "@/types/farmerOrders";
import type { z } from "zod";

/**
 * Very basic Create Stock page:
 * - Reads ?date=YYYY-MM-DD&shift=morning|afternoon|evening|night
 * - Validates params
 * - Shows a tiny summary and a placeholder "Initialize Stock" button
 * - Back button returns to previous page
 *
 * Later steps:
 * - Replace the placeholder handler with a hook that calls POST /available-stock/init
 * - Navigate to the new AMS page once backend returns { amsId }
 */

function titleCase(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export default function CreateStockPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const rawDate = params.get("date") ?? "";
  const rawShift = (params.get("shift") ?? "").toLowerCase();

  const parsed = useMemo(() => {
    const dateOk = IsoDateString.safeParse(rawDate).success;
    const shiftOk = ShiftEnum.safeParse(rawShift).success;
    return {
      valid: dateOk && shiftOk,
      date: dateOk ? rawDate : null,
      shift: shiftOk ? (rawShift as z.infer<typeof ShiftEnum>) : null,
      errors: {
        date: dateOk ? null : "Expected date=YYYY-MM-DD",
        shift: shiftOk ? null : "Expected shift=morning|afternoon|evening|night",
      },
    };
  }, [rawDate, rawShift]);

  const handleInit = useCallback(() => {
    if (!parsed.valid || !parsed.date || !parsed.shift) {
      toaster.create({
        type: "error",
        title: "Missing or invalid parameters",
        description: "Please navigate from the dashboard (Add button).",
      });
      return;
    }

    // Placeholder only — will be replaced by a POST /available-stock/init call
    toaster.create({
      type: "info",
      title: "Initialize Stock (placeholder)",
      description: `${parsed.date} · ${titleCase(parsed.shift)}`,
      duration: 2000,
    });

    // Later:
    // const { amsId } = await initAvailableStock({ date: parsed.date, shiftName: parsed.shift });
    // navigate(`/stock/${amsId}`);
  }, [parsed]);

  const handleBack = useCallback(() => {
    // Go back safely; if there is no history, fall back to dashboard route.
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/dashboard");
    }
  }, [navigate]);

  return (
    <Box w="full">
      <Stack gap="6">
        <Heading size="lg">Create Stock</Heading>
        <Separator />

        {/* Summary Card (v3 slot API) */}
        <Card.Root variant="outline">
          <Card.Header>
            <Heading size="sm">Selected Shift</Heading>
          </Card.Header>
          <Card.Body>
            {parsed.valid ? (
              <Stack gap="3">
                <Text>
                  Date: <Badge>{parsed.date}</Badge>
                </Text>
                <Text>
                  Shift: <Badge>{titleCase(parsed.shift!)}</Badge>
                </Text>

                <Stack direction="row" gap="3">
                  <Button onClick={handleBack} variant="subtle">
                    Back
                  </Button>
                  <Button colorPalette="green" onClick={handleInit}>
                    Initialize Stock
                  </Button>
                </Stack>
              </Stack>
            ) : (
              <Stack gap="3">
                <Text color="fg.muted">
                  Missing or invalid parameters. Use the <b>Add</b> button from
                  the Dashboard’s “Create Stock” card.
                </Text>
                <Stack gap="1" ps="1">
                  {parsed.errors.date && (
                    <Text color="fg.muted">• {parsed.errors.date}</Text>
                  )}
                  {parsed.errors.shift && (
                    <Text color="fg.muted">• {parsed.errors.shift}</Text>
                  )}
                </Stack>
                <Button onClick={handleBack}>Back</Button>
              </Stack>
            )}
          </Card.Body>
        </Card.Root>
      </Stack>
    </Box>
  );
}
