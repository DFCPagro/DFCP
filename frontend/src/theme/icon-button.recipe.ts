import { defineRecipe } from "@chakra-ui/react"

export const iconButtonRecipe = defineRecipe({
  className: "icon-button",
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    userSelect: "none",
    cursor: "pointer",
    outline: 0,
    rounded: "md",
    borderWidth: "1px",
    borderColor: "transparent",
    transitionProperty: "common",
    transitionDuration: "fast",

    _focusVisible: {
      boxShadow: "0 0 0 3px token(colors.colorPalette.300)",
    },
    _disabled: {
      opacity: 0.45,
      cursor: "not-allowed",
      boxShadow: "none",
    },

    // Make the inner icon size track the button size
    "& svg, & [data-part=icon]": {
      width: "1em",
      height: "1em",
      flexShrink: 0,
    },
  },

  variants: {
    variant: {
      solid: {
        bg: { base: "colorPalette.600", _dark: "colorPalette.500" },
        color: "white",
        _hover: { bg: { base: "colorPalette.700", _dark: "colorPalette.400" } },
        _active: { bg: { base: "colorPalette.800", _dark: "colorPalette.300" } },
      },
      subtle: {
        bg: { base: "colorPalette.50", _dark: "whiteAlpha.200" },
        color: { base: "colorPalette.700", _dark: "whiteAlpha.900" },
        _hover: { bg: { base: "colorPalette.100", _dark: "whiteAlpha.300" } },
        _active: { bg: { base: "colorPalette.200", _dark: "whiteAlpha.400" } },
      },
      ghost: {
        bg: "transparent",
        color: { base: "colorPalette.600", _dark: "colorPalette.300" },
        borderWidth: "0",
        _hover: { bg: { base: "blackAlpha.50", _dark: "whiteAlpha.100" } },
        _active: { bg: { base: "blackAlpha.100", _dark: "whiteAlpha.200" } },
      },
      outline: {
        bg: "transparent",
        color: { base: "colorPalette.600", _dark: "colorPalette.300" },
        borderColor: { base: "colorPalette.200", _dark: "whiteAlpha.300" },
        _hover: {
          bg: { base: "blackAlpha.50", _dark: "whiteAlpha.100" },
          borderColor: { base: "colorPalette.300", _dark: "whiteAlpha.400" },
        },
        _active: {
          bg: { base: "blackAlpha.100", _dark: "whiteAlpha.200" },
        },
      },
    },

    size: {
      xs: { boxSize: 7, fontSize: "xs" },
      sm: { boxSize: 8, fontSize: "sm" },
      md: { boxSize: 10, fontSize: "md" },
      lg: { boxSize: 12, fontSize: "lg" },
    },

    shape: {
      square: { rounded: "md" },
      rounded: { rounded: "lg" },
      circle: { rounded: "full" },
    },
  },

  defaultVariants: {
    variant: "ghost",
    size: "sm",
    shape: "square",
    // colorPalette defaults to "gray" unless you pass another (e.g., "brand")
  },
})
