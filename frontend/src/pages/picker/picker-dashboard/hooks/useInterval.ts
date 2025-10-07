import { useEffect, useRef } from "react";


export function useInterval(cb: () => void, delayMs: number | null) {
const saved = useRef(cb);
useEffect(() => {
saved.current = cb;
}, [cb]);
useEffect(() => {
if (delayMs === null) return;
const id = setInterval(() => saved.current(), delayMs);
return () => clearInterval(id);
}, [delayMs]);
}