import { Box } from "@chakra-ui/react"
import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Board (pan + zoom) with command API:
 * - "board:control" { type: "zoomIn" | "zoomOut" | "reset" }
 * - "board:focus"   { x, y, scale? }  // x,y in content-space pixels
 *
 * Listens on BOTH the board element AND window (so emitters can just dispatch to window).
 */
export default function Board({
  children,
  minScale = 0.4,
  maxScale = 3,
  initialScale = 1,
}: {
  children: any
  minScale?: number
  maxScale?: number
  initialScale?: number
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(initialScale)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const isPanningRef = useRef(false)
  const lastPosRef = useRef<{ x: number; y: number } | null>(null)

  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

  // Zoom around cursor with ctrl/shift/meta
  const onWheel = useCallback(
    (e: WheelEvent) => {
      if (!viewportRef.current) return
      const zoomIntent = e.ctrlKey || e.metaKey || e.shiftKey
      if (!zoomIntent) return
      e.preventDefault()

      const rect = viewportRef.current.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top

      const delta = -e.deltaY
      const factor = Math.exp(delta * 0.0015)
      const next = clamp(scale * factor, minScale, maxScale)

      const k = next / scale
      const ntx = cx - k * (cx - tx)
      const nty = cy - k * (cy - ty)

      setScale(next)
      setTx(ntx)
      setTy(nty)
    },
    [scale, tx, ty, minScale, maxScale],
  )

  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const handler = (e: WheelEvent) => onWheel(e)
    vp.addEventListener("wheel", handler, { passive: false })
    return () => vp.removeEventListener("wheel", handler as any)
  }, [onWheel])

  // Pan
  const startPan = (x: number, y: number) => {
    isPanningRef.current = true
    lastPosRef.current = { x, y }
  }
  const movePan = (x: number, y: number) => {
    if (!isPanningRef.current || !lastPosRef.current) return
    const dx = x - lastPosRef.current.x
    const dy = y - lastPosRef.current.y
    lastPosRef.current = { x, y }
    setTx((p) => p + dx)
    setTy((p) => p + dy)
  }
  const endPan = () => {
    isPanningRef.current = false
    lastPosRef.current = null
  }

  // Command handlers (shared for element + window)
  const handleControl = useCallback(
    (payload: { type: "zoomIn" | "zoomOut" | "reset" } | undefined) => {
      if (!payload) return
      if (payload.type === "reset") {
        setScale(initialScale)
        setTx(0)
        setTy(0)
      } else {
        const step = payload.type === "zoomIn" ? 1.12 : 1 / 1.12
        setScale((s) => clamp(s * step, minScale, maxScale))
      }
    },
    [initialScale, minScale, maxScale],
  )

  const handleFocus = useCallback(
    (payload: { x: number; y: number; scale?: number } | undefined) => {
      if (!payload) return
      const { x, y, scale: targetScale } = payload
      if (typeof x !== "number" || typeof y !== "number") return
      const vp = viewportRef.current
      if (!vp) return
      const rect = vp.getBoundingClientRect()
      const nextScale = clamp(targetScale ?? scale, minScale, maxScale)
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      const ntx = centerX - x * nextScale
      const nty = centerY - y * nextScale
      setScale(nextScale)
      setTx(ntx)
      setTy(nty)
    },
    [scale, minScale, maxScale],
  )

  // Register listeners on BOTH the element and the window
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return

    const onCmdEl = (e: Event) => handleControl((e as CustomEvent).detail)
    const onFocEl = (e: Event) => handleFocus((e as CustomEvent).detail)
    vp.addEventListener("board:control", onCmdEl as any)
    vp.addEventListener("board:focus", onFocEl as any)

    const onCmdWin = (e: Event) => handleControl((e as CustomEvent).detail)
    const onFocWin = (e: Event) => handleFocus((e as CustomEvent).detail)
    window.addEventListener("board:control", onCmdWin as any)
    window.addEventListener("board:focus", onFocWin as any)

    return () => {
      vp.removeEventListener("board:control", onCmdEl as any)
      vp.removeEventListener("board:focus", onFocEl as any)
      window.removeEventListener("board:control", onCmdWin as any)
      window.removeEventListener("board:focus", onFocWin as any)
    }
  }, [handleControl, handleFocus])

  return (
    <Box
      ref={viewportRef}
      data-board-root="1"
      position="relative"
      w="100%"
      h={{ base: "72vh", md: "78vh", xl: "84vh" }}
      overflow="hidden"
      borderRadius="16px"
      borderWidth="1px"
      borderColor="gameCanvasBorder"
      boxShadow="gameCanvasShadow"
      bgImage={`linear-gradient(transparent 23px, rgba(255,255,255,0.05) 24px),
          linear-gradient(90deg, transparent 23px, rgba(255,255,255,0.05) 24px)`}
      bgSize="24px 24px"
      onMouseDown={(e) => startPan(e.clientX, e.clientY)}
      onMouseMove={(e) => movePan(e.clientX, e.clientY)}
      onMouseUp={endPan}
      onMouseLeave={endPan}
      onTouchStart={(e) => {
        const t = e.touches[0]
        if (t) startPan(t.clientX, t.clientY)
      }}
      onTouchMove={(e) => {
        const t = e.touches[0]
        if (t) movePan(t.clientX, t.clientY)
      }}
      onTouchEnd={endPan}
    >
      <Box
        position="absolute"
        top={0}
        left={0}
        transform={`translate(${tx}px, ${ty}px) scale(${scale})`}
        transformOrigin="0 0"
        minW="max-content"
        minH="max-content"
        p="6"
      >
        {children}
      </Box>
    </Box>
  )
}
