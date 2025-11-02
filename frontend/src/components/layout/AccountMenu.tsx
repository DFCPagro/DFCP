// src/components/layout/AccountMenu.tsx
import { Menu, Portal, Box, HStack, Avatar, Text, Badge, Icon, HoverCard } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "@/store/session";
import { getDefaultLanding } from "@/config/nav.defaults";
import { toaster } from "@/components/ui/toaster";
import { useAuthStore } from "@/store/auth";
import { useUIStore } from "@/store/ui";            // <- use drawer store
import { Coins } from "lucide-react";

const colorPalette = ["red", "blue", "green", "yellow", "purple", "orange"] as const;
const pickPalette = (name?: string | null) => {
  const n = name?.trim();
  if (!n) return "gray";
  const index = n.charCodeAt(0) % colorPalette.length;
  return colorPalette[index];
};

export default function AccountMenu() {
  const navigate = useNavigate();

  const user = useAuthStore((s) => s.user);
  const mode = useSessionStore((s) => s.mode);
  const role = useSessionStore((s) => s.activeWorkerRole);
  const setMode = useSessionStore((s) => s.setMode);
  const resetForLogout = useSessionStore((s) => s.resetForLogout);
  const logout = useAuthStore((s) => s.logout);

  const openDrawer = useUIStore((s) => s.openDrawer); // <- trigger side drawer

  const canWork = Boolean(role);
  const isGuest = !user || mode === "noUser";

  const mdCoin =
    Number(
      (user as any)?.mdCoin ??
      (user as any)?.mdcoin ??
      (user as any)?.coins ??
      (user as any)?.wallet?.mdc ??
      0
    ) || 0;

  const handleRegion = () =>
    toaster.create({ title: "Change Region", description: "Region picker will open here (wired in Step 5).", type: "info" });

  const switchToWork = () => {
    if (!canWork) {
      toaster.create({ title: "No work role", description: "Your account has no work role.", type: "warning" });
      return;
    }
    setMode("work");
    navigate(getDefaultLanding("work", role));
    toaster.create({ title: "Work Mode On", type: "success" });
  };

  const switchToCustomer = () => {
    setMode("customer");
    navigate(getDefaultLanding("customer", role));
    toaster.create({ title: "Work Mode Off", type: "success" });
  };

  const handleLogout = () => {
    resetForLogout(true);
    logout();
    navigate(getDefaultLanding("noUser", role));
    toaster.create({ title: "Logged out", type: "success" });
  };

  return (
    <Menu.Root positioning={{ placement: "bottom-end" }}>
      <Menu.Trigger asChild>
        <Box cursor="pointer">
          <HStack gap={2} align="center">
            <Avatar.Root colorPalette={pickPalette(user?.name)}>
              <Avatar.Fallback name={user?.name ?? "Guest"} />
            </Avatar.Root>

            <HStack gap={2} align="center">
              <Text fontSize="sm">{user?.name ?? "Account"}</Text>

              {!isGuest && (
                <HoverCard.Root openDelay={120} closeDelay={120}>
                  <HoverCard.Trigger asChild>
                    <HStack gap={1}>
                      <Icon as={Coins} boxSize={4} />
                      <Badge>{mdCoin}</Badge>
                    </HStack>
                  </HoverCard.Trigger>
                  <HoverCard.Positioner>
                    <HoverCard.Content maxW="260px" p={3} zIndex="popover">
                      <HoverCard.Arrow />
                      <Text fontWeight="semibold" mb={2}>MD Coins</Text>
                      <HStack justify="space-between" mb={2}>
                        <Text>Balance</Text>
                        <Badge>{mdCoin}</Badge>
                      </HStack>
                      <Text fontSize="sm" color="fg.muted">
                        Earned from verified performance. Usable for discounts and in-app purchases.
                      </Text>
                    </HoverCard.Content>
                  </HoverCard.Positioner>
                </HoverCard.Root>
              )}
            </HStack>
          </HStack>
        </Box>
      </Menu.Trigger>

      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            {/* Open Side MENU via store-controlled drawer */}
            <Menu.Item value="open-side-menu" onClick={openDrawer}>Open Menu</Menu.Item>

            {isGuest ? (
              <>
                <Menu.Item value="login" onClick={() => navigate("/login")}>Login</Menu.Item>
                <Menu.Item value="register" onClick={() => navigate("/register")}>Register</Menu.Item>
              </>
            ) : (
              <>
                <Menu.Item value="region" onClick={handleRegion}>Change Region</Menu.Item>
                {mode === "customer" && canWork && (
                  <Menu.Item value="switch-work" onClick={switchToWork}>Switch to Work Mode</Menu.Item>
                )}
                {mode === "work" && (
                  <Menu.Item value="switch-customer" onClick={switchToCustomer}>Switch to Customer Mode</Menu.Item>
                )}
                <Menu.Separator />
                <Menu.Item value="logout" onClick={handleLogout}>Logout</Menu.Item>
              </>
            )}

            <Menu.Arrow />
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
