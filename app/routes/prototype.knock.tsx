// PROTOTYPE — throwaway page for "Does Knock hold up against Cadence?" (#18).
// Switch users with the DevUI panel; the Feed below should follow.
import { useRef, useState, useEffect } from "react";
import { Form, data } from "react-router";
import {
  KnockProvider,
  KnockFeedProvider,
  NotificationIconButton,
  NotificationFeedPopover,
  useKnockFeed,
  useNotificationStore,
} from "@knocklabs/react";
import "@knocklabs/react/dist/index.css";
import type { Route } from "./+types/prototype.knock";
import { getCurrentUserId } from "~/lib/session";
import {
  publicKnockConfig,
  signFeedToken,
  triggerRefundRequestRaised,
} from "~/lib/knock-prototype.server";

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await getCurrentUserId(request);
  if (!userId) return { userId: null, token: null, ...publicKnockConfig() };
  return { userId, token: await signFeedToken(userId), ...publicKnockConfig() };
}

export async function action({ request }: Route.ActionArgs) {
  const userId = await getCurrentUserId(request);
  if (!userId) throw data("Pick a user in DevUI", { status: 401 });
  return triggerRefundRequestRaised(userId);
}

export default function PrototypeKnock({ loaderData, actionData }: Route.ComponentProps) {
  const { userId, token, publicApiKey, feedChannelId } = loaderData;
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div className="rounded border-2 border-dashed border-amber-500 bg-amber-50 p-3 text-sm">
        PROTOTYPE — Knock spike (#18). Throwaway.
      </div>
      <pre className="text-xs bg-muted p-3 rounded">
        {JSON.stringify(
          { userId, hydrated, tokenTail: token?.slice(-12) ?? null, lastTrigger: actionData ?? null },
          null,
          2
        )}
      </pre>

      <Form method="post">
        <button className="rounded bg-primary text-primary-foreground px-3 py-1.5 text-sm">
          Raise a Refund Request as this user → notify every Platform Admin
        </button>
      </Form>

      {userId && token ? (
        <KnockProvider
          key={userId}
          apiKey={publicApiKey}
          user={{ id: String(userId) }}
          identificationStrategy="skip"
          userToken={token}
        >
          <KnockFeedProvider feedId={feedChannelId}>
            <StockFeed />
            <HeadlessFeed />
          </KnockFeedProvider>
        </KnockProvider>
      ) : (
        <p>No user — no Feed.</p>
      )}
    </div>
  );
}

function StockFeed() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm">Stock bell:</span>
      <NotificationIconButton ref={ref} onClick={() => setOpen(!open)} />
      <NotificationFeedPopover buttonRef={ref} isVisible={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function HeadlessFeed() {
  const { feedClient } = useKnockFeed();
  const { items, metadata, loading } = useNotificationStore(feedClient);
  const unseen = items.filter((i) => !i.seen_at);

  return (
    <div className="space-y-2">
      <h2 className="font-semibold">Headless Feed</h2>
      <pre className="text-xs bg-muted p-3 rounded">
        {JSON.stringify({ loading, metadata, itemCount: items.length }, null, 2)}
      </pre>
      <div className="flex gap-2 text-sm">
        <button className="border rounded px-2" disabled={unseen.length === 0} onClick={() => feedClient.markAsSeen(unseen)}>
          Mark all seen (Feed opened)
        </button>
        <button className="border rounded px-2" onClick={() => feedClient.markAllAsRead()}>
          Mark all read
        </button>
        <button className="border rounded px-2" onClick={() => feedClient.fetch()}>
          Refetch
        </button>
      </div>
      <ul className="text-sm space-y-1">
        {items.map((item) => (
          <li key={item.id} className="border rounded p-2 flex justify-between gap-2">
            <span
              dangerouslySetInnerHTML={{
                __html: (item.blocks[0] as { rendered: string }).rendered,
              }}
            />
            <span className="text-xs whitespace-nowrap">
              {item.seen_at ? "seen" : "unseen"} · {item.read_at ? "read" : "unread"}{" "}
              {item.read_at ? (
                <button className="underline" onClick={() => feedClient.markAsUnread(item)}>unread</button>
              ) : (
                <button className="underline" onClick={() => feedClient.markAsRead(item)}>read</button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
