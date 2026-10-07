'use client';

import { useEffect, useState } from 'react';

// How long the overlay stays mounted; matches the CSS animation in globals.css.
export const REST_END_FLASH_MS = 1500;

interface Props {
  // Bumped by the caller each time a rest runs out with the flash preference
  // on (issue #393). Zero means no flash yet.
  count: number;
}

// Full-screen, click-through colour flash at the end of a rest, for a gym too
// loud for the beep. The animation lives in the `.rest-end-flash` class, which
// swaps the blink for a static colour under prefers-reduced-motion.
export function RestEndFlash({ count }: Props) {
  const [visibleFor, setVisibleFor] = useState(0);

  useEffect(() => {
    if (count === 0) return;
    setVisibleFor(count);
    const id = setTimeout(() => setVisibleFor(0), REST_END_FLASH_MS);
    return () => clearTimeout(id);
  }, [count]);

  if (visibleFor === 0) return null;
  return (
    <div
      key={visibleFor}
      aria-hidden="true"
      data-testid="rest-end-flash"
      className="rest-end-flash pointer-events-none fixed inset-0 z-50 bg-primary"
    />
  );
}
