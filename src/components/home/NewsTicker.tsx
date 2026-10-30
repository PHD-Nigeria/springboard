import Link from "next/link";
import type { Content } from "@/content-types/types";
import { formatTickerDate } from "@/lib/content/home-helpers";

/**
 * The "News bites" strip under the masthead: the newest real headlines, scrolling slowly. It pauses on hover or keyboard
 * focus, and for visitors who prefer reduced motion it does not move at all (it becomes a plain horizontally scrollable
 * row). The second copy of the list exists only to make the loop seamless, so it is hidden from assistive technology and
 * from keyboard focus.
 */
export function NewsTicker({ items }: { items: Content[] }) {
  const stories = items.filter((item) => item.href);
  if (stories.length === 0) return null;

  const row = (hidden: boolean) => (
    <ul className="home-ticker-row" aria-hidden={hidden || undefined}>
      {stories.map((item) => (
        <li key={item.id}>
          <Link href={item.href!} tabIndex={hidden ? -1 : undefined}>
            {item.publishedAt && <span className="home-ticker-date">{formatTickerDate(item.publishedAt)}</span>}
            {item.title}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <section aria-label="News bites" className="home-ticker">
      <p className="home-ticker-label">News bites</p>
      <div className="home-ticker-viewport">
        <div className="home-ticker-track">
          {row(false)}
          {row(true)}
        </div>
      </div>
    </section>
  );
}
