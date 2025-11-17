// frontend/src/components/layout/HeaderMenu.tsx
import React, { useCallback, useLayoutEffect, useRef, type MutableRefObject, type Ref } from "react";
import { Box, Stack, IconButton, Icon } from "@chakra-ui/react";
import { FiMenu } from "react-icons/fi";
import { NavLink, useLocation } from "react-router-dom";
import { isMenuGroup, isVisible, type MenuItem, type MenuLink } from "@/types/menu";
import GroupMenu from "./GroupMenu";
import { linkIsActive } from "@/helpers/activeMatch";
import { StyledButton } from "@/components/ui/Button";
import { useUIStore } from "@/store/ui";

interface Props {
  items: ReadonlyArray<MenuItem>;
  containerRef?: Ref<HTMLDivElement> | null;
  registerItem?: (key: string) => (el: HTMLElement | null) => void;
  role?: "admin" | string;
}

/** Detect horizontal overflow of a single-line nav container. */
function useOverflow(container: React.RefObject<HTMLElement>): boolean {
  const [isOverflowing, setIsOverflowing] = React.useState(false);

  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;

    const check = () => setIsOverflowing(el.scrollWidth > el.clientWidth);

    check();

    const ro = new ResizeObserver(() => check());
    ro.observe(el);

    // Why: children size changes also affect overflow.
    Array.from(el.children).forEach((child) => {
      try {
        ro.observe(child as Element);
      } catch {
        /* noop */
      }
    });

    return () => ro.disconnect();
  }, [container]);

  return isOverflowing;
}

export default function HeaderMenu({
  items,
  containerRef,
  registerItem,
  role,
}: Props) {
  const location = useLocation();
  const openDrawer = useUIStore((s) => s.openDrawer);

  const localRef = useRef<HTMLDivElement | null>(null);
  const isOverflowing = useOverflow(localRef);
  const showHamburger = role === "admin";

  // Single callback ref that updates both localRef and optional external ref.
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      localRef.current = node;
      if (!containerRef) return;

      if (typeof containerRef === "function") {
        containerRef(node);
      } else {
        // containerRef is a RefObject
        (containerRef as MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [containerRef]
  );

  const childActive = (link: MenuLink) => linkIsActive(location.pathname, link);

  return (
    <>
      {showHamburger && (
        <Box display={{ base: "flex", md: "none" }} alignItems="center">
          <IconButton aria-label="Open menu" variant="ghost" size="sm" onClick={openDrawer}>
            <Icon as={FiMenu} />
          </IconButton>
        </Box>
      )}

      {(role === "admin" || !isOverflowing) && (
        <Box display={{ base: "none", md: "block" }} w="full">
          <Stack
            ref={setRefs}
            as="nav"
            direction="row"
            flexWrap="nowrap"
            gap="2"
            alignItems="center"
            overflow="hidden"
            whiteSpace="nowrap"
            minW={0}
            w="full"
            lineHeight={1}
          >
            {items.map((item) => {
              const visible = isVisible(item, { isAuthenticated: true, region: null });
              if (!visible) return null;

              if (isMenuGroup(item)) {
                const anyChildActive = item.children.some(childActive);
                return (
                  <Box
                    key={item.key}
                    ref={registerItem ? registerItem(item.key) : undefined}
                    data-overflow-item=""
                    flex="0 0 auto"
                    minW={0}
                  >
                    <GroupMenu group={item} active={anyChildActive} />
                  </Box>
                );
              }

              const link = item as MenuLink;
              const active = childActive(link);

              return (
                <Box
                  key={link.key}
                  ref={registerItem ? registerItem(link.key) : undefined}
                  data-overflow-item=""
                  flex="0 0 auto"
                  minW={0}
                  maxW="240px"
                >
                  <StyledButton visual={active ? "solid" : "ghost"} size="sm" asChild minW={0} w="full">
                    <NavLink
                      to={link.path}
                      style={{
                        display: "inline-block",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "100%",
                        verticalAlign: "middle",
                      }}
                    >
                      {link.label}
                    </NavLink>
                  </StyledButton>
                </Box>
              );
            })}
          </Stack>
        </Box>
      )}
    </>
  );
}
