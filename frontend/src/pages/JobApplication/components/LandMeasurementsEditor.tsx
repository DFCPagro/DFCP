import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Box, Field, Heading, Input, Stack, Tag } from "@chakra-ui/react"
import type { LandInput } from "@/types/availableJobs"

type Meas = NonNullable<LandInput["measurements"]>
type Side = "ab" | "bc" | "cd" | "da"

const numPattern = /^(\d+(\.\d*)?)?$/

export function LandMeasurementsEditor({
  value,
  onChange,
}: {
  value?: Meas
  onChange: (next: Meas) => void
}) {
  // source of truth from parent (numbers)
  const abNum = value?.abM ?? 50
  const bcNum = value?.bcM ?? 40
  const cdNum = value?.cdM ?? 50
  const daNum = value?.daM ?? 40

  // local text state mirrors inputs (prevents cursor fights while typing "1.", etc.)
  const [abText, setAbText] = useState<string>(String(abNum))
  const [bcText, setBcText] = useState<string>(String(bcNum))
  const [cdText, setCdText] = useState<string>(String(cdNum))
  const [daText, setDaText] = useState<string>(String(daNum))

  // track focused side and caret position to restore focus after parent re-render
  const [active, setActive] = useState<Side | null>(null)
  const abRef = useRef<HTMLInputElement | null>(null)
  const bcRef = useRef<HTMLInputElement | null>(null)
  const cdRef = useRef<HTMLInputElement | null>(null)
  const daRef = useRef<HTMLInputElement | null>(null)
  const caretRef = useRef<number | null>(null)
  const focusTick = useRef(0) // increments whenever we commit to parent

  const getRef = (side: Side) =>
    side === "ab" ? abRef : side === "bc" ? bcRef : side === "cd" ? cdRef : daRef

  // keep local text in sync if parent changes from outside while not focused
  useEffect(() => {
    if (active !== "ab") setAbText(String(abNum))
  }, [abNum, active])
  useEffect(() => {
    if (active !== "bc") setBcText(String(bcNum))
  }, [bcNum, active])
  useEffect(() => {
    if (active !== "cd") setCdText(String(cdNum))
  }, [cdNum, active])
  useEffect(() => {
    if (active !== "da") setDaText(String(daNum))
  }, [daNum, active])

  // restore focus + caret after parent state updates
  useLayoutEffect(() => {
    if (!active) return
    const el = getRef(active).current
    if (!el) return
    el.focus({ preventScroll: true })
    if (caretRef.current != null) {
      const p = Math.min(caretRef.current, el.value.length)
      el.setSelectionRange(p, p)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTick.current])

  const commit = (side: Side, n: number | undefined) => {
    const next: Meas = {
      abM: abNum,
      bcM: bcNum,
      cdM: cdNum,
      daM: daNum,
      rotationDeg: 0,
    }
    if (side === "ab") next.abM = n ?? undefined
    if (side === "bc") next.bcM = n ?? undefined
    if (side === "cd") next.cdM = n ?? undefined
    if (side === "da") next.daM = n ?? undefined
    onChange(next)
    // signal to restore focus on next paint
    focusTick.current++
  }

  const onInputChange = (side: Side, e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value
    if (!numPattern.test(text)) return
    // remember caret before commit (so we can restore it)
    caretRef.current = e.target.selectionStart ?? null

    if (side === "ab") setAbText(text)
    if (side === "bc") setBcText(text)
    if (side === "cd") setCdText(text)
    if (side === "da") setDaText(text)

    // live-commit only if parseable number; otherwise wait for blur
    const num = text === "" || text === "." ? undefined : Number(text)
    if (num !== undefined && !Number.isNaN(num)) {
      commit(side, num)
    }
  }

  const onInputBlur = (side: Side) => {
    setActive((prev) => (prev === side ? null : prev))
    const text =
      side === "ab" ? abText : side === "bc" ? bcText : side === "cd" ? cdText : daText
    const num = text === "" || text === "." ? undefined : Number(text)
    const formatted = num == null || Number.isNaN(num) ? "" : String(+num.toFixed(2))
    if (side === "ab") setAbText(formatted)
    if (side === "bc") setBcText(formatted)
    if (side === "cd") setCdText(formatted)
    if (side === "da") setDaText(formatted)
    if (num == null || Number.isNaN(num)) return
    commit(side, num)
  }

  // preview sizes from averages (meters → px)
  const PX_PER_M = 2
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
  const widthPx = clamp(((abNum + cdNum) / 2) * PX_PER_M, 60, 520)
  const heightPx = clamp(((bcNum + daNum) / 2) * PX_PER_M, 60, 520)

  const sideStyles = useMemo(
    () => ({
      ab: {
        bar: { top: "-3px", left: "0", right: "0", height: "3px" },
        tag: { top: "-8px", left: "50%", transform: "translateX(-50%)" },
      },
      cd: {
        bar: { bottom: "-3px", left: "0", right: "0", height: "3px" },
        tag: { bottom: "-8px", left: "50%", transform: "translateX(-50%)" },
      },
      da: {
        bar: { left: "-3px", top: "0", bottom: "0", width: "3px" },
        tag: {
          left: "-12px",
          top: "50%",
          transform: "translateY(-50%) rotate(-90deg)",
        },
      },
      bc: {
        bar: { right: "-3px", top: "0", bottom: "0", width: "3px" },
        tag: {
          right: "-12px",
          top: "50%",
          transform: "translateY(-50%) rotate(90deg)",
        },
      },
    }),
    []
  )

  const InputFor = ({
    side,
    label,
    text,
    inputRef,
  }: {
    side: Side
    label: string
    text: string
    inputRef: React.RefObject<HTMLInputElement>
  }) => (
    <Field.Root>
      <Field.Label>{label} (m)</Field.Label>
      <Input
        ref={inputRef}
        type="text" // keep as text to allow transient states like "1."
        inputMode="decimal"
        placeholder="0"
        value={text}
        onChange={(e) => onInputChange(side, e)}
        onFocus={() => setActive(side)}
        onBlur={() => onInputBlur(side)}
      />
    </Field.Root>
  )

  return (
    <Stack gap="4">
      <Heading size="xs">Land measurements</Heading>

      {/* Inputs grid */}
      <Stack
        direction={{ base: "column", md: "row" }}
        gap="4"
        align="stretch"
        justify="space-between"
      >
        <Stack flex="1" gap="3">
          <InputFor side="ab" label="Top (AB)" text={abText} inputRef={abRef} />
          <InputFor side="cd" label="Bottom (CD)" text={cdText} inputRef={cdRef} />
        </Stack>
        <Stack flex="1" gap="3">
          <InputFor side="da" label="Left (DA)" text={daText} inputRef={daRef} />
          <InputFor side="bc" label="Right (BC)" text={bcText} inputRef={bcRef} />
        </Stack>
      </Stack>

      {/* 2D preview */}
      <Box
        position="relative"
        h="320px"
        bg="bg.muted"
        _dark={{ bg: "blackAlpha.300" }}
        borderWidth="1px"
        borderRadius="xl"
        overflow="hidden"
      >
        <Box
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          width={`${widthPx}px`}
          height={`${heightPx}px`}
          borderWidth="2px"
          borderStyle="dashed"
          borderColor="border"
          borderRadius="md"
        >
          {/* AB */}
          <Box position="absolute" {...(sideStyles.ab.tag as any)}>
            <Tag.Root>
              <Tag.Label>{abNum.toFixed(2)} m</Tag.Label>
            </Tag.Root>
          </Box>
          <Box
            position="absolute"
            bg={active === "ab" ? "blue.500" : "border"}
            _dark={{ bg: active === "ab" ? "blue.400" : "whiteAlpha.500" }}
            {...(sideStyles.ab.bar as any)}
          />

          {/* CD */}
          <Box position="absolute" {...(sideStyles.cd.tag as any)}>
            <Tag.Root>
              <Tag.Label>{cdNum.toFixed(2)} m</Tag.Label>
            </Tag.Root>
          </Box>
          <Box
            position="absolute"
            bg={active === "cd" ? "blue.500" : "border"}
            _dark={{ bg: active === "cd" ? "blue.400" : "whiteAlpha.500" }}
            {...(sideStyles.cd.bar as any)}
          />

          {/* DA */}
          <Box position="absolute" {...(sideStyles.da.tag as any)}>
            <Tag.Root>
              <Tag.Label>{daNum.toFixed(2)} m</Tag.Label>
            </Tag.Root>
          </Box>
          <Box
            position="absolute"
            bg={active === "da" ? "blue.500" : "border"}
            _dark={{ bg: active === "da" ? "blue.400" : "whiteAlpha.500" }}
            {...(sideStyles.da.bar as any)}
          />

          {/* BC */}
          <Box position="absolute" {...(sideStyles.bc.tag as any)}>
            <Tag.Root>
              <Tag.Label>{bcNum.toFixed(2)} m</Tag.Label>
            </Tag.Root>
          </Box>
          <Box
            position="absolute"
            bg={active === "bc" ? "blue.500" : "border"}
            _dark={{ bg: active === "bc" ? "blue.400" : "whiteAlpha.500" }}
            {...(sideStyles.bc.bar as any)}
          />
        </Box>
      </Box>
    </Stack>
  )
}
