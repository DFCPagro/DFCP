import { useAuthStore } from "../../store/auth";
import { Button, Heading, Text, VStack } from "@chakra-ui/react";

export default function AdminDashboard() {
  const { user, logout } = useAuthStore();
  return (
    <VStack gap={4} mt={16}>
      <Heading size="md">Admin Dashboard</Heading>
      <Text>Hello, {user?.name ?? user?.email} 👋</Text>
      <Button onClick={logout}>Logout</Button>
    </VStack>
  );
}
