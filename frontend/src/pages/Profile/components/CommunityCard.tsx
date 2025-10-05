import { Box, Button, Card, HStack, Separator, Stack, Text } from "@chakra-ui/react";
import { UserPlus } from "lucide-react";

const Meta = ({ children }: { children: React.ReactNode }) => (
  <Text fontSize="xs" color="gray.600">{children}</Text>
);

type Node = {
  id: string;
  name: string;
  email: string;
  children?: Node[];
};

export default function CommunityCard({
  root,
  onAddFriendClick,
}: {
  root: Node;
  onAddFriendClick: () => void;
}) {
  return (
    <Card.Root variant="outline" borderColor="purple.200">
      <Card.Header py={3} px={4} bg="purple.50">
        <HStack justify="space-between" align="baseline">
          <Card.Title fontSize="sm" color="purple.900" textTransform="uppercase" letterSpacing="widest">
            Community
          </Card.Title>
          <Button size="xs" colorPalette="purple" onClick={onAddFriendClick}>
            <HStack gap={1}>
              <UserPlus size={14} />
              <Text>Add friend</Text>
            </HStack>
          </Button>
        </HStack>
        {/* add friends to gain more MD coins */}
        <text>Invite a friend to gain 5 MD Coins when he sign up </text>

      </Card.Header>
      <Separator />
      <Card.Body p={4}>
        <CommunityTree root={root} />
      </Card.Body>
    </Card.Root>
  );
}

function CommunityTree({ root }: { root: Node }) {
  return (
    <Box>
      <OrgNode node={root} depth={0} />
    </Box>
  );
}

function OrgNode({ node, depth }: { node: Node; depth: number }) {
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
