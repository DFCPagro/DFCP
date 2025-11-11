import React, { useEffect, useRef, useState } from "react"
import { Box, Card, type BoxProps } from "@chakra-ui/react"

/** Reveal: toggles data-inview attribute to drive CSS keyframe entrance */
export function Reveal(
  props: BoxProps & { as?: React.ElementType; once?: boolean; threshold?: number; rootMargin?: string }
) {
  const { once = true, threshold = 0.15, rootMargin = "0px 0px -10% 0px", ...rest } = props
  const ref = useRef<HTMLDivElement | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          if (once) io.disconnect()
        } else if (!once) {
          setInView(false)
        }
      },
      { threshold, rootMargin }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [once, threshold, rootMargin])

  return <Box ref={ref} data-inview={inView ? "" : undefined} {...rest} />
}

/** Pressable card shortcut */
export function PressableCard(props: React.ComponentProps<typeof Card.Root>) {
  return <Card.Root className="anim-pressable" {...props} />
}
