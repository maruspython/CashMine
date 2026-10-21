import { useEffect, useState } from 'react';

/** Current time, updated every `intervalMs`, for "updated 12 s ago" labels. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** "just now", "12 s ago", "3 min ago". The phone clock may differ from the server's, so never negative. */
export function formatAge(fromMs: number, nowMs: number): string {
  const seconds = Math.max(0, Math.floor((nowMs - fromMs) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds} s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `at ${new Date(fromMs).toLocaleString()}`;
}
