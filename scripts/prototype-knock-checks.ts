// PROTOTYPE — automated half of the Knock spike (#18): checks 1–3.
// Run: npx tsx scripts/prototype-knock-checks.ts
import {
  signFeedToken,
  triggerRefundRequestRaised,
  fetchFeed,
  markMessages,
} from "../app/lib/knock-prototype.server";

const ADMIN = 1; // Alex Rivera, the seed's only Platform Admin
const STUDENT = 5; // Emma Wilson, the buyer

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (label: string, v: unknown) =>
  console.log(`\n## ${label}\n`, JSON.stringify(v, null, 2));

// --- Check 1: signed Feed tokens, no cross-user reads
const adminToken = await signFeedToken(ADMIN);
const studentToken = await signFeedToken(STUDENT);
const [h, p] = adminToken.split(".").slice(0, 2).map((s) => JSON.parse(Buffer.from(s, "base64url").toString()));
log("1a token header/payload", { header: h, payload: p, ttl: p.exp - p.iat });
log("1b admin reads own feed", (await fetchFeed(ADMIN, adminToken)).status);
log("1c student token → admin feed", await fetchFeed(ADMIN, studentToken));
log("1d no token header → admin feed", (await fetch(`https://api.knock.app/v1/users/${ADMIN}/feeds/${process.env.KNOCK_FEED_CHANNEL_ID}`, { headers: { Authorization: `Bearer ${process.env.KNOCK_PUBLIC_API_KEY}` } })).status);
log("1e never-notified user's feed", await fetchFeed(44, await signFeedToken(44)));

// --- Check 2: trigger a real Kind, inline recipients
const before = (await fetchFeed(ADMIN, adminToken)).body as any;
const trig = await triggerRefundRequestRaised(STUDENT);
log("2a trigger", trig);
let after: any;
const t0 = Date.now();
for (let i = 0; i < 20; i++) {
  await sleep(1000);
  after = (await fetchFeed(ADMIN, adminToken)).body;
  if (after.meta.total_count > before.meta.total_count) break;
}
const newest = after.entries[0];
log("2b arrived in admin feed", {
  afterMs: Date.now() - t0,
  totalBefore: before.meta.total_count,
  totalAfter: after.meta.total_count,
  newest: { id: newest.id, workflow: newest.source.key, blocks: newest.blocks, seen_at: newest.seen_at, read_at: newest.read_at, actors: newest.actors, data: newest.data },
});

// --- Check 3: headless list, unread count, seen vs read
const meta = () => fetchFeed(ADMIN, adminToken).then((r: any) => r.body.meta);
log("3a meta before", await meta());
log("3b mark seen", await markMessages("seen", [newest.id], adminToken));
log("3c meta after seen", await meta());
log("3d mark read", await markMessages("read", [newest.id], adminToken));
log("3e meta after read", await meta());
log("3f mark unread", await markMessages("unread", [newest.id], adminToken));
log("3g meta after unread", await meta());
log("3h student token marks admin's message read", await markMessages("read", [newest.id], studentToken));
log("3i empty message_ids", await markMessages("read", [], adminToken));
