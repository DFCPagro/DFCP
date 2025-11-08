import { Box, Button, Card, HStack, Separator, Stack, Text, Badge } from "@chakra-ui/react";
import { UserPlus } from "lucide-react";
import { useMemo, useState } from "react";

const Meta = ({ children }: { children: React.ReactNode }) => (
  <Text fontSize="xs" color="gray.600">{children}</Text>
);

export type Node = {
  id: string;
  name?: string;
  email?: string;
  children?: Node[];
};

function countDescendants(n?: Node): number {
  if (!n?.children?.length) return 0;
  return n.children.length + n.children.reduce((acc, c) => acc + countDescendants(c), 0);
}
function countNodes(n?: Node): number {
  if (!n) return 0;
  return 1 + (n.children?.reduce((acc, c) => acc + countNodes(c), 0) ?? 0);
}

export default function CommunityCard({
  root,
  onAddFriendClick,
}: {
  root: Node;
  onAddFriendClick: () => void;
}) {
  const totalAffiliates = useMemo(() => countDescendants(root), [root]);
  const totalMembers = useMemo(() => countNodes(root), [root]); // includes root

  return (
    <Card.Root variant="outline" borderColor="purple.200">
      <Card.Header py={3} px={4} bg="purple.50">
        <HStack justify="space-between" align="baseline">
          <HStack>
            <Card.Title fontSize="sm" color="purple.900" textTransform="uppercase" letterSpacing="widest">
              Community
            </Card.Title>
            <Badge colorPalette="purple" variant="surface">
              {totalAffiliates} total
            </Badge>
          </HStack>

          <Button size="xs" colorPalette="purple" onClick={onAddFriendClick}>
            <HStack gap={1}>
              <UserPlus size={14} />
              <Text>Add friend</Text>
            </HStack>
          </Button>
        </HStack>

        <Text mt={2} fontSize="xs" color="gray.700">
          Invite a friend and earn <Text as="span" fontWeight="semibold">5 MD Coins</Text> when they sign up.
        </Text>
      </Card.Header>

      <Separator />

      <Card.Body p={4}>
        <Box overflowX="auto" pb={2}>
          <CommunityTree root={root} />
        </Box>
      </Card.Body>

      {/* NEW: summary at the end */}
      <Separator />
      <Card.Footer py={3} px={4} bg="purple.50">
        <HStack justify="space-between" w="full">
          <Text fontSize="sm" color="purple.900" fontWeight="semibold">
            Sum of all affiliates
          </Text>
          <HStack gap={3}>
            <Badge variant="solid" colorPalette="purple" title="All affiliates excluding the root">
              {totalAffiliates} affiliates
            </Badge>
            <Badge variant="subtle" colorPalette="purple" title="All members including the root">
              {totalMembers} members
            </Badge>
          </HStack>
        </HStack>
      </Card.Footer>
    </Card.Root>
  );
}

function CommunityTree({ root }: { root: Node }) {
  return (
    <Box minW="min(720px, 100%)">
      <OrgNode node={root} depth={0} />
    </Box>
  );
}

function OrgNode({ node, depth }: { node: Node; depth: number }) {
  const [expanded, setExpanded] = useState(true);
  const isRoot = depth === 0;
  const direct = node.children?.length ?? 0;
  const total = useMemo(() => countDescendants(node), [node]);

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
        cursor={direct ? "pointer" : "default"}
        onClick={() => direct && setExpanded((v) => !v)}
        _hover={{ bg: direct ? (isRoot ? "purple.200" : "gray.50") : undefined }}
      >
        <Text fontWeight={isRoot ? "bold" : "semibold"} color={isRoot ? "purple.900" : "gray.800"}>
          {node.name || node.email || "User"}
        </Text>
        {node.email ? <Meta>{node.email}</Meta> : null}
        <HStack justify="center" mt={1} gap={2}>
          <Badge size="sm" variant="subtle" colorPalette="purple" title="Direct affiliates">
            {direct} direct
          </Badge>
          <Badge size="sm" variant="outline" colorPalette="purple" title="Total affiliates in subtree">
            {total} total
          </Badge>
        </HStack>
        {direct ? (
          <Text mt={1} fontSize="2xs" color="gray.600">
            {expanded ? "Click to collapse" : "Click to expand"}
          </Text>
        ) : null}
      </Box>

      {expanded && direct > 0 ? (
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
            {node.children!.map((c) => (
              <OrgNode key={c.id} node={c} depth={depth + 1} />
            ))}
          </HStack>

        
        </Box>
      ) : null}
    </Stack>
  );
}
