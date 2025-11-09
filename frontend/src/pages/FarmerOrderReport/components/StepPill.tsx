import * as React from "react"
import { Tag } from "@chakra-ui/react"

export function StepPill(props: { children: React.ReactNode; active?: boolean }) {
  return (
    <Tag.Root colorPalette={props.active ? "green" : undefined} variant={props.active ? "solid" : "outline"}>
      <Tag.Label>{props.children}</Tag.Label>
    </Tag.Root>
  )
}
