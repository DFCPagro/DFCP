// src/components/layout/HeaderMenu.tsx
import { Box, Stack, IconButton, Icon } from "@chakra-ui/react";
import { FiMenu } from "react-icons/fi";
import { NavLink, useLocation } from "react-router-dom";
import {
  isMenuGroup,
  isVisible,
  type MenuItem,
  type MenuLink,
} from "@/types/menu";
import GroupMenu from "./GroupMenu";
import { linkIsActive } from "@/helpers/activeMatch";
import { StyledButton } from "@/components/ui/Button";
import SideDrawer from "./SideDrawer";
import { useUIStore } from "@/store/ui";

interface Props {
  items: ReadonlyArray<MenuItem>;
  containerRef: React.RefObject<HTMLDivElement>;
}

export default function HeaderMenu({ items, containerRef }: Props) {
  const location = useLocation();
  const openDrawer = useUIStore((s) => s.openDrawer);
  const childActive = (link: MenuLink) => linkIsActive(location.pathname, link);

  return (
    <>
      {/* Always mount the drawer so it can open from anywhere (mobile button or AccountMenu) */}
      <SideDrawer items={items} />

      {/* Mobile: hamburger trigger */}
      <Box display={{ base: "flex", md: "none" }} alignItems="center">
        <IconButton aria-label="Open menu" variant="ghost" size="sm" onClick={openDrawer}>
          <Icon as={FiMenu} />
        </IconButton>
      </Box>

      {/* Desktop: horizontal, wrapping menu */}
      <Box display={{ base: "none", md: "block" }}>
        <Stack
          ref={containerRef as any}
          as="nav"
          direction="row"
          flexWrap="wrap"
          gap="2"
          alignItems="center"
          overflow="visible"
          whiteSpace="normal"
          minW={0}
        >
          {items.map((item) => {
            const visible = isVisible(item, { isAuthenticated: true, region: null });
            if (!visible) return null;

            if (isMenuGroup(item)) {
              const anyChildActive = item.children.some(childActive);
              return <GroupMenu key={item.key} group={item} active={anyChildActive} />;
            }

            const active = childActive(item); // item is MenuLink
            return (
              <StyledButton
                key={item.key}
                visual={active ? "solid" : "ghost"}
                size="sm"
                asChild
                sx={{ whiteSpace: "normal", maxWidth: "100%" }}
                minW={0}
              >
                <NavLink
                  to={item.path}
                  style={{ display: "inline-block", whiteSpace: "normal", maxWidth: "100%" }}
                >
                  {item.label}
                </NavLink>
              </StyledButton>
            );
          })}
        </Stack>
      </Box>
    </>
  );
}
