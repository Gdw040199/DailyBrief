import { curlFetch } from "./curl-fetch";
import type { RawArticle } from "./types";

/**
 * Fetch recent arXiv papers from cs.CV and cs.MM categories,
 * optionally filtered by keywords. Uses the arXiv Atom API.
 *
 * The arXiv API returns Atom XML — we parse with regex to avoid
 * adding an XML parsing dependency.
 */
export async function fetchArxivPapers(
  sourceId: string,
  keywords?: string[],
  limit = 30,
): Promise<RawArticle[]> {
  // Search cs.CV (Computer Vision), cs.GR (Graphics), cs.AI (AI), and cs.MM (Multimedia)
  const searchQuery = "cat:cs.CV+OR+cat:cs.GR+OR+cat:cs.AI+OR+cat:cs.MM";
  const url =
    `http://export.arxiv.org/api/query?search_query=${searchQuery}` +
    `&sortBy=submittedDate&sortOrder=descending&max_results=60`;

  const raw = await curlFetch(url, {
    "User-Agent": "DailyBriefBot/1.0",
  }, 30);

  const entries = parseAtomEntries(raw);
  const keywordList = (keywords ?? []).map((k) => k.toLowerCase());

  return entries
    .filter((e) => {
      if (keywordList.length === 0) return true;
      const haystack = [e.title, e.summary].join(" ").toLowerCase();
      return keywordList.some((kw) => haystack.includes(kw));
    })
    .slice(0, limit)
    .map((e) => ({
      sourceId,
      title: e.title,
      url: e.url,
      excerpt: e.summary.slice(0, 300),
      publishedAt: e.published ? new Date(e.published) : undefined,
      category: "tech" as const,
      meta: e.categories.length > 0 ? e.categories.join(", ") : undefined,
    }));
}

interface AtomEntry {
  title: string;
  url: string;
  summary: string;
  published: string;
  categories: string[];
}

/**
 * Parse arXiv Atom XML entries with regex. The format is well-structured:
 * <entry>
 *   <id>http://arxiv.org/abs/2505.12345v1</id>
 *   <title>...</title>
 *   <summary>...</summary>
 *   <published>2025-05-30T...</published>
 *   <category term="cs.CV" />
 *   ...
 * </entry>
 */
function parseAtomEntries(xml: string): AtomEntry[] {
  const entries: AtomEntry[] = [];
  // Split on <entry> tags
  const entryBlocks = xml.split(/<entry>/g).slice(1); // skip preamble

  for (const block of entryBlocks) {
    const endIdx = block.indexOf("</entry>");
    const content = endIdx >= 0 ? block.slice(0, endIdx) : block;

    // Extract fields
    const id = extractTag(content, "id") ?? "";
    const title = normalizeWhitespace(extractTag(content, "title") ?? "");
    const summary = normalizeWhitespace(extractTag(content, "summary") ?? "");
    const published = extractTag(content, "published") ?? "";

    // Extract all category terms
    const categories: string[] = [];
    const catRegex = /<category\s+term="([^"]+)"/g;
    let catMatch: RegExpExecArray | null;
    while ((catMatch = catRegex.exec(content)) !== null) {
      categories.push(catMatch[1]);
    }

    // Use the abstract URL (not the API URL) as the article link
    // Prefer <link> with type="text/html", fallback to the id URL
    const htmlLink = content.match(
      /<link[^>]*type="text\/html"[^>]*href="([^"]+)"/,
    )?.[1];
    const url = htmlLink ?? id.replace("http://", "https://");

    if (title && url) {
      entries.push({ title, url, summary, published, categories });
    }
  }

  return entries;
}

function extractTag(xml: string, tag: string): string | undefined {
  // Handle CDATA: <tag><![CDATA[content]]></tag>
  const cdataMatch = xml.match(
    new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`),
  );
  if (cdataMatch) return cdataMatch[1];

  // Regular: <tag>content</tag>
  const match = xml.match(
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`),
  );
  return match?.[1]?.trim();
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
