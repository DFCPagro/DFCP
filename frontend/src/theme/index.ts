import {
  createSystem,
  defineConfig,
  defineTokens,
  defaultConfig,
  defineSemanticTokens,
} from "@chakra-ui/react";

import { buttonRecipe } from "./button.recipe";

const tokens = defineTokens({
  colors: {
    brand: {
      50: { value: "#e6fffa" },
      100: { value: "#b2f5ea" },
      200: { value: "#81e6d9" },
      300: { value: "#4fd1c5" },
      400: { value: "#38b2ac" },
      500: { value: "#319795" },
      600: { value: "#2c7a7b" },
      700: { value: "#285e61" },
      800: { value: "#234e52" },
      900: { value: "#1d4044" },
    },
  },
});


const semanticTokens = defineSemanticTokens({
  colors: {
    background: {
      value: { _light: "#f9f9f9", _dark: "#121212" },
    },
    text: {
      value: { _light: "#2d3748", _dark: "#e2e8f0" },
    },
    heading: {
      value: { _light: "#1a202c", _dark: "#ffffff" },
    },
    muted: {
      value: { _light: "#718096", _dark: "#a0aec0" },
    },
    border: {
      value: { _light: "#e2e8f0", _dark: "#2d3748" },
    },
  },
});


// 2. Global styles
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
  "*": {
    boxSizing: "border-box",
  },
  a: {
    color: "brand.500",
    _hover: {
      textDecoration: "underline",
    },
  },
  h1: {
    color: "heading",
    fontSize: "4xl",
    fontWeight: "bold",
  },
  p: {
    color: "text",
    fontSize: "md",
    lineHeight: "tall",
  },
};


// 3. Config with recipes + tokens
const config = defineConfig({
  theme: {
    tokens,
    semanticTokens,
    recipes: {
      button: buttonRecipe, //this makes all default buttons defined by the recipie
    },
  },
  globalCss,
});

// 4. Create system (no need to pass defaultConfig separately)
export const system = createSystem(defaultConfig, config);

export default system;
