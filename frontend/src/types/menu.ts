/**
 * Menu type system for the header/navigation.
 *
 * Goals:
 * - Strong typing for menu config (links vs. grouped links).
 * - Future-proof (optional visibility predicates).
 * - UI-agnostic: no Chakra/React imports here.
 *
 * Notes:
 * - `key` MUST be unique across the entire registry (used for open/close state).
 * - Keep labels short; groups become section titles in the side drawer.
 */

export type Mode = "noUser" |"customer" | "work";

/**
 * Known roles you support today. You can extend beyond these at runtime,
 * so the config uses a flexible map for `work`.
 */
export const KNOWN_WORK_ROLES = ["farmer", "admin", "deliverer", "industrialDeliverer", "picker"] as const;
export type KnownWorkRole = (typeof KNOWN_WORK_ROLES)[number];

/**
 * Context you can pass to visibility predicates (if/when you need them).
 * Keep this minimal to avoid unnecessary re-renders in the header.
 */
export interface MenuContext {
  isAuthenticated: boolean;
  region?: string | null;
}

/** Base shared properties for both links and groups. */
export interface BaseMenuEntry {
  /** Unique, stable key (no spaces). */
  key: string;
  /** Human-readable label. */
  label: string;
  /**
   * Optional icon identifier. UI layer can map this to an actual icon component.
   * (Kept as string to avoid coupling to any icon library here.)
   */
  iconId?: string;
  /**
   * Visibility control; if function, it receives minimal context.
   * Defaults to true if omitted.
   */
  visible?: boolean | ((ctx: MenuContext) => boolean);
}

/** A single navigable link. */
export interface MenuLink extends BaseMenuEntry {
  type: "link";
  /** In-app route or external URL. */
  path: string;
  /** Mark as external (used by UI for aria/rel). */
  external?: boolean;
  /** Open in new tab (only meaningful if external === true). */
  newTab?: boolean;
  /** If true, UI can mark active only on exact match. */
  exact?: boolean;
}

/** A group that expands to reveal a set of links. */
export interface MenuGroup extends BaseMenuEntry {
  type: "group";
  /** Child links shown in a popover (wide) or as a section in the side drawer (narrow). */
  children: ReadonlyArray<MenuLink>;
}

/** Union type for any menu item. */
export type MenuItem = MenuLink | MenuGroup;

export type NoUserMenu = ReadonlyArray<MenuItem>;
/** Top-level customer menu. */
export type CustomerMenu = ReadonlyArray<MenuItem>;

/**
 * Work menus keyed by role. Flexible Record<string, …> allows adding new roles
 * without changing this type file.
 */
export type WorkMenuMap = Readonly<Record<string, ReadonlyArray<MenuItem>>>;

/** Entire registry. */
export interface MenuRegistry {
  noUser: NoUserMenu;
  customer: CustomerMenu;
  work: WorkMenuMap;
}

/* ------------------------ Type Guards (helpers) ------------------------ */

export const isMenuGroup = (item: MenuItem): item is MenuGroup =>
  item.type === "group";

export const isMenuLink = (item: MenuItem): item is MenuLink =>
  item.type === "link";

/* ------------------------ Utility helpers (optional) ------------------------ */

/**
 * Evaluate `visible` predicates, returning a boolean.
 * UI layer can use this before rendering an item.
 */
export function isVisible(item: MenuItem, ctx: MenuContext): boolean {
  const v = item.visible;
  if (typeof v === "function") return v(ctx);
  if (typeof v === "boolean") return v;
  return true;
}
