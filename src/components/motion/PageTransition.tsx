"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { duration, easing } from "@/design-system/tokens/motion";

/**
 * The Ascension-inspired left→right wipe: a solid, full-viewport bar that
 * sweeps across the screen on every navigation. Implemented as a single
 * continuous translateX from -100% to 100% — because the bar is full
 * viewport width, that one motion both covers the outgoing view (as it
 * slides in from the left) and uncovers the incoming one (as it continues
 * out to the right), which is simpler and more robust than animating scaleX
 * with a mid-animation transform-origin flip.
 *
 * Deliberately does NOT wrap `children` in its own enter/exit animation —
 * letting Next.js's router hold the old page until the new one is ready
 * (its default App Router behavior with no loading.tsx) and swap instantly
 * underneath the sweep avoids fighting RSC streaming with AnimatePresence,
 * and keeps navigation non-blocking with no spinner.
 *
 * `key={pathname}` is what actually drives the animation: every pathname
 * change (Link clicks AND browser back/forward, both funnel through
 * usePathname()) remounts this element, replaying the sweep from scratch.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  return (
    <>
      {!reduceMotion && (
        <motion.div
          key={pathname}
          aria-hidden
          className="pointer-events-none fixed inset-0 z-50 bg-secondary-500"
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: duration.page, ease: easing.emphasized }}
        />
      )}
      {children}
    </>
  );
}
