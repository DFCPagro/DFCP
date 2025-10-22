import { Container } from "@chakra-ui/react"
// import { ReactNode } from "react"
import Board from "./Board"

/**
 * Canvas now hosts an infinite Board (pan + zoom).
 * Put your content as children; it will never overflow the viewport.
 */
export default function Canvas({ children }: { children: any }) {
  return (
    <Container maxW="8xl" py="6">
      <Board>{children}</Board>
    </Container>
  )
}
