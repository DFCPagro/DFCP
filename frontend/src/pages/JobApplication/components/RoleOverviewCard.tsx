import { Card, Heading, Image, Separator, Stack, Text } from "@chakra-ui/react";
import type { RoleDef } from "@/data/roles";

type RoleOverviewCardProps = {
  role: RoleDef;
  isLoading?: boolean;
  coverSrc: string;
};

export function RoleOverviewCard({ role, coverSrc }: RoleOverviewCardProps) {
  return (
    <Card.Root variant="elevated" borderRadius="2xl" overflow="hidden">
        <Image
          src={coverSrc}
          alt={`${role.name} cover`}
          width="100%"
          height={{ base: "160px", md: "200px" }}
          objectFit="cover"
        />
      <Card.Body gap="4" p={{ base: 4, md: 5 }}>
        <Heading size="md">About this role</Heading>
        <Text color="fg.muted">{(role as any).longDescription ?? role.description}</Text>

        <Separator />

        <Stack gap="3">
          <Heading size="sm">Highlights</Heading>
          <Stack as="ul" gap="2" pl="4">
            <Text as="li">Flexible schedule options</Text>
            <Text as="li">Fast application review</Text>
            <Text as="li">Clear next steps after submission</Text>
          </Stack>
        </Stack>

        {role?.includeSchedule && (
          <>
            <Separator />
            <Stack gap="2">
              <Heading size="sm">Tip</Heading>
              <Text color="fg.muted">
                Selecting more availability increases your chances. You can still adjust your hours later.
              </Text>
            </Stack>
          </>
        )}

        {role?.includeLand && (
          <>
            <Separator />
            <Stack gap="2">
              <Heading size="sm">Land photos</Heading>
              <Text color="fg.muted">
                Add clear photos or maps for each land parcel so our team can verify locations quickly.
              </Text>
              <Image
                src="https://source.unsplash.com/featured/480x270?farmland"
                alt="Land example"
                width="100%"
                height="140px"
                objectFit="cover"
                borderRadius="lg"
              />
            </Stack>
          </>
        )}
      </Card.Body>
    </Card.Root>
  );
}
