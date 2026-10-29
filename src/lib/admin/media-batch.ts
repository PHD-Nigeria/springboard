import { MAX_FILE_SIZE_BYTES, isAllowedMimeType } from "@/lib/admin/media-constants";

/**
 * Pure helpers for the temporary batch image importer
 * (components/admin/MediaBatchImport.tsx). No network, no React — kept apart
 * so the importer component stays about state and the rules here stay easy to
 * read. Validation deliberately defers to media-constants.ts, the same single
 * source of truth uploadMediaDirect() and the server actions use, so the
 * preview can never promise an upload the real workflow would refuse.
 */

export const BATCH_MAX_FILES = 100;

export type BatchValidation = { ok: true } | { ok: false; reason: string };

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateBatchFile(file: { name: string; type: string; size: number }): BatchValidation {
  if (file.size === 0) return { ok: false, reason: "Empty file (0 bytes)." };
  if (/\.(heic|heif)$/i.test(file.name) || /^image\/hei[cf]/i.test(file.type)) {
    return { ok: false, reason: "HEIC/HEIF photos aren't supported — convert to JPEG first." };
  }
  if (!isAllowedMimeType(file.type)) {
    return {
      ok: false,
      reason: `Unsupported type${file.type ? ` (${file.type})` : ""} — Springboard accepts JPEG, PNG or WebP.`,
    };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, reason: `Larger than the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MiB limit (${formatBytes(file.size)}).` };
  }
  return { ok: true };
}

/** The same identity the duplicate check uses everywhere: case-insensitive filename plus exact byte size. */
export function duplicateKey(name: string, size: number): string {
  return `${name.toLowerCase()}|${size}`;
}

/**
 * Quotes every cell, doubles embedded quotes, and neutralises spreadsheet
 * formula injection: a filename or alt text starting with = + - @ (or a tab /
 * carriage return) would otherwise be executed as a formula when the CSV is
 * opened in Excel.
 */
export function csvCell(value: string | number | boolean | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildCsv(header: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(","));
  // BOM so Excel on Windows reads the file as UTF-8; CRLF line endings per RFC 4180.
  return `﻿${lines.join("\r\n")}\r\n`;
}
