import React, { useEffect, useRef, useState } from "react"
import {
  Box,
  Button,
  Card,
  Link,
  Stack,
  type BoxProps,
  type ButtonProps,
  type LinkProps,
  type StackProps,
} from "@chakra-ui/react"

/**
 * Some Chakra UI subcomponents (like Card) in v3 don't export explicit prop types.
 * We use BoxProps as the compatible base since they share the same style interface.
 */
type CardLikeProps = BoxProps & { children?: React.ReactNode }

/**
 * Reveal: adds a `data-inview` attribute once the element enters the viewport.
 * Theme.globalCss uses this attribute to trigger entrance keyframes with stagger.
 */
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

/**
 * AnimatedList: wraps children with Reveal and sets `--stagger-index` for delays.
 */
export function AnimatedList({
  children,
  as = "div",
  gap = "3",
  ...rest
}: BoxProps & { as?: React.ElementType }) {
  const items = React.Children.toArray(children)
  return (
    <Box as={as} display="grid" gap={gap} {...rest}>
      {items.map((child, i) => (
        <Reveal key={i} style={{ ["--stagger-index" as any]: i } as React.CSSProperties}>
          {child}
        </Reveal>
      ))}
    </Box>
  )
}

/**
 * Hover/press utilities via global CSS classes.
 */
export function ScaleOnHover(props: BoxProps) {
  return <Box className="anim-scale-hover" {...props} />
}

export function FloatOnHover(props: BoxProps) {
  return <Box className="anim-float-hover" {...props} />
}

export function PressableCard(props: CardLikeProps) {
  return (
    <Card.Root className="anim-pressable" {...(props as any)}>
      {props.children}
    </Card.Root>
  )
}

/**
 * Animated primitives: ready-to-use Button/Link/Stack with tasteful motion.
 */
export function AnimatedButton(props: ButtonProps) {
  return <Button className="anim-pressable" {...props} />
}

export function AnimatedLink(props: LinkProps) {
  return <Link className="anim-underline-glide" {...props} />
}

/**
 * AnimatedStack: reveals its children on mount and staggers them.
 */
export function AnimatedStack({ children, ...rest }: StackProps) {
  const items = React.Children.toArray(children)
  return (
    <Stack {...rest}>
      {items.map((child, i) => (
        <Reveal key={i} style={{ ["--stagger-index" as any]: i } as React.CSSProperties}>
          {child}
        </Reveal>
      ))}
    </Stack>
  )
}
