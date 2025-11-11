import {
  createSystem,
  defineConfig,
  defineTokens,
  defaultConfig,
  defineSemanticTokens,
} from "@chakra-ui/react"
import { buttonRecipe } from "./button.recipe"

/**
 * GAME THEME — GREEN NEON VARIANT (+ Animations)
 * ------------------------------------------------------------------
 * • Primary hue: emerald / teal
 * • Secondary accent: lime-neon
 * • Adds global motion tokens, keyframes, and polished transitions
 * • Respects prefers-reduced-motion
 */

const tokens = defineTokens({
  /* ---- Colors (from your original theme) ---- */
  colors: {
    brand: {
      50: { value: "#e6fff8" },
      100: { value: "#b2fce2" },
      200: { value: "#81f7cd" },
      300: { value: "#4eeeb3" },
      400: { value: "#22dd99" },
      500: { value: "#10b981" },
      600: { value: "#059669" },
      700: { value: "#047857" },
      800: { value: "#065f46" },
      900: { value: "#064e3b" },
    },
    lime: {
      400: { value: "#bef264" },
      500: { value: "#a3e635" },
      600: { value: "#84cc16" },
    },
    ink: {
      50: { value: "#f8fafc" },
      100: { value: "#f1f5f9" },
      200: { value: "#e2e8f0" },
      300: { value: "#cbd5e1" },
      400: { value: "#94a3b8" },
      500: { value: "#64748b" },
      600: { value: "#475569" },
      700: { value: "#334155" },
      800: { value: "#1e293b" },
      900: { value: "#0a1118" },
    },
  },

  /* ---- Motion & effects tokens (new) ---- */
  easings: {
    productive: { value: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
    entrance: { value: "cubic-bezier(0.16, 1, 0.3, 1)" },
    exit: { value: "cubic-bezier(0.7, 0, 0.84, 0)" },
  },
  durations: {
    faster: { value: "75ms" },
    fast: { value: "150ms" },
    normal: { value: "200ms" },
    slow: { value: "300ms" },
    slower: { value: "450ms" },
  },
  blurs: {
    lg: { value: "12px" },
    xl: { value: "18px" },
  },
  radii: {
    xl: { value: "16px" },
    "2xl": { value: "24px" },
  },
})

const semanticTokens = defineSemanticTokens({
  colors: {
    /* Base surfaces */
    background: { value: { _light: "#f9f9f9", _dark: "#0a1118" } },
    text: { value: { _light: "#1a202c", _dark: "#d1fae5" } },
    heading: { value: { _light: "#0f172a", _dark: "#ecfdf5" } },
    muted: { value: { _light: "#718096", _dark: "#6ee7b7" } },
    border: { value: { _light: "#e2e8f0", _dark: "#14532d" } },

    /* Greenish game backdrop */
    gameGlow1: { value: { _light: "#a7f3d0", _dark: "#065f46" } },
    gameGlow2: { value: { _light: "#6ee7b7", _dark: "#0f172a" } },

    /* Canvas frame & grid lines */
    gameGridLine: { value: { _light: "rgba(0,0,0,.05)", _dark: "rgba(255,255,255,.06)" } },
    gameCanvasBorder: { value: { _light: "#bbf7d0", _dark: "#134e4a" } },
    gameCanvasShadow: {
      value: {
        _light: "0 20px 80px rgba(0,0,0,.1), inset 0 0 0 1px rgba(0,0,0,.05)",
        _dark: "0 20px 80px rgba(0,255,179,.4), inset 0 0 0 1px rgba(0,255,179,.1)",
      },
    },

    /* Zone panels (sections) */
    gamePanelTop: { value: { _light: "#bbf7d0", _dark: "#062c26" } },
    gamePanelBottom: { value: { _light: "#86efac", _dark: "#022c22" } },
    gamePanelBorder: { value: { _light: "#4ade80", _dark: "#065f46" } },
    gamePanelShadow: {
      value: {
        _light: "0 8px 30px rgba(0,0,0,.1)",
        _dark: "0 8px 30px rgba(0,255,179,.15), inset 0 0 0 1px rgba(0,255,179,.05)",
      },
    },

    /* Text and glow elements */
    gameZoneTitle: { value: { _light: "#065f46", _dark: "#6ee7b7" } },
    gameAisle: { value: { _light: "#166534", _dark: "#bbf7d0" } },

    /* Cells & shelves */
    gameCellBg: { value: { _light: "#f0fdf4", _dark: "#0a1b15" } },
    gameCellBorder: { value: { _light: "#a7f3d0", _dark: "#0d372e" } },
    gameShelfFrame: { value: { _light: "#065f46", _dark: "#6ee7b7" } },
    gameShelfSlot: { value: { _light: "#059669", _dark: "#34d399" } },
    gameCode: { value: { _light: "#065f46", _dark: "#a7f3d0" } },
  },
})

const globalCss = {
  /* ---- Base from your theme ---- */
  body: {
    bg: "background",
    color: "text",
    fontFamily: "Inter, system-ui, sans-serif",
    lineHeight: "base",
    transitionProperty:
      "background-color, border-color, color, fill, stroke, opacity, box-shadow, transform, filter",
    transitionTimingFunction: "var(--ease-productive)",
    transitionDuration: "var(--dur-fast)",
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
  },
  "*": { boxSizing: "border-box" },
  a: { color: "brand.500", _hover: { textDecoration: "underline" } },
  h1: { color: "heading", fontSize: "4xl", fontWeight: "bold" },
  p: { color: "text", fontSize: "md", lineHeight: "tall" },

  /* ---- Global transitions everywhere ---- */
  "*, *::before, *::after": {
    transitionProperty:
      "background-color, border-color, color, fill, stroke, opacity, box-shadow, transform, filter, outline-color, outline-offset",
    transitionTimingFunction: "var(--ease-productive)",
    transitionDuration: "var(--dur-fast)",
  },

  /* ---- Opt-out: no-anim utility ---- */
  ".no-anim, .no-anim *, [data-no-anim], [data-no-anim] *": {
    transition: "none !important",
    animation: "none !important",
    willChange: "auto !important",
  },
  ".no-anim [data-inview]": {
    animation: "none !important",
  },

  /* ---- Reduced motion ---- */
  "@media (prefers-reduced-motion: reduce)": {
    "*, *::before, *::after": {
      transitionDuration: "1ms",
      animationDuration: "1ms",
      animationIterationCount: "1 !important",
    },
  },

  /* ---- Keyframes ---- */
  "@keyframes fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
  "@keyframes slide-up": {
    from: { transform: "translateY(8px)", opacity: "0" },
    to: { transform: "translateY(0)", opacity: "1" },
  },
  "@keyframes scale-in": {
    from: { transform: "scale(0.98)", opacity: "0" },
    to: { transform: "scale(1)", opacity: "1" },
  },
  "@keyframes pop": {
    "0%": { transform: "scale(1)" },
    "50%": { transform: "scale(1.02)" },
    "100%": { transform: "scale(1)" },
  },
  "@keyframes shimmer": {
    "0%": { backgroundPosition: "-200% 0" },
    "100%": { backgroundPosition: "200% 0" },
  },

  /* ---- In-view entrance (used by <Reveal/>) ---- */
  '[data-inview]': {
    animationName: "fade-in, slide-up",
    animationDuration: "var(--dur-slow), var(--dur-slow)",
    animationTimingFunction: "var(--ease-productive)",
    animationFillMode: "both",
    animationDelay: "calc((var(--stagger-index, 0)) * 60ms)",
    willChange: "transform, opacity",
  },

  /* ---- Utility classes ---- */
  ".anim-scale-hover": { transform: "translateZ(0)" },
  ".anim-scale-hover:hover": {
    transform: "scale(1.02)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
  },

  ".anim-float-hover": { transform: "translateZ(0)" },
  ".anim-float-hover:hover": {
    transform: "translateY(-2px)",
    boxShadow: "0 10px 24px rgba(0,0,0,0.10)",
  },

  ".anim-pressable": { transform: "translateZ(0)" },
  ".anim-pressable:hover": {
    transform: "translateY(-1px)",
    boxShadow: "0 10px 24px rgba(0,0,0,0.10)",
  },
  ".anim-pressable:active": {
    transform: "translateY(0)",
    boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
    animationName: "pop",
    animationDuration: "var(--dur-fast)",
    animationTimingFunction: "var(--ease-productive)",
  },

  ".anim-underline-glide": {
    position: "relative",
    textDecoration: "none",
  },
  ".anim-underline-glide::after": {
    content: '""',
    position: "absolute",
    insetInlineStart: "0",
    insetBlockEnd: "-2px",
    width: "100%",
    height: "2px",
    transform: "scaleX(0)",
    transformOrigin: "left",
    background: "currentColor",
    transitionProperty: "transform",
    transitionDuration: "var(--dur-normal)",
  },
  ".anim-underline-glide:hover::after": {
    transform: "scaleX(1)",
  },

  /* ---- Overlay polish (Dialog/Drawer/Popover/Menu/HoverCard) ---- */
  '[data-scope="dialog"][data-part="backdrop"], \
   [data-scope="drawer"][data-part="backdrop"], \
   [data-scope="popover"][data-part="positioner"][data-state="open"]::before': {
    background: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(var(--chakra-blurs-xl))",
    animationName: "fade-in",
    animationDuration: "var(--dur-slow)",
    animationTimingFunction: "var(--ease-productive)",
  },

  /* IMPORTANT: tooltip is intentionally EXCLUDED here to keep its default (no animation) */
  '[data-scope="dialog"][data-part="content"], \
   [data-scope="drawer"][data-part="content"], \
   [data-scope="menu"][data-part="content"], \
   [data-scope="popover"][data-part="content"], \
   [data-scope="hover-card"][data-part="content"]': {
    animationName: "scale-in",
    animationDuration: "var(--dur-slow)",
    animationTimingFunction: "var(--ease-productive)",
    willChange: "transform, opacity",
    borderRadius: "var(--chakra-radii-2xl)",
  },

  /* HARD DISABLE tooltip animation/transitions (covers all cases) */
  '[data-scope="tooltip"][data-part="positioner"]': {
    animation: "none !important",
    transition: "none !important",
  },
  '[data-scope="tooltip"][data-part="content"]': {
    animation: "none !important",
    transition: "none !important",
  },
  '[role="tooltip"]': {
    animation: "none !important",
    transition: "none !important",
  },

  /* ---- Navigation polish ---- */
  '[role="tab"]::after': {
    content: '""',
    display: "block",
    height: "2px",
    background: "currentColor",
    transform: "scaleX(0)",
    transformOrigin: "left",
    transitionProperty: "transform",
    transitionDuration: "var(--dur-normal)",
  },
  '[role="tab"][aria-selected="true"]::after': {
    transform: "scaleX(1)",
  },

  /* ---- Accordion content ---- */
  '[data-scope="accordion"][data-part="content"]': {
    animationDuration: "var(--dur-slow)",
    animationTimingFunction: "var(--ease-productive)",
  },
  '[data-scope="accordion"][data-part="item"][data-state="open"] > [data-part="content"]': {
    animationName: "fade-in, slide-up",
  },

  /* ---- Menus / nav items hover nudge ---- */
  '[data-scope="menu"] [role="menuitem"], nav [role="link"]': {
    transitionProperty: "background-color, color, transform",
  },
  '[data-scope="menu"] [role="menuitem"]:hover, nav [role="link"]:hover': {
    transform: "translateX(2px)",
  },

  /* ---- Data display polish ---- */
  'table tbody tr': { transform: "translateZ(0)" },
  'table tbody tr:hover': {
    backgroundColor: "rgba(0,0,0,0.03)",
    transform: "translateY(-1px)",
  },

  /* ---- Badges / toasts / progress / skeleton ---- */
  '[data-scope="badge"][data-part="root"]': {
    animationName: "scale-in",
    animationDuration: "var(--dur-fast)",
    animationTimingFunction: "var(--ease-productive)",
  },
  '[data-scope="toast"][data-part="root"]': {
    animationName: "fade-in, slide-up",
    animationDuration: "var(--dur-slow), var(--dur-slow)",
    animationTimingFunction: "var(--ease-productive)",
    willChange: "transform, opacity",
  },
  '[data-scope="progress"][data-part="filled-track"]': {
    transitionProperty: "width",
    transitionDuration: "var(--dur-slow)",
    transitionTimingFunction: "var(--ease-productive)",
  },
  '[data-scope="skeleton"][data-part="root"]': {
    backgroundImage:
      "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)",
    backgroundSize: "200% 100%",
    animationName: "shimmer",
    animationDuration: "1.2s",
    animationIterationCount: "infinite",
    animationTimingFunction: "var(--ease-productive)",
  },

  /* ---- Inputs focus ring ---- */
  'input, textarea, select, [role="textbox"]': {
    transform: "translateZ(0)",
  },
  'input:focus-visible, textarea:focus-visible, select:focus-visible, [role="textbox"]:focus-visible': {
    outlineOffset: "2px",
    boxShadow: "0 0 0 3px rgba(59,130,246,0.45)",
  },

  /* ---- Buttons/links subtle lift ---- */
  'button, [role="button"], a[href]': {
    transform: "translateZ(0)",
  },
  'button:hover, [role="button"]:hover, a[href]:hover': {
    translate: "0 -1px",
    textDecorationThickness: "2px",
  },

  /* ---- CSS custom props for durations/easing ---- */
  ":root": {
    "--ease-productive": "var(--chakra-easings-productive)",
    "--ease-in": "var(--chakra-easings-entrance)",
    "--ease-out": "var(--chakra-easings-exit)",
    "--dur-faster": "var(--chakra-durations-faster)",
    "--dur-fast": "var(--chakra-durations-fast)",
    "--dur-normal": "var(--chakra-durations-normal)",
    "--dur-slow": "var(--chakra-durations-slow)",
    "--dur-slower": "var(--chakra-durations-slower)",
  },
}

const config = defineConfig({
  theme: {
    tokens,
    semanticTokens,
    recipes: { button: buttonRecipe },
  },
  globalCss,
})

export const system = createSystem(defaultConfig, config)
export default system
