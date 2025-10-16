import { Box, Stack, Heading, Skeleton, Text, Badge, Button, HStack } from "@chakra-ui/react";
import { useCSReports } from "../hooks/useCSReports";

export function ReportsCard({ title }: { title?: string }) {
  const { reports, isLoading } = useCSReports({ limit: 8 });

  return (
    <Box borderWidth="1px" borderColor="border" rounded="lg" p="4" bg="bg" w="full">
      <Stack gap="4">
        <Heading size="md">{title ?? "Order Reports (Customer Messages)"}</Heading>

        {isLoading ? (
          <Stack gap="2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} h="10" />
            ))}
          </Stack>
        ) : reports.length === 0 ? (
          <Text color="fg.muted">No customer messages.</Text>
        ) : (
          <Stack gap="2">
            {reports.map((r) => (
              <HStack
                key={r.id}
                justify="space-between"
                px="3"
                py="2"
                borderWidth="1px"
                borderRadius="md"
              >
                <Stack gap="0" maxW="70%">
                  <Text fontWeight="medium" lineClamp={1}>
                    {r.subject}
                  </Text>
                  <Text color="fg.muted" fontSize="sm" lineClamp={1}>
                    From {r.customerName} · {r.createdAtLabel}
                  </Text>
                </Stack>

                <HStack gap="2">
                  <Badge
                    colorPalette={
                      r.status === "open" ? "yellow" : r.status === "in-progress" ? "blue" : "green"
                    }
                  >
                    {r.status}
                  </Badge>
                  <Button size="sm">Open</Button>
                </HStack>
              </HStack>
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
