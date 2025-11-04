// src/components/layout/NavBar.tsx
import { Box, Flex, Link as CLink, Image as CImage } from "@chakra-ui/react";
import { StyledIconButton } from "@/components/ui/IconButton";
import { FiMenu } from "react-icons/fi";
import { Link as RouterLink } from "react-router-dom";

import { useNavOverflow } from "@/hooks/useNavOverflow";
import { useSessionStore } from "@/store/session";
import { useUIStore } from "@/store/ui";
import { getMenuFor } from "@/config/menu.config";

import HeaderMenu from "./HeaderMenu";
import SideDrawer from "./SideDrawer";
import AccountMenu from "./AccountMenu";
import { useColorModeValue, ColorModeButton } from "@/components/ui/color-mode";
import logo from "/DFCPlogo.png";

export default function NavBar() {
  const bg = useColorModeValue("gray.50", "gray.900");
  const border = useColorModeValue("gray.200", "gray.700");

  const mode = useSessionStore((s) => s.mode);
  const role = useSessionStore((s) => s.activeWorkerRole);
  const items = getMenuFor(mode, role);

 const { setRef, isOverflowing } = useNavOverflow({ collapseSlack: 0, expandSlack: 12, stableFrames: 1 });
  const openDrawer = useUIStore((s) => s.openDrawer);
  const showDesktopBurger = isOverflowing || !items?.length;

  return (
    <Box as="header" bg={bg} borderBottom="1px solid" borderColor={border} position="sticky" top={0} zIndex={100}>
      <Flex h="14" align="center" px="3" gap="3">
        {showDesktopBurger && (
          <Box display={{ base: "none", md: "block" }}>
            <StyledIconButton aria-label="Open menu" variant="ghost" onClick={openDrawer}>
              <FiMenu />
            </StyledIconButton>
          </Box>
        )}

        <CLink asChild _hover={{ textDecoration: "none" }}>
          <RouterLink to="/"><CImage src={logo} alt="DFCP" h="8" objectFit="contain" /></RouterLink>
        </CLink>

        {/* Right cluster */}
<Flex align="center" gap="2" ml="auto" minW={0} flex="1" position="relative">
          {/* Visible inline menu only when it fits */}
  {!isOverflowing && items?.length ? <HeaderMenu items={items} /> : null}

          {/* Probe: always mounted, hidden, measured. Must render the SAME structure as the real menu. */}
          <Box
    position="absolute"
    left={0}
    right={0}
    top={0}
    visibility="hidden"
    pointerEvents="none"
    aria-hidden="true"
  >
    <HeaderMenu items={items} containerRef={setRef} />
  </Box>
          <AccountMenu />
          <ColorModeButton />
        </Flex>
      </Flex>

      <SideDrawer items={items} />
    </Box>
  );
}
