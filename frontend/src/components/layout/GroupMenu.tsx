import { Menu, Portal } from "@chakra-ui/react";
import {StyledButton} from "@/components/ui/Button";
import { FiChevronDown } from "react-icons/fi";
import { NavLink } from "react-router-dom";
import type { MenuGroup } from "@/types/menu";

/**
 * Inline "group" opener for wide screens (Chakra v3.25 slot API).
 * - Uses Menu.Root / Menu.Trigger / Menu.Positioner / Menu.Content / Menu.Item
 * - Uses `asChild` so NavLink is the actual clickable element
 */
export default function GroupMenu({ group }: { group: MenuGroup }) {
  return (
    <Menu.Root positioning={{ placement: "bottom-start" }}>
      <Menu.Trigger asChild>
        <StyledButton visual="ghost" aria-haspopup="menu">
          {group.label}
          {/* put the icon as a child to avoid deprecated rightIcon prop */}
          <FiChevronDown style={{ marginInlineStart: 6 }} />
        </StyledButton>
      </Menu.Trigger>

      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            {group.children.map((child) => (
              <Menu.Item key={child.key} asChild value={child.label}>
                <NavLink to={child.path}>{child.label}</NavLink>
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
