"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AdminButton, AdminInput, AdminLabel, AdminNotice } from "@/components/admin/ui";
import {
  createEditionPdfUploadUrlAction,
  completeEditionPdfUploadAction,
  detachEditionPdfAction,
  MAX_EDITION_PDF_BYTES,
} from "@/lib/admin/edition-pdf-actions";
import { EDITION_PDF_BUCKET } from "@/lib/storage/buckets";

/** Browser-direct upload (the file never passes through a Server Action), then the server verifies the object and records it. */
export function EditionPdfPanel({
  editionId,
  current,
  initialPeriodLabel,
  initialPeriodStart,
}: {
  editionId: string;
  current: { filename: string | null; sizeBytes: number | null; url: string } | null;
  initialPeriodLabel: string;
  initialPeriodStart: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [periodLabel, setPeriodLabel] = useState(initialPeriodLabel);
  const [periodStart, setPeriodStart] = useState(initialPeriodStart);

  function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return setMessage({ tone: "error", text: "Choose a PDF file first." });
    if (file.type !== "application/pdf") return setMessage({ tone: "error", text: "Only PDF files can be attached." });
    if (file.size > MAX_EDITION_PDF_BYTES) return setMessage({ tone: "error", text: "That PDF is larger than 50 MB." });
    startTransition(async () => {
      setMessage(null);
      const prepared = await createEditionPdfUploadUrlAction({ fileSize: file.size, mimeType: file.type });
      if (prepared.error || !prepared.path || !prepared.token) return setMessage({ tone: "error", text: prepared.error ?? "Upload could not start." });
      const { error } = await createClient().storage.from(EDITION_PDF_BUCKET).uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: "application/pdf" });
      if (error) return setMessage({ tone: "error", text: "The upload failed. Please try again." });
      const done = await completeEditionPdfUploadAction({ editionId, path: prepared.path, filename: file.name, periodLabel, periodStart });
      if (done.error) return setMessage({ tone: "error", text: done.error });
      if (fileRef.current) fileRef.current.value = "";
      setMessage({ tone: "success", text: "PDF attached. It now appears on the Archive card." });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 p-4 font-body text-sm">
      <div role="status" aria-live="polite">{message && <AdminNotice tone={message.tone}>{message.text}</AdminNotice>}</div>
      {current ? (
        <p className="text-foreground">
          Current PDF:{" "}
          <a href={current.url} target="_blank" rel="noopener noreferrer" className="text-primary-600 underline underline-offset-2">
            {current.filename ?? "edition.pdf"}
          </a>
          {current.sizeBytes ? ` (${(current.sizeBytes / 1048576).toFixed(1)} MB)` : ""}
        </p>
      ) : (
        <p className="text-foreground-muted">No PDF attached. The Archive card shows no download until one is.</p>
      )}
      <div>
        <AdminLabel htmlFor="pdf-period-label">Period label (shown on the card)</AdminLabel>
        <AdminInput id="pdf-period-label" value={periodLabel} maxLength={80} placeholder="e.g. Q2 2026" onChange={(e) => setPeriodLabel(e.target.value)} />
      </div>
      <div>
        <AdminLabel htmlFor="pdf-period-start">Period start date (orders the Archive, newest first)</AdminLabel>
        <AdminInput id="pdf-period-start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
      </div>
      <div>
        <AdminLabel htmlFor="pdf-file">PDF file (max 50 MB)</AdminLabel>
        <input id="pdf-file" ref={fileRef} type="file" accept="application/pdf" className="block w-full text-sm" />
      </div>
      <div className="flex flex-wrap gap-2">
        <AdminButton type="button" disabled={pending} onClick={upload}>{pending ? "Working…" : current ? "Replace PDF" : "Upload PDF"}</AdminButton>
        {current && (
          <AdminButton
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await detachEditionPdfAction(editionId);
                setMessage(r.error ? { tone: "error", text: r.error } : { tone: "success", text: "PDF detached from this edition. The file itself is kept in storage." });
                router.refresh();
              })
            }
          >
            Detach PDF
          </AdminButton>
        )}
      </div>
    </div>
  );
}
