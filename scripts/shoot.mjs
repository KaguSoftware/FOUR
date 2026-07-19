/**
 * Screenshot the app as the signed-in dev user.
 *
 *   node scripts/shoot.mjs <prefix> "<paths>"
 *
 * Paths are comma separated and given WITHOUT leading slashes, because Git
 * Bash rewrites a bare "/" argument into a Windows path:
 *
 *   node scripts/shoot.mjs check ",history,proof"
 *
 * FULL=1 captures the whole scrollable page instead of one viewport.
 */
import { chromium } from "playwright";
import { signIn } from "./_session.mjs";

const OUT = process.argv[2] ?? "shot";
const PATHS = (process.argv[3] ?? "")
  .split(",")
  .map((p) => `/${p.replace(/^\/+/, "")}`);

const { session, env } = await signIn();

const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const payload = Buffer.from(
  JSON.stringify({
    access_token: session.access_token,
    token_type: "bearer",
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    refresh_token: session.refresh_token,
    user: session.user,
  }),
).toString("base64");

const FULL = process.env.FULL === "1";
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, // iPhone-ish
  deviceScaleFactor: 2,
  colorScheme: "dark",
});
await ctx.addCookies([
  {
    name: `sb-${ref}-auth-token`,
    value: `base64-${payload}`,
    domain: "localhost",
    path: "/",
  },
]);

const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

for (const p of PATHS) {
  await page.goto(`http://localhost:3000${p}`, { waitUntil: "networkidle" });
  const name = p === "/" ? "status" : p.replace(/\//g, "");
  await page.screenshot({ path: `scratch/${OUT}-${name}.png`, fullPage: FULL });
  console.log(`shot: scratch/${OUT}-${name}.png`);
}

console.log(errors.length ? `CONSOLE ERRORS: ${errors.slice(0, 5)}` : "no console errors");
await browser.close();
