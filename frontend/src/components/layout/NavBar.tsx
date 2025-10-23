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

// ✅ use your custom color-mode utilities (next-themes + Chakra)
import { useColorModeValue, ColorModeButton } from "@/components/ui/color-mode";
import logo from "/DFCPlogo.png";

export default function NavBar() {
  // use your hook instead of Chakra's
  const bg = useColorModeValue("gray.50", "gray.900");
  const border = useColorModeValue("gray.200", "gray.700");

  const mode = useSessionStore((s) => s.mode);
  const role = useSessionStore((s) => s.activeWorkerRole);
  const items = getMenuFor(mode, role);

  const { ref, isOverflowing } = useNavOverflow();
  const openDrawer = useUIStore((s) => s.openDrawer);

  return (
    <Box
      as="header"
      bg={bg}
      borderBottom="1px solid"
      borderColor={border}
      position="sticky"
      top={0}
      zIndex={100}
    >
      <Flex h="14" align="center" px="3" gap="3">
        {/* Burger appears when items overflow (or if there are none) */}
        {(isOverflowing || !items?.length) && (
          <StyledIconButton
            aria-label="Open menu"
            variant="ghost"
            onClick={openDrawer}
          >
            <FiMenu />
          </StyledIconButton>
        )}

        {/* Brand */}
        <CLink asChild _hover={{ textDecoration: "none" }}>
          <RouterLink to="/">
            <CImage
              src={logo}
              alt="Simple Market"
              height="8"
              objectFit="contain"
            />
          </RouterLink>
        </CLink>

        {/* Right cluster */}
        <Flex align="center" gap="2" ml="auto" minW={0}>
          {/* Inline menu when there is room */}
          {!isOverflowing && items?.length ? (
            <HeaderMenu items={items} containerRef={ref} />
          ) : (
            // Keep a measurable element for overflow detection even when hidden
            <Box
              ref={ref as any}
              style={{
                position: "absolute",
                left: -9999,
                visibility: "hidden",
              }}
            />
          )}

          {/* Account menu */}
          <AccountMenu />

          {/* Theme toggle (your component) */}
          <ColorModeButton />
        </Flex>
      </Flex>

      {/* Mobile / overflow drawer uses the same items registry */}
      <SideDrawer items={items} />
    </Box>
  );
}
