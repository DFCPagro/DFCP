// src/components/layout/AccountMenu.tsx
import { Menu, Portal, Box, HStack, Avatar, Text, Badge, Icon } from "@chakra-ui/react";
import { FiUser } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "@/store/session";
import { getDefaultLanding } from "@/config/nav.defaults";
import { toaster } from "@/components/ui/toaster";
import { useAuthStore } from "@/store/auth";
import { Coins } from "lucide-react";

/**
 * Account menu (Chakra v3.25 slot API + custom toaster)
 * - Change Region (stub)
 * - Switch to Work Mode / Switch to Customer Mode
 * - Logout
 */
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

  const canWork = Boolean(role);
  
  const isGuest = !user || mode === "noUser";
const mdCoin =  (user as any)?.coins ??
  (user as any)?.coins ??
  (user as any)?.coins ??
   (user as any)?.wallet?.mdc ??
   0;
  const handleRegion = () => {
    toaster.create({
      title: "Change Region",
      description: "Region picker will open here (wired in Step 5).",
      type: "info",
    });
  };

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
          <HStack gap={2}>
                 <Icon as={Coins} />
                  <Text flex="1">MDCoin</Text>
                  <Badge>{mdCoin}</Badge>
            <Avatar.Root colorPalette={pickPalette(user?.name)}>
              <Avatar.Fallback name={user?.name ?? "Guest"} />
            </Avatar.Root>
            <Text fontSize="sm">{user?.name ?? "Account"}</Text>
          </HStack>
        </Box>
      </Menu.Trigger>

      <Portal>
        <Menu.Positioner>
          <Menu.Content>

            {isGuest ? (
              <>
                <Menu.Item value="login" onClick={() => navigate("/login")}>
                  Login
                </Menu.Item>
                <Menu.Item value="register" onClick={() => navigate("/register")}>
                  Register
                </Menu.Item>
              </>
            ) : (
              
              <>
             
                <Menu.Item value="region" onClick={handleRegion}>
                  Change Region
                </Menu.Item>

                {mode === "customer" && canWork && (
                  <Menu.Item value="switch-work" onClick={switchToWork}>
                    Switch to Work Mode
                  </Menu.Item>
                )}

                {mode === "work" && (
                  <Menu.Item value="switch-customer" onClick={switchToCustomer}>
                    Switch to Customer Mode
                  </Menu.Item>
                )}

                <Menu.Separator />

                <Menu.Item value="logout" onClick={handleLogout}>
                  Logout
                </Menu.Item>
              </>
            
            )}

            <Menu.Arrow />
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
