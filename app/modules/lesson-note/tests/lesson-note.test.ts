import { describe, it, expect } from "vitest";
import { describeNoteEditor, type NoteEditorInput } from "../index";

const saved = {
  body: "Generics are type parameters.",
  updatedAt: "2026-11-19T10:00:00.000Z",
};

function editor(overrides: Partial<NoteEditorInput>) {
  return describeNoteEditor({
    draft: "",
    saved: null,
    saving: false,
    error: undefined,
    maxLength: 10,
    ...overrides,
  });
}

describe("describeNoteEditor", () => {
  it("is empty and cannot save before the Student writes anything", () => {
    expect(editor({})).toEqual({
      length: 0,
      tooLong: false,
      canSave: false,
      status: { kind: "empty" },
    });
  });

  it("can save a new draft and calls it unsaved", () => {
    const state = editor({ draft: "hello" });
    expect(state.canSave).toBe(true);
    expect(state.length).toBe(5);
    expect(state.status).toEqual({ kind: "unsaved" });
  });

  it("cannot save a draft of only whitespace", () => {
    expect(editor({ draft: "   " }).canSave).toBe(false);
  });

  it("shows when the saved Note was last edited, and Save is off until it changes", () => {
    const state = editor({ draft: saved.body, saved, maxLength: 2000 });
    expect(state.canSave).toBe(false);
    expect(state.status).toEqual({ kind: "saved", updatedAt: saved.updatedAt });
  });

  it("does not count whitespace at the ends as an edit, since the server trims it", () => {
    const state = editor({
      draft: `  ${saved.body}\n`,
      saved,
      maxLength: 2000,
    });
    expect(state.status.kind).toBe("saved");
    expect(state.canSave).toBe(false);
  });

  it("calls an edited saved Note unsaved", () => {
    const state = editor({
      draft: `${saved.body} More.`,
      saved,
      maxLength: 2000,
    });
    expect(state.status).toEqual({ kind: "unsaved" });
    expect(state.canSave).toBe(true);
  });

  it("cannot save a cleared Note, since the server refuses an empty body", () => {
    const state = editor({ draft: "  ", saved, maxLength: 2000 });
    expect(state.status).toEqual({ kind: "unsaved" });
    expect(state.canSave).toBe(false);
  });

  it("allows a draft exactly at the limit", () => {
    const state = editor({ draft: "a".repeat(10) });
    expect(state.tooLong).toBe(false);
    expect(state.canSave).toBe(true);
  });

  it("refuses a draft over the limit", () => {
    const state = editor({ draft: "a".repeat(11) });
    expect(state.tooLong).toBe(true);
    expect(state.canSave).toBe(false);
    expect(state.status).toEqual({ kind: "too-long" });
  });

  it("measures the limit on the trimmed draft but counts what the Student typed", () => {
    const state = editor({ draft: ` ${"a".repeat(10)} ` });
    expect(state.tooLong).toBe(false);
    expect(state.length).toBe(12);
  });

  it("is saving while the save is in flight, and Save is off", () => {
    const state = editor({ draft: "hello", saving: true, error: "old" });
    expect(state.status).toEqual({ kind: "saving" });
    expect(state.canSave).toBe(false);
  });

  it("shows the error from a failed save", () => {
    const state = editor({ draft: "hello", error: "Not saved" });
    expect(state.status).toEqual({ kind: "error", message: "Not saved" });
    expect(state.canSave).toBe(true);
  });
});
