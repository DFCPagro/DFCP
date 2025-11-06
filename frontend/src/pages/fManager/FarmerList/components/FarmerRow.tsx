import { memo, useMemo } from "react";
import { Table, HStack, Text, Avatar, Button, Tooltip } from "@chakra-ui/react";
import type { FarmerListItem } from "@/types/farmer";

export type FarmerRowProps = {
    item: FarmerListItem;
    onView: (farmerId: string) => void;
};

/** Local date formatter (kept in-file per your preference) */
function formatDate(d?: string | Date): string {
    if (!d) return "—";
    const dt = typeof d === "string" ? new Date(d) : d;
    if (Number.isNaN(dt.getTime())) return "—";
    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
    }).format(dt);
}

export const FarmerRow = memo(function FarmerRow({ item, onView }: FarmerRowProps) {
    const joined = item.joinedAt ?? item.createdAt;

    const avatarName = useMemo(() => item.farmName ?? "", [item.farmName]);
    const avatarSrc = useMemo(() => item.farmLogo ?? undefined, [item.farmLogo]);

    // Derive a fallback initials string (Avatar handles this too; this keeps things explicit)
    const initials = useMemo(() => {
        const base = item.farmName ?? "";
        const parts = base.trim().split(/\s+/);
        const [a, b] = [parts[0]?.[0], parts[1]?.[0]];
        return [a, b].filter(Boolean).join("").toUpperCase() || "F";
    }, [item.farmName]);

    return (
        <Table.Row data-row-id={item._id}>
            {/* Logo */}
            <Table.Cell>
                <Avatar.Root size="sm">
                    <Avatar.Image src={avatarSrc} />
                    <Avatar.Fallback name={avatarName || initials} />
                </Avatar.Root>
            </Table.Cell>

            {/* Farmer Name (from user contact or farm? We present farmName as primary, and show item._id fallback) */}
            <Table.Cell>
                <HStack gap={2} minW={0}>
                    <Text fontWeight="medium" lineClamp={1}>
                        {item.farmName ?? "—"}
                    </Text>
                </HStack>
            </Table.Cell>

            {/* Farm Name (if you later separate farmerName vs farmName, adjust here) */}
            <Table.Cell>
                <Text color="fg.subtle" lineClamp={1}>
                    {item.farmName ?? "—"}
                </Text>
            </Table.Cell>

            {/* Joined */}
            <Table.Cell>
                <Text>{formatDate(joined)}</Text>
            </Table.Cell>

            {/* Action */}
            <Table.Cell textAlign="right">
                <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                        <Button size="sm" variant="outline" onClick={() => onView(item._id)}>
                            View info
                        </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content>Open full farmer info</Tooltip.Content>
                </Tooltip.Root>
            </Table.Cell>
        </Table.Row>
    );
});

export default FarmerRow;
