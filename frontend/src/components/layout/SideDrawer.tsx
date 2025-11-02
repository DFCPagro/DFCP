  // src/components/layout/SideDrawer.tsx
  import {
    Drawer,
    Portal,
    CloseButton,
    Box,
    VStack,
    Heading,
    Separator,
    Accordion,
  } from "@chakra-ui/react";
  import { Link as RouterLink, useLocation } from "react-router-dom";
  import { isMenuGroup, isVisible, type MenuItem, type MenuLink } from "@/types/menu";
  import { useUIStore } from "@/store/ui";
  import { StyledButton } from "@/components/ui/Button";
  import { linkIsActive } from "@/helpers/activeMatch";
  import { useEffect, useMemo, useRef, useState } from "react";

  interface Props {
    items: ReadonlyArray<MenuItem>;
  }

  /** Premium side drawer with Accordion groups, auto-open active group, and scroll-to-active. */
  export default function SideDrawer({ items }: Props) {
    const isOpen = useUIStore((s) => s.isSideDrawerOpen);
    const closeDrawer = useUIStore((s) => s.closeDrawer);
    const location = useLocation();

    // 1) Filter visible once
    const visibleItems = useMemo(
      () => items.filter((item) => isVisible(item, { isAuthenticated: true, region: null })),
      [items]
    );

    // 2) Compute groups that contain the active route
    const activeGroupKeys = useMemo(() => {
      return visibleItems
        .filter(isMenuGroup)
        .filter((grp) => grp.children.some((c) => linkIsActive(location.pathname, c)))
        .map((g) => g.key);
    }, [visibleItems, location.pathname]);

    // 3) Controlled expanded groups (auto-open active when drawer opens)
    const [expanded, setExpanded] = useState<string[]>([]);
    useEffect(() => {
      if (isOpen) {
        setExpanded((prev) => (prev.length ? prev : activeGroupKeys));
      }
    }, [isOpen, activeGroupKeys]);

    // 4) Smooth scroll to active child
    const activeChildRef = useRef<HTMLButtonElement | null>(null);
    useEffect(() => {
      if (!isOpen) return;
      requestAnimationFrame(() => {
        activeChildRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    }, [isOpen, location.pathname]);

    // Render a single link as full-width StyledButton with correct active/inactive styles
    const renderLinkBtn = (link: MenuLink, insideAccordion?: boolean) => {
      const active = linkIsActive(location.pathname, link);
      const ref = active ? activeChildRef : undefined;

      return (
        <StyledButton
          key={link.key}
          ref={ref as any}
          asChild
          visual={active ? "solid" : "ghost"}
          size="sm"
          w="100%"
          justifyContent="flex-start"
          fontWeight={active ? "semibold" : "normal"} // force normal for inactive
          _hover={!active ? { bg: "gray.100", _dark: { bg: "gray.700" } } : undefined}
          onClick={closeDrawer}
          aria-current={active ? "page" : undefined}
          _focusVisible={{ boxShadow: "outline" }}
          mt={insideAccordion ? 1 : 0}
        >
          <RouterLink to={link.path}>{link.label}</RouterLink>
        </StyledButton>
      );
    };  

    return (
      <Drawer.Root
        open={isOpen}
        onOpenChange={(e) => {
          if (!e.open) {
            setExpanded([]); // reset so next open can auto expand active group
            closeDrawer();
          }
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
                  {/* Flat links (non-group) first, if any */}
                  {visibleItems
                    .filter((it) => !isMenuGroup(it))
                    .map((it, idx, arr) => (
                      <Box key={it.key}>
                        {renderLinkBtn(it as any)}
                        {idx !== arr.length - 1 && <Separator my="3" />}
                      </Box>
                    ))}

                  {/* Grouped sections as Accordion */}
                  <Accordion.Root
                    multiple
                    collapsible
                    value={expanded}
                    onValueChange={(e: { value: string[] }) => setExpanded(e?.value ?? [])}
                  >
                    {visibleItems.filter(isMenuGroup).map((group, gIdx, gArr) => {
                      // OPTIONAL: tint group header when any child is active
                      const isActiveGroup = activeGroupKeys.includes(group.key);

                      return (
                        <Accordion.Item key={group.key} value={group.key}>
                          <Accordion.ItemTrigger asChild>
                            <StyledButton
                              visual="ghost"
                              size="sm"
                              w="100%"
                              justifyContent="space-between"
                              fontWeight="semibold"
                              color={isActiveGroup ? "brand.600" : undefined}
                              _hover={{ bg: "gray.100", _dark: { bg: "gray.800" } }}
                            >
                              {group.label}
                              <Accordion.ItemIndicator />
                            </StyledButton>
                          </Accordion.ItemTrigger>

                          {/* Light motion via a Box wrapper (since ItemContent has no `sx` prop) */}
                          <Accordion.ItemContent>
                            <Box
                              overflow="hidden"
                              transition="height 180ms ease, opacity 180ms ease"
                              _closed={{ opacity: 0.8 }} // NOTE: purely visual, does not affect state
                            >
                              <Accordion.ItemBody>
                                <VStack align="stretch" gap="0" ps="1" pt="2">
                                  {group.children.map((child) => renderLinkBtn(child, true))}
                                </VStack>
                              </Accordion.ItemBody>
                            </Box>
                          </Accordion.ItemContent>

                          {gIdx !== gArr.length - 1 && <Separator my="3" />}
                        </Accordion.Item>
                      );
                    })}
                  </Accordion.Root>
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
