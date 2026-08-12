"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { duration, easing } from "@/design-system/tokens/motion";

/** Cross-fades between routes, using the shared motion tokens. */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: duration.base, ease: easing.standard }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
