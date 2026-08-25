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
  "w-full border border-border bg-surface px-3 py-2 font-body text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus-visible:border-secondary-400";

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

const STATUS_CLASSES: Record<string, string> = {
  draft: "text-foreground-muted border-border",
  review: "text-lavender border-lavender",
  scheduled: "text-coral border-coral",
  published: "text-secondary-400 border-secondary-400",
  archived: "text-foreground-muted border-border",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block border px-2 py-0.5 font-body text-xs font-medium tracking-wide uppercase ${STATUS_CLASSES[status] ?? "text-foreground-muted border-border"}`}
    >
      {status}
    </span>
  );
}
