import { curlFetch } from "./curl-fetch";
import type { RawArticle } from "./types";

/**
 * Fetch recent arXiv papers using the OAI-PMH endpoint.
 * More reliable than the search API which often rate-limits.
 */
export async function fetchArxivPapers(
  sourceId: string,
  keywords?: string[],
  limit = 15,
): Promise<RawArticle[]> {
  // Use OAI-PMH to get recent cs (Computer Science) papers
  const today = new Date().toISOString().slice(0, 10);
  const url = `https://export.arxiv.org/oai2?verb=ListRecords&set=cs&from=${today}&metadataPrefix=arXiv`;

  let raw = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      raw = await curlFetch(url, {
        "User-Agent": "DailyBriefBot/1.0 (academic research digest)",
      }, 90);
      break;
    } catch (e) {
      console.error(`[arxiv-papers] attempt ${attempt}/3 failed:`, (e as Error).message);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 10000));
    }
  }
  if (!raw) {
    console.error("[arxiv-papers] all attempts failed, skipping");
    return [];
  }

  const entries = parseOAIEntries(raw);
  const keywordList = (keywords ?? []).map((k) => k.toLowerCase());

  return entries
    .filter((e) => {
      if (keywordList.length === 0) return true;
      const haystack = [e.title, e.abstract].join(" ").toLowerCase();
      return keywordList.some((kw) => haystack.includes(kw));
    })
    .slice(0, limit)
    .map((e) => ({
      sourceId,
      title: e.title,
      url: `https://arxiv.org/abs/${e.id}`,
      excerpt: e.abstract.slice(0, 300),
      publishedAt: e.created ? new Date(e.created) : undefined,
      category: "tech" as const,
      meta: e.categories.length > 0 ? e.categories.join(", ") : undefined,
    }));
}

interface OAIEntry {
  id: string;
  title: string;
  abstract: string;
  created: string;
  categories: string[];
}

/**
 * Parse OAI-PMH XML entries for arXiv papers.
 * Extracts <id> from within <arXiv> metadata block only.
 */
function parseOAIEntries(xml: string): OAIEntry[] {
  const entries: OAIEntry[] = [];
  // Split on <record> tags
  const blocks = xml.split(/<record>/g).slice(1);

  for (const block of blocks) {
    const endIdx = block.indexOf("</record>");
    const content = endIdx >= 0 ? block.slice(0, endIdx) : block;

    // Extract the <arXiv> metadata block
    const arxivBlock = content.match(/<arXiv[^>]*>([\s\S]*?)<\/arXiv>/)?.[1];
    if (!arxivBlock) continue;

    // Only include papers with cs.CV, cs.GR, cs.AI, cs.MM categories
    const catMatch = content.match(/<categories>([^<]+)<\/categories>/);
    if (!catMatch) continue;

    const allCats = catMatch[1].trim().split(/\s+/);
    const relevantCats = allCats.filter((c) =>
      ["cs.CV", "cs.GR", "cs.AI", "cs.MM"].includes(c),
    );
    if (relevantCats.length === 0) continue;

    // Extract fields from the arXiv metadata block
    const id = extractTag(arxivBlock, "id") ?? "";
    const title = normalizeWhitespace(extractTag(arxivBlock, "title") ?? "");
    const abstract = normalizeWhitespace(extractTag(arxivBlock, "abstract") ?? "");
    const created = extractTag(arxivBlock, "created") ?? "";

    if (id && title) {
      entries.push({
        id,
        title,
        abstract,
        created,
        categories: relevantCats,
      });
    }
  }

  return entries;
}

function extractTag(xml: string, tag: string): string | undefined {
  const match = xml.match(
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`),
  );
  return match?.[1]?.trim();
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
