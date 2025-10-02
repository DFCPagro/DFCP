"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Container, Grid, Spinner, Stack } from "@chakra-ui/react";
import AuthGuard from "@/guards/AuthGuard";
import { loadGoogleMaps } from "@/utils/googleMaps";

import HeaderBar from "./components/HeaderBar";
import ContactCard from "./components/ContactCard";
import AddressesCard from "./components/AddressesCard";
import CommunityCard from "./components/CommunityCard";
import InviteModal from "./components/InviteModal";
import StatCard from "./components/StatCard";

import {
  getUserContact,
  updateUserContact,
  getUserAddresses,
  createUserAddress,
  deleteUserAddress,
} from "@/api/user";

import type { Address } from "@/types/address";
import type { Contact } from "@/api/user";

/* ========== local types ========== */
type CommunityNode = {
  id: string;
  name: string;
  email: string;
  children?: CommunityNode[];
};

/* ========== normalizers ========== */
function toAddressList(list: any[]): Address[] {
  return (list ?? [])
    .map((a) => {
      const lnt = a?.lnt ?? a?.lat;  // tolerate lat/lnt mismatch
      const alt = a?.alt ?? a?.lng;  // tolerate lng/alt mismatch
      const address = a?.address ?? "";
      return {
        lnt: Number(lnt),
        alt: Number(alt),
        address: String(address),
        logisticCenterId: a?.logisticCenterId ?? null,
      } as Address;
    })
    .filter(
      (a) =>
        Number.isFinite(a.lnt) &&
        Number.isFinite(a.alt) &&
        a.address.trim().length > 0
    );
}

export default function ProfilePage() {
  return (
    <AuthGuard>
      <Container maxW="6xl" py={8}>
        <HeaderBar />
        <ProfileContent />
      </Container>
    </AuthGuard>
  );
}

function ProfileContent() {
  const [loadingPage, setLoadingPage] = useState(true);

  // contact
  const [contact, setContact] = useState<Contact>({ email: "", phone: "" });
  const originalRef = useRef<Contact>({ email: "", phone: "" });
  const [savingContact, setSavingContact] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();

  // addresses
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addrPickerOpen, setAddrPickerOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  // community
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

  // preload maps once to avoid race when opening dialog
  useEffect(() => {
    loadGoogleMaps().catch(() => {});
  }, []);

  // initial load
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [c, addrRaw] = await Promise.all([getUserContact(), getUserAddresses()]);
        if (!alive) return;

        const incomingAvatar =
          (c as any).avatarUrl ?? (c as any).avatar ?? (c as any).image ?? (c as any).photoUrl ?? undefined;

        setContact({
          email: c.email ?? "",
          phone: c.phone ?? "",
          name: c.name,
          birthday: (c as any).birthday ?? (c as any).birthDate,
        } as Contact);
        originalRef.current = { email: c.email ?? "", phone: c.phone ?? "" } as Contact;
        setAvatarUrl(incomingAvatar);

        // STRICT list
        setAddresses(toAddressList(addrRaw));
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
    setContact((p) => ({ ...p, email: val.trim().toLowerCase() }));
  };
  const setPhoneField = (val: string) => setContact((p) => ({ ...p, phone: val }));

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

  const onAddAddress = useCallback(
    async (pick: { lat: number; lng: number; addressLine: string }) => {
      try {
        const listRaw = await createUserAddress({
          lnt: pick.lat,
          alt: pick.lng,
          address: pick.addressLine,
        });
        setAddresses(toAddressList(listRaw)); // normalize response
        setBanner("Address added");
      } catch {
        setBanner("Add failed");
      } finally {
        setTimeout(() => setBanner(null), 2200);
      }
    },
    []
  );

  async function onDeleteAddress(a: Address) {
    try {
      setDeletingKey(`${a.lnt},${a.alt},${a.address}`);
      const listRaw = await deleteUserAddress({ lnt: a.lnt, alt: a.alt, address: a.address });
      setAddresses(toAddressList(listRaw)); // normalize response
      setBanner("Address removed");
    } catch {
      setBanner("Delete failed");
    } finally {
      setDeletingKey(null);
      setTimeout(() => setBanner(null), 2200);
    }
  }

  function addFriendToRoot(email: string) {
    const name = email.split("@")[0].replace(/[\.\-_]/g, " ");
    const cap = (s: string) =>
      s
        .split(" ")
        .filter(Boolean)
        .map((w) => w[0]?.toUpperCase() + w.slice(1))
        .join(" ");

    setCommunity((prev) => ({
      ...prev,
      children: [...(prev.children ?? []), { id: `c-${Date.now()}`, name: cap(name), email }],
    }));
  }

  if (loadingPage) return <Spinner size="sm" />;

  return (
    <Grid templateColumns={{ base: "1fr", md: "360px 1fr" }} gap={8} alignItems="start">
      <ContactCard
        contact={{
          name: contact.name,
          email: contact.email,      // component handles undefined → ""
          phone: contact.phone,      // component handles undefined → ""
          birthday: (contact as any).birthday,
        }}
        setEmailField={setEmailField}
        setPhoneField={setPhoneField}
        emailError={emailError}
        hasChanges={hasChanges}
        saving={savingContact}
        onSave={onSaveContact}
        avatarUrl={avatarUrl}
        setAvatarUrl={setAvatarUrl}
      />

      <Stack gap={8}>
        <StatCard />

        <AddressesCard
          addresses={addresses}
          banner={banner}
          setBanner={setBanner}
          deletingKey={deletingKey}
          onDeleteAddress={onDeleteAddress}
          onAddAddress={onAddAddress}
          addrPickerOpen={addrPickerOpen}
          setAddrPickerOpen={setAddrPickerOpen}
        />

        <CommunityCard root={community} onAddFriendClick={() => setInviteOpen(true)} />
      </Stack>

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
