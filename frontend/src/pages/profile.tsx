// src/pages/profile.tsx
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
  Textarea,
} from "@chakra-ui/react";
import { Plus, MapPin, Trash2, UserPlus } from "lucide-react";
import AuthGuard from "@/guards/AuthGuard";
import MapPickerDialog from "@/components/common/MapPickerDialog";

import {
  getUserContact,
  updateUserContact,
  getUserAddresses,
  createUserAddress,
  deleteUserAddress,
} from "@/api/user";

import type { Address } from "@/types/address";
import type { Contact } from "@/api/user";

const MPD: any = MapPickerDialog;

/* ========== Community types ========== */
type CommunityNode = {
  id: string;
  name: string;
  email: string;
  children?: CommunityNode[];
};

export default function Profile() {
  return (
    <AuthGuard>
      <Container maxW="6xl" py={8}>
        <HeaderBar />
        <ProfileContent />
      </Container>
    </AuthGuard>
  );
}

/* ---------- header ---------- */
function HeaderBar() {
  return (
    <Card.Root
      variant="outline"
      borderColor="teal.300"
      shadow="sm"
      bgGradient="linear(to-r, teal.50, green.50)"
      mb={8}
    >
      <Card.Body py={4} px={5}>
        <HStack justify="space-between" align="center">
          <Heading size="md" color="teal.900" letterSpacing="tight">
            Profile
          </Heading>
          <Text fontSize="sm" color="teal.800">
            Contact, photo, addresses, and community
          </Text>
        </HStack>
      </Card.Body>
    </Card.Root>
  );
}

/* ---------- small bits ---------- */
const Label = ({ children }: { children: React.ReactNode }) => (
  <Text
    fontSize="xs"
    color="gray.500"
    textTransform="uppercase"
    letterSpacing="widest"
    mb={1}
  >
    {children}
  </Text>
);

const Meta = ({ children }: { children: React.ReactNode }) => (
  <Text fontSize="xs" color="gray.600">
    {children}
  </Text>
);

const AvatarBox = ({ url, text }: { url?: string; text: string }) => (
  <Box
    w="76px"
    h="76px"
    rounded="full"
    bg="teal.100"
    bgImage={url ? `url(${url})` : undefined}
    bgSize="cover"
    bgPos="center"
    display="grid"
    placeItems="center"
    fontWeight="bold"
    color="teal.900"
    shadow="md"
    border="2px solid"
    borderColor="whiteAlpha.700"
  >
    {!url ? text : null}
  </Box>
);

/* ---------- page ---------- */
function ProfileContent() {
  const [loadingPage, setLoadingPage] = useState(true);

  const [contact, setContact] = useState<Contact>({ email: "", phone: "" });
  const originalRef = useRef<Contact>({ email: "", phone: "" });

  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);

  const [savingContact, setSavingContact] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addrPickerOpen, setAddrPickerOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  // demo stats
  const [targets] = useState(() => ({
    farmers: Math.floor(Math.random() * 8) + 3,
    orders: Math.floor(Math.random() * 40) + 10,
    points: Math.floor(Math.random() * 900) + 100,
  }));
  const [stats, setStats] = useState({ farmers: 0, orders: 0, points: 0 });

  // community mock tree (root = current user)
  const [community, setCommunity] = useState<CommunityNode>({
    id: "me",
    name: "You",
    email: "",
    children: [
      {
        id: "c1",
        name: "Dana",
        email: "dana@example.com",
        children: [
          { id: "c1-1", name: "Sam", email: "sam@example.com" },
          { id: "c1-2", name: "Noa", email: "noa@example.com" },
        ],
      },
      {
        id: "c2",
        name: "Omar",
        email: "omar@example.com",
        children: [{ id: "c2-1", name: "Lee", email: "lee@example.com" }],
      },
    ],
  });
  const [inviteOpen, setInviteOpen] = useState(false);

  const initials = (name?: string, email?: string) => {
    const src = name && name.trim().length > 0 ? name : email ?? "";
    const parts = src.split(/[ \._@-]+/).filter(Boolean);
    const a = parts[0]?.[0] ?? "?";
    const b = parts[1]?.[0] ?? "";
    return (a + b).toUpperCase();
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [c, addr] = await Promise.all([getUserContact(), getUserAddresses()]);
        if (!alive) return;

        const incomingAvatar =
          (c as any).avatarUrl ?? (c as any).avatar ?? (c as any).image ?? (c as any).photoUrl ?? undefined;

        setContact({
          email: c.email ?? "",
          phone: c.phone ?? "",
          name: c.name,
          birthday: (c as any).birthday ?? (c as any).birthDate, // kept but not shown
        } as Contact);
        originalRef.current = { email: c.email ?? "", phone: c.phone ?? "" } as Contact;
        setAvatarUrl(incomingAvatar);
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

  // stat count-up
  useEffect(() => {
    let id = 0;
    const start = performance.now();
    const duration = 1200;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setStats({
        farmers: Math.round(targets.farmers * p),
        orders: Math.round(targets.orders * p),
        points: Math.round(targets.points * p),
      });
      if (p < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [targets]);

  const setEmailField = (val: string) => {
    setEmailError(null);
    setContact((prev) => ({ ...prev, email: val.trim().toLowerCase() }));
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
      const updated = await updateUserContact({
        email: (contact.email ?? "").trim().toLowerCase(),
        phone: (contact.phone ?? "").trim(),
      });
      setContact((p) => ({ ...p, email: updated.email, phone: updated.phone }));
      originalRef.current = { email: updated.email, phone: updated.phone } as Contact;
      setBanner("Contact updated");
    } catch (e: any) {
      setBanner(e?.response?.status === 409 ? "Email already in use" : "Update failed");
      if (e?.response?.status === 409) setEmailError("Email already in use");
    } finally {
      setSavingContact(false);
      setTimeout(() => setBanner(null), 2200);
    }
  }

  async function onAddAddress(pick: { lat: number; lng: number; addressLine: string }) {
    try {
      const list = await createUserAddress({ lnt: pick.lat, alt: pick.lng, address: pick.addressLine });
      setAddresses(list);
      setBanner("Address added");
    } catch {
      setBanner("Add failed");
    } finally {
      setTimeout(() => setBanner(null), 2200);
    }
  }

  async function onDeleteAddress(a: Address) {
    try {
      const key = `${a.lnt},${a.alt},${a.address}`;
      setDeletingKey(key);
      const updated = await deleteUserAddress({ lnt: a.lnt, alt: a.alt, address: a.address });
      setAddresses(updated);
      setBanner("Address removed");
    } catch {
      setBanner("Delete failed");
    } finally {
      setDeletingKey(null);
      setTimeout(() => setBanner(null), 2200);
    }
  }

  function onAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file); // preview only
    setAvatarUrl(url);
    setBanner("Photo selected");
    setTimeout(() => setBanner(null), 1800);
  }

  // community helpers
  function addFriendToRoot(email: string) {
    const name = email.split("@")[0].replace(/[\.\-_]/g, " ");
    setCommunity((prev) => ({
      ...prev,
      children: [
        ...(prev.children ?? []),
        { id: `c-${Date.now()}`, name: capitalizeWords(name), email },
      ],
    }));
  }

  function capitalizeWords(s: string) {
    return s
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0]?.toUpperCase() + w.slice(1))
      .join(" ");
  }

  if (loadingPage) return <Spinner size="sm" />;

  return (
    <Grid templateColumns={{ base: "1fr", md: "360px 1fr" }} gap={8} alignItems="start">
      {/* left: contact */}
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
              value={contact.email}
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
            <Input size="sm" value={contact.phone} onChange={(e) => setPhoneField(e.target.value)} />
          </Box>
        </Card.Body>
        <Separator />
        <Card.Footer py={4} px={5} justifyContent="flex-end" bg="teal.50">
          <Button size="sm" colorPalette="teal" loading={savingContact} disabled={!hasChanges} onClick={onSaveContact}>
            Save changes
          </Button>
        </Card.Footer>
      </Card.Root>

      {/* right: stats + addresses + community */}
      <Stack gap={8}>
        {banner ? (
          <Card.Root variant="subtle" shadow="xs" borderColor="teal.200">
            <Card.Body p={3}>
              <Text fontSize="sm">{banner}</Text>
            </Card.Body>
          </Card.Root>
        ) : null}

        {/* stats */}
        <Card.Root variant="outline" borderColor="green.200">
          <Card.Header py={3} px={4} bg="green.50">
            <HStack justify="space-between" align="baseline">
              <Card.Title fontSize="sm" color="green.900" textTransform="uppercase" letterSpacing="widest">
                Your impact
              </Card.Title>
              <Meta>Live counters</Meta>
            </HStack>
          </Card.Header>
          <Separator />
          <Card.Body p={4}>
            <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={4}>
              <StatCard color="teal" title="Farmers supported" value={stats.farmers} target={targets.farmers} />
              <StatCard color="blue" title="Total orders" value={stats.orders} target={targets.orders} />
              <StatCard color="purple" title="Total points" value={stats.points} target={targets.points} />
            </Grid>
          </Card.Body>
        </Card.Root>

        {/* addresses */}
        <Card.Root variant="elevated" shadow="sm">
          <Card.Header py={4} px={5} bgGradient="linear(to-r, blue.50, blue.100)">
            <HStack justify="space-between" w="full" align="baseline">
              <Card.Title color="blue.900" fontSize="sm" textTransform="uppercase" letterSpacing="widest">
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
                        <Box boxSize="8" rounded="full" bg="blue.200" display="grid" placeItems="center">
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
            <Button size="sm" colorPalette="blue" onClick={() => setAddrPickerOpen(true)}>
              <HStack gap={2}>
                <Plus size={16} />
                <Text>Add address</Text>
              </HStack>
            </Button>
          </Card.Footer>
        </Card.Root>

        {/* community */}
        <Card.Root variant="outline" borderColor="purple.200">
          <Card.Header py={3} px={4} bg="purple.50">
            <HStack justify="space-between" align="baseline">
              <Card.Title fontSize="sm" color="purple.900" textTransform="uppercase" letterSpacing="widest">
                Community
              </Card.Title>
              <Button size="xs" colorPalette="purple" onClick={() => setInviteOpen(true)}>
                <HStack gap={1}>
                  <UserPlus size={14} />
                  <Text>Add friend</Text>
                </HStack>
              </Button>
            </HStack>
          </Card.Header>
          <Separator />
          <Card.Body p={4}>
            <CommunityTree root={community} />
          </Card.Body>
        </Card.Root>
      </Stack>

      {/* address picker */}
      <MPD
        open={addrPickerOpen}
        onClose={() => setAddrPickerOpen(false)}
        onConfirm={(p: any) => {
          setAddrPickerOpen(false);
          onAddAddress({ lat: p.lat, lng: p.lng, addressLine: p.address });
        }}
        initial={{ address: undefined, lat: 31.771959, lng: 35.217018 }}
      />

      {/* invite modal */}
      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        defaultMessage={`Hi! Join me in the app—use my invite to support local farmers and earn points.`}
        onSubmit={(email) => {
          addFriendToRoot(email);
          setInviteOpen(false);
          setBanner("Invitation prepared");
          setTimeout(() => setBanner(null), 1800);
        }}
      />
    </Grid>
  );
}

/* ---------- stat card ---------- */
function StatCard({
  title,
  value,
  target,
  color,
}: {
  title: string;
  value: number;
  target: number;
  color: "teal" | "blue" | "purple";
}) {
  const progress = target > 0 ? Math.min(1, value / target) : 1;
  const scale = 0.9 + 0.2 * progress;
  return (
    <Box
      p={5}
      borderWidth="1px"
      borderColor={`${color}.200`}
      bgGradient={`linear(to-b, ${color}.50, white)`}
      rounded="lg"
      textAlign="center"
      shadow="xs"
    >
      <Text fontSize="xs" color={`${color}.800`} mb={2} letterSpacing="widest" textTransform="uppercase">
        {title}
      </Text>
      <Box transform={`scale(${scale})`} transformOrigin="center">
        <Text fontSize="3xl" fontWeight="extrabold" color={`${color}.900`} lineHeight="shorter">
          {value.toLocaleString()}
        </Text>
      </Box>
      <Box mt={3} h="2" rounded="full" bg={`${color}.100`} overflow="hidden">
        <Box h="full" w={`${progress * 100}%`} bg={`${color}.400`} transition="width 120ms" />
      </Box>
    </Box>
  );
}

/* ---------- Community tree (simple org chart) ---------- */
function CommunityTree({ root }: { root: CommunityNode }) {
  return (
    <Box>
      <OrgNode node={root} depth={0} />
    </Box>
  );
}

function OrgNode({ node, depth }: { node: CommunityNode; depth: number }) {
  const isRoot = depth === 0;
  return (
    <Stack align="center" gap={3}>
      <Box
        px={3}
        py={2}
        rounded="md"
        borderWidth="1px"
        borderColor={isRoot ? "purple.300" : "gray.200"}
        bg={isRoot ? "purple.100" : "white"}
        minW="220px"
        textAlign="center"
        shadow="xs"
      >
        <Text fontWeight={isRoot ? "bold" : "semibold"} color={isRoot ? "purple.900" : "gray.800"}>
          {node.name || node.email || "User"}
        </Text>
        {node.email ? <Meta>{node.email}</Meta> : null}
      </Box>

      {node.children && node.children.length > 0 ? (
        <Box w="full">
          {/* connector */}
          <Box h="4" borderLeftWidth="2px" borderColor="purple.200" mx="auto" />
          <HStack
            align="start"
            justify="center"
            gap={6}
            position="relative"
            _before={{
              content: '""',
              position: "absolute",
              top: 0,
              left: "10%",
              right: "10%",
              borderTop: "2px solid",
              borderColor: "purple.200",
            }}
            pt="3"
          >
            {node.children.map((c) => (
              <OrgNode key={c.id} node={c} depth={depth + 1} />
            ))}
          </HStack>
        </Box>
      ) : null}
    </Stack>
  );
}

/* ---------- Invite Modal (lightweight, no Chakra Modal API dependency) ---------- */
function InviteModal({
  open,
  onClose,
  onSubmit,
  defaultMessage,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (email: string, message: string) => void;
  defaultMessage: string;
}) {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState(defaultMessage);

  if (!open) return null;

  return (
    <Box
      position="fixed"
      inset="0"
      bg="blackAlpha.600"
      display="grid"
      placeItems="center"
      zIndex={1000}
      p={4}
    >
      <Box w="full" maxW="480px" bg="white" _dark={{ bg: "gray.800" }} rounded="lg" shadow="lg" overflow="hidden">
        <Box bg="purple.50" px={4} py={3}>
          <Text fontSize="sm" color="purple.900" fontWeight="semibold">
            Invite a friend
          </Text>
        </Box>
        <Box p={4}>
          <Box mb={3}>
            <Label>Email</Label>
            <Input
              size="sm"
              type="email"
              placeholder="friend@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Box>
          <Box>
            <Label>Message</Label>
            <Textarea
              size="sm"
              rows={4}
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
            />
          </Box>
        </Box>
        <HStack justify="flex-end" gap={2} px={4} py={3} bg="purple.50">
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            colorPalette="purple"
            onClick={() => {
              if (!email) return;
              onSubmit(email.trim().toLowerCase(), msg);
              setEmail("");
              setMsg(defaultMessage);
            }}
          >
            Send invite
          </Button>
        </HStack>
      </Box>
    </Box>
  );
}
