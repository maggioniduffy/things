/**
 * Renders the brand PNGs (app icons, favicon, Open Graph images) from the Claude Design
 * "Brand Assets" sheet. Output is committed; rerun only when the mark or the aurora changes:
 *
 *   node scripts/render-brand-assets.mjs
 *
 * Needs Playwright's Chromium (`pnpm exec playwright install chromium`) and network access
 * once, for the Inter Tight webfont. Colors mirror the tokens in src/app/globals.css.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = (...p) => join(root, ...p);

const C = {
  paper: "#f3f4f6",
  ink: "#0f0f12",
  inkMuted: "#4a4a52",
  blue: "#4f63de",
  violet: "#8e6cf0",
  pink: "#ee5bc4",
  red: "#ef4a30",
  coral: "#f6a79c",
  olive: "#a9a55c",
};

const NOISE = `url('data:image/svg+xml;utf8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27240%27 height=%27240%27%3E%3Cfilter id=%27n%27 x=%270%27 y=%270%27 width=%27100%25%27 height=%27100%25%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.85%27 numOctaves=%273%27 stitchTiles=%27stitch%27/%3E%3CfeColorMatrix type=%27saturate%27 values=%270%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/%3E%3C/svg%3E')`;

const MASK = `url('data:image/svg+xml;utf8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 1440 600%27 preserveAspectRatio=%27none%27%3E%3Cdefs%3E%3Cfilter id=%27b%27 x=%27-5%25%27 y=%27-20%25%27 width=%27110%25%27 height=%27140%25%27%3E%3CfeGaussianBlur stdDeviation=%279%27/%3E%3C/filter%3E%3C/defs%3E%3Cpath filter=%27url(%23b)%27 d=%27M-80 150 C 120 60 300 40 500 120 S 860 240 1040 110 S 1300 20 1520 120 L1520 700 L-80 700 Z%27/%3E%3C/svg%3E')`;

const blob = (pos, paint, extra = "") =>
  `<div style="position:absolute;${pos};border-radius:50%;filter:blur(40px);background:${paint};${extra}"></div>`;

const aurora = () => `
<div style="position:absolute;inset:0;overflow:hidden;-webkit-mask-image:${MASK};-webkit-mask-size:100% 100%;-webkit-mask-repeat:no-repeat">
  ${blob("right:-12%;bottom:-38%;height:105%;width:72%", `radial-gradient(closest-side,${C.blue},transparent)`)}
  ${blob("left:22%;bottom:-45%;height:115%;width:62%", `radial-gradient(closest-side,${C.violet},transparent)`)}
  ${blob("left:-14%;bottom:-40%;height:105%;width:70%", `radial-gradient(closest-side,${C.pink},transparent)`)}
  ${blob("left:8%;top:8%;height:40%;width:84%", `radial-gradient(closest-side,${C.red},${C.coral} 55%,transparent)`, "opacity:0.85")}
  ${blob("left:28%;top:16%;height:9%;width:52%", `radial-gradient(closest-side,${C.olive},transparent)`)}
  <div style="position:absolute;inset:0;opacity:0.3;mix-blend-mode:multiply;background-size:240px 240px;background-image:${NOISE}"></div>
</div>`;

const grain = () =>
  `<div style="position:absolute;inset:0;opacity:0.08;mix-blend-mode:multiply;background-size:240px 240px;background-image:${NOISE}"></div>`;

let gradientSeq = 0;
/** The mark: two sheared cards. `color` = default gradients, or a flat color string. */
const mark = (size, color) => {
  const n = ++gradientSeq;
  const a = `a${n}`;
  const b = `b${n}`;
  const fl = color ?? `url(#${a})`;
  const fr = color ?? `url(#${b})`;
  const defs = color
    ? ""
    : `<defs>
<linearGradient id="${a}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.blue}"/><stop offset="0.55" stop-color="${C.violet}"/><stop offset="1" stop-color="${C.pink}"/></linearGradient>
<linearGradient id="${b}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.coral}"/><stop offset="0.5" stop-color="${C.pink}"/><stop offset="1" stop-color="${C.red}"/></linearGradient>
</defs>`;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" stroke-width="2" stroke-linejoin="round" style="display:block;overflow:visible">${defs}
<path d="M1.85 4.2 10.5 9.2V22.8L1.85 17.8z" fill="${fl}" stroke="${fl}"/>
<path d="M13.5 1.2 22.15 6.2V19.8L13.5 14.8z" fill="${fr}" stroke="${fr}"/></svg>`;
};

/** 512 px app icon. `radius` 0 gives a full-bleed square (Apple masks it itself). */
const icon = (tone, radius) => {
  const frame = (bg, inner, ring = "") =>
    `<div id="root" style="position:relative;width:512px;height:512px;border-radius:${radius}px;overflow:hidden;background:${bg};${ring}">${inner}</div>`;
  const at = (l, t, inner) =>
    `<div style="position:absolute;left:${l}px;top:${t}px">${inner}</div>`;
  switch (tone) {
    case "paper":
      return frame(
        C.paper,
        `<div style="position:absolute;left:0;right:0;bottom:0;height:54%">${aurora()}</div>${at(146, 84, mark(220))}${grain()}`,
        "box-shadow:inset 0 0 0 1px rgb(15 15 18 / 0.06);",
      );
    case "ink":
      return frame(
        C.ink,
        `<div style="position:absolute;left:0;right:0;bottom:0;height:62%;opacity:0.9;-webkit-mask-image:linear-gradient(to bottom,transparent,#000 45%)">${aurora()}</div>${at(136, 110, mark(240))}`,
      );
    case "aurora":
      return frame(
        C.paper,
        `<div style="position:absolute;left:-10%;right:-10%;top:-4%;bottom:0">${aurora()}</div>${at(136, 136, mark(240, "#ffffff"))}`,
      );
    case "glyph":
      return frame(C.ink, at(76, 76, mark(360)));
  }
};

/** Wordmark: "teca" takes the mark's gradient on paper, a light weight when `color` is flat (on aurora). */
const wordmark = (size, color, flat = false) => {
  const suffix = flat
    ? `<span style="font-weight:300;opacity:0.85">teca</span>`
    : `<span style="background:linear-gradient(90deg,${C.blue},${C.violet},${C.pink});-webkit-background-clip:text;background-clip:text;color:transparent">teca</span>`;
  return `<span style="font-family:'Inter Tight',Inter,sans-serif;font-weight:600;letter-spacing:-0.02em;line-height:1;font-size:${size}px;color:${color}">Thing${suffix}</span>`;
};

const og = {
  default: () => `
<div id="root" style="position:relative;width:1200px;height:630px;overflow:hidden;background:${C.paper}">
  <div style="position:absolute;left:0;right:0;bottom:0;height:320px">${aurora()}</div>
  <div style="position:absolute;left:72px;top:64px;display:inline-flex;align-items:center;gap:12px">${mark(40)}${wordmark(36, C.ink)}</div>
  <div style="position:absolute;left:72px;right:72px;top:168px;display:flex;flex-direction:column;gap:20px">
    <h3 style="margin:0;font-family:'Inter Tight',Inter,sans-serif;font-weight:600;letter-spacing:-0.02em;font-size:88px;line-height:1.04;color:${C.ink}">Save anything.<br>Find it again.</h3>
    <p style="margin:0;font-family:Inter,sans-serif;font-size:26px;line-height:36px;color:${C.inkMuted};white-space:nowrap">Links, files and notes, sorted by format.</p>
  </div>
  ${grain()}
</div>`,
  brand: () => `
<div id="root" style="position:relative;width:1200px;height:630px;overflow:hidden;background:${C.paper}">
  <div style="position:absolute;left:0;right:0;bottom:0;height:560px">${aurora()}</div>
  <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding-bottom:40px">
    <div style="display:inline-flex;align-items:center;gap:26px">${mark(112, "#ffffff")}${wordmark(101, "#ffffff", true)}</div>
  </div>
  ${grain()}
</div>`,
};

const page = (body) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Inter+Tight:wght@300;600&display=swap" rel="stylesheet">
<style>html,body{margin:0;background:transparent;font-feature-settings:"ss01","cv11";-webkit-font-smoothing:antialiased}</style>
</head><body>${body}</body></html>`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});

/** Screenshot `html`'s #root at `width` px wide (CSS size `base`), transparent outside the radius. */
async function render(html, base, width) {
  const ctx = await browser.newContext({
    viewport: { width: base, height: base === 1200 ? 630 : base },
    deviceScaleFactor: width / base,
  });
  const p = await ctx.newPage();
  await p.setContent(page(html), { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  const buf = await p.locator("#root").screenshot({ omitBackground: true });
  await ctx.close();
  return buf;
}

const save = async (path, buf) => {
  await mkdir(dirname(out(path)), { recursive: true });
  await writeFile(out(path), buf);
  console.log("wrote", path, `${buf.length} B`);
};

/** Minimal ICO container holding PNG frames (Vista+ and every browser read it). */
function ico(frames) {
  const head = Buffer.alloc(6 + 16 * frames.length);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(frames.length, 4);
  let offset = head.length;
  frames.forEach(({ size, png }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size === 256 ? 0 : size, e);
    head.writeUInt8(size === 256 ? 0 : size, e + 1);
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(png.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  return Buffer.concat([head, ...frames.map((f) => f.png)]);
}

// App icons. Masters keep the sheet's rounded corners; apple-icon is full-bleed (iOS masks it).
await save("src/app/icon.png", await render(icon("paper", 114), 512, 512));
await save("src/app/apple-icon.png", await render(icon("paper", 0), 512, 180));
await save("public/brand/icon-512.png", await render(icon("paper", 114), 512, 512));
await save("public/brand/icon-192.png", await render(icon("paper", 114), 512, 192));
await save("public/brand/icon-ink-512.png", await render(icon("ink", 114), 512, 512));
await save("public/brand/icon-aurora-512.png", await render(icon("aurora", 114), 512, 512));

// Favicon: the sheet uses the flat glyph tone below 64 px.
const sizes = [16, 32, 48];
const frames = [];
for (const size of sizes) frames.push({ size, png: await render(icon("glyph", 114), 512, size) });
await save("src/app/favicon.ico", ico(frames));

// Open Graph.
const ogDefault = await render(og.default(), 1200, 1200);
await save("src/app/opengraph-image.png", ogDefault);
await save("src/app/twitter-image.png", ogDefault);
await save("public/brand/og-brand.png", await render(og.brand(), 1200, 1200));

await browser.close();
