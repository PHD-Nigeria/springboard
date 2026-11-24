"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { GalleryGroup, GalleryPhoto } from "@/lib/content/gallery-queries";

/** Responsive grouped grid with an accessible lightbox (native <dialog>: focus trap, Escape, focus return). Arrow keys move between photos. */
export function GalleryGrid({ groups }: { groups: GalleryGroup[] }) {
  const flat: GalleryPhoto[] = groups.flatMap((g) => g.photos);
  const [index, setIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const open = (i: number, el: HTMLElement) => {
    openerRef.current = el;
    setIndex(i);
  };
  const close = useCallback(() => setIndex(null), []);
  const step = useCallback((d: number) => setIndex((i) => (i === null ? i : (i + d + flat.length) % flat.length)), [flat.length]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (index !== null && !dialog.open) dialog.showModal();
    if (index === null && dialog.open) {
      dialog.close();
      openerRef.current?.focus();
    }
  }, [index]);

  const current = index === null ? null : flat[index];
  const offsets = groups.map((_, gi) => groups.slice(0, gi).reduce((n, g) => n + g.photos.length, 0));

  return (
    <>
      {groups.map((group, gi) => (
        <section key={group.title} aria-label={group.title} className="mb-12">
          <h2 className="mb-4 border-b border-border pb-2 font-display text-xl font-semibold text-foreground">{group.title}</h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {group.photos.map((photo, pi) => {
              const i = offsets[gi] + pi;
              return (
                <li key={photo.id}>
                  <button
                    type="button"
                    onClick={(e) => open(i, e.currentTarget)}
                    aria-label={`Open photo: ${photo.alt || photo.caption || "photograph"}`}
                    className="group relative block aspect-[4/5] w-full overflow-hidden bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                  >
                    <Image src={photo.url} alt={photo.alt} fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" className="object-cover transition-transform group-hover:scale-[1.02]" loading={i < 4 ? "eager" : "lazy"} />
                  </button>
                  {photo.caption && <p className="mt-1 font-body text-xs text-foreground-muted">{photo.caption}</p>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <dialog
        ref={dialogRef}
        aria-label="Photo viewer"
        onClose={close}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") step(1);
          if (e.key === "ArrowLeft") step(-1);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="m-auto max-h-[96svh] w-[min(96vw,64rem)] bg-primary-900 p-0 text-white backdrop:bg-black/80"
      >
        {current && (
          <div className="flex max-h-[96svh] flex-col">
            <div className="relative h-[70svh] w-full">
              <Image src={current.url} alt={current.alt} fill sizes="96vw" className="object-contain" />
            </div>
            <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 font-body text-sm">
              <div className="min-w-0 flex-1">
                {current.caption && <p className="font-medium">{current.caption}</p>}
                {current.description && <p className="mt-1 text-white/80">{current.description}</p>}
                <p className="mt-1 text-xs text-white/60" aria-live="polite">
                  {(index ?? 0) + 1} of {flat.length} · {current.group}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => step(-1)} className="border border-white/40 px-3 py-1.5 hover:bg-white/10">Previous</button>
                <button type="button" onClick={() => step(1)} className="border border-white/40 px-3 py-1.5 hover:bg-white/10">Next</button>
                <button type="button" onClick={close} autoFocus className="border border-secondary-400 bg-secondary-400 px-3 py-1.5 font-medium text-primary-900">Close</button>
              </div>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
