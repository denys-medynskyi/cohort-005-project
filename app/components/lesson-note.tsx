import { useState } from "react";
import { useFetcher } from "react-router";
import { Lock, NotebookPen } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { MAX_NOTE_LENGTH } from "~/lib/notes";
import { cn, formatRelativeTime } from "~/lib/utils";
import { describeNoteEditor, type NoteStatus } from "~/modules/lesson-note";

/**
 * The Student's private Note on a Lesson. Laid out like the Questions &
 * Discussion card below it, so the two read as one family of panels.
 */
export function LessonNote({
  note,
}: {
  note: { body: string; updatedAt: string } | null;
}) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [draft, setDraft] = useState(note?.body ?? "");
  const editor = describeNoteEditor({
    draft,
    saved: note,
    saving: fetcher.state !== "idle",
    error: fetcher.data?.error,
    maxLength: MAX_NOTE_LENGTH,
  });

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <LessonNoteHeader />

        <fetcher.Form method="post" className="space-y-2">
          <input type="hidden" name="intent" value="save-note" />
          <Textarea
            name="body"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Jot down what you want to remember from this lesson..."
            aria-label="Your notes on this lesson"
            className="min-h-32 resize-y"
          />

          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={!editor.canSave}>
              {editor.status.kind === "saving" ? "Saving..." : "Save note"}
            </Button>
            <StatusLine status={editor.status} />
            <span
              className={cn(
                "ml-auto text-xs",
                editor.tooLong ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {editor.length} / {MAX_NOTE_LENGTH}
            </span>
          </div>
        </fetcher.Form>
      </CardContent>
    </Card>
  );
}

function LessonNoteHeader() {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <NotebookPen className="size-5 text-primary" />
        <h2 className="text-xl font-semibold">Your notes</h2>
      </div>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Lock className="size-3.5" />
        Only you can see these
      </span>
    </div>
  );
}

function StatusLine({ status }: { status: NoteStatus }) {
  switch (status.kind) {
    case "error":
      return (
        <span role="alert" className="text-xs text-destructive">
          {status.message}
        </span>
      );
    case "too-long":
      return (
        <span className="text-xs text-destructive">
          Too long to save. Trim it to {MAX_NOTE_LENGTH} characters.
        </span>
      );
    case "unsaved":
      return (
        <span className="text-xs text-muted-foreground">Unsaved changes</span>
      );
    case "saved":
      return (
        <span
          suppressHydrationWarning
          className="text-xs text-muted-foreground"
        >
          Saved {formatRelativeTime(status.updatedAt)}
        </span>
      );
    case "saving":
    case "empty":
      return null;
  }
}
