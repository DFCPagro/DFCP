import { defineRecipe } from "@chakra-ui/react";

export const buttonRecipe = defineRecipe({
  base: {
    fontWeight: "semibold",
    borderRadius: "md",
    transition: "all 0.2s",
    px: 4,
    py: 2,
  },
  variants: {
    visual: {
      solid: {
        bg: { base: "#4a6f1eff", _dark: "brand.300" },
        color: { base: "white", _dark: "gray.900" },
        _hover: { bg: { base: "#7da152ff", _dark: "brand.400" } },
        _expanded: { bg: { base: "gray.400", _dark: "gray.600" } },
        _active: {
          bg: { base: "gray.200", _dark: "gray.700" },
          color: { base: "brand.600", _dark: "brand.300" },
        },
        // stays semibold via base
      },
      outline: {
        color: { base: "brand.500", _dark: "brand.300" },
        bg: "transparent",
        border: "1px solid",
        borderColor: { base: "brand.500", _dark: "brand.300" },
        _hover: { bg: { base: "brand.50", _dark: "brand.900" } },
        fontWeight: "normal", // ✅ not bold
      },
      ghost: {
        bg: "transparent",
        color: { base: "brand.500", _dark: "brand.300" },
        _expanded: { bg: { base: "gray.200", _dark: "gray.600" } },
        _hover: { bg: { base: "brand.100", _dark: "brand.800" } },
        _active: { bg: { base: "gray.200", _dark: "gray.600" } },
        fontWeight: "normal", // ✅ not bold
      },
      info: {
        bg: { base: "blue.700", _dark: "blue.300" },
        color: { base: "white", _dark: "gray.900" },
        _hover: { bg: { base: "blue.600", _dark: "blue.400" } },
        _active: { bg: { base: "blue.800", _dark: "blue.500" } },
      },
      mint: {
        bg: { base: "teal.500", _dark: "teal.300" },
        color: { base: "white", _dark: "gray.900" },
        _hover: { bg: { base: "teal.400", _dark: "teal.200" } },
        _active: { bg: { base: "teal.600", _dark: "teal.400" } },
      },

      /** 🔴 Destructive (Delete) button */
      danger: {
        bg: { base: "red.600", _dark: "red.400" },
        color: { base: "white", _dark: "gray.900" },
        _hover: { bg: { base: "red.700", _dark: "red.300" } },
        _active: { bg: { base: "red.800", _dark: "red.500" } },
        _focusVisible: {
          boxShadow: {
            base: "0 0 0 2px var(--chakra-colors-red-200)",
            _dark: "0 0 0 2px var(--chakra-colors-red-700)",
          },
        },
        _disabled: {
          bg: { base: "red.200", _dark: "red.700" },
          color: { base: "whiteAlpha.800", _dark: "gray.300" },
          cursor: "not-allowed",
          opacity: 0.7,
        },
      },
    },
  },
  defaultVariants: {
    visual: "solid",
  },
});
