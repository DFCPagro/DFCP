import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  Heading,
  SimpleGrid,
  Spinner,
  Center,
} from "@chakra-ui/react";
import { useColorModeValue } from "@/components/ui/color-mode"
import { mockRoles } from "@/data/mockRoles";
import { meApi } from "@/api/auth";
import { useScheduleToasts } from "@/helpers/toaster";

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function Jobs() {
  const { data: me, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: meApi,
    staleTime: 5 * 60 * 1000,
  });

  const isLoggedIn = !!me;
  const navigate = useNavigate();
  const { loginRequired, applied } = useScheduleToasts();

  const roles = useMemo(() => mockRoles, []);
  const cardBg = useColorModeValue("white", "gray.800");
  const cardBorder = useColorModeValue("gray.200", "gray.700");

  const handleApply = (roleName: string) => {
    if (isLoggedIn) {
      applied(cap(roleName));
      navigate(`/employment-application?role=${encodeURIComponent(roleName)}`);
    } else {
      loginRequired();
      navigate("/login");
    }
  };

  if (isLoading) {
    return (
      <Center minH="60vh">
        <Spinner size="lg" />
      </Center>
    );
  }

  return (
    <Box px={{ base: 4, md: 8 }} py={{ base: 6, md: 10 }}>
      <Heading size="lg" mb={6}>
        Open Roles
      </Heading>

      <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={6}>
        {roles.map((role) => (
          <Card.Root
            key={role.name}
            bg={cardBg}
            borderWidth="1px"
            borderColor={cardBorder}
            shadow="sm"
            _hover={{ shadow: "md", translateY: "-2px" }}
            transition="all 0.15s ease"
          >
            <Card.Body>
              <Card.Header mb={2}>
                {cap(role.name)}
              </Card.Header>
              <Card.Title mb={4} color="gray.500">
                {role.description}
              </Card.Title>
              <Button onClick={() => handleApply(role.name)}>Apply Now</Button>
            </Card.Body>
          </Card.Root>
        ))}
      </SimpleGrid>
    </Box>
  );
}
