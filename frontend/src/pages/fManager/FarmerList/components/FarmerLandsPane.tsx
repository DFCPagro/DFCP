import { memo } from "react";
import {
    Box,
    VStack,
    HStack,
    Text,
    Badge,
    Card,
    Grid,
    GridItem,
    Accordion,
    Skeleton,
    Separator,
    Icon,
    Tag,
} from "@chakra-ui/react";
import { FiMap, FiMapPin, FiLayers, FiTrendingUp } from "react-icons/fi";
import type { FarmerDetail, FarmerLandDetail, FarmerSection, SectionCrop } from "@/types/farmer";
import { useFarmerLands } from "../hooks/useFarmerLands";
import { useSectionsByLand } from "../hooks/useSectionsByLand";
import { useItemsMap } from "../hooks/useItemsMap";

export type FarmerLandsPaneProps = {
    farmer?: FarmerDetail | null;
    isLoading?: boolean; // loading of farmer itself while dialog opens
};

function formatArea(m2?: number | null) {
    if (typeof m2 !== "number" || Number.isNaN(m2)) return "—";
    return `${Math.round(m2)} m²`;
}

export const FarmerLandsPane = memo(function FarmerLandsPane({
    farmer,
    isLoading = false,
}: FarmerLandsPaneProps) {
    const farmerId = farmer?._id;
    const landsFromDetail = farmer?.lands;

    const {
        lands,
        landsCount,
        sectionsCount,
        isLoading: isLoadingLands,
        isFetching: isFetchingLands,
        source,
    } = useFarmerLands({
        farmerId,
        landsFromDetail,
        enabled: Boolean(farmerId),
    });

    const { getName } = useItemsMap({ enabled: true });

    const loading = isLoading || isLoadingLands || isFetchingLands;

    if (!farmer && !loading) {
        return <Box color="fg.subtle">Farmer details are not loaded yet.</Box>;
    }

    return (
        <VStack align="stretch" gap={4}>
            {/* Summary */}
            <HStack gap={3} wrap="wrap">
                <Badge variant="surface" colorPalette="green">
                    Lands: {landsCount}
                </Badge>
                <Badge variant="surface" colorPalette="blue">
                    Sections: {sectionsCount}
                </Badge>
                <Badge variant="surface" colorPalette="gray">
                    Source: {source === "detail" ? "embedded" : "api"}
                </Badge>
            </HStack>

            <Separator />

            {/* Lands list */}
            {loading ? (
                <VStack align="stretch" gap={3}>
                    <Skeleton height="64px" />
                    <Skeleton height="64px" />
                    <Skeleton height="64px" />
                </VStack>
            ) : lands.length === 0 ? (
                <Box color="fg.subtle">No lands recorded yet.</Box>
            ) : (
                <Accordion.Root multiple>
                    {lands.map((land, idx) => {
                        const landId = (land as any)?._id as string | undefined;
                        const itemValue = landId ?? String(idx);

                        const detail = land as FarmerLandDetail;
                        const embeddedSections = Array.isArray(detail?.sections)
                            ? (detail.sections as FarmerSection[])
                            : undefined;

                        const {
                            sections,
                            isLoading: isLoadingSections,
                            isFetching: isFetchingSections,
                            source: sectionSource,
                        } = useSectionsByLand({
                            landId,
                            sectionsFromLand: embeddedSections,
                            enabled: Boolean(landId),
                        });

                        const secLoading = isLoadingSections || isFetchingSections;

                        return (
                            <Accordion.Item key={itemValue} value={itemValue}>
                                <Accordion.ItemTrigger>
                                    <HStack flex="1" justify="space-between" gap={3}>
                                        <HStack gap={2} minW={0}>
                                            <Icon as={FiMap} />
                                            <Text fontWeight="medium" lineClamp={1}>
                                                {land.name}
                                            </Text>
                                            {land.ownership && <Badge variant="outline">{land.ownership}</Badge>}
                                        </HStack>
                                        <HStack gap={3} color="fg.subtle">
                                            <HStack gap={1}>
                                                <Icon as={FiLayers} />
                                                <Text>
                                                    {Array.isArray(embeddedSections) ? embeddedSections.length : sections?.length ?? 0}
                                                </Text>
                                            </HStack>
                                            <Text>{formatArea(land.areaM2 ?? null)}</Text>
                                        </HStack>
                                    </HStack>
                                    <Accordion.ItemIndicator />
                                </Accordion.ItemTrigger>

                                <Accordion.ItemContent>
                                    {/* Land meta */}
                                    <VStack align="stretch" gap={2} mb={3}>
                                        <HStack gap={2} color="fg.subtle" wrap="wrap">
                                            <HStack gap={1}>
                                                <Icon as={FiMapPin} />
                                                <Text>{land.address?.address ?? "No address"}</Text>
                                            </HStack>
                                            {land.address?.logisticCenterId && (
                                                <Badge variant="surface" colorPalette="purple">
                                                    LC: {land.address?.logisticCenterId}
                                                </Badge>
                                            )}
                                        </HStack>
                                    </VStack>

                                    <Separator />

                                    {/* Sections */}
                                    {secLoading ? (
                                        <VStack align="stretch" gap={3} mt={3}>
                                            <Skeleton height="48px" />
                                            <Skeleton height="48px" />
                                        </VStack>
                                    ) : sections.length === 0 ? (
                                        <Box color="fg.subtle" mt={3}>
                                            No sections recorded for this land.
                                        </Box>
                                    ) : (
                                        <VStack align="stretch" gap={3} mt={3}>
                                            {sections.map((s) => (
                                                <Card.Root key={s._id}>
                                                    <Card.Header py={2}>
                                                        <HStack justify="space-between" gap={2}>
                                                            <HStack gap={2} minW={0}>
                                                                <Text fontWeight="medium" lineClamp={1}>
                                                                    {s.name ?? `Section ${s._id.slice(-4)}`}
                                                                </Text>
                                                                {s.logisticCenterId && (
                                                                    <Badge variant="outline" colorPalette="purple">
                                                                        LC: {s.logisticCenterId}
                                                                    </Badge>
                                                                )}
                                                            </HStack>
                                                            <Text color="fg.subtle">{formatArea(s.areaM2 ?? null)}</Text>
                                                        </HStack>
                                                    </Card.Header>

                                                    <Card.Body pt={0}>
                                                        {Array.isArray(s.crops) && s.crops.length > 0 ? (
                                                            <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={3}>
                                                                {s.crops.map((c: SectionCrop, i: number) => (
                                                                    <GridItem key={`${s._id}-${i}`}>
                                                                        <HStack justify="space-between" gap={2} align="start">
                                                                            <VStack align="start" gap={1}>
                                                                                <HStack gap={2}>
                                                                                    <Tag.Root size="sm" variant="surface">
                                                                                        <Tag.Label>{getName(c.item)}</Tag.Label>
                                                                                    </Tag.Root>
                                                                                    {c.status && (
                                                                                        <Badge size="sm" variant="outline">
                                                                                            {c.status}
                                                                                        </Badge>
                                                                                    )}
                                                                                </HStack>

                                                                                <HStack gap={3} color="fg.subtle" fontSize="sm" wrap="wrap">
                                                                                    {typeof c.expectedHarvestKg === "number" && (
                                                                                        <HStack gap={1}>
                                                                                            <Icon as={FiTrendingUp} />
                                                                                            <Text>{Math.round(c.expectedHarvestKg)} kg</Text>
                                                                                        </HStack>
                                                                                    )}
                                                                                    {typeof c.statusPercentage === "number" && (
                                                                                        <Badge variant="surface">{Math.round(c.statusPercentage)}%</Badge>
                                                                                    )}
                                                                                </HStack>
                                                                            </VStack>
                                                                        </HStack>
                                                                    </GridItem>
                                                                ))}
                                                            </Grid>
                                                        ) : (
                                                            <Text color="fg.subtle">No crops recorded.</Text>
                                                        )}
                                                    </Card.Body>
                                                </Card.Root>
                                            ))}
                                        </VStack>
                                    )}

                                    {/* Source hint for sections */}
                                    <HStack gap={2} mt={3} color="fg.subtle" fontSize="sm">
                                        <Text>Sections source:</Text>
                                        <Badge variant="surface">{sectionSource === "land" ? "embedded" : "api"}</Badge>
                                    </HStack>
                                </Accordion.ItemContent>
                            </Accordion.Item>
                        );
                    })}
                </Accordion.Root>
            )}
        </VStack>
    );
});

export default FarmerLandsPane;
