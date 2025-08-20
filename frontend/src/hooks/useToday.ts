import { useEffect, useRef, useState } from 'react';

export function useToday() {
  const [today, setToday] = useState(() => new Date());
  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => setToday(new Date());

    const now = new Date();
    const msUntilMidnight =
      +new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - +now;

    timeoutRef.current = window.setTimeout(() => {
      tick();
      intervalRef.current = window.setInterval(tick, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);

    const onVis = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVis);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return today;
}
