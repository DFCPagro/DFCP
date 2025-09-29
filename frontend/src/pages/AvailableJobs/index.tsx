import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Button,
  Card,
  Center,
  Heading,
  Icon,
  Image,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  VisuallyHidden,
} from "@chakra-ui/react";
import { useColorModeValue } from "@/components/ui/color-mode";
import { mockRoles } from "@/data/mockRoles";
import { meApi } from "@/api/auth";
import { useScheduleToasts } from "@/helpers/toaster";
import { Sparkles } from "lucide-react";

export const roleImages: Record<string, string> = {
  deliverer:
    "https://img.freepik.com/premium-photo/cheerful-delivery-guy-with-box-hand-ai_431161-12363.jpg",
  picker:
    "https://source.unsplash.com/640x360/?warehouse,worker,scanner&sig=picker",
  industrialdeliverer:
    "https://i.pinimg.com/736x/0e/b0/be/0eb0be1ace7c9caf9211564c3b2eede3.jpg",
  farmer:
    "https://i.pinimg.com/originals/df/ae/83/dfae83290c2c77ae42d83b99e201b5f2.jpg",
  sorting:
    "https://source.unsplash.com/640x360/?warehouse,sorting,conveyor&sig=sorting",
  "warehouse-worker":
    "https://source.unsplash.com/640x360/?warehouse,forklift,worker&sig=warehouse-worker",
  default:
    "https://tse4.mm.bing.net/th/id/OIP.fPZcB-2duJR_eBOo2jS7YQAAAA?rs=1&pid=ImgDetMain&o=7&rm=3",
};

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
      navigate(`/job-application?role=${encodeURIComponent(roleName)}`);
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
    <Box bg="bg" minH="100dvh">
      {/* Compact, centered page container (not full-width) */}
      <Box
        maxW="6xl"
        mx="auto"
        px={{ base: 4, md: 6 }}
        py={{ base: 6, md: 10 }}
      >
        {/* Breadcrumb */}
        <Stack>
          <Breadcrumb.Root
            color="fg.muted"
            fontSize="sm"
            mb={{ base: 3, md: 4 }}
          >
            <Breadcrumb.List>
              <BreadcrumbItem>
                <BreadcrumbLink onClick={() => navigate("/")}>
                  Home
                </BreadcrumbLink>
              </BreadcrumbItem>
              <Breadcrumb.Separator />
              <BreadcrumbItem>
                <Breadcrumb.CurrentLink>Jobs</Breadcrumb.CurrentLink>
              </BreadcrumbItem>
            </Breadcrumb.List>
          </Breadcrumb.Root>
        </Stack>

        {/* Page header */}
        <Stack
          direction={{ base: "column", md: "row" }}
          justify="space-between"
          align={{ base: "flex-start", md: "center" }}
          mb={{ base: 5, md: 8 }}
          gap="3"
        >
          <Stack gap="1">
            <Heading size="lg" display="flex" alignItems="center" gap="2">
              <Icon as={Sparkles} />
              Open Roles
            </Heading>
            <Text color="fg.muted">
              Find a role that matches your skills and availability.
            </Text>
          </Stack>
          <Badge
            variant="subtle"
            colorPalette="gray"
            borderRadius="full"
            px="3"
            py="1"
          >
            {roles.length} openings
          </Badge>
        </Stack>

        {/* Cards grid */}
        <SimpleGrid
          columns={{ base: 1, sm: 2, lg: 3 }}
          gap={{ base: 5, md: 6 }}
        >
          {roles.map((role) => {
            const coverSrc = roleImages[role.name.toLowerCase()] ?? roleImages.default;
            return (
              <Card.Root
                key={role.name}
                bg={cardBg}
                borderWidth="1px"
                borderColor={cardBorder}
                shadow="sm"
                overflow="hidden"
                borderRadius="2xl"
                transition="all 0.2s ease"
                _hover={{ shadow: "md", translateY: "-2px" }}
                display="flex"
                flexDirection="column"
              >
                {/* Media */}
                  <Image
                    src={coverSrc}
                    alt={`${cap(role.name)} cover`}
                    width="100%"
                    height={{ base: "160px", md: "180px" }}
                    objectFit="cover"
                  />

                {/* Body */}
                <Card.Body p={{ base: 4, md: 5 }} gap="3" flex="1">
                  <Card.Header fontSize="lg" fontWeight="semibold">
                    {cap(role.name)}
                  </Card.Header>
                  <Card.Description color="fg.muted">
                    {role.description}
                  </Card.Description>
                </Card.Body>

                {/* Footer */}
                <Card.Footer
                  p={{ base: 4, md: 5 }}
                  pt="0"
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Stack direction="row" gap="2" align="center">
                    <Badge
                      variant="solid"
                      colorPalette="green"
                      borderRadius="full"
                    >
                      Open
                    </Badge>
                    <Badge
                      variant="subtle"
                      colorPalette="gray"
                      borderRadius="full"
                    >
                      {cap("general")}
                    </Badge>
                    <VisuallyHidden>Role status and category</VisuallyHidden>
                  </Stack>

                  <Button
                    onClick={() => handleApply(role.name)}
                    colorPalette="blue"
                    borderRadius="xl"
                  >
                    Apply Now
                  </Button>
                </Card.Footer>
              </Card.Root>
            );
          })}
        </SimpleGrid>
      </Box>
    </Box>
  );
}
