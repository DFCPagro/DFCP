import {
  createSystem,
  defineConfig,
  defineTokens,
  defaultConfig,
  defineSemanticTokens,
} from "@chakra-ui/react"
import { buttonRecipe } from "./button.recipe"

/**
 * GAME THEME — GREEN NEON VARIANT
 * ------------------------------------------------------------------
 * • Primary hue: emerald / teal
 * • Secondary accent: lime-neon
 * • Panels & canvas keep the game-like contrast
 * • All previous semantics kept for compatibility
 */

const tokens = defineTokens({
  colors: {
    // Core emerald/teal brand range (brighter & saturated)
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

    // Lime glow accent
    lime: {
      400: { value: "#bef264" },
      500: { value: "#a3e635" },
      600: { value: "#84cc16" },
    },

    // Dark-neutral inks for backgrounds and frames
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
        _dark: "0 20px 80px rgba(0,0,0,.4), inset 0 0 0 1px rgba(0,255,179,.1)",
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
  body: {
    bg: "background",
    color: "text",
    fontFamily: "Inter, system-ui, sans-serif",
    lineHeight: "base",
    transition: "background 0.2s ease, color 0.2s ease",
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
  },
  "*": { boxSizing: "border-box" },
  a: { color: "brand.500", _hover: { textDecoration: "underline" } },
  h1: { color: "heading", fontSize: "4xl", fontWeight: "bold" },
  p: { color: "text", fontSize: "md", lineHeight: "tall" },
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
