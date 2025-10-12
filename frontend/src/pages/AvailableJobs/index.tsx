"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import {
  Badge,
  Box,
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
} from "@chakra-ui/react"
import { useColorModeValue } from "@/components/ui/color-mode"
import { mockRoles } from "@/data/mockRoles"
import { meApi } from "@/api/auth"
import { useScheduleToasts } from "@/helpers/toaster"
import { Sparkles } from "lucide-react"
import { RolePreviewDialog } from "./components/RolePreviewDialog"
import type { RoleDetails } from "./components/RolePreviewDialog"

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
}

// Example static role details (can be replaced by API JSON)
const ROLE_DETAILS_MAP: Record<string, RoleDetails> = {
  deliverer: {
    name: "Deliverer",
    description:
      "Pick up packages from our hubs and deliver them safely and on-time. You’ll use our mobile app for navigation and proof-of-delivery.",
    category: "Logistics",
    location: "Multiple locations",
    shift: "Day / Evening",
    currency: "$",
    payMin: 16,
    payMax: 22,
    highlights: [
      "Mileage reimbursement or company vehicle (site-dependent).",
      "Paid training and safety-first culture.",
      "Flexible scheduling with weekend options.",
    ],
    responsibilities: [
      "Load, transport, and deliver packages to customers on assigned routes.",
      "Follow safety protocols and traffic laws.",
      "Use the app to scan parcels and capture proof-of-delivery.",
    ],
    requirements: [
      "Valid driver’s license and clean driving record.",
      "Ability to lift up to 20kg and walk stairs.",
      "Good time management and customer service.",
    ],
    faq: [
      { q: "Do I need my own car?", a: "Depends on region. Some routes use company vans; otherwise, mileage is reimbursed." },
      { q: "Dress code?", a: "Company-branded top and closed-toe shoes. Safety vest provided." },
    ],
    coverSrc: roleImages.deliverer,
  },
  picker: {
    name: "Picker",
    description:
      "Work inside the warehouse to pick items from shelves using handheld scanners and prepare orders for packing.",
    category: "Operations",
    location: "Central warehouse",
    shift: "Day / Night",
    currency: "$",
    payMin: 15,
    payMax: 20,
    highlights: ["Climate-controlled aisles", "Ergonomic equipment", "Performance bonuses"],
    responsibilities: [
      "Pick items accurately according to pick lists.",
      "Scan, sort, and stage items for packing.",
      "Maintain a clean, safe work area.",
    ],
    requirements: [
      "Comfortable standing/walking for extended periods.",
      "Basic proficiency with handheld scanners.",
      "Attention to detail and speed.",
    ],
    faq: [
      { q: "Is experience required?", a: "No, training is provided. Prior warehouse experience is a plus." },
      { q: "Is overtime available?", a: "Yes, based on daily volume and your availability." },
    ],
    coverSrc: roleImages.picker,
  },
  default: {
    name: "Open Role",
    description:
      "Learn more about this position before applying. Review the duties, requirements, and pay range below.",
    category: "General",
    location: "Various",
    shift: "Varies",
    currency: "$",
    highlights: ["On-the-job training", "Supportive team environment"],
    faq: [{ q: "How do I schedule interviews?", a: "After you apply, our team will contact you with next steps." }],
    coverSrc: roleImages.default,
  },
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function Jobs() {
  const { data: me, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: meApi,
    staleTime: 5 * 60 * 1000,
  })

  const isLoggedIn = !!me
  const navigate = useNavigate()
  const { loginRequired, applied } = useScheduleToasts()

  const roles = useMemo(() => mockRoles, [])
  const cardBg = useColorModeValue("white", "gray.800")
  const cardBorder = useColorModeValue("gray.200", "gray.700")

  // Modal state
  const [previewOpen, setPreviewOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<null | (typeof roles)[number]>(null)

  const startApply = (role: (typeof roles)[number]) => {
    setSelectedRole(role)
    setPreviewOpen(true)
  }

  const confirmApply = () => {
    if (!selectedRole) return
    setPreviewOpen(false)
    const roleName = selectedRole.name
    if (isLoggedIn) {
      applied(cap(roleName))
      navigate(`/job-application?role=${encodeURIComponent(roleName)}`)
    } else {
      loginRequired()
      navigate("/login")
    }
  }

  // Build dynamic details for the dialog from static map (or future API JSON)
  const selectedDetails: RoleDetails | null = useMemo(() => {
    if (!selectedRole) return null
    const key = selectedRole.name.toLowerCase()
    const base = ROLE_DETAILS_MAP[key] ?? ROLE_DETAILS_MAP.default
    return {
      ...base,
      // prefer the card's text if mockRoles contains more up-to-date description
      name: cap(selectedRole.name),
      description: selectedRole.description ?? base.description,
      coverSrc: base.coverSrc ?? roleImages[key] ?? roleImages.default,
    }
  }, [selectedRole])

  if (isLoading) {
    return (
      <Center minH="60vh">
        <Spinner size="lg" />
      </Center>
    )
  }

  return (
    <Box bg="bg" minH="100dvh">
      {/* Compact, centered page container (not full-width) */}
      <Box maxW="6xl" mx="auto" px={{ base: 4, md: 6 }} py={{ base: 6, md: 10 }}>
        {/* Breadcrumb */}
        <Stack>
          <Breadcrumb.Root color="fg.muted" fontSize="sm" mb={{ base: 3, md: 4 }}>
            <Breadcrumb.List>
              <BreadcrumbItem>
                <BreadcrumbLink onClick={() => navigate("/")}>Home</BreadcrumbLink>
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
            <Text color="fg.muted">Find a role that matches your skills and availability.</Text>
          </Stack>
          <Badge variant="subtle" colorPalette="gray" borderRadius="full" px="3" py="1">
            {roles.length} openings
          </Badge>
        </Stack>

        {/* Cards grid */}
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={{ base: 5, md: 6 }}>
          {roles.map((role) => {
            const coverSrc = roleImages[role.name.toLowerCase()] ?? roleImages.default
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
                  <Card.Description color="fg.muted">{role.description}</Card.Description>
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
                    <Badge variant="solid" colorPalette="green" borderRadius="full">
                      Recruiting
                    </Badge>
                    <Badge variant="subtle" colorPalette="gray" borderRadius="full">
                      {cap("general")}
                    </Badge>
                    <VisuallyHidden>Role status and category</VisuallyHidden>
                  </Stack>

                  <Button
                    onClick={() => startApply(role)}
                    colorPalette="blue"
                    borderRadius="xl"
                  >
                    View and Apply
                  </Button>
                </Card.Footer>
              </Card.Root>
            )
          })}
        </SimpleGrid>
      </Box>

      {/* Role preview / confirmation dialog (dynamic details) */}
      <RolePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        details={selectedDetails}
        onConfirm={confirmApply}
      />
    </Box>
  )
}
