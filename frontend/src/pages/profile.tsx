import { useEffect, useState } from "react";
import {
  Box, Container, Heading, Stack, HStack, Text, Input, Button, Spinner, Badge
} from "@chakra-ui/react";
import { Plus, MapPin } from "lucide-react";
import AuthGuard from "@/guards/AuthGuard";
import MapPickerDialog from "@/components/common/MapPickerDialog";

import {
  getUserContact, updateUserContact,
  getUserAddresses, createUserAddress,
} from "@/api/user";

import type { Address } from "@/types/address";
import type { Contact } from "@/api/user";

export default function Profile() {
  return (
    <AuthGuard>
      <Container maxW="6xl" py={8}>
        <Heading size="lg" mb={6}>Profile</Heading>
        <ProfileContent />
      </Container>
    </AuthGuard>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box borderWidth="1px" borderRadius="lg" p={4}>
      <Heading size="md" mb={3}>{title}</Heading>
      {children}
    </Box>
  );
}
const Label = ({ children }: { children: React.ReactNode }) =>
  <Text fontSize="sm" color="fg.muted" mb={1}>{children}</Text>;
const Row = ({ children }: { children: React.ReactNode }) =>
  <Box display="grid" gridTemplateColumns="1fr 1fr 1fr" gap="12px">{children}</Box>;

// do not depend on dialog’s exact prop types here
const MPD: any = MapPickerDialog;

function ProfileContent() {
  const [loadingPage, setLoadingPage] = useState(true);

  const [contact, setContact] = useState<Contact>({ email: "", phone: "" });
  const [savingContact, setSavingContact] = useState(false);

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
        setContact(c);
        setAddresses(addr);
      } catch {
        setBanner("Failed to load profile");
      } finally {
        if (alive) setLoadingPage(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const setEmailField = (val: string) => setContact(prev => ({ ...prev, email: val }));
  const setPhoneField = (val: string) => setContact(prev => ({ ...prev, phone: val }));

  async function onSaveContact() {
    try {
      setSavingContact(true);
      const updated = await updateUserContact({ email: contact.email, phone: contact.phone });
      setContact(prev => ({ ...prev, email: updated.email, phone: updated.phone }));
      setBanner("Contact updated");
    } catch (e: any) {
      setBanner(e?.response?.status === 409 ? "Email already in use" : "Update failed");
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
      const list = await getUserAddresses(); // guarantees Address[]
      setAddresses(list);
      setBanner("Address added");
    } catch {
      setBanner("Add failed");
    } finally {
      setTimeout(() => setBanner(null), 2500);
    }
  }

  if (loadingPage) return <Spinner />;

  return (
    <Stack gap={6}>
      {banner && (
        <Box borderWidth="1px" borderRadius="md" p={2} bg="bg.subtle">
          <Text fontSize="sm">{banner}</Text>
        </Box>
      )}

      <Section title="Contact">
        <Row>
          <Box><Label>Name</Label><Input readOnly value={contact.name ?? ""} placeholder="—" /></Box>
          <Box>
            <Label>Email</Label>
            <Input type="email" value={contact.email} onChange={(e) => setEmailField(e.target.value)} />
          </Box>
          <Box>
            <Label>Phone</Label>
            <Input value={contact.phone} onChange={(e) => setPhoneField(e.target.value)} />
          </Box>
        </Row>
        <Row>
          <Box><Label>Birthday</Label><Input readOnly value={formatBirthday(contact.birthday)} placeholder="—" /></Box>
          <Box /><Box />
        </Row>
        <HStack mt={4} gap={3}>
          <Button onClick={onSaveContact} loading={savingContact} colorPalette="blue">Save</Button>
          <Button onClick={() => setAddrPickerOpen(true)}>
            <HStack gap={2}><Plus size={16} /><Text>Add address</Text></HStack>
          </Button>
        </HStack>
      </Section>

      <Section title="Addresses">
        <Text fontSize="sm" color="fg.muted" mb={3}>{addresses.length} saved</Text>
        {addresses.length === 0 ? (
          <Text>No addresses yet.</Text>
        ) : (
          <Stack gap={3}>
            {addresses.map((a, i) => (
              <Box key={`${a.lnt},${a.alt},${i}`} borderWidth="1px" borderRadius="md" p={3}>
                <HStack justify="space-between" align="start">
                  <Box>
                    <HStack gap={2}>
                      <MapPin size={16} />
                      <Text fontWeight="semibold">{a.address}</Text>
                      {a.logisticCenterId ? <Badge>LC: {a.logisticCenterId}</Badge> : null}
                    </HStack>
                    <Text fontSize="sm" color="fg.muted">lat {a.lnt}, lng {a.alt}</Text>
                  </Box>
                </HStack>
              </Box>
            ))}
          </Stack>
        )}
      </Section>

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
    </Stack>
  );
}
