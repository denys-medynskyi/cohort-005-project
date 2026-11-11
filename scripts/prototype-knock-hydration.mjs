// PROTOTYPE (#18). Needs playwright-core (not a project dep) and the dev server on :5199.
// Drives /prototype/knock in headless Chrome: hydration errors, Feed load, DevUI switch.
import { chromium } from "playwright-core";

const BASE = "http://localhost:5199";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

const consoleMsgs = [];
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type())) consoleMsgs.push(`[${m.type()}] ${m.text().slice(0, 300)}`);
});
page.on("pageerror", (e) => consoleMsgs.push(`[pageerror] ${e.message.slice(0, 300)}`));
const knockCalls = [];
page.on("request", (r) => {
  if (r.url().includes("knock.app")) knockCalls.push(`${r.method()} ${r.url().replace(/\?.*/, "")}`);
});
page.on("websocket", (ws) => knockCalls.push(`WS ${ws.url().replace(/\?.*/, "")}`));

const pre = async (i) => page.locator("pre").nth(i).textContent();

// Start as the admin.
await ctx.request.post(`${BASE}/api/switch-user?redirectTo=/prototype/knock`, { form: { userId: "1" }, maxRedirects: 0 });
await page.goto(`${BASE}/prototype/knock`, { waitUntil: "networkidle" });
await page.waitForFunction(() => document.querySelectorAll("pre")[1]?.textContent.includes('"itemCount"'));
await page.waitForTimeout(1500);
console.log("== admin, after hydrate\n", await pre(0), "\n", await pre(1));
console.log("items:", await page.locator("li").count(), "badge:", await page.locator(".rnf-badge").allTextContents());

// Stock popover opens without errors.
await page.locator(".rnf-notification-icon-button").click();
await page.waitForTimeout(1000);
console.log("popover cells:", await page.locator(".rnf-notification-cell").count());
await page.keyboard.press("Escape");

// Client-side DevUI switch to Emma (student, id 5), no full reload.
const navBefore = await page.evaluate(() => performance.getEntriesByType("navigation").length);
knockCalls.length = 0;
await page.getByRole("button", { name: "Switch user" }).click();
await page.getByRole("button", { name: /Emma Wilson/ }).click();
await page.waitForFunction(() => document.querySelector("pre")?.textContent.includes('"userId": 5'));
await page.waitForTimeout(2500);
console.log("\n== after DevUI switch to 5 (full reload?", (await page.evaluate(() => performance.getEntriesByType("navigation").length)) !== navBefore, ")\n", await pre(0), "\n", await pre(1));
console.log("items:", await page.locator("li").count());
console.log("knock calls after switch:\n ", [...new Set(knockCalls)].join("\n  "));

console.log("\n== console errors/warnings\n", consoleMsgs.length ? consoleMsgs.join("\n") : "(none)");
await browser.close();
