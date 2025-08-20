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
        bg: { base: "brand.500", _dark: "brand.300" },
        color: { base: "white", _dark: "gray.900" },
        _hover: {
          bg: { base: "brand.600", _dark: "brand.400" },
        },
      },
      outline: {
        color: { base: "brand.500", _dark: "brand.300" },
        bg: { base: "transparent", _dark: "transparent" },
        border: "1px solid",
        borderColor: { base: "brand.500", _dark: "brand.300" },
        _hover: {
          bg: { base: "brand.50", _dark: "brand.900" },
        },
      },
      ghost: {
        bg: { base: "transparent", _dark: "transparent" },
        color: { base: "brand.500", _dark: "brand.300" },
        _hover: {
          bg: { base: "brand.100", _dark: "brand.800" },
        },
      },
      info: {
        bg: { base: "blue.700", _dark: "blue.300" },
        color: { base: "white", _dark: "gray.900" },
        _hover: {
          bg: { base: "blue.600", _dark: "blue.400" },
        },
        _active: {
          bg: { base: "blue.800", _dark: "blue.500" },
        },
      },
      mint: {
        bg: { base: "teal.500", _dark: "teal.300" },
        color: { base: "white", _dark: "gray.900" },
        _hover: {
          bg: { base: "teal.400", _dark: "teal.200" },
        },
        _active: {
          bg: { base: "teal.600", _dark: "teal.400" },
        },
      },
    },
  },
  defaultVariants: {
    visual: "solid",
  },
});
