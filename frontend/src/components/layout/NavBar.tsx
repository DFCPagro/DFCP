import { Button, Link as CLink, Flex, HStack } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { ColorModeButton } from "@/components/ui/color-mode";

interface Route {
  title: string;
  path: string;
}

const routes: Route[] = [
  {
    title: "Home",
    path: "/",
  },
  {
    title: "Dashboard",
    path: "/dashboard",
  },
];

export default function NavBar() {
  const { token, logout } = useAuthStore();
  return (
    <Flex as="nav" p={4} borderBottomWidth="1px" justify="space-between">
      <HStack gap={4}>
        {routes.map((r, idx) => (
          <CLink asChild key={idx}>
            <Link to={r.path}>{r.title}</Link>
          </CLink>
        ))}
      </HStack>
      <HStack>
        {token ? (
          <Button size="sm" onClick={logout}>
            Logout
          </Button>
        ) : (
          <>
            <CLink asChild>
              <Link to="/login">Login</Link>
            </CLink>
            <CLink asChild>
              <Link to="/register">Register</Link>
            </CLink>
          </>
        )}
        <ColorModeButton />
      </HStack>
    </Flex>
  );
}
