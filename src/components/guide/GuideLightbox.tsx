"use client";

import { useEffect, useState, type MouseEvent } from "react";

interface LightboxImage {
  src: string;
  alt: string;
}

/**
 * Click-to-enlarge for every screenshot in the guide, wrapping the whole
 * article area rather than living inside it. React's own event delegation
 * (the click handler is only ever attached to this one wrapper) is what
 * makes this survive client-side navigation between chapters: each chapter
 * page swaps in a fresh <GuideArticle> element, but this wrapper — declared
 * once in the shared guide layout — never unmounts, so the listener never
 * needs re-attaching. An earlier version attached the listener directly to
 * the article DOM node found via getElementById in a mount-only effect;
 * that node gets replaced on every chapter navigation, so the very first
 * client-side navigation silently left every later screenshot un-clickable
 * — caught testing Previous/Next before this shipped.
 */
export function GuideLightbox({ children, className }: { children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState<LightboxImage | null>(null);

  function onClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) return;
    if (!target.classList.contains("guide-image")) return;
    setOpen({ src: target.currentSrc || target.src, alt: target.alt });
  }

  // A real document-level listener, not a React onKeyDown on the wrapper
  // below: Escape needs to close the modal regardless of what currently has
  // focus, and a keydown that starts on <body> (nothing focused inside the
  // modal) never bubbles through this component's own DOM subtree for a
  // React handler to see. Scoped to `open` so it's only attached while the
  // modal is actually up.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div onClick={onClick} className={className}>
      {children}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={open.alt}
          onClick={() => setOpen(null)}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-background/90 p-6"
        >
          <button
            type="button"
            onClick={() => setOpen(null)}
            aria-label="Close"
            className="fixed top-4 right-4 border border-border bg-surface px-3 py-1.5 font-body text-sm text-foreground hover:border-secondary-400"
          >
            Close ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- full-resolution screenshot, shown at natural size; next/image's optimizer adds nothing here. */}
          <img src={open.src} alt={open.alt} onClick={(event) => event.stopPropagation()} className="max-w-none cursor-zoom-out" />
        </div>
      )}
    </div>
  );
}
