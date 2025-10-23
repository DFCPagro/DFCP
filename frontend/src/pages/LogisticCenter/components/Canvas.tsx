import { Container } from "@chakra-ui/react"
import type { ReactNode } from "react"

/**
 * Canvas is a simple wrapper around a Chakra `Container` that provides
 * consistent padding and width for the main map area. Because the
 * `LogisticMap` component internally renders its own `Board` (which
 * handles panning and zooming), we deliberately avoid nesting another
 * `Board` here.
 */
export default function Canvas({ children }: { children: ReactNode }) {
  return (
    <Container maxW="8xl" py="6">
      {children}
    </Container>
  )
}
