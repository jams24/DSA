"use client";

import { useEffect, useRef, useState } from "react";

/** Elapsed whole seconds while running. Measured from Date.now(), so background-tab timer throttling can't make it drift. */
export function useStopwatch() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const base = useRef(0); // ms accumulated before the current run
  const startedAt = useRef(0);
  const discard = useRef(false); // set by reset(): the running segment must not be added back

  useEffect(() => {
    if (!running) return;
    startedAt.current = Date.now();
    discard.current = false;
    const t = setInterval(() => setElapsed(Math.floor((base.current + Date.now() - startedAt.current) / 1000)), 250);
    return () => {
      clearInterval(t);
      if (!discard.current) base.current += Date.now() - startedAt.current;
    };
  }, [running]);

  return {
    elapsed,
    running,
    start: () => setRunning(true),
    pause: () => setRunning(false),
    reset: () => {
      setRunning(false);
      discard.current = true;
      base.current = 0;
      setElapsed(0);
    },
  };
}

export const clock = (s: number) => `${s < 0 ? "-" : ""}${Math.floor(Math.abs(s) / 60)}:${String(Math.abs(s) % 60).padStart(2, "0")}`;
