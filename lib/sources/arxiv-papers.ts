/**
 * arXiv Papers fetcher — uses arXiv RSS feeds to get daily new papers.
 *
 * Approach:
 * 1. Fetch RSS feeds for cs.CV, cs.GR, cs.AI, cs.MM categories
 * 2. Each feed contains papers announced today (updated daily around 2am ET)
 * 3. RSS includes full abstracts — no need for extra API calls
 * 4. Deduplicate by arXiv ID (papers may appear in multiple categories)
 *
 * Why RSS over arXiv API:
 * - RSS works reliably (API can timeout under load)
 * - RSS includes full abstracts in <description>
 * - RSS is updated daily, perfect for a daily digest
 * - No rate limiting concerns
 *
 * RSS feed URL format: https://rss.arxiv.org/rss/{category}
 * Combined feed: https://rss.arxiv.org/rss/cs.CV+cs.AI (AND logic, not OR)
 * So we fetch each category separately and merge.
 */

import type { RawArticle } from "./types.js";

// --- helpers ----------------------------------------------------------------

/** Extract text content between opening and closing tags */
function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = re.exec(xml);
  return m ? m[1].trim() : "";
}

/** Extract all values for a tag (e.g., multiple <category> tags) */
function extractAllTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, "gi");
  const results: string[] = [];
  let m;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1].trim());
  }
  return results;
}

interface RssEntry {
  arxivId: string;
  title: string;
  abstract: string;
  authors: string;
  categories: string[];
  link: string;
  published: string;
}

/** Parse arXiv RSS XML into structured entries */
function parseRssEntries(xml: string): RssEntry[] {
  const entries: RssEntry[] = [];

  // Split by <item> tags
  const itemBlocks = xml.split(/<item>/i).slice(1);

  for (const block of itemBlocks) {
    const endIdx = block.search(/<\/item>/i);
    const itemXml = endIdx >= 0 ? block.slice(0, endIdx) : block;

    const title = extractTag(itemXml, "title")
      .replace(/\s+/g, " ")
      .trim();

    const link = extractTag(itemXml, "link").trim();

    // Extract arXiv ID from link (format: https://arxiv.org/abs/2605.30380)
    const idMatch = /arxiv\.org\/abs\/(.+?)(?:v\d+)?$/i.exec(link);
    const arxivId = idMatch ? idMatch[1] : "";
    if (!arxivId) continue;

    // Description contains "arXiv:ID Announce Type: ... Abstract: ..."
    const description = extractTag(itemXml, "description");
    const abstractMatch = /Abstract:\s*([\s\S]+)$/i.exec(description);
    const abstract = abstractMatch
      ? abstractMatch[1].replace(/\s+/g, " ").trim()
      : "";

    // Authors from dc:creator
    const authors = extractTag(itemXml, "dc:creator");

    // Categories (can be multiple)
    const categories = extractAllTags(itemXml, "category");

    // Published date
    const published = extractTag(itemXml, "pubDate");

    entries.push({
      arxivId,
      title,
      abstract,
      authors,
      categories,
      link,
      published,
    });
  }

  return entries;
}

/** Fetch an RSS feed with retry logic */
async function fetchRssFeed(url: string): Promise<string> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "DailyBrief/1.0 (academic research digest)",
        },
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const text = await resp.text();
      if (text.length > 0) return text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[arxiv] RSS attempt ${attempt}/3 failed for ${url}: ${msg}`);
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }
  return "";
}

// --- main fetcher -----------------------------------------------------------

/**
 * Target arXiv categories:
 * - cs.CV: Computer Vision (main, ~200+ papers/day)
 * - cs.GR: Graphics (animation, rendering, ~10 papers/day)
 * - cs.AI: Artificial Intelligence (world models, agents, ~30 papers/day)
 * - cs.MM: Multimedia (video, audio, ~5 papers/day)
 */
const TARGET_CATEGORIES = ["cs.CV", "cs.GR", "cs.AI", "cs.MM"];

/**
 * Fetch today's arXiv papers from RSS feeds.
 *
 * Each category has its own RSS feed updated daily.
 * We fetch all feeds, parse, deduplicate, and return combined results.
 */
export async function fetchArxivPapers(
  sourceId: string,
  _keywords?: string[],
  limit = 300,
): Promise<RawArticle[]> {
  console.log(`[arxiv] Fetching RSS feeds for: ${TARGET_CATEGORIES.join(", ")}`);

  // Fetch all feeds in parallel
  const feedPromises = TARGET_CATEGORIES.map(async (cat) => {
    const url = `https://rss.arxiv.org/rss/${cat}`;
    const xml = await fetchRssFeed(url);
    const entries = parseRssEntries(xml);
    console.log(`[arxiv] ${cat}: ${entries.length} papers`);
    return entries;
  });

  const feeds = await Promise.all(feedPromises);

  // Merge and deduplicate by arXiv ID
  const seen = new Set<string>();
  const allEntries: RssEntry[] = [];

  for (const entries of feeds) {
    for (const entry of entries) {
      if (!seen.has(entry.arxivId)) {
        seen.add(entry.arxivId);
        allEntries.push(entry);
      }
    }
  }

  console.log(`[arxiv] Total unique papers: ${allEntries.length} (limit: ${limit})`);

  // Log category distribution
  const catDist: Record<string, number> = {};
  for (const e of allEntries) {
    const primary = e.categories[0] || "unknown";
    catDist[primary] = (catDist[primary] || 0) + 1;
  }
  console.log("[arxiv] Category distribution:", JSON.stringify(catDist));

  // Apply limit
  const limited = allEntries.slice(0, limit);

  return limited.map((e) => ({
    sourceId,
    title: e.title,
    url: e.link,
    excerpt: e.abstract.slice(0, 300),
    publishedAt: e.published ? new Date(e.published) : undefined,
    category: "tech" as const,
    // Store primary category for display
    meta: e.categories[0] || "cs.CV",
    // Store full abstract for LLM classification
    content: e.abstract,
  }));
}
