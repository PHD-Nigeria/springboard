/** Placeholder — publication/issue hero banner. No visual design yet. */
export function Hero({ title, subtitle }: { title: string; subtitle?: string | null }) {
  return (
    <header>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </header>
  );
}
