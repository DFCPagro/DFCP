// src/components/NavBar.tsx
import { Button, Link as CLink, Flex, HStack } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/auth";

export default function NavBar() {
  const { token, logout } = useAuthStore();
  return (
    <Flex as="nav" p={4} borderBottomWidth="1px" justify="space-between">
      <HStack gap={4}>
        <CLink as={Link}><Link to="/">Home</Link></CLink>
        <CLink as={Link}><Link to="/dashboard">Dashboard</Link></CLink>
      </HStack>
      <HStack>
        {token ? (
          <Button size="sm" onClick={logout}>Logout</Button>
        ) : (
          <>
            <CLink as={Link} ><Link to="/login">Login</Link></CLink>
            <CLink as={Link} ><Link to="/register">Register</Link></CLink>
          </>
        )}
      </HStack>
    </Flex>
  );
}
