import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import * as cheerio from "cheerio";

import { curlFetch } from "./sources/curl-fetch";
import { REPORT_LOCALE } from "./sources/registry";

// ----- types -----

export type LabWatchDef = {
  id: string;
  name: string;
  url: string;
  enabled?: boolean;
  notes?: string;
};

export type LabWatchStatus = "updated" | "unchanged" | "error";

export type LabWatchResult = {
  id: string;
  name: string;
  url: string;
  status: LabWatchStatus;
  /** Latest news line extracted from the homepage */
  headline: string;
  /** Previous headline when status === updated */
  previousHeadline?: string;
  error?: string;
};

type LabWatchStateEntry = {
  fingerprint: string;
  headline: string;
  checkedAt: string;
};

type LabWatchState = {
  entries: Record<string, LabWatchStateEntry>;
};

const WATCHLIST_PATH = "lab-watchlist.json";
/** Lives under daily_reports/ so gh-pages restore persists fingerprints in CI */
const STATE_PATH = path.join("daily_reports", ".lab-watch-state.json");

const FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (compatible; DailyBriefBot/1.0; +https://github.com/)",
  Accept: "text/html,application/xhtml+xml",
};

// ----- watchlist loader -----

export function loadLabWatchlist(): LabWatchDef[] {
  const file = path.resolve(WATCHLIST_PATH);
  if (!fs.existsSync(file)) return [];
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as LabWatchDef[];
  return raw.filter((e) => e.enabled !== false && e.id && e.url && e.name);
}

function loadState(): LabWatchState {
  const file = path.resolve(STATE_PATH);
  if (!fs.existsSync(file)) return { entries: {} };
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as LabWatchState;
  } catch {
    return { entries: {} };
  }
}

function saveState(state: LabWatchState): void {
  fs.writeFileSync(
    path.resolve(STATE_PATH),
    JSON.stringify(state, null, 2),
    "utf8",
  );
}

function fingerprint(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 20);
}

function normalizeSpace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Pick the first news-like line for display in the report UI */
function headlineFromText(text: string): string {
  const segment = (text.split("|")[0] ?? text).trim();
  const cleaned = normalizeSpace(segment.replace(/🎉+/g, " "));
  const parts = cleaned.split(
    /\s(?=\d{4}\.\d{1,2}:)|\s(?=\d{2}\s*\/\s*\d{4}\s)|\s(?=(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
  );
  const first = parts[0]?.trim() || cleaned;
  return first.slice(0, 160);
}

/**
 * Extract the News / New Events block from common academic homepage layouts.
 * Tested against yuexinma.me, icoz69.github.io, wyhsirius.github.io.
 */
export function extractNewsFromHtml(html: string): {
  snippet: string;
  headline: string;
} {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();

  // wyhsirius.github.io — #news anchor + following .row items
  const newsAnchor = $("#news");
  if (newsAnchor.length) {
    const rows: string[] = [];
    let el = newsAnchor.next();
    while (el.length) {
      if (el.attr("id") === "research") break;
      const t = normalizeSpace(el.text());
      if (t.length > 8) rows.push(t);
      if (rows.length >= 12) break;
      el = el.next();
    }
    const snippet = rows.join(" | ").slice(0, 1800);
    if (snippet.length > 20) {
      return { snippet, headline: headlineFromText(snippet) };
    }
  }

  const newsHeading = $("h2, h3")
    .filter((_, el) => {
      const t = $(el).text().trim().toLowerCase();
      return t === "news" || t === "new events" || t.startsWith("new events");
    })
    .first();

  if (newsHeading.length) {
    // icoz69.github.io — News inside <section>
    const section = newsHeading.closest("section");
    if (section.length) {
      let text = normalizeSpace(section.text());
      text = text.replace(/^news\s*scroll for more\s*/i, "").slice(0, 1800);
      if (text.length > 25) {
        return { snippet: text, headline: headlineFromText(text) };
      }
    }

    // yuexinma.me — "New Events" in same cell / table block
    const blockText = normalizeSpace(newsHeading.parent().parent().text());
    const afterEvents = blockText.split(/new events/i)[1]?.trim();
    if (afterEvents && afterEvents.length > 30) {
      const snippet = afterEvents.slice(0, 1800);
      return { snippet, headline: headlineFromText(snippet) };
    }

    // Generic: walk siblings after heading container
    const parts: string[] = [];
    let cur = newsHeading.parent().next();
    for (let i = 0; i < 15 && cur.length; i++) {
      const t = normalizeSpace(cur.text());
      if (/^(about me|research|publications|honors)/i.test(t.slice(0, 24))) break;
      if (t.length > 10) parts.push(t);
      cur = cur.next();
    }
    if (parts.length > 0) {
      const snippet = parts.join(" | ").slice(0, 1800);
      return { snippet, headline: headlineFromText(snippet) };
    }
  }

  throw new Error("no News / New Events section found");
}

async function fetchHomepage(url: string): Promise<string> {
  return curlFetch(url, FETCH_HEADERS, 45);
}

/**
 * Check all enabled lab homepages, update local state, return today's results.
 * First run stores baselines silently (status unchanged) — alerts start day 2.
 */
export async function checkLabWatchlist(
  opts: { persist?: boolean } = {},
): Promise<LabWatchResult[]> {
  const persist = opts.persist !== false;
  const list = loadLabWatchlist();
  if (list.length === 0) return [];

  const state = loadState();
  const results: LabWatchResult[] = [];
  let changed = false;

  for (const lab of list) {
    try {
      const html = await fetchHomepage(lab.url);
      const { snippet, headline } = extractNewsFromHtml(html);
      const fp = fingerprint(snippet);
      const prev = state.entries[lab.id];

      if (!prev) {
        state.entries[lab.id] = {
          fingerprint: fp,
          headline,
          checkedAt: new Date().toISOString(),
        };
        changed = true;
        results.push({
          id: lab.id,
          name: lab.name,
          url: lab.url,
          status: "unchanged",
          headline,
        });
        continue;
      }

      if (prev.fingerprint !== fp) {
        state.entries[lab.id] = {
          fingerprint: fp,
          headline,
          checkedAt: new Date().toISOString(),
        };
        changed = true;
        results.push({
          id: lab.id,
          name: lab.name,
          url: lab.url,
          status: "updated",
          headline,
          previousHeadline: prev.headline,
        });
      } else {
        state.entries[lab.id].checkedAt = new Date().toISOString();
        changed = true;
        results.push({
          id: lab.id,
          name: lab.name,
          url: lab.url,
          status: "unchanged",
          headline,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({
        id: lab.id,
        name: lab.name,
        url: lab.url,
        status: "error",
        headline: "",
        error: msg,
      });
    }
  }

  if (persist && changed) saveState(state);
  return results;
}

export function labWatchUiStrings() {
  return REPORT_LOCALE === "en"
    ? {
        sectionLabel: "Lab Watch",
        updated: "Updated",
        unchanged: "No change",
        error: "Check failed",
        emptyUpdates: "No lab homepage updates today.",
        viewHomepage: "Open homepage",
        latest: "Latest",
      }
    : {
        sectionLabel: "课题组动态",
        updated: "有更新",
        unchanged: "无变化",
        error: "检查失败",
        emptyUpdates: "今日暂无课题组主页更新。",
        viewHomepage: "打开主页",
        latest: "最新",
      };
}
