// src/hooks/useNavOverflow.ts
import { useCallback, useLayoutEffect, useRef, useState } from "react";

/** True if any child wrapped to a new row. */
function hasWrapped(container: HTMLElement): boolean {
  const kids = Array.from(container.children) as HTMLElement[];
  if (kids.length <= 1) return false;
  const top0 = kids[0].offsetTop;
  for (const el of kids) if (el.offsetTop > top0) return true;
  return false;
}


type Options = {
  /** Extra px slack before we COLLAPSE to the drawer. Prevents flicker near the edge. */
  collapseSlack?: number; // default 8
  /** Extra px slack before we EXPAND back to inline. Make this larger than collapseSlack. */
  expandSlack?: number; // default 16
  /** Require this many consecutive consistent reads before toggling state. */
  stableFrames?: number; // default 2
};

/** Detects header overflow with hysteresis. Use the returned callback as the ref. */
export function useNavOverflow(opts: Options = {}) {
  const {
    collapseSlack = 0,
    expandSlack = 0,
    stableFrames = 0,
  } = opts;

  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [isOverflowing, setOverflow] = useState(false);

  const roRef = useRef<ResizeObserver | null>(null);
  const rafRef = useRef<number | null>(null);
  const stableRef = useRef(0); // consecutive confirmations of the same outcome
  const lastDesiredRef = useRef<boolean | null>(null); // desired state before commit

  const measureDesired = useCallback(() => {
    if (!node) return null;

    // Use different slack depending on current state to add hysteresis
    const slack = isOverflowing ? expandSlack : collapseSlack;

    const overflowX = node.scrollWidth > node.clientWidth + slack;
    const wrapped = hasWrapped(node);

    // Wrapping is a hard signal regardless of slack
    const desired = overflowX || wrapped;
    return desired;
  }, [node, isOverflowing, collapseSlack, expandSlack]);

  const check = useCallback(() => {
    const desired = measureDesired();
    if (desired == null) return;

    // stability gate: commit only after N consecutive frames agree
    if (lastDesiredRef.current === desired) {
      stableRef.current += 1;
    } else {
      lastDesiredRef.current = desired;
      stableRef.current = 1;
    }

    if (stableRef.current >= stableFrames && desired !== isOverflowing) {
      setOverflow(desired);
      // reset stability after commit
      stableRef.current = 0;
      lastDesiredRef.current = null;
    }
  }, [measureDesired, isOverflowing, stableFrames]);

  const run = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(check);
  }, [check]);

  // Rebind observer whenever the target node changes
  useLayoutEffect(() => {
    roRef.current?.disconnect();
    if (!node) return;

    const ro = new ResizeObserver(run);
    roRef.current = ro;

    ro.observe(node);
    for (const child of Array.from(node.children)) ro.observe(child);

    window.addEventListener("resize", run);
    const fontsReady: Promise<unknown> | undefined = (document as any).fonts?.ready;
    fontsReady?.then(() => run()).catch(() => {});

    // initial
    run();

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", run);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [node, run]);

  /** Use this as the ref prop: <Stack ref={setRef}> or for the hidden probe. */
  const setRef = useCallback((el: HTMLDivElement | null) => {
    setNode(el);
  }, []);

  return { setRef, isOverflowing, recheck: run };
}
