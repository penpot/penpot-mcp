#!/usr/bin/env node
// Headless Penpot driver — login via the RPC API (skips brittle React form
// discovery), inject auth cookie into Playwright context, open the file
// workspace, then launch the MCP plugin panel.
//
// Required env:  PENPOT_EMAIL, PENPOT_PASSWORD
// Optional env:  PENPOT_BASE_URL (default http://localhost:9001)
//                PENPOT_FILE_ID  workspace target
//                HEADLESS=0 to run headed (needs WSLg/X)
//                KEEP_OPEN=0 to exit after :4402 confirmation
//
// Prints "READY :4402 connected" on success.

import { chromium } from "playwright";
import { execSync } from "node:child_process";

const BASE = process.env.PENPOT_BASE_URL || "http://localhost:9001";
const EMAIL = process.env.PENPOT_EMAIL;
const PASSWORD = process.env.PENPOT_PASSWORD;
const FILE_ID = process.env.PENPOT_FILE_ID;
const TEAM_ID = process.env.PENPOT_TEAM_ID;
const PAGE_ID = process.env.PENPOT_PAGE_ID;
const HEADLESS = process.env.HEADLESS !== "0";
const KEEP_OPEN = process.env.KEEP_OPEN !== "0";

if (!EMAIL || !PASSWORD) {
    console.error("PENPOT_EMAIL and PENPOT_PASSWORD must be set");
    process.exit(2);
}

function pluginClientCount() {
    try {
        const out = execSync("ss -tn state established 'sport = :4402'", { encoding: "utf8" });
        return out.trim().split("\n").length - 1;
    } catch { return 0; }
}

async function loginAndGetCookie() {
    const url = BASE + "/api/rpc/command/login-with-password";
    const body = JSON.stringify({ "~:email": EMAIL, "~:password": PASSWORD });
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
    });
    if (!res.ok) throw new Error(`login failed: ${res.status} ${await res.text()}`);
    const setCookie = res.headers.get("set-cookie");
    if (!setCookie) throw new Error("no Set-Cookie in login response");
    // Set-Cookie: auth-token=...; Path=/; HttpOnly; Expires=...
    const m = setCookie.match(/auth-token=([^;]+)/);
    if (!m) throw new Error("auth-token cookie not found");
    return m[1];
}

async function main() {
    console.error("[open-plugin] login via RPC");
    const authToken = await loginAndGetCookie();
    console.error("[open-plugin] auth-token len=" + authToken.length);

    console.error("[open-plugin] launching chromium (headless=" + HEADLESS + ")");
    const browser = await chromium.launch({ headless: HEADLESS, args: ["--no-sandbox"] });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addCookies([{
        name: "auth-token",
        value: authToken,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
    }]);

    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.error("[pageerror]", e.message.slice(0, 200)));
    page.on("console", (msg) => {
        const t = msg.text();
        if (/MCP|plugin|websocket|katex|latex/i.test(t) || msg.type() === "error") {
            console.error("[console:" + msg.type() + "]", t.slice(0, 200));
        }
    });

    let target;
    if (FILE_ID && TEAM_ID) {
        const parts = [`team-id=${TEAM_ID}`, `file-id=${FILE_ID}`];
        if (PAGE_ID) parts.push(`page-id=${PAGE_ID}`);
        target = `${BASE}/#/workspace?${parts.join("&")}`;
    } else {
        target = `${BASE}/#/dashboard`;
    }
    console.error("[open-plugin] navigating", target);
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // Open Plugin Manager: Ctrl+Alt+P
    console.error("[open-plugin] Ctrl+Alt+P");
    await page.keyboard.press("Control+Alt+P");
    await page.waitForTimeout(1500);

    // Click on the installed "Penpot MCP Plugin" — Penpot Hub shows installed
    // plugins as cards. Selector tries a few common shapes.
    // The Plugin Manager modal lists installed plugins. We want to click the
    // Open button on the "Penpot MCP Plugin" card. The DOM structure isn't
    // documented; we probe several selectors and fall back to text+sibling.
    let clicked = false;
    const tryClick = async (loc, label) => {
        try {
            if (await loc.isVisible({ timeout: 1500 }).catch(() => false)) {
                console.error("[open-plugin] clicking:", label);
                await loc.click({ timeout: 3000 });
                return true;
            }
        } catch (e) { console.error("[open-plugin] click failed for", label, e.message); }
        return false;
    };

    // Strategy 1: xpath — find any element whose own text contains "Penpot MCP Plugin"
    // and that has a descendant <button> with text "Open"
    const xp1 = page.locator(
        "xpath=//*[contains(normalize-space(.),'Penpot MCP Plugin')][.//button[normalize-space()='Open']][1]//button[normalize-space()='Open']"
    ).first();
    clicked = await tryClick(xp1, "xpath card-with-Open");

    // Strategy 2: each "Open" button — pick the one whose surrounding text mentions our plugin
    if (!clicked) {
        const allOpen = await page.locator("button", { hasText: /^Open$/ }).all();
        for (let i = 0; i < allOpen.length; i++) {
            const btn = allOpen[i];
            const parent = btn.locator("xpath=ancestor::*[self::div or self::li or self::article][1]");
            const txt = (await parent.textContent().catch(() => "")) || "";
            if (txt.includes("Penpot MCP")) {
                clicked = await tryClick(btn, `Open #${i} (parent text matches)`);
                if (clicked) break;
            }
        }
    }

    // Strategy 3: only one Open button visible (installed plugin list shows just our one)
    if (!clicked) {
        const all = page.getByRole("button", { name: /^Open$/ });
        const n = await all.count().catch(() => 0);
        if (n === 1) clicked = await tryClick(all.first(), "sole Open button");
    }

    if (!clicked) console.error("[open-plugin] could not find Open button via any strategy");

    // After Open, plugin iframe loads. It contains a "Connect to MCP server"
    // button that the user must click before WebSocket connects. Do that
    // automatically — find the plugin iframe and click [data-handler='connect-mcp'].
    if (clicked) {
        console.error("[open-plugin] waiting for plugin iframe to appear");
        const iframeLoc = page.frameLocator("iframe[src*='/plugins/mcp/']");
        // Iframe load can take a couple seconds
        await page.waitForTimeout(2000);
        const connectBtn = iframeLoc.locator("[data-handler='connect-mcp']");
        try {
            await connectBtn.waitFor({ state: "visible", timeout: 8000 });
            console.error("[open-plugin] clicking 'Connect to MCP server' inside plugin iframe");
            await connectBtn.click();
        } catch (e) {
            console.error("[open-plugin] connect button not found in iframe:", e.message.slice(0, 200));
        }
    }

    // Wait up to 30s for plugin sandbox to connect to :4402.
    const t0 = Date.now();
    let n = 0;
    while (Date.now() - t0 < 30000) {
        n = pluginClientCount();
        if (n > 0) break;
        await page.waitForTimeout(1000);
    }

    if (n > 0) {
        console.log("READY :4402 connected (" + n + " client" + (n > 1 ? "s" : "") + ")");
    } else {
        console.error("[open-plugin] FAILED — no :4402 client after 30s");
        await page.screenshot({ path: "/tmp/penpot.png", fullPage: true }).catch(() => {});
        // Dump every visible button + dialog text
        const buttons = await page.locator("button, [role='button']").allTextContents().catch(() => []);
        console.error("buttons (" + buttons.length + "):", buttons.slice(0, 40).map(s => s.trim()).filter(Boolean));
        const dialogs = await page.locator("dialog, [role='dialog']").count().catch(() => 0);
        console.error("dialog count:", dialogs);
        if (dialogs > 0) {
            const dt = await page.locator("dialog, [role='dialog']").first().textContent().catch(() => "");
            console.error("dialog text head:", (dt || "").slice(0, 800));
        }
        // Also scan for any element containing "MCP" text
        const mcpEls = await page.locator(":has-text('Penpot MCP')").count().catch(() => 0);
        console.error("elements containing 'Penpot MCP':", mcpEls);
        if (!KEEP_OPEN) { await browser.close(); process.exit(3); }
    }

    if (KEEP_OPEN) {
        console.error("[open-plugin] parking (set KEEP_OPEN=0 to exit)");
        await new Promise(() => {});
    } else {
        await browser.close();
    }
}

main().catch((e) => { console.error("[open-plugin] fatal:", e?.stack ?? e); process.exit(1); });
