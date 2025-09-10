import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Detects when a horizontal menu overflows its container.
 * Usage:
 *   const { ref, isOverflowing } = useNavOverflow();
 *   <HStack ref={ref}> ...inline items... </HStack>
 */
export function useNavOverflow() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isOverflowing, setOverflow] = useState(false);

  const check = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // scrollWidth includes full horizontal content; clientWidth is visible width
    setOverflow(el.scrollWidth > el.clientWidth + 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    check();

    const ro = new ResizeObserver(() => {
      check();
    });
    ro.observe(el);

    // Observe children too (when labels change, groups open/close, etc.)
    for (const child of Array.from(el.children)) {
      ro.observe(child as Element);
    }

    const onWin = () => check();
    window.addEventListener("resize", onWin);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onWin);
    };
  }, [check]);

  return { ref, isOverflowing };
}
