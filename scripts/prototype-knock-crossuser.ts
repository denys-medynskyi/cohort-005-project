// PROTOTYPE — does a user token act on another user's message by id? (#18, check 1 follow-up)
// Run: npx tsx scripts/prototype-knock-crossuser.ts
import { signFeedToken, fetchFeed, markMessages } from "../app/lib/knock-prototype.server";

const admin = await signFeedToken(1);
const student = await signFeedToken(5);
const feed: any = (await fetchFeed(1, admin)).body;
const id = feed.entries[0].id;
const state = async () => {
  const f: any = (await fetchFeed(1, admin)).body;
  const m = f.entries.find((e: any) => e.id === id);
  return { unread: f.meta.unread_count, read_at: m.read_at, archived_at: m.archived_at };
};

console.log("start", await state());
await markMessages("unread", [id], admin);
console.log("admin set unread", await state());

for (const status of ["read", "seen", "archived"] as const) {
  const r = await markMessages(status as any, [id], student);
  console.log(`student batch/${status}`, r.status, "body:", r.body.slice(0, 200), await state());
}

const single = await fetch(`https://api.knock.app/v1/messages/${id}/read`, {
  method: "PUT",
  headers: {
    Authorization: `Bearer ${process.env.KNOCK_PUBLIC_API_KEY}`,
    "X-Knock-User-Token": student,
  },
});
console.log("student PUT /messages/:id/read", single.status, (await single.text()).slice(0, 160), await state());

const get = await fetch(`https://api.knock.app/v1/messages/${id}`, {
  headers: {
    Authorization: `Bearer ${process.env.KNOCK_PUBLIC_API_KEY}`,
    "X-Knock-User-Token": student,
  },
});
console.log("student GET /messages/:id", get.status, (await get.text()).slice(0, 160));

await markMessages("unarchived" as any, [id], admin);
console.log("cleanup", await state());
