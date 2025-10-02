"use client";

import { useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  HStack,
  Separator,
  Stack,
  Text,
} from "@chakra-ui/react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import MapPickerDialog from "@/components/common/MapPickerDialog";
import type { Address } from "@/types/address";

const Meta = ({ children }: { children: React.ReactNode }) => (
  <Text fontSize="xs" color="gray.600">
    {children}
  </Text>
);

type Props = {
  addresses: Address[]; // STRICT
  banner: string | null;
  setBanner: (v: string | null) => void;
  deletingKey: string | null;
  onDeleteAddress: (a: Address) => void;
  onAddAddress: (pick: {
    lat: number;
    lng: number;
    addressLine: string;
  }) => void;
  addrPickerOpen: boolean;
  setAddrPickerOpen: (v: boolean) => void;
};

export default function AddressesCard({
  addresses,
  banner,
  setBanner,
  deletingKey,
  onDeleteAddress,
  onAddAddress,
  addrPickerOpen,
  setAddrPickerOpen,
}: Props) {
  const [initial] = useState<{ lat: number; lng: number }>({
    lat: 31.771959,
    lng: 35.217018,
  });

  return (
    <Card.Root variant="elevated" shadow="sm">
      <Card.Header py={4} px={5} bgGradient="linear(to-r, blue.50, blue.100)">
        <HStack justify="space-between" w="full" align="baseline">
          <Card.Title
            color="blue.900"
            fontSize="sm"
            textTransform="uppercase"
            letterSpacing="widest"
          >
            Addresses
          </Card.Title>
          <Badge size="sm" variant="solid" colorPalette="blue">
            {addresses.length} saved
          </Badge>
        </HStack>
      </Card.Header>
      <Separator />
      <Card.Body p={0}>
        {addresses.length === 0 ? (
          <Box p={5}>
            <Text fontSize="sm">No addresses yet.</Text>
          </Box>
        ) : (
          <Stack gap={0}>
            {addresses.map((a, i) => {
              const key = `${a.lnt},${a.alt},${i}`;
              return (
                <HStack
                  key={key}
                  px={5}
                  py={4}
                  borderTopWidth={i === 0 ? 0 : "1px"}
                  _hover={{ bg: "blue.50" }}
                  transition="background 120ms"
                  justify="space-between"
                  align="center"
                >
                  <HStack gap={3} align="start">
                    <Box
                      boxSize="8"
                      rounded="full"
                      bg="blue.200"
                      display="grid"
                      placeItems="center"
                    >
                      <MapPin size={16} />
                    </Box>
                    <Box>
                      <Text fontWeight="semibold" lineHeight="short">
                        {a.address}
                      </Text>
                      <Meta>
                        lat {a.lnt}, lng {a.alt}
                      </Meta>
                    </Box>
                    {a.logisticCenterId ? (
                      <Badge size="xs" colorPalette="blue" variant="subtle">
                        LC: {a.logisticCenterId}
                      </Badge>
                    ) : null}
                  </HStack>
                  <Button
                    size="xs"
                    variant="ghost"
                    colorPalette="red"
                    loading={deletingKey === `${a.lnt},${a.alt},${a.address}`}
                    onClick={() => onDeleteAddress(a)}
                  >
                    <HStack gap={1}>
                      <Trash2 size={14} />
                      <Text>Delete</Text>
                    </HStack>
                  </Button>
                </HStack>
              );
            })}
          </Stack>
        )}
      </Card.Body>
      <Separator />
      <Card.Footer py={4} px={5} justifyContent="flex-end" bg="blue.50">
        <Button
          size="sm"
          colorPalette="blue"
          onClick={() => setAddrPickerOpen(true)}
        >
          <HStack gap={2}>
            <Plus size={16} />
            <Text>Add address</Text>
          </HStack>
        </Button>
      </Card.Footer>

      <MapPickerDialog
        key={addrPickerOpen ? "open" : "closed"} // force a clean mount on every open
        open={addrPickerOpen}
        onClose={() => setAddrPickerOpen(false)}
        onConfirm={(p) => {
          onAddAddress({ lat: p.lat, lng: p.lng, addressLine: p.address });
          setAddrPickerOpen(false);
        }}
        initial={{ lat: 31.771959, lng: 35.217018 }}
        countries="IL"
      />
    </Card.Root>
  );
}
