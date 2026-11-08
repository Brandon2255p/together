// A tiny promo recorder: drives the app at phone size and films it with Chrome's screencast, then encodes an MP4.
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

// a Playwright Chromium; change this to wherever yours is installed
const EXE = process.env.CHROMIUM ?? process.env.HOME + "/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
export const BASE = "http://localhost:3000";
const W = 390, H = 844, DPR = 2;

const INIT = `
(() => {
  const css = 'nextjs-portal{display:none!important} *{scrollbar-width:none} ::-webkit-scrollbar{display:none}' +
    '.__tap{position:fixed;z-index:2147483647;pointer-events:none;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;' +
    'background:rgba(30,26,24,.18);border:2px solid rgba(255,255,255,.85);box-shadow:0 2px 10px rgba(0,0,0,.18);' +
    'animation:__tap .55s ease-out forwards}' +
    '@keyframes __tap{0%{transform:scale(.55);opacity:1}70%{opacity:.9}100%{transform:scale(1.25);opacity:0}}';
  const add = () => { const s = document.createElement('style'); s.textContent = css; document.documentElement.appendChild(s); };
  if (document.documentElement) add(); else document.addEventListener('DOMContentLoaded', add);
  addEventListener('pointerdown', (e) => {
    const d = document.createElement('div'); d.className = '__tap';
    d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px';
    document.documentElement.appendChild(d); setTimeout(() => d.remove(), 700);
  }, true);
})();`;

export async function record(name, { warm = [], start }, scene) {
  const dir = path.resolve("frames", name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true, reducedMotion: "no-preference" });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);

  // compile every route first so the film never shows a dev-server pause
  for (const r of warm) { await page.goto(BASE + r, { waitUntil: "networkidle" }); }
  await page.goto(BASE + start, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    const file = path.join(dir, String(frames.length).padStart(5, "0") + ".jpg");
    writeFileSync(file, Buffer.from(data, "base64"));
    frames.push({ file, t: metadata.timestamp });
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: W * DPR, maxHeight: H * DPR, everyNthFrame: 1 });

  const s = helpers(page);
  try {
    await s.hold(1200);
    await scene(s, page);
    await s.hold(1500);
  } finally {
    const end = Date.now() / 1000;
    await cdp.send("Page.stopScreencast").catch(() => {});
    await browser.close();
    encode(name, frames, end);
  }
}

function encode(name, frames, end) {
  if (!frames.length) throw new Error("no frames");
  const lines = [];
  frames.forEach((f, i) => {
    const next = i + 1 < frames.length ? frames[i + 1].t : end;
    lines.push(`file '${f.file}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
  });
  lines.push(`file '${frames.at(-1).file}'`);
  const list = path.resolve("frames", name + ".txt");
  writeFileSync(list, lines.join("\n"));
  const out = path.resolve("out", name + ".mp4");
  mkdirSync(path.dirname(out), { recursive: true });
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list,
    "-vf", `fps=30,scale=${W * DPR}:${H * DPR}:flags=lanczos,format=yuv420p`, "-c:v", "libx264", "-preset", "slow", "-crf", "17",
    "-movflags", "+faststart", out], { stdio: "inherit" });
  console.log("wrote", out, frames.length, "frames");
}

function helpers(page) {
  const hold = (ms) => page.waitForTimeout(ms);
  const loc = (x) => (typeof x === "string" ? page.locator(x).first() : x);
  async function into(x) {
    const l = loc(x);
    await l.waitFor({ state: "visible" });
    const off = await l.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top < 70 || r.bottom > innerHeight - 120 ? r.top + r.height / 2 - innerHeight * 0.45 : 0;
    });
    if (Math.abs(off) > 4) { await page.evaluate((y) => scrollBy({ top: y, behavior: "smooth" }), off); await hold(700); }
    return l;
  }
  return {
    page, hold, into,
    async tap(x, after = 650) {
      const l = await into(x);
      await hold(250);
      await l.click();
      await hold(after);
    },
    async type(x, text, after = 400) {
      const l = await into(x);
      await l.click();
      await hold(200);
      await l.pressSequentially(text, { delay: 75 });
      await hold(after);
    },
    async scroll(y, after = 700) {
      await page.evaluate((y) => scrollBy({ top: y, behavior: "smooth" }), y);
      await hold(after);
    },
    async top(after = 600) {
      await page.evaluate(() => scrollTo({ top: 0, behavior: "smooth" }));
      await hold(after);
    },
    async nav(href, after = 1400) {
      await this.tap(page.locator(`nav a[href="${href}"], a[href="${href}"]`).last(), after);
    },
  };
}
