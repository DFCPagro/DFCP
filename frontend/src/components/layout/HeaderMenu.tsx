// src/components/layout/HeaderMenu.tsx
import { Stack } from "@chakra-ui/react";
import { NavLink, useLocation } from "react-router-dom";
import { isMenuGroup, isVisible, type MenuItem, type MenuLink } from "@/types/menu";
import GroupMenu from "./GroupMenu";
import { linkIsActive } from "@/helpers/activeMatch";
import { StyledButton } from "@/components/ui/Button";

interface Props {
  items: ReadonlyArray<MenuItem>;
  containerRef: React.RefObject<HTMLDivElement>;
}

export default function HeaderMenu({ items, containerRef }: Props) {
  const location = useLocation();
  const childActive = (link: MenuLink) => linkIsActive(location.pathname, link);

  return (
    <Stack
      ref={containerRef as any}
      as="nav"
      direction="row"
      gap="1"
      alignItems="center"
      overflow="hidden"
      whiteSpace="nowrap"
    >
      {items.map((item) => {
        const visible = isVisible(item, { isAuthenticated: true, region: null });
        if (!visible) return null;

        if (isMenuGroup(item)) {
          const anyChildActive = item.children.some(childActive);
          return <GroupMenu key={item.key} group={item} active={anyChildActive} />;
        }

        const isActive = childActive(item); // item is MenuLink
        return (
          <StyledButton
            key={item.key}
            visual={isActive ? "solid" : "ghost"}
            size="sm"
            asChild
          >
            <NavLink to={item.path}>{item.label}</NavLink>
          </StyledButton>
        );
      })}
    </Stack>
  );
}
