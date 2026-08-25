"use client";

import { useState, useTransition, useEffect } from "react";
import { searchContentForPickerAction, type ContentPickerRow } from "@/lib/admin/content-actions";
import { AdminInput } from "@/components/admin/ui";

interface ContentPickerProps {
  selectedIds: string[];
  excludeId?: string;
  onChange: (ids: string[]) => void;
}

/** Multi-select search picker backing the related-content block — same content table, no separate index. */
export function ContentPicker({ selectedIds, excludeId, onChange }: ContentPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContentPickerRow[]>([]);
  const [selectedItems, setSelectedItems] = useState<ContentPickerRow[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const rows = await searchContentForPickerAction(undefined, excludeId);
      setResults(rows);
      setSelectedItems((prev) => {
        const known = new Map(prev.map((row) => [row.id, row]));
        for (const row of rows) known.set(row.id, row);
        return selectedIds.map((id) => known.get(id)).filter((row): row is ContentPickerRow => Boolean(row));
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once to seed initial labels for already-selected ids
  }, []);

  function runSearch(next: string) {
    setQuery(next);
    startTransition(async () => {
      setResults(await searchContentForPickerAction(next || undefined, excludeId));
    });
  }

  function toggle(row: ContentPickerRow) {
    const isSelected = selectedIds.includes(row.id);
    if (isSelected) {
      onChange(selectedIds.filter((id) => id !== row.id));
      setSelectedItems((prev) => prev.filter((item) => item.id !== row.id));
    } else {
      onChange([...selectedIds, row.id]);
      setSelectedItems((prev) => [...prev, row]);
    }
  }

  return (
    <div>
      {selectedItems.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {selectedItems.map((item) => (
            <span key={item.id} className="flex items-center gap-2 border border-border px-2 py-1 font-body text-xs text-foreground">
              {item.title}
              <button type="button" onClick={() => toggle(item)} className="text-foreground-muted hover:text-danger">
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <AdminInput placeholder="Search content by title…" value={query} onChange={(e) => runSearch(e.target.value)} />
      </div>

      <div className="mt-2 max-h-48 overflow-y-auto border border-border">
        {results.length === 0 && !pending && <p className="p-3 font-body text-sm text-foreground-muted">No matches.</p>}
        {results.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => toggle(row)}
            className={`block w-full border-b border-border px-3 py-2 text-left font-body text-sm last:border-b-0 hover:bg-background ${
              selectedIds.includes(row.id) ? "text-secondary-400" : "text-foreground"
            }`}
          >
            {selectedIds.includes(row.id) ? "✓ " : ""}
            {row.title}
          </button>
        ))}
      </div>
    </div>
  );
}
