"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";
import { duration, easing } from "@/design-system/tokens/motion";

const variants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

/** Fades/slides content in as it enters the viewport, using the shared motion tokens. */
export function ScrollReveal({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-10% 0px" }}
      variants={variants}
      transition={{ duration: duration.slow, ease: easing.editorialIn }}
    >
      {children}
    </motion.div>
  );
}
