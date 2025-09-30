// src/components/layout/SideDrawer.tsx
import {
  Drawer,
  Portal,
  CloseButton,
  Box,
  VStack,
  Heading,
  Separator,
} from "@chakra-ui/react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { isMenuGroup, isVisible, type MenuItem, type MenuLink } from "@/types/menu";
import { useUIStore } from "@/store/ui";
import { linkIsActive } from "@/helpers/activeMatch";
import { StyledButton } from "@/components/ui/Button";

interface Props {
  items: ReadonlyArray<MenuItem>;
}

export default function SideDrawer({ items }: Props) {
  const isOpen = useUIStore((s) => s.isSideDrawerOpen);
  const closeDrawer = useUIStore((s) => s.closeDrawer);
  const location = useLocation();

  const visibleItems = items.filter((item) =>
    isVisible(item, { isAuthenticated: true, region: null })
  );

  const renderLinkBtn = (link: MenuLink) => {
    const active = linkIsActive(location.pathname, link);

    return (
      <StyledButton
        key={link.key}
        asChild
        visual={active ? "solid" : "ghost"}
        size="sm"
        w="100%"
        justifyContent="flex-start"
        fontWeight={active ? "semibold" : "normal"}  // ✅ force weight
        _hover={!active ? { bg: "gray.100", _dark: { bg: "gray.700" } } : undefined}
        onClick={closeDrawer}
        aria-current={active ? "page" : undefined}
      >
        <RouterLink to={link.path}>{link.label}</RouterLink>
      </StyledButton>
    );
  };

  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={(e) => {
        if (!e.open) closeDrawer();
      }}
      placement="start"
    >
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.Header pe="10">
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Drawer.Title>Menu</Drawer.Title>
              </Box>
            </Drawer.Header>

            <Drawer.Body>
              <VStack align="stretch" gap="4">
                {visibleItems.map((item, idx) => {
                  const isLast = idx === visibleItems.length - 1;

                  if (isMenuGroup(item)) {
                    return (
                      <Box key={item.key}>
                        <Heading as="h3" size="sm" mb="2" fontWeight="semibold">
                          {item.label}
                        </Heading>

                        <VStack align="stretch" gap="1">
                          {item.children.map(renderLinkBtn)}
                        </VStack>

                        {!isLast && <Separator my="3" />}
                      </Box>
                    );
                  }

                  return (
                    <Box key={item.key}>
                      {renderLinkBtn(item as any)}
                      {!isLast && <Separator my="3" />}
                    </Box>
                  );
                })}
              </VStack>
            </Drawer.Body>

            <Drawer.CloseTrigger asChild>
              <CloseButton size="sm" aria-label="Close menu" />
            </Drawer.CloseTrigger>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
}
