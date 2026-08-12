import { notFound } from "next/navigation";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { parseBodyDocument } from "@/content-types/blocks";
import {
  blockDocumentFixture,
  blockDocumentFixtureMediaMap,
  blockDocumentFixtureRelatedContent,
} from "@/dev-fixtures/block-document.fixture";

export const metadata = {
  robots: { index: false, follow: false },
};

/**
 * Development-only verification page for the content.body block system —
 * proves parseBodyDocument + BlockRenderer work end-to-end for all 9 block
 * types using a hand-written fixture (src/dev-fixtures/), not real content
 * or a database query. 404s outside development so it never ships.
 */
export default function BlockFixturePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  // Runs the fixture through the same zod validation real content.body rows
  // go through, so this verifies parsing, not just rendering.
  const document = parseBodyDocument(blockDocumentFixture);

  return (
    <main>
      <h1>Block renderer fixture (development only)</h1>
      <p>
        Verifies parseBodyDocument + BlockRenderer against a fixture document with all{" "}
        {document.blocks.length} block types: {document.blocks.map((b) => b.type).join(", ")}.
      </p>
      <hr />
      <BlockRenderer
        blocks={document.blocks}
        mediaMap={blockDocumentFixtureMediaMap}
        relatedContent={blockDocumentFixtureRelatedContent}
      />
    </main>
  );
}
