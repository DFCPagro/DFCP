import {
  Box,
  Flex,
  Stack,
  SimpleGrid,
  Image,
  Text,
  Link as CLink,
  Icon,
  Input,
  Button,
  Separator,
  HStack,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import {
  FiTwitter,
  FiGithub,
  FiLinkedin,
  FiMail,
  FiPhone,
} from "react-icons/fi";
import { useColorModeValue } from "@/components/ui/color-mode";
import Logo from "/DFCPlogo.png";

type LinkItem = { label: string; to: string };

const productLinks: LinkItem[] = [
  { label: "Features", to: "/features" },
  { label: "Pricing", to: "/pricing" },
  { label: "Marketplace", to: "/marketplace" },
  { label: "New Arrivals", to: "/new" },
];

const companyLinks: LinkItem[] = [
  { label: "About", to: "/about" },
  { label: "Careers", to: "/careers" },
  { label: "Blog", to: "/blog" },
  { label: "Press", to: "/press" },
];

const resourcesLinks: LinkItem[] = [
  { label: "Docs", to: "/docs" },
  { label: "Guides", to: "/guides" },
  { label: "Support", to: "/support" },
  { label: "Status", to: "/status" },
];

const legalLinks: LinkItem[] = [
  { label: "Privacy", to: "/legal/privacy" },
  { label: "Terms", to: "/legal/terms" },
  { label: "Cookies", to: "/legal/cookies" },
  { label: "Licenses", to: "/legal/licenses" },
];

function LinkColumn({ title, links }: { title: string; links: LinkItem[] }) {
  return (
    <Stack gap="3" minW={0}>
      <Text
        fontWeight="semibold"
        fontSize="sm"
        color="gray.600"
        _dark={{ color: "gray.300" }}
      >
        {title}
      </Text>
      <Stack as="nav" gap="2">
        {links.map((l) => (
          <CLink
            key={l.to}
            asChild
            color="gray.700"
            _dark={{ color: "gray.200" }}
            _hover={{ color: "primary.600", _dark: { color: "primary.300" } }}
            lineHeight="1.6"
          >
            <RouterLink to={l.to}>{l.label}</RouterLink>
          </CLink>
        ))}
      </Stack>
    </Stack>
  );
}

export default function Footer() {
  const bg = useColorModeValue("gray.50", "gray.900");
  const border = useColorModeValue("gray.200", "gray.700");
  const subtext = useColorModeValue("gray.600", "gray.400");

  return (
    <Box
      as="footer"
      zIndex={10}
      // bg="transparent"
      bg={bg}
      borderTop="1px solid"
      borderColor={border}
      mt="10"
    >
      <Box
        maxW="7xl"
        mx="auto"
        px={{ base: "4", md: "6" }}
        py={{ base: "8", md: "12" }}
      >
        {/* Top area */}
        <SimpleGrid
          columns={{ base: 1, sm: 2, md: 4 }}
          gap={{ base: "8", md: "10" }}
        >
          <Stack gap="4">
            <CLink
              asChild
              fontWeight="bold"
              fontSize="lg"
              _hover={{ textDecoration: "none" }}
            >
              <RouterLink to="/">
                <Image
                  src={Logo}
                  alt="DFCP Logo"
                  height="8"
                  objectFit="contain"
                />
              </RouterLink>
            </CLink>

            <Text fontSize="sm" color={subtext}>
              Buy and sell with confidence. Curated products, transparent
              pricing, and delightful UX.
            </Text>

            {/* Contact info */}
            <Stack gap="2" mt="2">
              <HStack gap="2" color={subtext}>
                <Icon as={FiPhone} />
                <Text fontSize="sm">+1 (555) 123-4567</Text>
              </HStack>
              <HStack gap="2" color={subtext}>
                <Icon as={FiMail} />
                <Text fontSize="sm">support@DFCP.com</Text>
              </HStack>
            </Stack>

            {/* Newsletter */}
            <Stack gap="2" mt="4">
              <Text
                fontSize="sm"
                fontWeight="semibold"
                color="gray.600"
                _dark={{ color: "gray.300" }}
              >
                Stay in the loop
              </Text>
              <Flex
                as="form"
                gap="2"
                onSubmit={(e) => e.preventDefault()}
                maxW={{ base: "full", sm: "xs" }}
              >
                <Input
                  type="email"
                  placeholder="you@example.com"
                  aria-label="Email for newsletter"
                />
                <Button type="submit" colorPalette="primary">
                  Subscribe
                </Button>
              </Flex>
              <Text fontSize="xs" color={subtext}>
                We'll never spam. Unsubscribe at any time.
              </Text>
            </Stack>
          </Stack>

          <LinkColumn title="Product" links={productLinks} />
          <LinkColumn title="Company" links={companyLinks} />
          <LinkColumn title="Resources" links={resourcesLinks} />

          {/* On md: 4 columns; when more space, show legal alongside resources */}
          <Box display={{ base: "none", md: "block" }}>
            <LinkColumn title="Legal" links={legalLinks} />
          </Box>
        </SimpleGrid>

        {/* Legal on small screens */}
        <Box display={{ base: "block", md: "none" }} mt="8">
          <Separator my="4" />
          <LinkColumn title="Legal" links={legalLinks} />
        </Box>

        {/* Bottom bar */}
        <Separator my={{ base: "6", md: "10" }} />
        <Flex
          direction={{ base: "column", md: "row" }}
          align={{ base: "flex-start", md: "center" }}
          gap="4"
        >
          <Text fontSize="sm" color={subtext}>
            © {new Date().getFullYear()} DFCP. All rights reserved.
          </Text>

          <Stack direction="row" gap="3" ml={{ md: "auto" }}>
            <CLink
              asChild
              aria-label="Twitter"
              _hover={{ color: "primary.600", _dark: { color: "primary.300" } }}
            >
              <RouterLink to="https://twitter.com">
                <Icon as={FiTwitter} fontSize="lg" />
              </RouterLink>
            </CLink>
            <CLink
              asChild
              aria-label="GitHub"
              _hover={{ color: "primary.600", _dark: { color: "primary.300" } }}
            >
              <RouterLink to="https://github.com">
                <Icon as={FiGithub} fontSize="lg" />
              </RouterLink>
            </CLink>
            <CLink
              asChild
              aria-label="LinkedIn"
              _hover={{ color: "primary.600", _dark: { color: "primary.300" } }}
            >
              <RouterLink to="https://www.linkedin.com">
                <Icon as={FiLinkedin} fontSize="lg" />
              </RouterLink>
            </CLink>
          </Stack>
        </Flex>
      </Box>
    </Box>
  );
}
