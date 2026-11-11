// PROTOTYPE — inspect the admin's newest messages server-side (#18)
import Knock from "@knocklabs/node";
process.loadEnvFile(".env");
const knock = new Knock({ apiKey: process.env.KNOCK_API_KEY! });
const page = await knock.users.listMessages("1");
for (const m of page.items.slice(0, 4)) console.log(m.id, m.inserted_at, "read:", m.read_at, "archived:", m.archived_at, "updated:", m.updated_at);
