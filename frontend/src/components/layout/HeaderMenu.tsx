import React from "react";
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
  /** Optional: only needed when this instance is the overflow probe. */
  containerRef?: React.Ref<HTMLDivElement> | null;
  /** Optional per-item ref from useNavOverflowSplit. */
  registerItem?: (key: string) => (el: HTMLElement | null) => void;
}

export default function HeaderMenu({ items, containerRef, registerItem }: Props) {
  const location = useLocation();
  const openDrawer = useUIStore((s) => s.openDrawer);
  const childActive = (link: MenuLink) => linkIsActive(location.pathname, link);

  return (
    <>
      <Box display={{ base: "flex", md: "none" }} alignItems="center">
        <IconButton aria-label="Open menu" variant="ghost" size="sm" onClick={openDrawer}>
          <Icon as={FiMenu} />
        </IconButton>
      </Box>

      <Box display={{ base: "none", md: "block" }} w="full">
        <Stack
          ref={containerRef ?? undefined}
          as="nav"
          direction="row"
          flexWrap="wrap"
          gap="2"
          alignItems="center"
          overflow="visible"
          whiteSpace="nowrap"     // enforce single-line items
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
                  flex="0 0 auto"   // item treated as a single unit
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
                maxW="240px"       // prevent ultra-wide labels from breaking layout
              >
                <StyledButton
                  visual={active ? "solid" : "ghost"}
                  size="sm"
                  asChild
                  minW={0}
                  w="full"
                >
                  <NavLink
                    to={link.path}
                    style={{
                      display: "inline-block",
                      whiteSpace: "nowrap",     // no internal wrapping
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
    </>
  );
}
