import {
  Flex,
  HStack,
  Link as CLink,
  Spacer,
  Menu,
  Avatar,
  Text,
  Box,
} from "@chakra-ui/react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { PATHS } from "@/routes/paths";
import { ColorModeButton } from "@/components/ui/color-mode";

type NavItem = { title: string; path: string };

const colorPalette = ["red", "blue", "green", "yellow", "purple", "orange"] as const;
const pickPalette = (name?: string | null) => {
  const n = name?.trim();
  if (!n) return "gray";
  const index = n.charCodeAt(0) % colorPalette.length;
  return colorPalette[index];
};

export default function NavBar() {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  // avoid flicker before zustand/persist hydrates (optional)
  const hasHydrated = (useAuthStore as any).persist?.hasHydrated?.() ?? true;
  if (!hasHydrated) return null;

  const location = useLocation();

  const links: NavItem[] = [{ title: "Home", path: PATHS.home }];
  if (token) {
    links.push({ title: "Dashboard", path: PATHS.dashboard });
    if (role === "deliverer") {
      links.push({ title: "Driver Schedule", path: PATHS.driverSchedule });
    }
  }

  const isActive = (path: string) => {
    // exact for home, prefix for others — tweak as you like
    if (path === PATHS.home) return location.pathname === PATHS.home;
    return location.pathname.startsWith(path);
  };

  return (
    <Flex as="nav" p={4} borderBottomWidth="1px" align="center" gap={4}>
      {/* left: navigation links */}
      <HStack gap={4}>
        {links.map((item) => {
          const active = isActive(item.path);
          return (
            <CLink
              key={item.path}
              asChild
              fontWeight={active ? "semibold" : "normal"}
              color={active ? "teal.500" : undefined}
              _hover={{ opacity: 0.85, textDecoration: "none" }}
            >
              {/* Only ONE anchor: RouterLink renders <a />, CLink passes styles to it */}
              <RouterLink to={item.path}>{item.title}</RouterLink>
            </CLink>
          );
        })}
      </HStack>

      <Spacer />

      {/* right: auth actions / user menu */}
      <HStack gap={3}>
        {!token ? (
          <>
            <CLink asChild>
              <RouterLink to={PATHS.login}>Login</RouterLink>
            </CLink>
            <CLink asChild>
              <RouterLink to={PATHS.register}>Register</RouterLink>
            </CLink>
          </>
        ) : (
          <Menu.Root>
            <Menu.Trigger asChild>
              <Box cursor="pointer">
                <HStack gap={2}>
                  <Avatar.Root colorPalette={pickPalette(user?.name)}>
                    {/* If you support photos later: <Avatar.Image src={user?.avatarUrl} alt={user?.name ?? "User"} /> */}
                    <Avatar.Fallback name={user?.name ?? "User"} />
                  </Avatar.Root>
                  <Text fontSize="sm">{user?.name ?? "Account"}</Text>
                </HStack>
              </Box>
            </Menu.Trigger>

            <Menu.Positioner>
              <Menu.Content>
                {/* Give Menu.Item a value when using it (required by v3 types) */}
                <Menu.Item value="dashboard" asChild>
                  <RouterLink to={PATHS.dashboard}>My Dashboard</RouterLink>
                </Menu.Item>

                {role === "deliverer" && (
                  <Menu.Item value="driver-schedule" asChild>
                    <RouterLink to={PATHS.driverSchedule}>Driver Schedule</RouterLink>
                  </Menu.Item>
                )}

                <Menu.Separator />

                <Menu.Item value="logout" onClick={logout}>
                  Logout
                </Menu.Item>

                <Menu.Arrow />
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Root>
        )}

        <ColorModeButton />
      </HStack>
    </Flex>
  );
}
