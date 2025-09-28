import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  Container,
  Grid,
  HStack,
  Heading,
  Input,
  Separator,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import { Plus, MapPin } from "lucide-react";
import AuthGuard from "@/guards/AuthGuard";
import MapPickerDialog from "@/components/common/MapPickerDialog";

import {
  getUserContact,
  updateUserContact,
  getUserAddresses,
  createUserAddress,
} from "@/api/user";

import type { Address } from "@/types/address";
import type { Contact } from "@/api/user";

// do not depend on dialog’s exact prop types here
const MPD: any = MapPickerDialog;

export default function Profile() {
  return (
    <AuthGuard>
      <Container maxW="6xl" py={3}>
        <HeaderBar />
        <ProfileContent />
      </Container>
    </AuthGuard>
  );
}

function HeaderBar() {
  return (
    <HStack
      justify="space-between"
      borderWidth="1px"
      borderRadius="md"
      px={3}
      py={2}
      mb={3}
      bg="bg.subtle"
    >
      <Heading size="sm">Profile</Heading>
      <Text fontSize="xs" color="fg.muted">
        Manage your contact info and saved addresses
      </Text>
    </HStack>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <Text fontSize="xs" color="fg.muted" mb={1}>
      {children}
    </Text>
  );
}

function ProfileContent() {
  const [loadingPage, setLoadingPage] = useState(true);

  // only editable fields
  const [contact, setContact] = useState<Contact>({ email: "", phone: "" });
  const originalRef = useRef<Contact>({ email: "", phone: "" });

  const [savingContact, setSavingContact] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addrPickerOpen, setAddrPickerOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  function formatBirthday(b?: string): string {
    if (!b) return "";
    const d = new Date(b);
    if (isNaN(d.getTime())) return b;
    return new Intl.DateTimeFormat("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [c, addr] = await Promise.all([getUserContact(), getUserAddresses()]);
        if (!alive) return;
        // keep only editable fields in local state
        setContact({ email: c.email ?? "", phone: c.phone ?? "", name: c.name, birthday: c.birthday } as Contact);
        originalRef.current = { email: c.email ?? "", phone: c.phone ?? "" } as Contact;
        setAddresses(addr);
      } catch {
        setBanner("Failed to load profile");
      } finally {
        if (alive) setLoadingPage(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const setEmailField = (val: string) => {
    setEmailError(null);
    // normalize to lowercase immediately; also trim leading/trailing spaces
    const normalized = val.trim().toLowerCase();
    setContact((prev) => ({ ...prev, email: normalized }));
  };
  const setPhoneField = (val: string) => setContact((prev) => ({ ...prev, phone: val }));

  const hasChanges = useMemo(() => {
    const e0 = (originalRef.current.email ?? "").trim().toLowerCase();
    const p0 = (originalRef.current.phone ?? "").trim();
    const e1 = (contact.email ?? "").trim().toLowerCase();
    const p1 = (contact.phone ?? "").trim();
    return e0 !== e1 || p0 !== p1;
  }, [contact]);

  async function onSaveContact() {
    setEmailError(null);
    try {
      setSavingContact(true);

      // send only normalized editable fields
      const email = (contact.email ?? "").trim().toLowerCase();
      const phone = (contact.phone ?? "").trim();

      const updated = await updateUserContact({ email, phone });

      // reflect server truth
      setContact((prev) => ({ ...prev, email: updated.email, phone: updated.phone }));
      originalRef.current = { email: updated.email, phone: updated.phone } as Contact;

      setBanner("Contact updated");
    } catch (e: any) {
      if (e?.response?.status === 409) {
        setEmailError("Email already in use");
        setBanner("Email already in use");
      } else {
        setBanner("Update failed");
      }
    } finally {
      setSavingContact(false);
      setTimeout(() => setBanner(null), 2500);
    }
  }

  async function onAddAddress(pick: { lat: number; lng: number; addressLine: string }) {
    try {
      await createUserAddress({
        lnt: pick.lat,
        alt: pick.lng,
        address: pick.addressLine,
      });
      const list = await getUserAddresses();
      setAddresses(list);
      setBanner("Address added");
    } catch {
      setBanner("Add failed");
    } finally {
      setTimeout(() => setBanner(null), 2500);
    }
  }

  if (loadingPage) return <Spinner size="sm" />;

  return (
    <Grid templateColumns={{ base: "1fr", md: "320px 1fr" }} gap={3} alignItems="start">
      {/* Left rail: compact contact card */}
      <Card.Root variant="outline" size="sm" asChild>
        <Box position="sticky" top="12px">
          <Card.Header py={2} px={3}>
            <Card.Title fontSize="sm">Contact</Card.Title>
          </Card.Header>
          <Separator />
          <Card.Body p={3} gap="2">
            <Stack gap={2}>
              <Box>
                <Label>Name</Label>
                <Input size="sm" readOnly value={contact.name ?? ""} placeholder="—" />
              </Box>
              <Box>
                <Label>Birthday</Label>
                <Input size="sm" readOnly value={formatBirthday(contact.birthday)} placeholder="—" />
              </Box>
              <Box>
                <Label>Email</Label>
                <Input
                  size="sm"
                  type="email"
                  value={contact.email}
                  onChange={(e) => setEmailField(e.target.value)}
                  aria-invalid={!!emailError}
                  aria-errormessage={emailError ? "email-error" : undefined}
                  data-invalid={emailError ? "" : undefined}
                  borderColor={emailError ? "red.500" : undefined}
                />
                {emailError ? (
                  <Text id="email-error" mt="1" fontSize="xs" color="red.500">
                    {emailError}
                  </Text>
                ) : null}
              </Box>
              <Box>
                <Label>Phone</Label>
                <Input size="sm" value={contact.phone} onChange={(e) => setPhoneField(e.target.value)} />
              </Box>
            </Stack>
          </Card.Body>
          <Separator />
          <Card.Footer py={2} px={3} justifyContent="flex-end" gap="2">
            <Button
              size="sm"
              colorPalette="blue"
              loading={savingContact}
              onClick={onSaveContact}
              disabled={!hasChanges}
            >
              Save
            </Button>
          </Card.Footer>
        </Box>
      </Card.Root>

      {/* Right: address list with dense rows */}
      <Stack gap={3}>
        {banner && (
          <Card.Root variant="subtle" size="sm">
            <Card.Body p={2}>
              <Text fontSize="sm">{banner}</Text>
            </Card.Body>
          </Card.Root>
        )}

        <Card.Root variant="outline" size="sm">
          <Card.Header py={2} px={3}>
            <HStack justify="space-between" w="full">
              <Card.Title fontSize="sm">Addresses</Card.Title>
              <Badge size="sm" variant="subtle">
                {addresses.length} saved
              </Badge>
            </HStack>
          </Card.Header>
          <Separator />
          <Card.Body p={0}>
            {addresses.length === 0 ? (
              <Box p={3}>
                <Text fontSize="sm">No addresses yet.</Text>
              </Box>
            ) : (
              <Stack gap={0}>
                {addresses.map((a, i) => (
                  <Box key={`${a.address}-${i}`}>
                    <HStack align="start" p={3} gap={2}>
                      <Box mt="1">
                        <MapPin size={14} />
                      </Box>
                      <Box flex="1">
                        <Text fontWeight="semibold">{a.address}</Text>
                      </Box>
                    </HStack>
                    {i < addresses.length - 1 ? <Separator /> : null}
                  </Box>
                ))}
              </Stack>
            )}
          </Card.Body>
          <Separator />
          <Card.Footer py={2} px={3} justifyContent="flex-end">
            <Button size="sm" onClick={() => setAddrPickerOpen(true)}>
              <HStack gap={1}>
                <Plus size={14} />
                <Text>Add address</Text>
              </HStack>
            </Button>
          </Card.Footer>
        </Card.Root>
      </Stack>

      <MPD
        open={addrPickerOpen}
        onClose={() => setAddrPickerOpen(false)}
        onConfirm={(p: any) => {
          setAddrPickerOpen(false);
          onAddAddress({ lat: p.lat, lng: p.lng, addressLine: p.address });
        }}
        initial={{
          address: undefined,
          lat: 31.771959,
          lng: 35.217018,
        }}
      />
    </Grid>
  );
}
