// src/components/layout/HeaderMenu.tsx
import { Stack, Button } from "@chakra-ui/react";
import { NavLink, useLocation } from "react-router-dom";
import { isMenuGroup, isVisible, type MenuItem } from "@/types/menu";
import GroupMenu from "./GroupMenu";

interface Props {
  items: ReadonlyArray<MenuItem>;
  containerRef: React.RefObject<HTMLDivElement>;
}

/**
 * Renders inline (wide-screen) nav items.
 * - Links render as Button with `asChild` (Chakra v3.25)
 * - Groups render via <GroupMenu> (v3 slot API)
 */
export default function HeaderMenu({ items, containerRef }: Props) {
  const location = useLocation();

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
        const visible = isVisible(item, {
          isAuthenticated: true,
          region: null,
        });
        if (!visible) return null;

        if (isMenuGroup(item)) {
          return <GroupMenu key={item.key} group={item} />;
        }

        const isActive = item.exact
          ? location.pathname === item.path
          : location.pathname.startsWith(item.path);

        return (
          <Button
            key={item.key}
            variant={isActive ? "solid" : "ghost"}
            size="sm"
            asChild
          >
            <NavLink to={item.path}>{item.label}</NavLink>
          </Button>
        );
      })}
    </Stack>
  );
}
