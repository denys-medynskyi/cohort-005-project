// PROTOTYPE — throwaway spike for "Does Knock hold up against Cadence?" (#18).
// Not production code. Lives on the prototype/knock-spike branch only.
import Knock, { signUserToken } from "@knocklabs/node";
import { eq } from "drizzle-orm";
import { db } from "~/db";
import { users, UserRole } from "~/db/schema";

// Vite doesn't put non-VITE_ .env values on process.env.
process.loadEnvFile(".env");

const env = {
  apiKey: process.env.KNOCK_API_KEY!,
  publicApiKey: process.env.KNOCK_PUBLIC_API_KEY!,
  signingKey: process.env.KNOCK_SIGNING_KEY!,
  feedChannelId: process.env.KNOCK_FEED_CHANNEL_ID!,
};

const knock = new Knock({ apiKey: env.apiKey });

export function publicKnockConfig() {
  return { publicApiKey: env.publicApiKey, feedChannelId: env.feedChannelId };
}

export function signFeedToken(userId: number) {
  // KNOCK_SIGNING_KEY is base64 PEM; signUserToken accepts it as-is.
  return signUserToken(String(userId), {
    signingKey: env.signingKey,
    expiresInSeconds: 3600,
  });
}

function recipient(user: typeof users.$inferSelect) {
  return { id: String(user.id), email: user.email, name: user.name };
}

// Refund Request raised → every Platform Admin.
export async function triggerRefundRequestRaised(buyerId: number) {
  const buyer = db.select().from(users).where(eq(users.id, buyerId)).get()!;
  const admins = db
    .select()
    .from(users)
    .where(eq(users.role, UserRole.Admin))
    .all();

  const result = await knock.workflows.trigger("refund-request-raised", {
    recipients: admins.map(recipient),
    data: {
      buyer_name: buyer.name,
      course_title: "Prototype Course",
      review_url: "/admin/refunds",
    },
  });

  return { workflowRunId: result.workflow_run_id, recipientIds: admins.map((a) => a.id) };
}

// Headless Feed API, called the way a browser would: public key + user token.
const API = "https://api.knock.app/v1";

function feedHeaders(token: string) {
  return {
    Authorization: `Bearer ${env.publicApiKey}`,
    "X-Knock-User-Token": token,
    "Content-Type": "application/json",
  };
}

export async function fetchFeed(asUserId: number, token: string) {
  const res = await fetch(
    `${API}/users/${asUserId}/feeds/${env.feedChannelId}`,
    { headers: feedHeaders(token) }
  );
  return { status: res.status, body: res.ok ? await res.json() : await res.text() };
}

export async function markMessages(
  status: "seen" | "read" | "unread" | "unseen" | "archived" | "unarchived",
  messageIds: string[],
  token: string
) {
  const res = await fetch(`${API}/messages/batch/${status}`, {
    method: "POST",
    headers: feedHeaders(token),
    body: JSON.stringify({ message_ids: messageIds }),
  });
  return { status: res.status, body: await res.text() };
}
