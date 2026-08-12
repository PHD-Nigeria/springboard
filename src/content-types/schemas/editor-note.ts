import { z } from "zod";

/** EDITOR_NOTE carries no type-specific fields beyond the shared content columns. */
export const editorNoteMetadataSchema = z.object({}).strict();

export type EditorNoteMetadata = z.infer<typeof editorNoteMetadataSchema>;
