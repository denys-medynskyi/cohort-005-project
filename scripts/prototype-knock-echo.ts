// PROTOTYPE — foreign batch call right after the owner's batch call (#18)
import { signFeedToken, fetchFeed, markMessages } from "../app/lib/knock-prototype.server";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const admin = await signFeedToken(1);
const student = await signFeedToken(5);
const id = ((await fetchFeed(1, admin)).body as any).entries[0].id;
const msg = async () => ((await fetchFeed(1, admin)).body as any).entries.find((e: any) => e.id === id);
for (const gap of [0, 1000, 3000, 10000]) {
  await markMessages("unread", [id], admin);
  await sleep(gap);
  const r = await markMessages("read", [id], student);
  await sleep(1500);
  console.log(`gap ${gap}ms: student batch/read`, r.status, "echoed:", r.body !== "[]", "admin read_at after:", (await msg()).read_at);
}
await markMessages("unread", [id], admin);
await markMessages("archived", [id], student);
await sleep(1500);
console.log("immediate student archive → admin archived_at:", JSON.stringify((await msg())?.archived_at));
