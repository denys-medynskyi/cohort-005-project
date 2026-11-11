// PROTOTYPE — list admin feed entries (#18)
import { signFeedToken, fetchFeed } from "../app/lib/knock-prototype.server";
const f: any = (await fetchFeed(1, await signFeedToken(1))).body;
console.log(f.meta, f.entries.map((e: any) => [e.id, e.read_at, e.archived_at]));
