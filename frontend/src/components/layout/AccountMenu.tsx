// src/components/layout/AccountMenu.tsx
import { Menu, Portal, IconButton } from "@chakra-ui/react";
import { FiUser } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "@/store/session";
import { getDefaultLanding } from "@/config/nav.defaults";
import { toaster } from "@/components/ui/toaster";

/**
 * Account menu (Chakra v3.25 slot API + custom toaster)
 * - Change Region (stub)
 * - Switch to Work Mode / Switch to Customer Mode
 * - Logout
 */
export default function AccountMenu() {
  const navigate = useNavigate();

  const mode = useSessionStore((s) => s.mode);
  const role = useSessionStore((s) => s.activeWorkerRole);
  const setMode = useSessionStore((s) => s.setMode);
  const resetForLogout = useSessionStore((s) => s.resetForLogout);

  const canWork = Boolean(role);

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
  navigate(getDefaultLanding("customer", role));
  toaster.create({ title: "Logged out", type: "success" });
};


  return (
    <Menu.Root positioning={{ placement: "bottom-end" }}>
      <Menu.Trigger asChild>
        <IconButton aria-label="Account" variant="ghost">
          <FiUser />
        </IconButton>
      </Menu.Trigger>

      <Portal>
        <Menu.Positioner>
          <Menu.Content>
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

            <Menu.Arrow />
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
