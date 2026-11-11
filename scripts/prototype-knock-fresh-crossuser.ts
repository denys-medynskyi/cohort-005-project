// PROTOTYPE — foreign token vs a freshly created message (#18, check 1 follow-up)
// Run: npx tsx scripts/prototype-knock-fresh-crossuser.ts
import { signFeedToken, fetchFeed, markMessages, triggerRefundRequestRaised } from "../app/lib/knock-prototype.server";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const admin = await signFeedToken(1);
const student = await signFeedToken(5);
const total0 = ((await fetchFeed(1, admin)).body as any).meta.total_count;
await triggerRefundRequestRaised(5);
let feed: any;
while (true) {
  await sleep(500);
  feed = (await fetchFeed(1, admin)).body;
  if (feed.meta.total_count > total0) break;
}
const id = feed.entries[0].id;
const msg = async () => ((await fetchFeed(1, admin)).body as any).entries.find((e: any) => e.id === id);

for (const delay of [0, 2000, 5000, 15000, 30000]) {
  await sleep(delay);
  const r = await markMessages("read", [id], student);
  const m = await msg();
  console.log(`+${delay}ms student batch/read`, r.status, "echoed:", r.body !== "[]", "admin read_at:", m.read_at);
}
const a = await markMessages("archived", [id], student);
console.log("student batch/archived", a.status, "echoed:", a.body !== "[]", "admin archived_at:", (await msg()).archived_at);
