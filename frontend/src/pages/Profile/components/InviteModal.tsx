"use client";

import { Box, Button, HStack, Input, Text, Textarea } from "@chakra-ui/react";
import React from "react";
const Label = ({ children }: { children: React.ReactNode }) => (
  <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="widest" mb={1}>
    {children}
  </Text>
);

export default function InviteModal({
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
  const [email, setEmail] = React.useState("");
  const [msg, setMsg] = React.useState(defaultMessage);

  if (!open) return null;

  return (
    <Box position="fixed" inset="0" bg="blackAlpha.600" display="grid" placeItems="center" zIndex={1000} p={4}>
      <Box w="full" maxW="480px" bg="white" _dark={{ bg: "gray.800" }} rounded="lg" shadow="lg" overflow="hidden">
        <Box bg="purple.50" px={4} py={3}>
          <Text fontSize="sm" color="purple.900" fontWeight="semibold">Invite a friend</Text>
        </Box>
        <Box p={4}>
          <Box mb={3}>
            <Label>Email</Label>
            <Input size="sm" type="email" placeholder="friend@email.com" value={email}
              onChange={(e) => setEmail(e.target.value)} />
          </Box>
          <Box>
            <Label>Message</Label>
            <Textarea size="sm" rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} />
          </Box>
        </Box>
        <HStack justify="flex-end" gap={2} px={4} py={3} bg="purple.50">
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
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
