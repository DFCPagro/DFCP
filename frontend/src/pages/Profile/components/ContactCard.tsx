"use client";

import React, { useRef } from "react";
import { Box, Button, Card, HStack, Input, Separator, Stack, Text } from "@chakra-ui/react";

const Label = ({ children }: { children: React.ReactNode }) => (
  <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="widest" mb={1}>
    {children}
  </Text>
);
const Meta = ({ children }: { children: React.ReactNode }) => (
  <Text fontSize="xs" color="gray.600">{children}</Text>
);
const AvatarBox = ({ url, text }: { url?: string; text: string }) => (
  <Box
    w="76px" h="76px" rounded="full" bg="teal.100"
    bgImage={url ? `url(${url})` : undefined} bgSize="cover" bgPos="center"
    display="grid" placeItems="center" fontWeight="bold" color="teal.900"
    shadow="md" border="2px solid" borderColor="whiteAlpha.700"
  >
    {!url ? text : null}
  </Box>
);

type Props = {
  // relaxed to tolerate undefined coming from parent/backend
  contact: { name?: string; email?: string; phone?: string; birthday?: string };
  setEmailField: (v: string) => void;
  setPhoneField: (v: string) => void;
  emailError: string | null;
  hasChanges: boolean;
  saving: boolean;
  onSave: () => void;
  avatarUrl?: string;
  setAvatarUrl: (url?: string) => void;
};

export default function ContactCard({
  contact,
  setEmailField,
  setPhoneField,
  emailError,
  hasChanges,
  saving,
  onSave,
  avatarUrl,
  setAvatarUrl,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const initials = (name?: string, email?: string) => {
    const src = name && name.trim().length > 0 ? name : email ?? "";
    const parts = src.split(/[ \._@-]+/).filter(Boolean);
    const a = parts[0]?.[0] ?? "?";
    const b = parts[1]?.[0] ?? "";
    return (a + b).toUpperCase();
    };

  function onAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAvatarUrl(url);
  }

  return (
    <Card.Root variant="elevated" shadow="sm" bg="white" _dark={{ bg: "gray.800" }}>
      <Card.Header py={4} px={5} bgGradient="linear(to-r, teal.50, teal.100)">
        <HStack justify="space-between" w="full" align="baseline">
          <Card.Title color="teal.900" fontSize="sm" letterSpacing="widest" textTransform="uppercase">
            Contact
          </Card.Title>
          <Meta>Keep your info up to date</Meta>
        </HStack>
      </Card.Header>
      <Separator />
      <Card.Body p={5} gap="4">
        <HStack gap={5} align="center">
          <AvatarBox url={avatarUrl} text={initials(contact.name, contact.email)} />
          <Stack gap={1}>
            <Button size="xs" colorPalette="teal" onClick={() => fileRef.current?.click()}>
              Change photo
            </Button>
            <Input ref={fileRef} type="file" accept="image/*" hidden onChange={onAvatarFileChange} />
            <Meta>PNG or JPG</Meta>
          </Stack>
        </HStack>

        <Box>
          <Label>Name</Label>
          <Input size="sm" readOnly value={contact.name ?? ""} placeholder="—" />
        </Box>
        <Box>
          <Label>Email</Label>
          <Input
            size="sm"
            type="email"
            value={contact.email ?? ""}        // default to ""
            onChange={(e) => setEmailField(e.target.value)}
            aria-invalid={!!emailError}
            borderColor={emailError ? "red.500" : undefined}
          />
          {emailError ? (
            <Text mt="1" fontSize="xs" color="red.500">
              {emailError}
            </Text>
          ) : null}
        </Box>
        <Box>
          <Label>Phone</Label>
          <Input size="sm" value={contact.phone ?? ""} onChange={(e) => setPhoneField(e.target.value)} />
        </Box>
      </Card.Body>
      <Separator />
      <Card.Footer py={4} px={5} justifyContent="flex-end" bg="teal.50">
        <Button size="sm" colorPalette="teal" loading={saving} disabled={!hasChanges} onClick={onSave}>
          Save changes
        </Button>
      </Card.Footer>
    </Card.Root>
  );
}
