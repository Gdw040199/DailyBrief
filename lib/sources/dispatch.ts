import { fetchAttentionVc } from "./attentionvc";
import { fetchArxivPapers } from "./arxiv-papers";
import { fetchGithubTrending } from "./github-trending";
import { fetchHuggingfacePapers } from "./huggingface-papers";
import { fetchRss } from "./rss";
import type { RawArticle, SourceDef } from "./types";

/**
 * Single dispatcher used by daily.ts, dry-run.ts, and the cron route.
 * Add a new branch here when introducing a non-RSS fetcher.
 */
export async function fetchSource(source: SourceDef): Promise<RawArticle[]> {
  if (source.id === "github-trending") return fetchGithubTrending(source.id);
  if (source.id === "attentionvc-ai") return fetchAttentionVc(source.id);
  if (source.id === "huggingface-papers") return fetchHuggingfacePapers(source.id, source.keywords);
  if (source.id === "arxiv-papers") return fetchArxivPapers(source.id, source.keywords);
  return fetchRss(source.id, source.url, source.category, {
    useCurl: source.useCurl,
  });
}
