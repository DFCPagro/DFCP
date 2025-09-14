import { useEffect, useMemo, useState } from "react";
import {
  Container,
  Heading,
  Grid,
  GridItem,
  Button,
  HStack,
  Text,
  Badge,
  Spinner,
  Alert,
} from "@chakra-ui/react";
import AuthGuard from "@/guards/AuthGuard";
import MapPickerDialog from "@/components/common/MapPickerDialog";
import ShiftPicker from "@/components/ui/ShiftPicker";
import ItemCard from "@/components/feature/market/ItemCard";
import CategoryFilter from "@/components/feature/market/CategoryFilter";
import { fetchMarket, addLocation } from "@/api/market";
import type {
  MarketItem,
  ShiftCode,
  UserLocation,
  CategoryCode,
} from "@/types/market";

export default function Market() {
  const [locationId, setLocationId] = useState<string>();
  const [selectedAddress, setSelectedAddress] = useState<string>("");
  const [shift, setShift] = useState<ShiftCode>();
  const [category, setCategory] = useState<CategoryCode | "ALL">("ALL");

  const [items, setItems] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const countries = "il";

  // Reset when location changes
  useEffect(() => {
    setShift(undefined);
    setItems([]);
  }, [locationId]);

  // Fetch items when location/shift/category change
  useEffect(() => {
    if (!locationId || !shift) {
      setItems([]);
      return;
    }
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetchMarket({ locationId, shift, category }); // ← pass category
        if (mounted) setItems(res);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [locationId, shift, category]); // ← re-run on category too

  const emptyState = useMemo(() => {
    if (!locationId) return "Pick your delivery location to continue.";
    if (!shift) return "Choose a shift to load available items.";
    if (!loading && items.length === 0) return "No items available for this shift.";
    return null;
  }, [locationId, shift, loading, items.length]);

  function handleAddToCart(inventoryId: string, qty: number) {
    console.log("ADD", { inventoryId, qty, locationId, shift });
  }

  type MapConfirm =
    | { address: string; lat: number; lng: number }
    | { address: string; latitude: number; longitude: number };

  async function handleMapConfirm(res: MapConfirm) {
    const lat = "lat" in res ? res.lat : (res as any).latitude;
    const lng = "lng" in res ? res.lng : (res as any).longitude;

    const parts = res.address.split(",").map((s) => s.trim());
    const city = parts.length >= 2 ? ((parts.at(-2) as string) ?? "") : "";
    const street = res.address;

    const saved: UserLocation = await addLocation({
      label: res.address,
      street,
      city,
      lat,
      lng,
    });

    setLocationId(saved._id);
    setSelectedAddress(saved.label || res.address);
    setPickerOpen(false);
  }

  return (
    <AuthGuard>
      <Container maxW="6xl" py={6}>
        <Heading size="lg" mb={4}>
          Market
        </Heading>

        <Grid templateColumns={["1fr", null, "1fr 1fr"]} gap={4} mb={3}>
          <GridItem>
            <HStack gap={3}>
              <Button type="button" onClick={() => setPickerOpen(true)} variant="outline">
                {selectedAddress ? "Change delivery location" : "Pick delivery location"}
              </Button>
              {selectedAddress && (
                <Badge colorPalette="green" variant="surface" title={selectedAddress}>
                  <Text lineClamp={1} maxW="36ch">
                    {selectedAddress}
                  </Text>
                </Badge>
              )}
            </HStack>
          </GridItem>

          <GridItem>
            <ShiftPicker locationId={locationId} value={shift} onChange={setShift} />
          </GridItem>
        </Grid>

        {/* Category filter */}
        <HStack mb={4}>
          <CategoryFilter value={category} onChange={setCategory} />
        </HStack>

        {emptyState ? (
          <Alert.Root status="info" borderRadius="md">
            <Alert.Indicator />
            <Alert.Description>{emptyState}</Alert.Description>
          </Alert.Root>
        ) : loading ? (
          <HStack justify="center" py={10}>
            <Spinner />
          </HStack>
        ) : (
          <Grid
            templateColumns={["1fr", "repeat(2, 1fr)", "repeat(3, 1fr)", "repeat(4, 1fr)"]}
            gap={6}
          >
            {items.map((it) => (
              <ItemCard
                key={it.inventoryId}
                item={it}
                onAdd={handleAddToCart}
                disabled={!locationId || !shift}
              />
            ))}
          </Grid>
        )}

        <MapPickerDialog
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onConfirm={(r: any) => handleMapConfirm(r)}
          countries={countries}
          initial={{
            address: selectedAddress || undefined,
            lat: 31.771959,
            lng: 35.217018,
          }}
        />
      </Container>
    </AuthGuard>
  );
}
