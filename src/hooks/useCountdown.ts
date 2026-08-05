import { useEffect, useState } from 'react';

export function useCountdown(initialValue = 0) {
  const [seconds, setSeconds] = useState(initialValue);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  return [seconds, setSeconds] as const;
}
