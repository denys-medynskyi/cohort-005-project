export type NoteStatus =
  | { kind: "saving" }
  | { kind: "error"; message: string }
  | { kind: "too-long" }
  | { kind: "unsaved" }
  | { kind: "saved"; updatedAt: string }
  | { kind: "empty" };

export type NoteEditorState = {
  length: number;
  tooLong: boolean;
  canSave: boolean;
  status: NoteStatus;
};

export type NoteEditorInput = {
  draft: string;
  saved: { body: string; updatedAt: string } | null;
  saving: boolean;
  /** The error from the last save, if it failed. */
  error: string | undefined;
  maxLength: number;
};

/**
 * What the Lesson Note editor shows for the Student's current draft: the
 * character count, whether Save is enabled, and the one status line beside it.
 */
export function describeNoteEditor({
  draft,
  saved,
  saving,
  error,
  maxLength,
}: NoteEditorInput): NoteEditorState {
  const trimmed = draft.trim();
  const tooLong = trimmed.length > maxLength;
  // The server stores the trimmed body, so whitespace at the ends is not an edit.
  const changed = trimmed !== (saved?.body ?? "");
  const canSave = !saving && changed && trimmed.length > 0 && !tooLong;

  return {
    length: trimmed.length,
    tooLong,
    canSave,
    status: statusOf(),
  };

  function statusOf(): NoteStatus {
    if (saving) return { kind: "saving" };
    if (tooLong) return { kind: "too-long" };
    if (error) return { kind: "error", message: error };
    if (changed) return { kind: "unsaved" };
    if (saved) return { kind: "saved", updatedAt: saved.updatedAt };
    return { kind: "empty" };
  }
}
