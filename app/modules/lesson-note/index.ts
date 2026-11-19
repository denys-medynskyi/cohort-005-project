import { describeNoteEditor as describe } from "./lib/editor-state";
import type { NoteEditorInput, NoteEditorState } from "./lib/editor-state";

export type {
  NoteEditorInput,
  NoteEditorState,
  NoteStatus,
} from "./lib/editor-state";

/**
 * What the Lesson Note editor shows for the Student's current draft: the
 * character count, whether Save is enabled, and the one status line beside it.
 */
export function describeNoteEditor(input: NoteEditorInput): NoteEditorState {
  return describe(input);
}
