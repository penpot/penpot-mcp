#!/usr/bin/env node
// Take a fresh viewport screenshot of the current Penpot workspace.
// Logs in via RPC, opens the file, zooms to fit the board, screenshots.

import { chromium } from "playwright";

const BASE = "http://localhost:9001";
const EMAIL = process.env.PENPOT_EMAIL;
const PASSWORD = process.env.PENPOT_PASSWORD;
if (!EMAIL || !PASSWORD) {
    console.error("PENPOT_EMAIL and PENPOT_PASSWORD must be set");
    process.exit(2);
}
const TEAM = process.env.PENPOT_TEAM_ID;
const FILE = process.env.PENPOT_FILE_ID;
const PAGE = process.env.PENPOT_PAGE_ID;
if (!TEAM || !FILE) {
    console.error("PENPOT_TEAM_ID and PENPOT_FILE_ID must be set");
    process.exit(2);
}
const OUT = process.argv[2] || "/tmp/penpot-board-shot.png";

const res = await fetch(`${BASE}/api/rpc/command/login-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ "~:email": EMAIL, "~:password": PASSWORD }),
});
const tok = res.headers.get("set-cookie").match(/auth-token=([^;]+)/)[1];

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addCookies([
    { name: "auth-token", value: tok, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Lax" },
]);
const page = await ctx.newPage();
await page.goto(`${BASE}/#/workspace?team-id=${TEAM}&file-id=${FILE}&page-id=${PAGE}`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
// Allow workspace canvas to render
await page.waitForTimeout(5000);

// Zoom to fit (Penpot keyboard shortcut: Shift+1)
await page.keyboard.press("Shift+1");
await page.waitForTimeout(1500);

await page.screenshot({ path: OUT, fullPage: false });
console.log(OUT);
await browser.close();
