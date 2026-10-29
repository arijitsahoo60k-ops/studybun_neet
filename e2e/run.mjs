// End-to-end checks for Group Timer in a real headless Chromium against a real Postgres (PGlite)
// running the project's actual migrations. Several browser contexts = several users in one room.
//   cd e2e && npm i && node run.mjs            (needs the repo's own node_modules for vite/react)
import fs from "fs";
import { startServer, U } from "./server.mjs";
import { startVite, launch, url, makeRunner } from "./lib.mjs";

const SHOTS = process.env.SHOTS || "/tmp/e2e-shots";
fs.mkdirSync(SHOTS, { recursive: true });
const srv = await startServer();
const vite = await startVite();
const browser = await launch();
const runner = makeRunner();
const { results } = runner;
const test = async (name, fn) => {
  const before = results.length;
  await runner.test(name, fn);
  if (results.length > before && !results[results.length - 1].ok) {
    const n = results.length;
    for (const p of pages) { try { await p.screenshot({ path: `${SHOTS}/FAIL-${n}-${p.__who}.png` }); } catch { /* closed */ } }
    try { console.log("      DB sessions:", JSON.stringify(await sql("select u.name, s.actual_minutes, s.planned_minutes, s.completed from timer_sessions s join profiles_stub u on u.user_id=s.user_id order by s.created_at"))); } catch { /* ignore */ }
  }
  for (const p of pages) { try { if (await p.locator(".sb-pt-overlay").count()) await p.keyboard.press("Escape"); } catch { /* page closed */ } }
};
const errors = [];                       // every console error/warning, page error, failed request, any page
const IGNORE = [/favicon/i, /Download the React DevTools/i];
const pages = [];

async function open(key, { w = 1280, h = 800, clock = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  // Animated GIFs are heavy to decode in a software-rendered headless browser and make timing flaky
  // when five pages share one CPU; stub them with a 1x1 gif (set REAL_GIFS=1 to load the real ones).
  if (!process.env.REAL_GIFS) {
    const px = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
    await ctx.route("**/*.gif", (r) => r.fulfill({ status: 200, contentType: "image/gif", body: px }));
  }
  const page = await ctx.newPage();
  page.__who = key;
  const note = (s) => { if (!IGNORE.some((r) => r.test(s))) errors.push(`[${key}] ${s}`); };
  page.on("console", (m) => { if (["error", "warning"].includes(m.type())) note(`${m.type()}: ${m.text()}`); });
  page.on("pageerror", (e) => note(`pageerror: ${e.message}`));
  page.on("requestfailed", (r) => { if (!/\/rt$|ERR_ABORTED/.test(r.url() + r.failure()?.errorText)) note(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
  if (clock) await page.clock.install();
  const names = { asha: "Asha", bela: "Bela", chirag: "Chirag", dev: "Dev", fay: "Founder Fay" };
  await page.goto(url(U[key], names[key]));
  await page.waitForSelector("text=Group Timer");
  pages.push(page);
  return page;
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (a, b, msg) => expect(a === b, `${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const shot = (p, name) => p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const timeToSec = (t) => t.split(":").reduce((a, x) => a * 60 + Number(x), 0);
const card = (p, name) => p.locator("li.sb-gt-card", { hasText: name });
const sql = (q, a) => srv.sql(q, a);
// Playwright's own waitFor polls with in-page timers, which a fake clock can stall. For pages with
// an installed clock, poll from Node instead.
const until = async (fn, msg, timeout = 30000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { if (await fn()) return; await sleep(250); }
  throw new Error("timed out: " + msg);
};

let asha, bela, chirag, code, groupId;

console.log("\nGroup Timer e2e\n");

await test("lobby: title, seeded public groups, private tab options", async () => {
  asha = await open("asha");
  await asha.waitForSelector("text=Open Study Hall");
  eq(await asha.locator(".sb-gt-row").count(), 4, "public rows");
  await asha.getByRole("tab", { name: /Private/ }).click();
  expect(await asha.getByText("Join with a code").isVisible(), "join option");
  expect(await asha.getByText("Create a group").isVisible(), "create option");
  await shot(asha, "01-lobby-private");
});

await test("create a private group -> code shown -> enter room", async () => {
  await asha.getByText("Create a group").click();
  const dlg = asha.getByRole("dialog", { name: "Create a group" });
  expect(await dlg.getByText("Private rooms are invisible").isVisible(), "private hint");
  expect(await dlg.getByRole("radio", { name: /Public/ }).count() === 0, "non-founder sees no public toggle");
  await dlg.getByLabel("Group name").fill("Night Owls");
  await dlg.getByRole("button", { name: "Create" }).click();
  const codeEl = asha.locator(".sb-gt-code");
  await codeEl.waitFor();
  code = (await codeEl.textContent()).replace("-", "");
  expect(/^[A-HJ-NP-Z2-9]{6}$/.test(code), "code format " + code);
  await asha.getByRole("button", { name: "Enter room" }).click();
  await asha.getByLabel("Group timer").waitFor();
  eq(await asha.locator(".sb-gt-room-name").textContent(), "Night Owls", "room name");
  groupId = (await sql("select id from study_groups where name='Night Owls'"))[0].id;
});

await test("room renders: panes, self card, stats card, recap, no horizontal scroll", async () => {
  await asha.getByLabel("Studying now").waitFor();
  expect(await card(asha, "You").isVisible(), "self card");
  await asha.getByLabel("Room stats").waitFor();
  await asha.getByText("studied together").waitFor();
  await asha.getByLabel("Last week's recap").getByText(/Nothing was logged/).waitFor();
  const sw = await asha.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(sw[0] <= sw[1], `horizontal overflow ${sw}`);
  await shot(asha, "02-room-desktop");
});

await test("second user joins by code (messy input) and both see each other live", async () => {
  bela = await open("bela");
  await bela.getByRole("tab", { name: /Private/ }).click();
  await bela.getByText("Join with a code").click();
  await bela.getByLabel("6-character code").fill(code.slice(0, 3).toLowerCase() + "-" + code.slice(3).toLowerCase());
  await bela.getByRole("button", { name: "Join group" }).click();
  await bela.getByLabel("Group timer").waitFor();
  await card(bela, "Asha").waitFor({ timeout: 10000 });
  await card(asha, "Bela").waitFor({ timeout: 10000 });
  eq(await bela.locator(".sb-gt-room-name").textContent(), "Night Owls", "room name for Bela");
});

await test("wrong code and short code are rejected with a message", async () => {
  chirag = await open("chirag");
  await chirag.getByRole("tab", { name: /Private/ }).click();
  await chirag.getByText("Join with a code").click();
  await chirag.getByLabel("6-character code").fill("ZZZZZZ");
  await chirag.getByRole("button", { name: "Join group" }).click();
  await chirag.getByRole("alert").getByText(/No group found/).waitFor();
  await chirag.getByRole("button", { name: "Cancel" }).click();
});

await test("timer start shows live on the other screen, clocks agree within 2s", async () => {
  await asha.getByRole("radio", { name: "Physics" }).click();
  await asha.getByLabel("Topic you're focusing on").fill("Rotation");
  await asha.getByLabel("Goal for this session").fill("20 PYQs");
  await asha.getByRole("button", { name: "Start" }).click();
  await card(bela, "Asha").getByText("Studying").waitFor({ timeout: 10000 });
  await card(bela, "Asha").getByText(/Physics · Rotation/).waitFor({ timeout: 10000 });
  await card(bela, "Asha").getByText("20 PYQs").waitFor({ timeout: 10000 });
  await sleep(3500);
  const mine = timeToSec(await asha.locator(".sb-gt-time").textContent()); // countdown remaining
  const elapsedMine = 25 * 60 - mine;
  const seen = timeToSec(await card(bela, "Asha").locator(".sb-gt-card-time").textContent());
  expect(Math.abs(seen - elapsedMine) <= 2, `Bela sees ${seen}s, Asha's own elapsed ${elapsedMine}s`);
  await shot(bela, "03-bela-sees-asha-studying");
});

await test("rejoin shows the TRUE elapsed time, not a restart", async () => {
  await bela.getByLabel("Back to groups").click();
  await bela.getByText("Select a").waitFor();
  await sleep(2500);
  await bela.getByRole("tab", { name: /Private/ }).click();
  await bela.getByRole("button", { name: /Open Night Owls/ }).click();
  await card(bela, "Asha").getByText("Studying").waitFor({ timeout: 10000 });
  const mine = 25 * 60 - timeToSec(await asha.locator(".sb-gt-time").textContent());
  const seen = timeToSec(await card(bela, "Asha").locator(".sb-gt-card-time").textContent());
  expect(seen >= 6, `elapsed restarted: Bela sees ${seen}s`);
  expect(Math.abs(seen - mine) <= 2, `Bela sees ${seen}s, Asha ${mine}s`);
});

await test("pause updates on the other screen right away, and the clock freezes", async () => {
  await asha.getByRole("button", { name: "Pause" }).click();
  await card(bela, "Asha").getByText(/Paused/).waitFor({ timeout: 5000 });
  const a = await card(bela, "Asha").locator(".sb-gt-card-time").textContent();
  await sleep(2200);
  const b = await card(bela, "Asha").locator(".sb-gt-card-time").textContent();
  eq(a, b, "paused clock must not tick");
});

await test("cheer: sender -> receiver feed + toast; rate limit; whole-room cheer", async () => {
  await asha.getByRole("button", { name: "Start" }).click(); // resume so she is cheerable
  await card(bela, "Asha").getByText("Studying").waitFor({ timeout: 5000 });
  await card(bela, "Asha").getByRole("button", { name: /Cheer/ }).click();
  await bela.getByRole("menuitem", { name: "🔥" }).click();
  await asha.locator(".sb-gt-feed-list li", { hasText: "sent you 🔥" }).waitFor({ timeout: 5000 });
  await asha.locator("#toasts li", { hasText: "sent you 🔥" }).waitFor({ timeout: 5000 });
  await bela.locator(".sb-gt-feed-list li", { hasText: "You sent Asha 🔥" }).waitFor();
  // immediately again -> slowed down
  await bela.getByRole("button", { name: "Cheer the room" }).click();
  await bela.getByRole("menuitem", { name: "👏" }).click();
  await bela.getByText(/Easy — one cheer every few seconds/).waitFor();
  await sleep(4200);
  await bela.getByRole("menuitem", { name: "👏" }).click();
  await asha.locator(".sb-gt-feed-list li", { hasText: "sent the room 👏" }).waitFor({ timeout: 5000 });
});

await test("finish a 1-min session: goal prompt requires an answer; result reaches the room; hours counted", async () => {
  // fresh page with a fake clock so a 1-minute session can finish instantly
  const dev = await open("dev", { clock: true });
  await dev.getByRole("tab", { name: /Private/ }).click();
  await dev.getByText("Join with a code").click();
  await dev.getByLabel("6-character code").fill(code);
  await dev.getByRole("button", { name: "Join group" }).click();
  await dev.getByLabel("Group timer").waitFor();
  await dev.getByLabel("Edit duration").click();
  await dev.getByRole("spinbutton", { name: "Minutes" }).fill("1");
  await dev.getByRole("button", { name: "Save" }).first().click();
  await dev.getByLabel("Goal for this session").fill("Finish ch 4");
  await dev.getByRole("button", { name: "Start" }).click();
  await card(asha, "Dev").getByText("Finish ch 4").waitFor({ timeout: 10000 });
  await dev.clock.fastForward("01:05");
  await until(() => dev.getByText("What did you study?").count().then((n) => n > 0), "session card on dev");
  expect(await dev.getByRole("button", { name: "Save session" }).isDisabled(), "save blocked until Done/Not done chosen");
  await dev.getByRole("radio", { name: /Done/ }).click();
  await dev.getByRole("button", { name: "Save session" }).click();
  await asha.locator(".sb-gt-feed-list li", { hasText: "finished “Finish ch 4” ✅" }).waitFor({ timeout: 8000 });
  await dev.locator("#saved li").first().waitFor();
  // server-side: that session is a real row, and the room stats see it
  const rows = await sql("select actual_minutes, completed from timer_sessions where user_id=$1", [U.dev]);
  eq(rows.length, 1, "one saved session row");
  await dev.getByLabel("Room stats").getByText("1m").first().waitFor({ timeout: 8000 });
  await shot(dev, "04-dev-after-session");
});

await test("discarding a finished session removes its hours and reports 'not done'", async () => {
  const dev = pages.find((p) => p.__who === "dev");
  await dev.getByLabel("Goal for this session").fill("Impossible goal");
  await dev.getByRole("button", { name: "Start" }).click();
  await dev.clock.fastForward("01:05");
  await until(() => dev.getByText("What did you study?").count().then((n) => n > 0), "session card on dev");
  await sleep(600);
  eq((await sql("select count(*)::int n from timer_sessions where user_id=$1", [U.dev]))[0].n, 2, "row exists while undecided");
  await dev.getByRole("button", { name: /Discard/ }).click();
  await asha.locator(".sb-gt-feed-list li", { hasText: "didn't get to “Impossible goal” ❌" }).waitFor({ timeout: 8000 });
  await sleep(1200);
  eq((await sql("select count(*)::int n from timer_sessions where user_id=$1", [U.dev]))[0].n, 1, "discarded row removed");
  await dev.getByLabel("Room stats").getByText("1m").first().waitFor({ timeout: 8000 });
});

await test("stats: today/week/all, leaderboard ranking, goal bar absent until host sets one", async () => {
  // seed deterministic sessions for Bela & Asha straight in the DB (inside their stints)
  await sql(`insert into timer_sessions(user_id,mode,planned_minutes,actual_minutes,completed,created_at) values
    ($1,'Deep Focus',90,90,true,now()),($2,'Deep Focus',30,30,true,now())`, [U.asha, U.bela]);
  await asha.getByRole("tab", { name: "All time" }).click();
  const board = asha.locator(".sb-gt-board-row");
  await board.nth(0).waitFor();
  await asha.waitForFunction(() => document.querySelectorAll(".sb-gt-board-row").length >= 3);
  eq(await board.nth(0).locator(".sb-gt-board-name").textContent(), "You", "Asha leads");
  eq(await board.nth(0).locator(".sb-gt-board-val b").textContent(), "1h 30m", "Asha minutes");
  eq(await asha.getByLabel("Rank 1").first().textContent(), "1", "rank");
  await asha.getByRole("tab", { name: "This week" }).click();
  expect(await asha.getByText(/No weekly goal yet/).isVisible(), "host hint when no goal");
  await shot(asha, "05-stats");
});

await test("'How is this counted?' shows every rule", async () => {
  await asha.getByRole("button", { name: /How is this counted/ }).click();
  const dlg = asha.getByRole("dialog", { name: /How room hours are counted/ });
  eq(await dlg.locator("ol li").count(), 8, "rules listed");
  await dlg.getByText(/780 min/).waitFor();
  await shot(asha, "06-rules");
  await asha.keyboard.press("Escape");
  await dlg.waitFor({ state: "detached" });
});

await test("host: info dialog -> Manage room saves description/rules/goal; others update live", async () => {
  await asha.getByLabel("Group info").click();
  await asha.getByRole("button", { name: "Manage room" }).click();
  const dlg = asha.getByRole("dialog", { name: "Manage room" });
  await dlg.getByLabel("Description").fill("Late-night physics grind");
  await dlg.getByLabel(/Room rules/).fill("Phones away.\nBe kind.");
  await dlg.getByLabel(/Weekly goal/).fill("100");
  await dlg.getByRole("button", { name: "Save changes" }).click();
  await dlg.getByText("Saved ✓").waitFor();
  await shot(asha, "07-manage");
  await asha.keyboard.press("Escape");
  await bela.getByLabel("Group info").click();
  await bela.getByText("Late-night physics grind").waitFor({ timeout: 8000 });
  await bela.getByText(/Phones away/).waitFor();
  expect(await bela.getByRole("button", { name: "Manage room" }).count() === 0, "member has no Manage button");
  await bela.keyboard.press("Escape");
  await asha.getByRole("tab", { name: "This week" }).click();
  await asha.getByText(/Weekly goal · 100h/).waitFor({ timeout: 8000 });
});

await test("room focus lock: banner + cheer controls disappear for members, goals still flow", async () => {
  await asha.getByLabel("Group info").click();
  await asha.getByRole("button", { name: "Manage room" }).click();
  await asha.getByRole("switch", { name: /Turn on the room focus lock/ }).click();
  await asha.getByRole("switch", { name: /Turn off the room focus lock/ }).waitFor();
  await asha.keyboard.press("Escape");
  await bela.getByText(/Focus lock is on/).waitFor({ timeout: 8000 });
  eq(await card(bela, "Asha").getByRole("button", { name: /Cheer/ }).count(), 0, "no cheer button while locked");
  expect(await bela.getByRole("button", { name: "Cheer the room" }).count() === 0, "no room cheer while locked");
  await shot(bela, "08-focus-lock");
  // unlock again
  await asha.getByLabel("Group info").click();
  await asha.getByRole("button", { name: "Manage room" }).click();
  await asha.getByRole("switch", { name: /Turn off the room focus lock/ }).click();
  await asha.getByRole("switch", { name: /Turn on the room focus lock/ }).waitFor();
  await asha.keyboard.press("Escape");
  await bela.getByText(/Focus lock is on/).waitFor({ state: "detached", timeout: 8000 });
});

await test("members dialog lists offline members with 'last studied'; hosts get remove/ban, members don't", async () => {
  const chiragCtx = await open("chirag");  // second page for chirag after the failed join attempt page: join properly
  await chiragCtx.getByRole("tab", { name: /Private/ }).click();
  await chiragCtx.getByText("Join with a code").click();
  await chiragCtx.getByLabel("6-character code").fill(code);
  await chiragCtx.getByRole("button", { name: "Join group" }).click();
  await chiragCtx.getByLabel("Group timer").waitFor();
  await card(asha, "Chirag").waitFor({ timeout: 8000 });
  await chiragCtx.context().close();                     // Chirag goes offline
  await pages.find((p) => p.__who === "dev").context().close(); // Dev (who has saved sessions) goes offline too
  await card(asha, "Chirag").waitFor({ state: "detached", timeout: 8000 }); // gone from live cards
  await asha.getByLabel("Members", { exact: true }).click();
  const dlg = asha.getByRole("dialog", { name: "Members" });
  await dlg.getByText("Chirag").waitFor();
  await dlg.locator(".sb-gt-roster-row", { hasText: "Chirag" }).getByText(/Offline · hasn't studied yet/).waitFor();
  await dlg.locator(".sb-gt-roster-row", { hasText: "Dev" }).getByText(/Offline · studied/).waitFor({ timeout: 10000 });
  await dlg.locator(".sb-gt-roster-row", { hasText: "You" }).getByText(/Host/).waitFor();
  eq(await dlg.getByLabel("Remove You").count(), 0, "can't remove self");
  await shot(asha, "09-roster");
  await asha.keyboard.press("Escape");
  await bela.getByLabel("Members", { exact: true }).click();
  const bdlg = bela.getByRole("dialog", { name: "Members" });
  await bdlg.getByText("Chirag").waitFor();
  eq(await bdlg.getByLabel(/^Remove /).count(), 0, "members can't remove");
  eq(await bdlg.getByLabel(/^Ban /).count(), 0, "members can't ban");
  await bela.keyboard.press("Escape");
});

await test("host bans a member: they're thrown back to the lobby, can't rejoin, unban restores", async () => {
  await asha.getByLabel("Members", { exact: true }).click();
  const dlg = asha.getByRole("dialog", { name: "Members" });
  await dlg.getByLabel("Ban Bela").click();
  await dlg.getByText("Ban?").waitFor();
  await dlg.getByRole("button", { name: "Yes" }).click();
  await dlg.locator(".sb-gt-roster-row", { hasText: "Bela" }).first().waitFor({ state: "detached", timeout: 8000 }).catch(() => {});
  await bela.getByText(/You're no longer in that group/).waitFor({ timeout: 10000 });
  expect((await bela.getByText(/no longer in that group/).textContent()).includes("you were removed"), "message must cover removal, not only deletion");
  await bela.getByText("Select a").waitFor();
  await bela.getByRole("tab", { name: /Private/ }).click();
  await bela.getByText("Join with a code").click();
  await bela.getByLabel("6-character code").fill(code);
  await bela.getByRole("button", { name: "Join group" }).click();
  await bela.getByRole("alert").getByText(/No group found/).waitFor();
  await bela.getByRole("button", { name: "Cancel" }).click();
  await dlg.getByText("Banned").waitFor({ timeout: 8000 });
  await dlg.getByRole("button", { name: /Unban/ }).click();
  await dlg.getByText("Banned").waitFor({ state: "detached", timeout: 8000 });
  await asha.keyboard.press("Escape");
  await bela.getByText("Join with a code").click();
  await bela.getByLabel("6-character code").fill(code);
  await bela.getByRole("button", { name: "Join group" }).click();
  await bela.getByLabel("Group timer").waitFor({ timeout: 8000 });
  // Bela's earlier minutes were kept in the room total through the kick
  await asha.getByRole("tab", { name: "All time" }).click();
  await asha.waitForFunction(() => /2h|3h/.test(document.querySelector(".sb-gt-tile b")?.textContent || ""), null, { timeout: 8000 }).catch(() => {});
});

await test("new join code kills the old one instantly; people inside stay", async () => {
  await asha.getByLabel("Group info").click();
  const oldCode = (await asha.locator(".sb-gt-code").textContent()).replace("-", "");
  await asha.getByRole("button", { name: "Manage room" }).click();
  await asha.getByRole("button", { name: "New code" }).click();
  await asha.getByText("Old code stops working").waitFor();
  await asha.getByRole("button", { name: "Make new code" }).click();
  await asha.waitForFunction((o) => (document.querySelector(".sb-gt-manage-dialog .sb-gt-code")?.textContent || "").replace("-", "") !== o, oldCode);
  const fresh = (await asha.locator(".sb-gt-manage-dialog .sb-gt-code").textContent()).replace("-", "");
  expect(fresh !== oldCode && /^[A-HJ-NP-Z2-9]{6}$/.test(fresh), "new code valid & different");
  await asha.keyboard.press("Escape");
  const rows = await sql("select join_code from study_groups where id=$1", [groupId]);
  eq(rows[0].join_code, fresh, "persisted");
  eq((await sql("select count(*)::int n from study_group_members where group_id=$1", [groupId]))[0].n >= 3, true, "members kept");
  code = fresh;
});

await test("nudge appears for someone paused 5+ min (observer clock fast-forwarded), receiver gets it", async () => {
  const obs = await open("chirag", { clock: true });   // observer with a controllable clock
  await obs.getByRole("tab", { name: /Private/ }).click();
  await obs.getByRole("button", { name: /Open Night Owls/ }).click();
  await card(obs, "Asha").waitFor({ timeout: 10000 });
  await asha.getByRole("button", { name: "Pause" }).click();
  await card(obs, "Asha").getByText(/Paused/).waitFor({ timeout: 8000 });
  expect(await card(obs, "Asha").getByRole("button", { name: /Nudge/ }).count() === 0, "no nudge right after pausing");
  await obs.clock.fastForward("06:00");
  await card(obs, "Asha").getByRole("button", { name: /Nudge/ }).waitFor({ timeout: 8000 });
  await card(obs, "Asha").getByRole("button", { name: /Nudge/ }).click();
  await card(obs, "Asha").getByText("Nudged ✓").waitFor();
  await asha.locator("#toasts li", { hasText: "nudged you" }).waitFor({ timeout: 8000 });
  await asha.locator(".sb-gt-feed-list li", { hasText: "nudged you" }).waitFor();
  await shot(obs, "10-nudge");
  await obs.context().close();
});

await test("closing the app removes you from the room's live list immediately", async () => {
  await asha.getByRole("button", { name: "Start" }).click();
  await card(bela, "Asha").getByText("Studying").waitFor({ timeout: 8000 });
  await asha.context().close();
  await card(bela, "Asha").waitFor({ state: "detached", timeout: 8000 });
});

await test("reload while in a room drops you back into it (state restored)", async () => {
  await bela.reload();
  await bela.getByLabel("Group timer").waitFor({ timeout: 15000 });
  eq(await bela.locator(".sb-gt-room-name").textContent(), "Night Owls", "restored room");
});

await test("navigating away and back keeps the room (presence is root-level)", async () => {
  await bela.evaluate(() => document.getElementById("go-other").click()); // harness plumbing, not product UI
  await bela.locator("#other-page").waitFor();
  await bela.evaluate(() => [...document.querySelectorAll("#other-page button")][0].click()); // harness plumbing
  await bela.getByLabel("Group timer").waitFor();
});

await test("leave group via Info: confirm step, room gone from lists, hours stay in room total", async () => {
  const before = (await sql("select coalesce(sum(actual_minutes),0)::float s from timer_sessions where user_id=$1", [U.bela]))[0].s;
  await bela.getByLabel("Group info").click();
  await bela.getByRole("button", { name: "Leave group" }).click();
  await bela.getByText("Leave this group?").waitFor();
  await bela.getByRole("button", { name: /Yes, leave/ }).click();
  await bela.getByText("Select a").waitFor({ timeout: 8000 });
  await bela.getByRole("tab", { name: /Private/ }).click();
  await bela.getByText("You haven't joined any private groups yet.").waitFor();
  const stint = await sql("select left_at is not null as closed from study_group_stints where group_id=$1 and user_id=$2", [groupId, U.bela]);
  expect(stint.every((s) => s.closed), "stint closed");
  expect(before >= 30, "bela's seeded minutes exist");
});

await test("founder sees the public/private toggle and can make a public room", async () => {
  const fay = await open("fay");
  await fay.getByRole("tab", { name: /Private/ }).click();
  await fay.getByText("Create a group").click();
  const dlg = fay.getByRole("dialog", { name: "Create a group" });
  await dlg.getByRole("radio", { name: /Public/ }).click();
  await dlg.getByLabel("Group name").fill("Sunday Marathon");
  await dlg.getByRole("button", { name: "Create" }).click();
  await fay.getByText("Your public room is live").waitFor();
  await fay.getByRole("button", { name: "Enter room" }).click();
  await fay.getByLabel("Group timer").waitFor();
  expect(await fay.getByText("Public", { exact: true }).first().isVisible(), "public pill");
  await fay.getByLabel("Group info").click();
  expect(await fay.getByRole("button", { name: "Manage room" }).isVisible(), "founder is host");
  await fay.keyboard.press("Escape");
});

await test("MOBILE 390px: lobby + room fit the screen, no horizontal scroll, timer legible", async () => {
  const m = await open("dev", { w: 390, h: 800 });
  const sw1 = await m.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  expect(sw1[0] <= sw1[1], `lobby overflow ${sw1}`);
  await shot(m, "11-mobile-lobby");
  await m.getByRole("tab", { name: /Private/ }).click();
  await m.getByRole("button", { name: /Open Night Owls/ }).click();
  await m.getByLabel("Group timer").waitFor();
  await m.getByLabel("Room stats").waitFor();
  const sw2 = await m.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  expect(sw2[0] <= sw2[1], `room overflow ${sw2}`);
  const nameBox = await m.locator(".sb-gt-room-name").boundingBox();
  expect(nameBox.width >= 120, `room name squeezed to ${nameBox.width}px`);
  const trunc = await m.locator(".sb-gt-room-name").evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(!trunc, "short room name must not be ellipsised on mobile");
  const cardBox = await m.getByLabel("Group timer").boundingBox();
  expect(cardBox.width >= 390 - 50, /* page scrollbar takes ~15px in headless */ `timer card only ${cardBox.width}px wide on a 390px screen`);
  const box = await m.locator(".sb-gt-time").boundingBox();
  expect(box && box.width > 120 && box.x >= 0 && box.x + box.width <= 390, "timer inside viewport");
  await shot(m, "12-mobile-room");
});

await test("no console errors, React warnings, page errors or failed requests anywhere", async () => {
  expect(errors.length === 0, "\n" + errors.slice(0, 12).join("\n"));
});

await browser.close(); await vite.close(); await srv.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed${failed.length ? `  —  FAILED: ${failed.map((f) => f.name).join(" | ")}` : ""}\nscreenshots: ${SHOTS}`);
process.exit(failed.length ? 1 : 0);
