// src/components/layout/GroupMenu.tsx
import { Menu, Portal } from "@chakra-ui/react";
import { FiChevronDown } from "react-icons/fi";
import { NavLink, useLocation } from "react-router-dom";
import type { MenuGroup } from "@/types/menu";
import { StyledButton } from "@/components/ui/Button";
import { linkIsActive } from "@/helpers/activeMatch";

export default function GroupMenu({ group, active }: { group: MenuGroup; active?: boolean }) {
  const location = useLocation();

  return (
    <Menu.Root positioning={{ placement: "bottom-start" }}>
      <Menu.Trigger asChild>
        <StyledButton
          visual={active ? "solid" : "ghost"}
          size="sm"
          aria-haspopup="menu"
        >
          {group.label}
          <FiChevronDown style={{ marginInlineStart: 6 }} />
        </StyledButton>
      </Menu.Trigger>

      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            {group.children.map((child) => {
              const childActive = linkIsActive(location.pathname, child);

              // IMPORTANT: Menu.Item `asChild` -> we hand it our StyledButton
              // StyledButton `asChild` -> renders the NavLink as the actual element
              return (
                <Menu.Item key={child.key} asChild value={child.label}>
                  <StyledButton
                    asChild
                    visual={childActive ? "solid" : "ghost"}  // ✅ same solid background as header
                    size="sm"
                    w="100%"
                    justifyContent="flex-start"
                  >
                    <NavLink to={child.path} aria-current={childActive ? "page" : undefined}>
                      {child.label}
                    </NavLink>
                  </StyledButton>
                </Menu.Item>
              );
            })}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
