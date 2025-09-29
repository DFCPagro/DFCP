import {
  Box,
  Breadcrumb,
  Heading,
  Image,
  Card,
  Text,
  Button,
  SimpleGrid,
  Stack,
} from "@chakra-ui/react";
import { useEmploymentApplication } from "@/hooks/useEmploymentApplication";
import { RoleOverviewCard } from "./components/RoleOverviewCard";
import { ApplicationFormCard } from "./components/ApplicationFormCard";
import { RoleHeader } from "./components/RoleHeader";

/**
 * Page shell that composes split components + hook.
 */
export default function EmploymentApplication() {
  const {
    role,
    roleName,
    loadingMe,
    coverSrc,
    cap,
    navigate,
    // form bits
    fields,
    errors,
    scheduleMask,
    lands,
    agree,
    isPending,
    isFormValid,
    updateField,
    updateSchedule,
    updateLands,
    handleSubmit,
  } = useEmploymentApplication();

  if (!role) {
    // invalid role fallback with compact centered card
    return (
      <Box bg="bg" minH="100dvh">
        <Box
          maxW="3xl"
          mx="auto"
          px={{ base: 4, md: 8 }}
          py={{ base: 8, md: 12 }}
        >
          <Card.Root variant="subtle">
            <Card.Body gap="4" alignItems="center" textAlign="center">
              <Image
                src="https://source.unsplash.com/featured/640x360?search"
                alt="Jobs"
                width="100%"
                height="200px"
                objectFit="cover"
                borderRadius="lg"
              />
              <Heading size="lg">Invalid role</Heading>
              <Text>No role called “{roleName}”.</Text>
              <Button mt="2" onClick={() => navigate("/jobs")}>
                Back to roles
              </Button>
            </Card.Body>
          </Card.Root>
        </Box>
      </Box>
    );
  }

  return (
    <Box bg="bg" minH="100dvh">
      <Box
        maxW="6xl"
        mx="auto"
        px={{ base: 4, md: 6 }}
        py={{ base: 6, md: 10 }}
      >
        <Stack>
          <Breadcrumb.Root>
            <Breadcrumb.List>
              <Breadcrumb.Item>
                <Breadcrumb.Link onClick={() => navigate("/")}>
                  Home
                </Breadcrumb.Link>
              </Breadcrumb.Item>
              <Breadcrumb.Separator />
              <Breadcrumb.Item>
                <Breadcrumb.Link onClick={() => navigate("/jobs")}>
                  Jobs
                </Breadcrumb.Link>
              </Breadcrumb.Item>
              <Breadcrumb.Separator />
              <Breadcrumb.Item>
                <Breadcrumb.Link>{cap(role.name)}</Breadcrumb.Link>
              </Breadcrumb.Item>
            </Breadcrumb.List>
          </Breadcrumb.Root>
        </Stack>

        {/* Page header */}
        <Stack gap={{ base: "3", md: "4" }} mb={{ base: 5, md: 8 }}>
          <RoleHeader
            roleName={cap(role.name)}
            description={role.description}
          />
        </Stack>

        {/* Two-column responsive layout */}
        <SimpleGrid columns={{ base: 1, lg: 3 }} gap={{ base: 5, md: 8 }}>
          <RoleOverviewCard
            role={role}
            isLoading={loadingMe}
            coverSrc={coverSrc}
          />
          <Box gridColumn={{ lg: "span 2" }}>
            <ApplicationFormCard
              role={role}
              fields={fields}
              errors={errors}
              scheduleMask={scheduleMask}
              lands={lands}
              agree={agree}
              isPending={isPending}
              isFormValid={isFormValid}
              onChangeField={updateField}
              onScheduleChange={updateSchedule}
              onLandsChange={updateLands}
              onCancel={() => navigate("/jobs")}
              onSubmit={handleSubmit}
            />
          </Box>
        </SimpleGrid>
      </Box>
    </Box>
  );
}
