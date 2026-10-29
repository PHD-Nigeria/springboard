import { forwardRef } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

/**
 * Minimal, reused-everywhere admin UI primitives — deliberately plain
 * (sharp corners, no shadows, no motion) so the CMS reads as a fast
 * internal tool, not a second design system. Still uses the same brand
 * tokens as the public site (surface/border/foreground/primary/secondary)
 * so it doesn't clash with it, per the "one coherent product" instruction —
 * just applied at utilitarian density instead of editorial density.
 */

export function AdminLabel({ className = "", ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={`mb-1.5 block font-body text-xs font-medium tracking-wide text-foreground-muted uppercase ${className}`}
      {...props}
    />
  );
}

const fieldClass =
  "w-full border border-border bg-surface px-3 py-2 font-body text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus-visible:border-primary-500";

export const AdminInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function AdminInput(
  { className = "", ...props },
  ref
) {
  return <input ref={ref} className={`${fieldClass} ${className}`} {...props} />;
});

export function AdminTextarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldClass} ${className}`} {...props} />;
}

export function AdminSelect({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${fieldClass} ${className}`} {...props} />;
}

export function AdminButton({
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const variantClass = {
    primary: "border-secondary-400 bg-secondary-400 text-primary-900 hover:bg-secondary-300",
    secondary: "border-border bg-surface text-foreground hover:border-border-strong",
    danger: "border-danger bg-transparent text-danger hover:bg-danger/10",
    ghost: "border-transparent bg-transparent text-foreground-muted hover:text-foreground",
  }[variant];

  return (
    <button
      className={`border px-4 py-2 font-body text-sm font-medium tracking-wide transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-50 ${variantClass} ${className}`}
      {...props}
    />
  );
}

export function AdminCard({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`border border-border bg-surface p-6 ${className}`} {...props} />;
}

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-medium text-foreground">{title}</h1>
        {description && <p className="mt-1 font-body text-sm text-foreground-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  review: "In review",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
};

/** Marker colours use the PHD palette; the label is always body-ink text so contrast never depends on a brand colour. */
const STATUS_MARKER: Record<string, string> = {
  draft: "bg-border-strong",
  review: "bg-lavender",
  scheduled: "bg-coral",
  published: "bg-secondary-400",
  archived: "bg-foreground-muted",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-border bg-surface px-2 py-0.5 font-body text-xs font-medium whitespace-nowrap text-foreground">
      <span aria-hidden="true" className={`inline-block h-2 w-2 ${STATUS_MARKER[status] ?? "bg-border-strong"}`} />
      {statusLabel(status)}
    </span>
  );
}

/** Inline feedback. Errors are announced assertively, successes politely; never show success for a failed action. */
export function AdminNotice({
  tone,
  children,
  className = "",
}: {
  tone: "error" | "success" | "info";
  children: React.ReactNode;
  className?: string;
}) {
  const toneClass = {
    error: "border-danger bg-danger/10",
    success: "border-primary-500 bg-primary-50",
    info: "border-border-strong bg-surface-raised",
  }[tone];
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`border px-4 py-3 font-body text-sm text-foreground ${toneClass} ${className}`}
    >
      {children}
    </p>
  );
}

export function AdminEmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="border border-dashed border-border-strong bg-surface px-6 py-10 text-center">
      <p className="font-display text-base font-medium text-foreground">{title}</p>
      {children && <div className="mt-1 font-body text-sm text-foreground-muted">{children}</div>}
    </div>
  );
}
