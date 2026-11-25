import { IDEAS_SUBJECT, buildIdeasMailto } from "@/lib/ideas/mailto";

function BulbIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" />
    </svg>
  );
}

const base = "inline-flex h-10 items-center gap-2 border px-3 font-body text-[13px] font-semibold whitespace-nowrap xl:h-9 xl:px-3.5";

/** Header button, top-right, separate from the nav menu. A real mailto link once an address is configured; a disabled button (no link) until then. */
export function ShareIdeasButton({ email }: { email: string | null }) {
  const href = email ? buildIdeasMailto(email) : null;
  if (!href) {
    return (
      <button type="button" disabled aria-disabled="true" title="Share Your Ideas is not available yet" className={`${base} cursor-not-allowed border-primary-700 text-foreground-muted opacity-60`}>
        <BulbIcon />
        <span className="sr-only sm:not-sr-only">Share Your Ideas</span><span aria-hidden="true" className="sm:hidden">Ideas</span>
      </button>
    );
  }
  return (
    <a href={href} className={`${base} border-secondary-400 bg-secondary-400 text-primary-900 transition-colors duration-fast hover:bg-secondary-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-400`} data-subject={IDEAS_SUBJECT}>
      <BulbIcon />
      <span className="sr-only sm:not-sr-only">Share Your Ideas</span><span aria-hidden="true" className="sm:hidden">Ideas</span>
    </a>
  );
}
