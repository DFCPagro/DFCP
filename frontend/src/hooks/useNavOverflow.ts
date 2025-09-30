import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Detects when a horizontal menu overflows its container.
 * Usage:
 *   const { ref, isOverflowing } = useNavOverflow();
 */
export function useNavOverflow() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isOverflowing, setOverflow] = useState(false);

  const check = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setOverflow(el.scrollWidth > el.clientWidth + 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    check();

    const ro = new ResizeObserver(() => check());
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child as Element);

    const onWin = () => check();
    window.addEventListener("resize", onWin);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onWin);
    };
  }, [check]);

  return { ref, isOverflowing };
}

/**
 * NEW: Dynamic overflow splitter.
 * Gives you refs to attach to each item and splits items into visible/overflow based on actual width.
 */
export function useNavOverflowSplit<T extends { key: string }>() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [itemWidths, setItemWidths] = useState<Record<string, number>>({});

  // attach to each rendered item wrapper
  const registerItem = (key: string) => (el: HTMLElement | null) => {
    if (!el) return;
    const measure = () => {
      const w = Math.ceil(el.getBoundingClientRect().width);
      setItemWidths(prev => (prev[key] === w ? prev : { ...prev, [key]: w }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // store for cleanup
    (el as any).__ro = ro;
  };

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const measure = () => {
      const w = Math.floor(node.getBoundingClientRect().width);
      setContainerWidth(prev => (prev === w ? prev : w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      document.querySelectorAll("[data-overflow-item]").forEach((n: any) => {
        try { n.__ro?.disconnect?.(); } catch {}
      });
    };
  }, []);

  function split(items: T[], gapBuffer = 8) {
    // sum until we run out of space
    let used = 0;
    let cut = items.length;
    for (let i = 0; i < items.length; i++) {
      const w = itemWidths[items[i].key] ?? 0;
      if (used + w + gapBuffer <= containerWidth) {
        used += w;
      } else {
        cut = i;
        break;
      }
    }
    return {
      visible: items.slice(0, cut),
      overflow: items.slice(cut),
      isOverflowing: cut < items.length,
      containerRef,
      registerItem,
    };
  }

  return { split };
}
