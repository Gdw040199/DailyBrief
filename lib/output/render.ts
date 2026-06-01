import type {
  ArticleInput,
  BriefItem,
  DailyReport,
} from "../ai/pipeline";
import { REPORT_LOCALE } from "../sources/registry";
import { getReportTz } from "../utils";
import type { Category, SourceDef } from "../sources/types";

// ----- i18n -----

/**
 * Localized UI strings. `t` resolves to TEXTS_ZH or TEXTS_EN at module
 * init based on REPORT_LOCALE. All hardcoded display text routes through
 * this object so adding a third locale = adding one more table.
 */
const TEXTS_ZH = {
  siteTitle: "每日简报",
  catTech: "技术动态",
  catPolitics: "时政观察",
  subAiNews: "AI 媒体",
  subTrendingPapers: "热门论文",
  subArxivPapers: "arXiv 论文",
  subXViral: "X 推文",
  subBlogWeekly: "博客周刊",
  subWorld: "国际要闻",
  subOverseasNews: "海外科技",
  subOverseas: "海外",
  emptySource: "该源今日无内容。",
  emptyCategory: "该分类今日无内容。",
  footer: "内容均来自原媒体，本站仅作摘要整理与回链。",
  summaryLabelNews: "中文摘要",
  summaryLabelIntro: "中文介绍",
  mdTodayOverview: "今日总览",
  mdEditorNote: "编辑短评",
  mdTodayKeywords: "今日关键词",
  mdImportance: "重要度",
  archiveLink: "← 历史归档",
};

const TEXTS_EN: typeof TEXTS_ZH = {
  siteTitle: "Daily Brief",
  catTech: "Tech",
  catPolitics: "World",
  subAiNews: "AI Media",
  subTrendingPapers: "Trending Papers",
  subArxivPapers: "arXiv Papers",
  subXViral: "X Viral",
  subBlogWeekly: "Blog Weekly",
  subWorld: "World News",
  subOverseasNews: "Overseas Tech",
  subOverseas: "Overseas",
  emptySource: "No content from this source today.",
  emptyCategory: "No content in this category today.",
  footer:
    "Content sourced from original publishers; this site provides summary and backlinks only.",
  summaryLabelNews: "Summary",
  summaryLabelIntro: "Summary",
  mdTodayOverview: "Today's Overview",
  mdEditorNote: "Editor's Note",
  mdTodayKeywords: "Keywords",
  mdImportance: "Importance",
  archiveLink: "← Archive",
};

const STR = REPORT_LOCALE === "en" ? TEXTS_EN : TEXTS_ZH;

// ----- types -----

export type SourceGroup = {
  sourceId: string;
  sourceName: string;
  items: ArticleInput[];
  /**
   * When true, items come from multiple merged sources and the renderer
   * should label each article with `a.source` since the source-tab row
   * is suppressed (only one synthetic group).
   */
  merged?: boolean;
};

export type SubGroup = {
  id: string;
  name: string;
  sources: SourceGroup[];
};

export type RawByCategory = Record<Category, SubGroup[]>;

// ----- labels & ordering -----

const CATEGORY_LABELS: Record<Category, string> = {
  tech: STR.catTech,
  politics: STR.catPolitics,
};

const CATEGORY_DIGEST_LABELS: Record<Category, string> = {
  tech: STR.catTech,
  politics: STR.catPolitics,
};

/**
 * L2 ordering per category. Categories not listed render flat (no L2 tabs).
 */
const SUBCATEGORY_ORDER: Partial<Record<Category, string[]>> = {
  tech: ["github-trending", "arxiv-papers", "trending-papers", "x-viral", "ai-news"],
  politics: ["world"],
};

const SUBCATEGORY_LABELS: Record<string, string> = {
  "github-trending": "GitHub Trending",
  "arxiv-papers": STR.subArxivPapers,
  "trending-papers": STR.subTrendingPapers,
  "ai-news": STR.subAiNews,
  "x-viral": STR.subXViral,
  "blog-weekly": STR.subBlogWeekly,
  world: STR.subWorld,
};

/**
 * Per-source item caps in the raw display, keyed by "category:subcategory".
 * Each source inside the subcategory shows up to N items. Missing keys = no cap.
 *
 * Default 20 across all L3-tabbed subcategories keeps each tab a single
 * comfortable scroll instead of 25-30 items. Merged subgroups (blog-weekly,
 * politics:world) ignore this — they use MERGED_SUBGROUP_LIMITS.
 */
const SOURCE_DISPLAY_LIMITS: Record<string, number> = {
  "tech:github-trending": 20,
  "tech:x-viral": 20,
  "tech:trending-papers": 20,
  "tech:arxiv-motion": 10,
  "tech:arxiv-video": 10,
  "tech:arxiv-world-model": 10,
  "tech:arxiv-cv-other": 5,
};

/**
 * Sources whose fetcher returns items already sorted by an engagement/heat
 * algorithm we want to preserve. groupRaw skips its default date-desc sort
 * for these so the final render reflects the source's own ranking.
 */
const PRESERVE_FETCH_ORDER_SOURCES = new Set([
  "attentionvc-ai",
  "huggingface-papers",
]);

function displayLimitFor(
  category: Category,
  subId: string | undefined,
): number | undefined {
  if (!subId) return undefined;
  return SOURCE_DISPLAY_LIMITS[`${category}:${subId}`];
}

/**
 * Subcategories that should collapse their sources into a single flat
 * time-sorted list (no L3 source tabs), keyed by "category:subcategory".
 * Value = number of items kept after merging. Each rendered article
 * will display its `source` label inline since the per-source tab row
 * is suppressed.
 *
 * Exported so daily.ts can read the cap to keep enrichment in sync.
 */
export const MERGED_SUBGROUP_LIMITS: Record<string, number> = {
  "tech:ai-news": 15,
  "politics:world": 15,
};

/**
 * Politics sources (especially Al Jazeera / BBC / The Diplomat) regularly
 * mix in World Cup / Olympic / football coverage. Filter at the title level
 * so the merged "国际要闻" stream stays politics-only.
 *
 * Pattern is intentionally specific — avoid generic words like "team" or
 * "match" that overlap with diplomacy headlines.
 */
const POLITICS_SPORTS_RE =
  /\b(World\s*Cup|Olympics?|UEFA|FIFA|NBA|NFL|NHL|MLB|ATP|WTA|Premier\s*League|Bundesliga|La\s*Liga|Serie\s*A|Champions\s*League|Eurovision|Wimbledon|Grand\s*Slam|F1|Formula\s*1|Ronaldo|Messi|Mbappe|Beckham|Lukaku|Mitoma|sportsman|footballer|squad)\b|世界杯|奥运|残奥|冬奥|欧冠|英超|西甲|意甲|德甲|网球|足球|篮球|高尔夫|棒球|板球|橄榄球/i;

export function isSportsArticle(title: string): boolean {
  return POLITICS_SPORTS_RE.test(title);
}

function mergedLimitFor(
  category: Category,
  subId: string,
): number | undefined {
  return MERGED_SUBGROUP_LIMITS[`${category}:${subId}`];
}

// ----- grouping -----

export function groupRaw(
  articles: ArticleInput[],
  registry: SourceDef[],
): RawByCategory {
  const subcatOf = new Map<string, string | undefined>();
  for (const s of registry) subcatOf.set(s.id, s.subcategory);
  // Drop articles from sources that have since been disabled — important
  // when scripts/render.ts re-renders against a stale sidecar that still
  // contains the disabled sources' fetched data.
  const enabledIds = new Set(
    registry.filter((s) => s.enabled !== false).map((s) => s.id),
  );

  type Bucket = { sourceName: string; items: ArticleInput[] };
  const buckets: Record<Category, Map<string, Bucket>> = {
    tech: new Map(),
    politics: new Map(),
  };
  // Pre-seed empty buckets for every enabled source so per-source-tabbed
  // subcategories still render a tab for sources that returned 0 items today.
  for (const s of registry) {
    if (s.enabled === false) continue;
    if (!buckets[s.category].has(s.id)) {
      buckets[s.category].set(s.id, { sourceName: s.name, items: [] });
    }
  }

  for (const a of articles) {
    if (!enabledIds.has(a.sourceId)) continue;
    if (a.category === "politics" && isSportsArticle(a.title)) continue;
    const map = buckets[a.category];
    let b = map.get(a.sourceId);
    if (!b) {
      b = { sourceName: a.source, items: [] };
      map.set(a.sourceId, b);
    }
    b.items.push(a);
  }

  for (const cat of Object.keys(buckets) as Category[]) {
    for (const [id, b] of buckets[cat].entries()) {
      if (PRESERVE_FETCH_ORDER_SOURCES.has(id)) continue;
      b.items.sort(
        (a, b) =>
          (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
      );
    }
  }

  function toSourceGroup(
    sourceId: string,
    b: Bucket,
    limit: number | undefined,
  ): SourceGroup {
    return {
      sourceId,
      sourceName: b.sourceName,
      items: limit ? b.items.slice(0, limit) : b.items,
    };
  }

  function sortByRegistry(list: SourceGroup[]): SourceGroup[] {
    return [...list].sort((a, b) => {
      const ia = registry.findIndex((s) => s.id === a.sourceId);
      const ib = registry.findIndex((s) => s.id === b.sourceId);
      return ia - ib;
    });
  }

  const out: RawByCategory = { tech: [], politics: [] };

  for (const cat of Object.keys(buckets) as Category[]) {
    const order = SUBCATEGORY_ORDER[cat];
    if (!order) {
      // Flat: one synthetic subgroup with every source.
      const sources: SourceGroup[] = [];
      for (const [id, b] of buckets[cat].entries()) {
        sources.push(toSourceGroup(id, b, undefined));
      }
      out[cat] = sources.length
        ? [{ id: "all", name: CATEGORY_LABELS[cat], sources: sortByRegistry(sources) }]
        : [];
      continue;
    }
    // Subcategory split: bucket each source under its registered subcategory.
    const subs: SubGroup[] = [];
    for (const subId of order) {
      const mergeLimit = mergedLimitFor(cat, subId);
      if (mergeLimit !== undefined) {
        // Merge: flatten all sources under this subcategory into a single
        // time-sorted SourceGroup. Articles keep their `source` field so
        // the renderer can label them.
        const flat: ArticleInput[] = [];
        for (const [id, b] of buckets[cat].entries()) {
          if (subcatOf.get(id) === subId) flat.push(...b.items);
        }
        if (flat.length === 0) continue;
        flat.sort(
          (a, b) =>
            (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
        );
        subs.push({
          id: subId,
          name: SUBCATEGORY_LABELS[subId] ?? subId,
          sources: [
            {
              sourceId: "_merged",
              sourceName: SUBCATEGORY_LABELS[subId] ?? subId,
              items: flat.slice(0, mergeLimit),
              merged: true,
            },
          ],
        });
        continue;
      }

      const limit = displayLimitFor(cat, subId);
      const sources: SourceGroup[] = [];

      // Special handling: split arxiv-papers by research direction (meta field)
      if (subId === "arxiv-papers") {
        const arxivBucket = buckets[cat].get("arxiv-papers");
        if (arxivBucket && arxivBucket.items.length > 0) {
          const byDir: Record<string, ArticleInput[]> = {
            motion: [],
            video: [],
            "world-model": [],
            "cv-other": [],
          };
          for (const a of arxivBucket.items) {
            // meta format: "category" or "category|codeUrl"
            const metaStr = (a.meta as string) || "cv-other";
            const pipeIdx = metaStr.indexOf("|");
            const dir = pipeIdx >= 0 ? metaStr.slice(0, pipeIdx) : metaStr;
            const codeUrl = pipeIdx >= 0 ? metaStr.slice(pipeIdx + 1) : "";
            if (byDir[dir]) {
              byDir[dir].push(a);
              // Store codeUrl on the article for rendering
              if (codeUrl) a.codeUrl = codeUrl;
            }
          }
          const dirLabels: Record<string, string> = {
            motion: "Human Motion",
            video: "Video Models",
            "world-model": "World Models",
            "cv-other": "CV Highlights",
          };
          for (const [dir, items] of Object.entries(byDir)) {
            if (items.length === 0) continue;
            sources.push({
              sourceId: `arxiv-${dir}`,
              sourceName: dirLabels[dir] ?? dir,
              items: items.slice(0, limit),
            });
          }
        }
      } else {
        for (const [id, b] of buckets[cat].entries()) {
          if (subcatOf.get(id) === subId) sources.push(toSourceGroup(id, b, limit));
        }
      }
      if (sources.length === 0) continue;
      subs.push({
        id: subId,
        name: SUBCATEGORY_LABELS[subId] ?? subId,
        sources: sortByRegistry(sources),
      });
    }
    out[cat] = subs;
  }

  return out;
}

// ----- HTML helpers -----

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(d: Date | undefined): string {
  if (!d) return "";
  try {
    // zh: "05/20 16:00"  · en: "May 20, 4:00 PM" → keep 24h en-GB style "20/05 16:00"
    const localeTag = REPORT_LOCALE === "en" ? "en-GB" : "zh-CN";
    return d.toLocaleString(localeTag, {
      timeZone: getReportTz(),
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}

// ----- raw article renderers -----

function renderArticleHtml(a: ArticleInput, showSource = false): string {
  const title = escapeHtml(a.title);
  const url = escapeHtml(a.url);
  const excerpt = a.excerpt ? escapeHtml(a.excerpt) : "";
  // Backwards-compat: old sidecar JSON files may carry `cnSummary` instead.
  const summaryText = a.summary ?? (a as unknown as { cnSummary?: string }).cnSummary;
  const summary = summaryText ? escapeHtml(summaryText) : "";
  const meta = a.meta ? escapeHtml(a.meta) : "";
  const time = formatDate(a.publishedAt);
  const sourceLabel = showSource && a.source ? escapeHtml(a.source) : "";
  const metaLine = [sourceLabel, time].filter(Boolean).join(" · ");
  const authors = a.authors ? escapeHtml(a.authors) : "";
  // Code repository link (stored by arXiv enrichment)
  const codeUrl = a.codeUrl;
  const codeLink = codeUrl ? `<a class="code-link" href="${escapeHtml(codeUrl)}" target="_blank" rel="noopener noreferrer">📦 Code</a>` : "";
  // News-style summary label for politics, project-intro style for GH/tech.
  const newsy = a.category === "politics";
  const summaryLabel = newsy ? STR.summaryLabelNews : STR.summaryLabelIntro;
  return `<article class="article">
  <h3 class="article-title"><a href="${url}" target="_blank" rel="noopener noreferrer">${title}</a></h3>
  ${authors ? `<p class="article-authors">${authors}</p>` : ""}
  ${codeLink ? `<p class="article-code">${codeLink}</p>` : ""}
  ${meta ? `<p class="article-stats">${meta}</p>` : ""}
  ${metaLine ? `<p class="article-meta">${metaLine}</p>` : ""}
  ${excerpt ? `<p class="article-excerpt">${excerpt}</p>` : ""}
  ${summary ? `<p class="article-summary"><span class="summary-label">${summaryLabel}</span> ${summary}</p>` : ""}
</article>`;
}

function renderSourceContent(
  category: Category,
  subId: string,
  source: SourceGroup,
  isActive: boolean,
): string {
  const showSource = source.merged === true;
  return `<div class="source-content${isActive ? " active" : ""}" data-source-content="${escapeHtml(source.sourceId)}" data-sub="${escapeHtml(subId)}" data-cat="${category}">
    ${source.items.length === 0 ? `<p class="empty">${STR.emptySource}</p>` : source.items.map((a) => renderArticleHtml(a, showSource)).join("\n")}
  </div>`;
}

function renderSourceTabs(
  category: Category,
  subId: string,
  sources: SourceGroup[],
): string {
  // Single-source L2s (X 推文 / GitHub Trending) skip the L3 row — the L2 tab
  // label already identifies the dataset. L3 only earns its row when there
  // are ≥2 sources to switch between.
  if (sources.length < 2) return "";
  return `<nav class="source-tabs">${sources
    .map(
      (s, i) =>
        `<button class="source-tab${i === 0 ? " active" : ""}" data-source="${escapeHtml(s.sourceId)}" data-sub="${escapeHtml(subId)}" data-cat="${category}">${escapeHtml(s.sourceName)}<span class="count">${s.items.length}</span></button>`,
    )
    .join("")}</nav>`;
}

function renderSubContent(category: Category, sub: SubGroup, isActive: boolean): string {
  return `<div class="sub-content${isActive ? " active" : ""}" data-sub-content="${escapeHtml(sub.id)}" data-cat="${category}">
    ${renderSourceTabs(category, sub.id, sub.sources)}
    <div class="source-contents">
      ${sub.sources.map((s, i) => renderSourceContent(category, sub.id, s, i === 0)).join("\n")}
    </div>
  </div>`;
}

function renderRawCategoryPanel(
  category: Category,
  subs: SubGroup[],
): string {
  // Filter out sub-groups with zero items across all sources
  const nonEmpty = subs.filter((s) =>
    s.sources.some((src) => src.items.length > 0),
  );
  if (nonEmpty.length === 0) {
    return `<p class="empty">${STR.emptyCategory}</p>`;
  }
  if (nonEmpty.length === 1) {
    return renderSubContent(category, nonEmpty[0], true);
  }
  const subTabs = nonEmpty
    .map((s, i) => {
      const count = s.sources.reduce((n, src) => n + src.items.length, 0);
      return `<button class="sub-tab${i === 0 ? " active" : ""}" data-sub="${escapeHtml(s.id)}" data-cat="${category}">${escapeHtml(s.name)}<span class="count">${count}</span></button>`;
    })
    .join("");
  const panels = nonEmpty
    .map((s, i) => renderSubContent(category, s, i === 0))
    .join("\n");
  return `<nav class="sub-tabs">${subTabs}</nav>\n<div class="sub-contents">${panels}</div>`;
}

/** Direction color map for the summary dots */
const DIR_COLORS: Record<string, string> = {
  motion: "var(--dir-motion)",
  video: "var(--dir-video)",
  "world-model": "var(--dir-world)",
  "cv-other": "var(--dir-cv)",
};
const DIR_LABELS: Record<string, string> = {
  motion: "Human Motion",
  video: "Video Models",
  "world-model": "World Models",
  "cv-other": "CV Highlights",
};

/** Render the numbered direction summary rows (MiMo blog style) */
function renderDirectionSummary(subs: SubGroup[]): string {
  // Find the arxiv-papers sub-group
  const arxivSub = subs.find((s) => s.id === "arxiv-papers");
  if (!arxivSub) return "";

  // Collect direction counts from source groups
  const dirs: Array<{ id: string; label: string; count: number; color: string }> = [];
  for (const src of arxivSub.sources) {
    const dirId = src.sourceId.replace("arxiv-", "");
    if (DIR_LABELS[dirId]) {
      dirs.push({
        id: dirId,
        label: DIR_LABELS[dirId],
        count: src.items.length,
        color: DIR_COLORS[dirId] || "var(--muted)",
      });
    }
  }

  if (dirs.length === 0) return "";

  const totalPapers = dirs.reduce((n, d) => n + d.count, 0);
  const headerText = REPORT_LOCALE === "en"
    ? `Today's Research Directions · ${totalPapers} papers`
    : `今日研究方向 · ${totalPapers} 篇论文`;

  const rows = dirs
    .map((d, i) => {
      const idx = String(i + 1).padStart(2, "0");
      return `<div class="dir-row" onclick="document.querySelector('[data-sub=arxiv-papers]')?.click()">
    <span class="dir-index">${idx}</span>
    <span class="dir-dot" style="background:${d.color}"></span>
    <span class="dir-name">${escapeHtml(d.label)}</span>
    <span class="dir-count">${d.count} papers</span>
    <span class="dir-arrow">→</span>
  </div>`;
    })
    .join("\n");

  return `<div class="dir-summary">
  <div class="dir-summary-title">${headerText}</div>
  ${rows}
</div>`;
}

// ----- top-level renderer -----

export function renderHtml(
  report: DailyReport,
  raw: RawByCategory,
  date: string,
): string {
  const sumItems = (subs: SubGroup[]) =>
    subs.reduce(
      (n, sg) => n + sg.sources.reduce((m, s) => m + s.items.length, 0),
      0,
    );
  const counts = {
    tech: sumItems(raw.tech),
    politics: sumItems(raw.politics),
  };

  return `<!doctype html>
<html lang="${REPORT_LOCALE === "en" ? "en" : "zh-CN"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${STR.siteTitle} · ${date}</title>
<style>
  /* ===== MiMo-inspired dark theme — full effects ===== */
  :root {
    --bg: #000000;
    --bg-elevated: #0a0a0a;
    --fg: #fafafa;
    --fg-soft: #a1a1aa;
    --muted: #52525b;
    --rule: #1a1a1a;
    --card: #0a0a0a;
    --card-hover: #141414;
    --link: #93c5fd;
    --accent: #fafafa;
    --accent-fg: #000000;
    --rank-high-bg: rgba(239,68,68,0.12);
    --rank-high-fg: #fca5a5;
    --rank-mid-bg: rgba(245,158,11,0.12);
    --rank-mid-fg: #fcd34d;
    --rank-low-bg: rgba(99,102,241,0.12);
    --rank-low-fg: #a5b4fc;
    --dir-motion: #60a5fa;
    --dir-video: #a78bfa;
    --dir-world: #34d399;
    --dir-cv: #fbbf24;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--fg);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
      "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overflow-x: hidden;
  }
  main { max-width: 880px; margin: 0 auto; padding: 0 2rem 5rem; }

  /* ===== MiMo animated text pattern background ===== */
  @keyframes mimo-scroll {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  .hero-section {
    position: relative;
    padding: 6rem 0 4rem;
    overflow: hidden;
    border-bottom: 1px solid var(--rule);
    margin-bottom: 3rem;
  }
  .hero-pattern {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0;
    opacity: 0.04;
    pointer-events: none;
    z-index: 0;
  }
  .pattern-row {
    display: flex;
    white-space: nowrap;
    animation: mimo-scroll 30s linear infinite;
    font-size: 1.1rem;
    font-weight: 700;
    letter-spacing: 0.5em;
    color: var(--fg);
    line-height: 2.2;
  }
  .pattern-row:nth-child(even) { animation-direction: reverse; animation-duration: 35s; }
  .pattern-text { padding: 0 1.5rem; }
  .hero-content {
    position: relative;
    z-index: 1;
  }
  .hero-eyebrow {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.3em;
    color: var(--muted);
    font-weight: 500;
    display: block;
    margin-bottom: 1.2rem;
  }
  .hero-title {
    font-size: 4rem;
    font-weight: 700;
    margin: 0 0 0.8rem;
    letter-spacing: -0.04em;
    line-height: 1;
    color: var(--fg);
  }
  .hero-date {
    font-size: 1rem;
    color: var(--muted);
    font-weight: 400;
    letter-spacing: 0.05em;
    display: block;
    margin-bottom: 1.5rem;
  }
  .hero-link {
    display: inline-block;
    font-size: 0.82rem;
    color: var(--muted);
    text-decoration: none;
    transition: color 0.2s;
    letter-spacing: 0.02em;
  }
  .hero-link:hover { color: var(--fg); }

  /* ===== direction summary — MiMo blog/experience row style ===== */
  .dir-section { margin: 0 0 3rem; }
  .dir-section-title {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.3em;
    color: var(--muted);
    font-weight: 500;
    margin-bottom: 1.5rem;
  }
  .dir-row {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 1.1rem 0;
    border-bottom: 1px solid var(--rule);
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    text-decoration: none;
    color: inherit;
  }
  .dir-row:hover {
    background: var(--bg-elevated);
    padding-left: 0.5rem;
    padding-right: 0.5rem;
  }
  .dir-row:last-child { border-bottom: none; }
  .dir-index {
    font-size: 0.75rem;
    color: var(--muted);
    font-weight: 500;
    min-width: 2rem;
    font-feature-settings: "tnum";
    transition: color 0.2s;
  }
  .dir-row:hover .dir-index { color: var(--fg-soft); }
  .dir-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    transition: transform 0.2s;
  }
  .dir-row:hover .dir-dot { transform: scale(1.3); }
  .dir-name {
    font-size: 1.05rem;
    font-weight: 500;
    color: var(--fg);
    flex: 1;
    transition: color 0.2s;
  }
  .dir-row:hover .dir-name { color: #ffffff; }
  .dir-count {
    font-size: 0.82rem;
    color: var(--muted);
    font-feature-settings: "tnum";
    transition: color 0.2s;
  }
  .dir-row:hover .dir-count { color: var(--fg-soft); }
  .dir-arrow {
    font-size: 1rem;
    color: var(--muted);
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    display: inline-block;
  }
  .dir-row:hover .dir-arrow { transform: translateX(6px); color: var(--fg); }

  /* ===== primary tabs ===== */
  .tabs {
    display: flex;
    gap: 0;
    margin: 0 0 2.5rem;
    border-bottom: 1px solid var(--rule);
  }
  .tab {
    background: none;
    border: none;
    padding: 0.9rem 1.6rem;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--muted);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    font-family: inherit;
    transition: all 0.2s;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .tab:hover { color: var(--fg-soft); }
  .tab.active { color: var(--fg); border-bottom-color: var(--fg); }
  .tab .count {
    font-size: 0.65rem;
    color: var(--muted);
    margin-left: 0.6rem;
    font-weight: 400;
  }
  .panel { display: none; }
  .panel.active { display: block; }

  /* ===== sub-tabs — MiMo pill style ===== */
  .sub-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    margin: 0 0 2rem;
  }
  .sub-tab {
    background: transparent;
    border: 1px solid var(--rule);
    padding: 0.5rem 1.1rem;
    border-radius: 0.35rem;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--fg-soft);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.2s;
    letter-spacing: 0.02em;
  }
  .sub-tab:hover { border-color: var(--muted); color: var(--fg); background: var(--card); }
  .sub-tab.active { background: var(--fg); color: var(--bg); border-color: var(--fg); }
  .sub-tab .count { font-size: 0.6rem; opacity: 0.6; margin-left: 0.5rem; }
  .sub-content { display: none; }
  .sub-content.active { display: block; }

  /* ===== source-tabs ===== */
  .source-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0 0 2rem;
    padding-bottom: 1.2rem;
    border-bottom: 1px solid var(--rule);
  }
  .source-tab {
    background: none;
    border: 1px solid var(--rule);
    padding: 0.35rem 0.9rem;
    border-radius: 0.3rem;
    font-size: 0.75rem;
    color: var(--fg-soft);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.2s;
  }
  .source-tab:hover { border-color: var(--muted); color: var(--fg); }
  .source-tab.active { background: var(--fg); color: var(--bg); border-color: var(--fg); }
  .source-tab .count { font-size: 0.6rem; opacity: 0.6; margin-left: 0.3rem; }
  .source-content { display: none; }
  .source-content.active { display: block; }

  /* ===== digest briefs — card grid ===== */
  .digest-category { margin-bottom: 2.5rem; }
  .category-header {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    margin: 0 0 1.2rem;
    padding-bottom: 0.6rem;
    border-bottom: 1px solid var(--rule);
  }
  .category-title {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.3em;
    font-weight: 500;
    color: var(--muted);
    margin: 0;
  }
  .category-count { font-size: 0.65rem; color: var(--muted); font-feature-settings: "tnum"; }
  .brief-list { display: grid; grid-template-columns: 1fr; gap: 0.8rem; }
  @media (min-width: 720px) { .brief-list { grid-template-columns: 1fr 1fr; } }
  .brief {
    background: var(--card);
    border: 1px solid var(--rule);
    border-radius: 0.5rem;
    padding: 1.1rem 1.3rem;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
  }
  .brief::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--link), transparent);
    opacity: 0;
    transition: opacity 0.3s;
  }
  .brief:hover { border-color: #333; background: var(--card-hover); transform: translateY(-2px); }
  .brief:hover::before { opacity: 1; }
  .brief-head { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; margin-bottom: 0.5rem; }
  .brief-source { font-size: 0.65rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.12em; font-weight: 500; }
  .brief-rank { font-size: 0.62rem; padding: 0.1rem 0.5rem; border-radius: 999px; font-weight: 600; flex-shrink: 0; }
  .brief-rank.high { background: var(--rank-high-bg); color: var(--rank-high-fg); }
  .brief-rank.mid { background: var(--rank-mid-bg); color: var(--rank-mid-fg); }
  .brief-rank.low { background: var(--rank-low-bg); color: var(--rank-low-fg); }
  .brief-title { font-size: 0.95rem; font-weight: 600; margin: 0 0 0.5rem; line-height: 1.4; }
  .brief-title a { color: var(--fg); text-decoration: none; transition: color 0.2s; }
  .brief-title a:hover { color: var(--link); }
  .brief-summary { margin: 0; color: var(--fg-soft); font-size: 0.82rem; line-height: 1.65; }

  /* ===== editor card ===== */
  .editor-card {
    background: var(--card);
    border-left: 2px solid var(--muted);
    border-radius: 0 0.5rem 0.5rem 0;
    padding: 1.5rem 1.8rem;
    margin: 2.5rem 0;
  }
  .editor-card .eyebrow { display: block; margin-bottom: 0.6rem; }
  .editor-text { margin: 0; font-size: 0.9rem; line-height: 1.8; color: var(--fg-soft); }
  .keywords { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 2rem 0; }
  .keyword {
    background: transparent;
    color: var(--fg-soft);
    padding: 0.35rem 0.9rem;
    border-radius: 0.3rem;
    font-size: 0.75rem;
    border: 1px solid var(--rule);
    transition: all 0.2s;
    letter-spacing: 0.02em;
  }
  .keyword:hover { border-color: var(--muted); color: var(--fg); }

  /* ===== article cards — MiMo experience/blog row style ===== */
  .article {
    padding: 1.3rem 0;
    border-bottom: 1px solid var(--rule);
    transition: all 0.2s;
  }
  .article:first-child { padding-top: 0; }
  .article:last-child { border-bottom: none; }
  .article:hover { padding-left: 0.3rem; }
  .article-title {
    font-size: 1rem;
    margin: 0 0 0.4rem;
    font-weight: 600;
    line-height: 1.45;
  }
  .article-title a { color: var(--fg); text-decoration: none; transition: color 0.2s; }
  .article-title a:hover { color: var(--link); }
  .article-authors { color: var(--muted); font-size: 0.75rem; margin: 0 0 0.4rem; }
  .article-code { margin: 0 0 0.4rem; }
  .code-link {
    display: inline-block;
    background: transparent;
    color: var(--link);
    font-size: 0.72rem;
    font-weight: 500;
    padding: 0.15rem 0.65rem;
    border-radius: 0.3rem;
    text-decoration: none;
    border: 1px solid var(--link);
    transition: all 0.2s;
    letter-spacing: 0.02em;
  }
  .code-link:hover { background: var(--link); color: #000; }
  .article-meta { color: var(--muted); font-size: 0.72rem; margin: 0 0 0.4rem; }
  .article-stats { color: var(--muted); font-size: 0.78rem; margin: 0 0 0.5rem; font-feature-settings: "tnum"; }
  .article-excerpt { margin: 0; color: var(--fg-soft); font-size: 0.88rem; line-height: 1.75; }
  .article-summary {
    margin: 0.8rem 0 0;
    padding: 0.8rem 1.1rem;
    background: var(--card);
    border-left: 2px solid var(--link);
    border-radius: 0 0.4rem 0.4rem 0;
    font-size: 0.85rem;
    line-height: 1.75;
    color: var(--fg-soft);
  }
  .summary-label {
    display: inline-block;
    font-size: 0.6rem;
    color: var(--link);
    margin-right: 0.5rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .empty { color: var(--muted); text-align: center; padding: 4rem 0; font-size: 0.88rem; }

  /* ===== footer ===== */
  footer {
    margin-top: 4rem;
    border-top: 1px solid var(--rule);
    padding-top: 2rem;
    color: var(--muted);
    font-size: 0.75rem;
    letter-spacing: 0.05em;
    text-align: center;
  }
</style>
</head>
<body>
<main>
  <!-- MiMo-style hero with animated text pattern -->
  <div class="hero-section">
    <div class="hero-pattern" aria-hidden="true">
      ${Array.from({ length: 12 }, () => `<div class="pattern-row">${Array.from({ length: 20 }, () => `<span class="pattern-text">D A I L Y&nbsp;&nbsp;&nbsp;B R I E F</span>`).join("")}</div>`).join("")}
    </div>
    <div class="hero-content">
      <span class="hero-eyebrow">${STR.siteTitle}</span>
      <h1 class="hero-title">${REPORT_LOCALE === "en" ? "Daily Research Brief" : "每日研究简报"}</h1>
      <span class="hero-date">${date}</span>
      ${process.env.WEB_MODE === "true" ? `<a class="hero-link" href="../archive.html">${STR.archiveLink}</a>` : ""}
    </div>
  </div>

  ${renderDirectionSummary(raw.tech)}

  <nav class="tabs" role="tablist">
    <button class="tab active" data-tab="tech">${CATEGORY_LABELS.tech}<span class="count">${counts.tech}</span></button>
    <button class="tab" data-tab="politics">${CATEGORY_LABELS.politics}<span class="count">${counts.politics}</span></button>
  </nav>

  <section class="panel active" data-panel="tech">
    ${renderRawCategoryPanel("tech", raw.tech)}
  </section>
  <section class="panel" data-panel="politics">
    ${renderRawCategoryPanel("politics", raw.politics)}
  </section>

  <footer>${STR.footer}</footer>
</main>
<script>
  document.querySelectorAll('.tabs > .tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = btn.dataset.tab;
      document.querySelectorAll('.tabs > .tab').forEach(function (b) {
        b.classList.toggle('active', b === btn);
      });
      document.querySelectorAll('.panel').forEach(function (p) {
        p.classList.toggle('active', p.dataset.panel === target);
      });
    });
  });
  document.querySelectorAll('.sub-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var panel = btn.closest('.panel');
      if (!panel) return;
      var sub = btn.dataset.sub;
      panel.querySelectorAll('.sub-tab').forEach(function (b) {
        b.classList.toggle('active', b === btn);
      });
      panel.querySelectorAll('.sub-content').forEach(function (p) {
        p.classList.toggle('active', p.dataset.subContent === sub);
      });
    });
  });
  document.querySelectorAll('.source-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var subContent = btn.closest('.sub-content');
      if (!subContent) return;
      var src = btn.dataset.source;
      subContent.querySelectorAll('.source-tab').forEach(function (b) {
        b.classList.toggle('active', b === btn);
      });
      subContent.querySelectorAll('.source-content').forEach(function (p) {
        p.classList.toggle('active', p.dataset.sourceContent === src);
      });
    });
  });
</script>
</body>
</html>`;
}

// ----- markdown -----

function renderBriefMarkdown(b: BriefItem): string {
  const importance = Number.isFinite(b.importance) ? b.importance : 0;
  return `### [${b.title}](${b.url})\n${b.source} · ${STR.mdImportance} ${importance}/10\n\n${b.summary}\n`;
}

function renderSectionMarkdown(title: string, briefs: BriefItem[]): string {
  if (briefs.length === 0) return "";
  return `## ${title}\n\n${briefs.map(renderBriefMarkdown).join("\n")}\n`;
}

export function renderMarkdown(report: DailyReport, date: string): string {
  const blocks: string[] = [];
  blocks.push(`# ${STR.siteTitle} · ${date}\n`);
  if (report.hero_headline) blocks.push(`> ${report.hero_headline}\n`);
  if (report.daily_overview) {
    blocks.push(`## ${STR.mdTodayOverview}\n\n${report.daily_overview}\n`);
  }
  blocks.push(
    renderSectionMarkdown(CATEGORY_DIGEST_LABELS.tech, report.tech_briefs),
  );
  blocks.push(
    renderSectionMarkdown(
      CATEGORY_DIGEST_LABELS.politics,
      report.politics_briefs,
    ),
  );
  if (report.editor_note) {
    blocks.push(`## ${STR.mdEditorNote}\n\n${report.editor_note}\n`);
  }
  if (report.keywords.length > 0) {
    blocks.push(
      `## ${STR.mdTodayKeywords}\n\n${report.keywords.map((k) => `\`#${k}\``).join(" ")}\n`,
    );
  }
  return blocks.filter(Boolean).join("\n");
}
