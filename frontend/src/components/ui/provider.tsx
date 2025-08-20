"use client"

import { ChakraProvider } from "@chakra-ui/react"
import {
  ColorModeProvider,
  type ColorModeProviderProps,
} from "./color-mode"
import system from "@/theme"

export function Provider(props: ColorModeProviderProps) {
  return (
    <ChakraProvider value={system}>
      <ColorModeProvider {...props} />
    </ChakraProvider>
  )
}


// export function Provider({ children }: { children: React.ReactNode }) {
//   return (
//     <ChakraProvider value={system}>
//       <ColorModeProvider>
//               {children}
//       </ColorModeProvider>
//     </ChakraProvider>
//   )
// }
