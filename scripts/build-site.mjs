#!/usr/bin/env node
/**
 * Build the static site that gets published to GitHub Pages (or any static
 * host). Run AFTER `npm run daily` has produced today's report.
 *
 * Writes into daily_reports/ (already the publish dir):
 *   - index.html      copy of the latest <date>/<date>.html
 *   - archive.html    table of every <date>/<date>.html, newest first
 *
 * Existing per-date subdirs are left untouched. Idempotent — safe to re-run.
 *
 * Usage:
 *   node scripts/build-site.mjs
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = "daily_reports";

if (!fs.existsSync(ROOT)) {
  console.error(`[build-site] ${ROOT}/ doesn't exist — run \`npm run daily\` first.`);
  process.exit(1);
}

// Pick up every <YYYY-MM-DD>/<YYYY-MM-DD>.html, newest first.
const dates = fs
  .readdirSync(ROOT)
  .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
  .filter((d) => fs.existsSync(path.join(ROOT, d, `${d}.html`)))
  .sort((a, b) => b.localeCompare(a));

if (dates.length === 0) {
  console.error(`[build-site] no <YYYY-MM-DD>/<YYYY-MM-DD>.html found in ${ROOT}/`);
  process.exit(1);
}

// --- index.html = latest report ---
const latest = dates[0];
const latestPath = path.join(ROOT, latest, `${latest}.html`);
const latestHtml = fs
  .readFileSync(latestPath, "utf8")
  .replace(/href="\.\.\/archive\.html"/g, 'href="./archive.html"');
fs.writeFileSync(path.join(ROOT, "index.html"), latestHtml, "utf8");
console.log(`[build-site] index.html  ← ${latest}/${latest}.html`);

// --- archive.html = list of all reports (MiMo dark theme) ---
const rows = dates
  .map((d) => {
    const size = (fs.statSync(path.join(ROOT, d, `${d}.html`)).size / 1024).toFixed(0);
    return `      <li><a href="./${d}/${d}.html">${d}</a> <span class="size">${size} KB</span></li>`;
  })
  .join("\n");

const generated = new Date().toISOString().slice(0, 10);

const archiveHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>DailyBrief — Archive</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800&family=Noto+Sans+SC:wght@400;500&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0a0a0a;
    color: #f0f0f0;
    font-family: Inter, 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    padding: 6rem 2rem 4rem;
  }
  .wrap { max-width: 720px; margin: 0 auto; }
  .section-label {
    color: rgba(255,255,255,0.25);
    font-size: 0.7rem; letter-spacing: 0.2em;
    text-transform: uppercase; font-weight: 500;
    margin-bottom: 2rem;
  }
  h1 {
    font-size: clamp(1.75rem, 4vw, 2.25rem);
    font-weight: 700; letter-spacing: -0.02em;
    margin-bottom: 0.75rem;
  }
  .meta {
    color: rgba(255,255,255,0.35);
    font-size: 0.85rem;
    margin-bottom: 2.5rem;
    letter-spacing: 0.04em;
  }
  .top {
    margin-bottom: 2.5rem;
    padding: 1rem 1.25rem;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.02);
    border-radius: 2px;
  }
  .top a {
    color: rgba(255,255,255,0.72);
    text-decoration: none;
    font-size: 0.9rem;
    transition: color 0.2s;
  }
  .top a:hover { color: #fff; }
  ul { list-style: none; padding: 0; }
  li {
    padding: 1rem 0;
    border-top: 1px solid rgba(255,255,255,0.055);
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: padding-left 0.2s;
  }
  li:last-child { border-bottom: 1px solid rgba(255,255,255,0.055); }
  li:hover { padding-left: 0.75rem; }
  li a {
    color: rgba(255,255,255,0.72);
    text-decoration: none;
    font-size: 0.93rem;
    transition: color 0.2s;
  }
  li:hover a { color: rgba(255,255,255,0.95); }
  .size { color: rgba(255,255,255,0.22); font-size: 0.72rem; }
  a:focus-visible {
    outline: 2px solid rgba(255,255,255,0.4);
    outline-offset: 2px;
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="section-label">Archive</div>
    <h1>DailyBrief</h1>
    <p class="meta">${dates.length} report${dates.length === 1 ? "" : "s"} · newest first · generated ${generated}</p>
    <div class="top">
      <a href="./index.html">→ Latest report (${latest})</a>
    </div>
    <ul>
${rows}
    </ul>
  </div>
</body>
</html>
`;
fs.writeFileSync(path.join(ROOT, "archive.html"), archiveHtml, "utf8");
console.log(`[build-site] archive.html (${dates.length} dates)`);

// .nojekyll prevents GitHub Pages from running Jekyll, which would otherwise
// strip directories whose names start with "_". We don't have any today but
// it's cheap insurance and standard practice for static-site GH Pages.
fs.writeFileSync(path.join(ROOT, ".nojekyll"), "", "utf8");
console.log(`[build-site] .nojekyll`);
