import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { UserRole } from "~/db/schema";
import { getNote, listNotesForStudent, saveNote } from "./notes.server";

type TestDb = ReturnType<typeof createTestDb>;

const NOW = new Date(2026, 9, 6, 12, 0, 0);

function minutesAfter(minutes: number) {
  return new Date(NOW.getTime() + minutes * 60_000);
}

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let lessonIds: number[];

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);

  const module = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();

  lessonIds = [1, 2, 3].map(
    (position) =>
      db
        .insert(schema.lessons)
        .values({ moduleId: module.id, title: `Lesson ${position}`, position })
        .returning()
        .get().id
  );
});

describe("saving a Note", () => {
  it("creates a Note with the body trimmed", () => {
    const result = saveNote(db, base.user.id, lessonIds[0], "  Rewatch 4:10  ", NOW);

    expect(result).toMatchObject({
      ok: true,
      note: {
        body: "Rewatch 4:10",
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      },
    });
  });

  it("replaces the body and moves the last edited time on when saved again", () => {
    saveNote(db, base.user.id, lessonIds[0], "First thought", NOW);
    saveNote(db, base.user.id, lessonIds[0], "Second thought", minutesAfter(30));

    expect(getNote(db, base.user.id, lessonIds[0])).toMatchObject({
      body: "Second thought",
      createdAt: NOW.toISOString(),
      updatedAt: minutesAfter(30).toISOString(),
    });
  });

  it("never leaves a Student with two Notes on the same Lesson", () => {
    saveNote(db, base.user.id, lessonIds[0], "One", NOW);
    saveNote(db, base.user.id, lessonIds[0], "Two", minutesAfter(1));

    expect(listNotesForStudent(db, base.user.id)).toHaveLength(1);
    expect(() =>
      db
        .insert(schema.notes)
        .values({ userId: base.user.id, lessonId: lessonIds[0], body: "Three" })
        .run()
    ).toThrow();
  });

  it("accepts a Note of exactly 2,000 characters", () => {
    const result = saveNote(db, base.user.id, lessonIds[0], "a".repeat(2000), NOW);

    expect(result.ok).toBe(true);
  });

  it("refuses a Note over 2,000 characters", () => {
    const result = saveNote(db, base.user.id, lessonIds[0], "a".repeat(2001), NOW);

    expect(result).toEqual({
      ok: false,
      error: "A note must be 2,000 characters or fewer.",
    });
    expect(getNote(db, base.user.id, lessonIds[0])).toBeUndefined();
  });

  it("refuses an empty Note", () => {
    const result = saveNote(db, base.user.id, lessonIds[0], "   ", NOW);

    expect(result.ok).toBe(false);
    expect(getNote(db, base.user.id, lessonIds[0])).toBeUndefined();
  });
});

describe("listing a Student's Notes", () => {
  it("lists only that Student's Notes, last edited first, with Lesson and Course", () => {
    const other = db
      .insert(schema.users)
      .values({ name: "Other", email: "other@example.com", role: UserRole.Student })
      .returning()
      .get();
    saveNote(db, base.user.id, lessonIds[0], "Older", NOW);
    saveNote(db, base.user.id, lessonIds[2], "Newer", minutesAfter(5));
    saveNote(db, other.id, lessonIds[1], "Not mine", minutesAfter(10));

    expect(listNotesForStudent(db, base.user.id)).toMatchObject([
      {
        body: "Newer",
        lessonId: lessonIds[2],
        lessonTitle: "Lesson 3",
        courseTitle: "Test Course",
        courseSlug: "test-course",
      },
      {
        body: "Older",
        lessonId: lessonIds[0],
        lessonTitle: "Lesson 1",
        courseTitle: "Test Course",
        courseSlug: "test-course",
      },
    ]);
  });

  it("moves a re-saved Note to the top", () => {
    saveNote(db, base.user.id, lessonIds[0], "First", NOW);
    saveNote(db, base.user.id, lessonIds[1], "Second", minutesAfter(5));
    saveNote(db, base.user.id, lessonIds[0], "First, edited", minutesAfter(10));

    expect(
      listNotesForStudent(db, base.user.id).map((note) => note.body)
    ).toEqual(["First, edited", "Second"]);
  });
});
