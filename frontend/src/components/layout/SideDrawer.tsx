// src/components/layout/SideDrawer.tsx
import {
  Drawer,
  Portal,
  CloseButton,
  Box,
  VStack,
  Text,
  Heading,
  Link as CLink,
  Separator, // ✅ v3 replacement for Divider/StackDivider
} from "@chakra-ui/react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { isMenuGroup, isVisible, type MenuItem } from "@/types/menu";
import ModeBadge from "./ModeBadge";
import { useUIStore } from "@/store/ui";

interface Props {
  items: ReadonlyArray<MenuItem>;
}

/**
 * Side drawer (Chakra v3.25 slot API)
 * - Groups render as section titles with child links
 * - Flat links render as list items
 * - Uses Drawer.CloseTrigger + CloseButton
 * - Uses Separator (v3) for visual separation
 */
export default function SideDrawer({ items }: Props) {
  const isOpen = useUIStore((s) => s.isSideDrawerOpen);
  const closeDrawer = useUIStore((s) => s.closeDrawer);
  const location = useLocation();

  const visibleItems = items.filter((item) =>
    isVisible(item, { isAuthenticated: true, region: null })
  );

  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={(e) => {
        if (!e.open) closeDrawer();
      }}
      placement="start" // start | end | top | bottom
    >
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.Header pe="10">
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Drawer.Title>Menu</Drawer.Title>
                <ModeBadge />
              </Box>
            </Drawer.Header>

            <Drawer.Body>
              <VStack align="stretch" gap="4">
                {visibleItems.map((item, idx) => {
                  const isLast = idx === visibleItems.length - 1;

                  if (isMenuGroup(item)) {
                    return (
                      <Box key={item.key}>
                        <Heading as="h3" size="sm" mb="2">
                          {item.label}
                        </Heading>

                        <VStack align="stretch" gap="1" pl="2">
                          {item.children.map((child) => {
                            const active = child.exact
                              ? location.pathname === child.path
                              : location.pathname.startsWith(child.path);

                            return (
                              <CLink
                                key={child.key}
                                asChild
                                fontWeight={active ? "semibold" : "normal"}
                                onClick={closeDrawer}
                              >
                                <RouterLink to={child.path}>{child.label}</RouterLink>
                              </CLink>
                            );
                          })}
                        </VStack>

                        {/* v3: use Separator for section breaks */}
                        {!isLast && <Separator my="3" />}
                      </Box>
                    );
                  }

                  // Flat link
                  const active = item.exact
                    ? location.pathname === item.path
                    : location.pathname.startsWith(item.path);

                  return (
                    <Box key={item.key}>
                      <CLink
                        asChild
                        fontWeight={active ? "semibold" : "normal"}
                        onClick={closeDrawer}
                      >
                        <RouterLink to={item.path}>{item.label}</RouterLink>
                      </CLink>

                      {!isLast && <Separator my="3" />}
                    </Box>
                  );
                })}
              </VStack>
            </Drawer.Body>

            {/* v3 close trigger */}
            <Drawer.CloseTrigger asChild>
              <CloseButton size="sm" aria-label="Close menu" />
            </Drawer.CloseTrigger>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
}
