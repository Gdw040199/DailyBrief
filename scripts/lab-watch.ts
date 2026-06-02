#!/usr/bin/env tsx
/**
 * Check lab/professor homepages in lab-watchlist.json.
 * First run stores baselines; later runs report fingerprint changes.
 *
 * Usage:
 *   npm run lab-watch
 *   npm run lab-watch -- --dry   # fetch + extract only, don't save state
 */
import "./_env";

import {
  checkLabWatchlist,
  extractNewsFromHtml,
  loadLabWatchlist,
} from "../lib/lab-watch";
import { curlFetch } from "../lib/sources/curl-fetch";

const dry = process.argv.includes("--dry");

async function main() {
  const list = loadLabWatchlist();
  if (list.length === 0) {
    console.error("[lab-watch] lab-watchlist.json is empty or missing");
    process.exit(1);
  }

  if (process.argv.includes("--probe")) {
    for (const lab of list) {
      console.log(`\n[probe] ${lab.name} — ${lab.url}`);
      try {
        const html = await curlFetch(lab.url, {
          "User-Agent": "Mozilla/5.0 (compatible; DailyBriefBot/1.0)",
          Accept: "text/html",
        }, 45);
        const { headline, snippet } = extractNewsFromHtml(html);
        console.log(`  headline: ${headline}`);
        console.log(`  snippet: ${snippet.slice(0, 200)}…`);
      } catch (e) {
        console.error(`  FAILED:`, e instanceof Error ? e.message : e);
      }
    }
    return;
  }

  console.log(`[lab-watch] checking ${list.length} homepage(s)…\n`);
  const results = await checkLabWatchlist({ persist: !dry });
  for (const r of results) {
    const icon =
      r.status === "updated" ? "●" : r.status === "error" ? "✗" : "○";
    console.log(`${icon} ${r.name}`);
    if (r.status === "updated") {
      console.log(`    NEW: ${r.headline}`);
      if (r.previousHeadline) console.log(`    WAS: ${r.previousHeadline}`);
    } else if (r.status === "unchanged") {
      console.log(`    ${r.headline || "(baseline stored)"}`);
    } else {
      console.log(`    error: ${r.error}`);
    }
  }

  const n = results.filter((r) => r.status === "updated").length;
  console.log(
    `\n[lab-watch] ${n} update(s)${dry ? " (dry — state not saved)" : ""}`,
  );
}

main().catch((e) => {
  console.error("[lab-watch] FAILED:", e);
  process.exit(1);
});
