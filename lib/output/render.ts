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
  archiveLink: "历史归档",
  arxivSectionLabel: "研究方向",
  arxivMotionName: "Human Motion",
  arxivMotionTag: "人体动作生成、理解与控制",
  arxivVideoName: "Video Models",
  arxivVideoTag: "视频生成、编辑与理解",
  arxivWorldName: "World Models",
  arxivWorldTag: "世界模型与物理仿真",
  arxivBrowse: "浏览论文",
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
  archiveLink: "Archive",
  arxivSectionLabel: "Research Directions",
  arxivMotionName: "Human Motion",
  arxivMotionTag: "Motion generation, understanding & control",
  arxivVideoName: "Video Models",
  arxivVideoTag: "Video generation, editing & understanding",
  arxivWorldName: "World Models",
  arxivWorldTag: "World models & physical simulation",
  arxivBrowse: "Browse papers",
};

const STR = REPORT_LOCALE === "en" ? TEXTS_EN : TEXTS_ZH;

/** Three primary arXiv research directions (excludes CV Highlights bucket). */
const ARXIV_DIRECTIONS = [
  {
    id: "motion",
    num: "01",
    name: STR.arxivMotionName,
    tagline: STR.arxivMotionTag,
  },
  {
    id: "video",
    num: "02",
    name: STR.arxivVideoName,
    tagline: STR.arxivVideoTag,
  },
  {
    id: "world-model",
    num: "03",
    name: STR.arxivWorldName,
    tagline: STR.arxivWorldTag,
  },
] as const;

type ArxivDirectionTile = {
  id: string;
  num: string;
  name: string;
  tagline: string;
  count: number;
};

function getArxivDirectionTiles(raw: RawByCategory): ArxivDirectionTile[] {
  const sub = raw.tech.find((s) => s.id === "arxiv-papers");
  if (!sub) return [];
  const bySourceId = new Map(sub.sources.map((s) => [s.sourceId, s]));
  const tiles: ArxivDirectionTile[] = [];
  for (const dir of ARXIV_DIRECTIONS) {
    const src = bySourceId.get(`arxiv-${dir.id}`);
    if (!src || src.items.length === 0) continue;
    tiles.push({
      id: dir.id,
      num: dir.num,
      name: src.sourceName || dir.name,
      tagline: dir.tagline,
      count: src.items.length,
    });
  }
  return tiles;
}

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
  const codeLink = codeUrl ? `<a class="code-link" href="${escapeHtml(codeUrl)}" target="_blank" rel="noopener noreferrer">Code →</a>` : "";
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
  const scrollId =
    source.sourceId.startsWith("arxiv-")
      ? ` id="${escapeHtml(source.sourceId)}"`
      : "";
  return `<div class="source-content${isActive ? " active" : ""}"${scrollId} data-source-content="${escapeHtml(source.sourceId)}" data-sub="${escapeHtml(subId)}" data-cat="${category}">
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

/** MiMo About-style overview block between Hero and content tabs */
function renderAboutSection(report: DailyReport): string {
  const overview = report.daily_overview?.trim();
  if (!overview) return "";

  return `<section class="about-section" id="about">
  <div class="about-inner">
    <div class="section-label">${STR.mdTodayOverview}</div>
    <p class="about-text">${escapeHtml(overview)}</p>
  </div>
</section>`;
}

/** MiMo Products-style cards → jump to arXiv direction tabs */
function renderArxivDirectionsSection(tiles: ArxivDirectionTile[]): string {
  if (tiles.length === 0) return "";

  const cards = tiles
    .map(
      (t) => `<button type="button" class="arxiv-card" data-arxiv-dir="${escapeHtml(t.id)}">
  <span class="arxiv-num">${t.num}</span>
  <h3 class="arxiv-name">${escapeHtml(t.name)}</h3>
  <p class="arxiv-tagline">${escapeHtml(t.tagline)}</p>
  <span class="arxiv-count">${t.count} ${REPORT_LOCALE === "en" ? "papers" : "篇"}</span>
  <span class="arxiv-cta">${STR.arxivBrowse} <span class="arxiv-arrow">→</span></span>
</button>`,
    )
    .join("\n");

  return `<section class="arxiv-section" id="arxiv-directions">
  <div class="arxiv-inner">
    <div class="section-label">${STR.arxivSectionLabel}</div>
    <div class="arxiv-grid">${cards}</div>
  </div>
</section>`;
}

function renderNavTechLink(tiles: ArxivDirectionTile[]): string {
  const label = CATEGORY_LABELS.tech;
  if (tiles.length === 0) {
    return `<a class="nav-link" href="#content" data-nav-tab="tech">${label}</a>`;
  }

  const flyout = tiles
    .map(
      (t) =>
        `<button type="button" class="nav-flyout-link" data-arxiv-dir="${escapeHtml(t.id)}" role="menuitem"><span class="nav-flyout-num">${t.num}</span><span class="nav-flyout-name">${escapeHtml(t.name)}</span><span class="nav-flyout-count">${t.count}</span></button>`,
    )
    .join("");

  return `<div class="nav-group">
  <a class="nav-link nav-link-parent" href="#content" data-nav-tab="tech">${label}</a>
  <div class="nav-flyout" role="menu">${flyout}</div>
</div>`;
}

/** Render conference deadlines section */
function renderDeadlines(): string {
  const now = new Date();
  const deadlines = [
    { name: "CVPR 2027", date: "2026-11-15", url: "https://cvpr2027.thecvf.com/" },
    { name: "ECCV 2026", date: "2026-03-06", url: "https://eccv2026.eu/" },
    { name: "ICCV 2027", date: "2027-03-08", url: "https://iccv2027.thecvf.com/" },
    { name: "NeurIPS 2026", date: "2026-05-22", url: "https://neurips.cc/Conferences/2026" },
    { name: "ICML 2027", date: "2027-01-31", url: "https://icml.cc/Conferences/2027" },
    { name: "ICLR 2027", date: "2026-10-01", url: "https://iclr.cc/Conferences/2027" },
    { name: "AAAI 2027", date: "2026-08-15", url: "https://aaai.org/conference/aaai/aaai-27/" },
    { name: "ACM MM 2026", date: "2026-04-15", url: "https://acmmm2026.org/" },
  ];

  const upcoming = deadlines
    .map((d) => ({ ...d, diff: new Date(d.date).getTime() - now.getTime() }))
    .filter((d) => d.diff > 0)
    .sort((a, b) => a.diff - b.diff)
    .slice(0, 5);

  if (upcoming.length === 0) return "";

  const label = REPORT_LOCALE === "en" ? "Upcoming Deadlines" : "即将截止的会议";

  const rows = upcoming.map((d, i) => {
    const idx = String(i + 1).padStart(2, "0");
    const days = Math.ceil(d.diff / 86_400_000);
    const badgeClass = days <= 30 ? "soon" : days <= 90 ? "upcoming" : "later";
    const badgeText = days <= 30
      ? (REPORT_LOCALE === "en" ? `${days}d left` : `剩余 ${days} 天`)
      : (REPORT_LOCALE === "en" ? `${days}d` : `${days} 天`);
    return `<a class="deadline-row" href="${escapeHtml(d.url)}" target="_blank" rel="noopener noreferrer">
  <span class="deadline-num">${idx}</span>
  <div class="deadline-info"><span class="deadline-name">${escapeHtml(d.name)}</span></div>
  <span class="deadline-meta">${d.date}</span>
  <span class="deadline-badge ${badgeClass}">${badgeText}</span>
  <span class="deadline-arrow" aria-hidden="true">→</span>
</a>`;
  }).join("\n");

  return `<div class="deadlines-section">
  <div class="section-label">${label}</div>
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

  const heroTitle =
    report.hero_headline?.trim() ||
    (REPORT_LOCALE === "en" ? "Daily Research Brief" : "每日研究简报");
  const heroSubtitle =
    REPORT_LOCALE === "en"
      ? "Daily Brief"
      : date;
  const heroSubtitleClass =
    REPORT_LOCALE === "en" ? "hero-subtitle hero-subtitle-en" : "hero-subtitle hero-subtitle-zh";
  const contentLabel =
    REPORT_LOCALE === "en" ? "Content" : "内容";
  const patternRows = Array.from({ length: 24 }, (_, i) => {
    const anim = i % 2 === 0 ? "mimoScrollLeft" : "mimoScrollRight";
    const dur = (22 + i * 1.8).toFixed(1);
    const spans = Array.from(
      { length: 20 },
      () =>
        `<span class="pattern-text">D A I L Y&nbsp;&nbsp;&nbsp;&nbsp;B R I E F&nbsp;&nbsp;&nbsp;&nbsp;</span>`,
    ).join("");
    return `<div class="pattern-row" style="animation:${anim} ${dur}s linear infinite">${spans}</div>`;
  }).join("");
  const arxivTiles = getArxivDirectionTiles(raw);

  return `<!doctype html>
<html lang="${REPORT_LOCALE === "en" ? "en" : "zh-CN"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${STR.siteTitle} · ${date}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Noto+Sans+SC:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
  /* ===== MiMo Figma exact clone ===== */
  @keyframes mimoScrollLeft { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  @keyframes mimoScrollRight { from { transform: translateX(-50%); } to { transform: translateX(0); } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0a0a0a;
    color: #f0f0f0;
    font-family: Inter, 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    scroll-behavior: smooth;
  }
  main#content {
    max-width: 860px; margin: 0 auto;
    padding: 6rem 2rem;
    border-top: 1px solid rgba(255,255,255,0.05);
    scroll-margin-top: 4.5rem;
  }
  .content-label { margin-bottom: 2.5rem; }

  /* ===== Nav — fixed blur ===== */
  .top-nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 50;
    display: flex; align-items: center; justify-content: space-between;
    padding: 1rem 2rem;
    background: rgba(10,10,10,0.88);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .nav-logo {
    font-weight: 800; font-size: 1.35rem; color: #fff;
    letter-spacing: 0.06em;
    font-family: Inter, 'Noto Sans SC', sans-serif;
  }
  .nav-links { display: flex; align-items: center; gap: 2rem; flex-wrap: wrap; }
  .nav-link {
    color: rgba(255,255,255,0.55); font-size: 0.875rem; font-weight: 400;
    text-decoration: none; transition: color 0.2s;
    font-family: Inter, 'Noto Sans SC', sans-serif;
  }
  .nav-link:hover { color: rgba(255,255,255,0.9); }
  .nav-group { position: relative; }
  .nav-flyout {
    position: absolute; top: calc(100% + 0.6rem); left: 50%;
    transform: translateX(-50%) translateY(4px);
    min-width: 13.5rem;
    padding: 0.35rem 0;
    background: rgba(14,14,14,0.96);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 2px;
    opacity: 0; visibility: hidden;
    transition: opacity 0.2s, transform 0.2s, visibility 0.2s;
    pointer-events: none;
  }
  .nav-group:hover .nav-flyout,
  .nav-group:focus-within .nav-flyout {
    opacity: 1; visibility: visible;
    transform: translateX(-50%) translateY(0);
    pointer-events: auto;
  }
  .nav-flyout-link {
    display: flex; align-items: center; gap: 0.65rem;
    width: 100%; padding: 0.55rem 1rem;
    background: none; border: none; cursor: pointer;
    text-align: left; font-family: Inter, 'Noto Sans SC', sans-serif;
    color: rgba(255,255,255,0.55); font-size: 0.78rem;
    transition: background 0.15s, color 0.15s;
  }
  .nav-flyout-link:hover {
    background: rgba(255,255,255,0.04);
    color: rgba(255,255,255,0.92);
  }
  .nav-flyout-num {
    color: rgba(255,255,255,0.18);
    font-size: 0.62rem; font-weight: 700;
    letter-spacing: 0.1em; flex-shrink: 0;
    font-family: Inter, sans-serif;
  }
  .nav-flyout-name { flex: 1; }
  .nav-flyout-count {
    color: rgba(255,255,255,0.22);
    font-size: 0.62rem; flex-shrink: 0;
    font-family: Inter, sans-serif;
  }
  @media (max-width: 600px) {
    .top-nav { padding: 0.75rem 1.25rem; }
    .nav-links { gap: 1rem; }
    .nav-link { font-size: 0.78rem; }
  }

  /* ===== Hero — 100vh + animated text pattern ===== */
  .hero-section {
    position: relative; height: 100vh;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden; background: #0a0a0a;
  }
  .hero-pattern {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; justify-content: center;
    overflow: hidden; pointer-events: none; user-select: none;
  }
  .pattern-row {
    white-space: nowrap;
    color: #fff; opacity: 0.042;
    font-size: 2.6rem; font-weight: 800;
    letter-spacing: 0.55em; line-height: 3.6rem;
    font-family: Inter, sans-serif;
  }
  @media (prefers-reduced-motion: reduce) {
    .pattern-row { animation: none !important; }
    html { scroll-behavior: auto; }
  }
  .pattern-text { padding: 0 1.5rem; }
  .hero-content {
    position: relative; z-index: 2; text-align: center;
    animation: fadeIn 0.8s ease-out; padding: 0 2rem;
  }
  .hero-title {
    color: #fff; font-size: clamp(2.5rem, 5vw, 4.5rem);
    font-weight: 700; letter-spacing: -0.02em;
    line-height: 1.15; margin-bottom: 1rem;
    font-family: Inter, 'Noto Sans SC', sans-serif;
  }
  .hero-subtitle {
    color: rgba(255,255,255,0.38);
    font-size: clamp(0.9rem, 2vw, 1.2rem);
    font-weight: 400;
    font-family: Inter, 'Noto Sans SC', sans-serif;
    margin-bottom: 0.5rem;
  }
  .hero-subtitle-en {
    letter-spacing: 0.4em;
    text-transform: uppercase;
    font-family: Inter, sans-serif;
  }
  .hero-subtitle-zh {
    letter-spacing: 0.08em;
    color: rgba(255,255,255,0.28);
    font-size: 0.9rem;
  }
  .hero-date {
    color: rgba(255,255,255,0.25);
    font-size: 0.85rem; letter-spacing: 0.08em;
    font-family: Inter, sans-serif;
  }
  .scroll-indicator {
    position: absolute; left: 50%; bottom: 4rem;
    transform: translateX(-50%);
    width: 1px; height: 3rem;
    background: linear-gradient(to bottom, rgba(255,255,255,0.4), transparent);
  }

  /* ===== About — MiMo About section ===== */
  .about-section {
    padding: 6rem 2rem;
    border-top: 1px solid rgba(255,255,255,0.05);
  }
  .about-inner { max-width: 768px; margin: 0 auto; }
  .about-text {
    color: rgba(255,255,255,0.72);
    font-size: 1.08rem; line-height: 1.9;
    font-family: Inter, 'Noto Sans SC', sans-serif;
    font-weight: 300; margin: 0;
  }

  /* ===== arXiv directions — MiMo Products grid ===== */
  .arxiv-section {
    padding: 6rem 2rem;
    border-top: 1px solid rgba(255,255,255,0.05);
  }
  .arxiv-inner { max-width: 960px; margin: 0 auto; }
  .arxiv-grid {
    display: grid; grid-template-columns: 1fr;
    gap: 1px; background: rgba(255,255,255,0.05);
  }
  @media (min-width: 768px) {
    .arxiv-grid { grid-template-columns: repeat(3, 1fr); }
  }
  .arxiv-card {
    position: relative;
    display: flex; flex-direction: column; align-items: flex-start;
    text-align: left;
    background: #0a0a0a;
    padding: 2.25rem;
    border: none; cursor: pointer;
    font-family: inherit;
    transition: background 0.3s;
  }
  .arxiv-card:hover { background: #161616; }
  .arxiv-card:hover .arxiv-arrow { transform: translateX(4px); }
  .arxiv-card:hover .arxiv-cta { color: rgba(255,255,255,0.85); }
  .arxiv-num {
    color: rgba(255,255,255,0.12);
    font-size: 0.7rem; letter-spacing: 0.15em;
    font-weight: 700; margin-bottom: 2.5rem;
    font-family: Inter, sans-serif;
  }
  .arxiv-name {
    color: #fff; font-size: 1.15rem; font-weight: 600;
    letter-spacing: -0.01em; line-height: 1.3;
    margin: 0 0 0.75rem;
    font-family: Inter, 'Noto Sans SC', sans-serif;
  }
  .arxiv-tagline {
    color: rgba(255,255,255,0.45);
    font-size: 0.875rem; line-height: 1.65;
    margin: 0 0 1.5rem;
    font-family: Inter, 'Noto Sans SC', sans-serif;
    font-weight: 400;
  }
  .arxiv-count {
    color: rgba(255,255,255,0.22);
    font-size: 0.68rem; letter-spacing: 0.06em;
    margin-bottom: 2rem;
    font-family: Inter, sans-serif;
  }
  .arxiv-cta {
    margin-top: auto;
    color: rgba(255,255,255,0.38);
    font-size: 0.875rem;
    font-family: Inter, 'Noto Sans SC', sans-serif;
    transition: color 0.2s;
  }
  .arxiv-arrow {
    display: inline-block;
    transition: transform 0.2s;
  }
  .source-content[id] { scroll-margin-top: 5rem; }

  /* ===== Section labels — MiMo uppercase style ===== */
  .section-label {
    color: rgba(255,255,255,0.25);
    font-size: 0.7rem; letter-spacing: 0.2em;
    text-transform: uppercase; font-weight: 500;
    font-family: Inter, sans-serif;
    margin-bottom: 3.5rem;
  }

  /* ===== Primary tabs ===== */
  .tabs {
    display: flex; gap: 0;
    margin: 0 0 3rem;
    border-bottom: 1px solid rgba(255,255,255,0.055);
  }
  .tab {
    background: none; border: none;
    padding: 1rem 1.8rem;
    font-size: 0.8rem; font-weight: 500;
    color: rgba(255,255,255,0.35);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px; font-family: Inter, 'Noto Sans SC', sans-serif;
    transition: all 0.2s;
    letter-spacing: 0.1em; text-transform: uppercase;
  }
  .tab:hover { color: rgba(255,255,255,0.6); }
  .tab.active { color: rgba(255,255,255,0.9); border-bottom-color: #fff; }
  .tab .count { font-size: 0.6rem; color: rgba(255,255,255,0.2); margin-left: 0.5rem; }
  .panel { display: none; }
  .panel.active { display: block; }

  /* ===== Sub-tabs ===== */
  .sub-tabs { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0 0 2.5rem; }
  .sub-tab {
    background: transparent;
    border: 1px solid rgba(255,255,255,0.08);
    padding: 0.5rem 1.1rem; border-radius: 2px;
    font-size: 0.75rem; font-weight: 500;
    color: rgba(255,255,255,0.45);
    cursor: pointer; font-family: Inter, 'Noto Sans SC', sans-serif;
    transition: all 0.2s; letter-spacing: 0.03em;
  }
  .sub-tab:hover { border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.03); }
  .sub-tab.active { background: #fff; color: #0a0a0a; border-color: #fff; }
  .sub-tab .count { font-size: 0.55rem; opacity: 0.5; margin-left: 0.4rem; }
  .sub-content { display: none; }
  .sub-content.active { display: block; }

  /* ===== Source tabs — text-only L3 filters ===== */
  .source-tabs {
    display: flex; flex-wrap: wrap; gap: 0.4rem;
    margin: 0 0 2rem; padding-bottom: 1.5rem;
    border-bottom: 1px solid rgba(255,255,255,0.055);
  }
  .source-tab {
    background: none; border: none;
    padding: 0.3rem 0.6rem; border-radius: 2px;
    font-size: 0.7rem; color: rgba(255,255,255,0.35);
    cursor: pointer; font-family: Inter, 'Noto Sans SC', sans-serif;
    transition: all 0.2s;
    border-bottom: 1px solid transparent;
  }
  .source-tab:hover { color: rgba(255,255,255,0.65); }
  .source-tab.active {
    color: rgba(255,255,255,0.9);
    border-bottom-color: rgba(255,255,255,0.35);
    background: none;
  }
  .source-tab .count { font-size: 0.55rem; opacity: 0.5; margin-left: 0.3rem; }
  .source-content { display: none; }
  .source-content.active { display: block; }

  /* ===== Article rows — MiMo blog row style ===== */
  .article {
    padding: 1.3rem 0;
    border-top: 1px solid rgba(255,255,255,0.055);
    transition: all 0.2s;
  }
  .article:first-child { border-top: none; }
  .article:hover { padding-left: 1rem; }
  .article:hover .article-title a { color: rgba(255,255,255,0.95); }
  .article-title {
    font-size: 0.95rem; margin: 0 0 0.35rem;
    font-weight: 500; line-height: 1.5;
    font-family: Inter, 'Noto Sans SC', sans-serif;
  }
  .article-title a { color: rgba(255,255,255,0.7); text-decoration: none; transition: color 0.2s; }
  .article-title a:hover { color: rgba(255,255,255,0.95); }
  .article-authors {
    color: rgba(255,255,255,0.22);
    font-size: 0.7rem; margin: 0 0 0.35rem;
    font-family: Inter, sans-serif;
  }
  .article-code { margin: 0 0 0.35rem; }
  .code-link {
    display: inline-block; background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.45);
    font-size: 0.68rem; font-weight: 500;
    padding: 0.12rem 0.55rem; border-radius: 2px;
    text-decoration: none; transition: all 0.2s;
    font-family: Inter, sans-serif;
  }
  .code-link:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.8); }
  .article-meta { color: rgba(255,255,255,0.18); font-size: 0.68rem; margin: 0 0 0.35rem; }
  .article-stats { color: rgba(255,255,255,0.18); font-size: 0.72rem; margin: 0 0 0.5rem; }
  .article-excerpt {
    margin: 0; color: rgba(255,255,255,0.48);
    font-size: 0.85rem; line-height: 1.75;
    font-family: Inter, 'Noto Sans SC', sans-serif;
    font-weight: 400;
  }
  .article-summary {
    margin: 0.8rem 0 0; padding: 0.9rem 1.2rem;
    background: rgba(255,255,255,0.03);
    border-left: 2px solid rgba(255,255,255,0.12);
    border-radius: 0 2px 2px 0;
    font-size: 0.82rem; line-height: 1.75;
    color: rgba(255,255,255,0.5);
    font-family: Inter, 'Noto Sans SC', sans-serif;
    font-weight: 300;
  }
  .summary-label {
    display: inline-block; font-size: 0.55rem;
    color: rgba(255,255,255,0.3);
    margin-right: 0.5rem; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.15em;
    font-family: Inter, sans-serif;
  }

  .empty {
    color: rgba(255,255,255,0.2);
    text-align: center; padding: 5rem 0;
    font-size: 0.85rem;
    font-family: Inter, 'Noto Sans SC', sans-serif;
  }

  /* ===== Footer — MiMo style ===== */
  .mimo-footer {
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 1rem;
    padding: 2.5rem 2rem;
    border-top: 1px solid rgba(255,255,255,0.05);
    max-width: 860px; margin: 0 auto;
  }
  .footer-logo {
    font-weight: 800; font-size: 1.25rem; color: #fff;
    letter-spacing: 0.06em;
    font-family: Inter, 'Noto Sans SC', sans-serif;
  }
  .footer-right {
    display: flex; flex-direction: column; align-items: flex-end;
    gap: 0.35rem; text-align: right;
  }
  .footer-disclaimer {
    color: rgba(255,255,255,0.22);
    font-size: 0.68rem;
    font-family: Inter, 'Noto Sans SC', sans-serif;
    letter-spacing: 0.02em; max-width: 28rem;
  }
  .footer-copy {
    color: rgba(255,255,255,0.2);
    font-size: 0.72rem; font-family: Inter, sans-serif;
    letter-spacing: 0.04em;
  }

  /* ===== Conference Deadlines — MiMo Careers style ===== */
  .deadlines-section {
    padding: 6rem 2rem;
    border-top: 1px solid rgba(255,255,255,0.05);
    max-width: 860px; margin: 0 auto;
  }
  .deadline-row {
    display: flex; align-items: baseline; gap: 1.5rem;
    padding: 1.3rem 0;
    border-top: 1px solid rgba(255,255,255,0.055);
    transition: all 0.2s;
    text-decoration: none; color: inherit;
  }
  .deadline-row:last-of-type { border-bottom: 1px solid rgba(255,255,255,0.055); }
  .deadline-row:hover { padding-left: 1rem; }
  .deadline-row:hover .deadline-arrow { color: rgba(255,255,255,0.6); transform: translateX(4px); }
  .deadline-num {
    color: rgba(255,255,255,0.14);
    font-size: 0.7rem; font-weight: 700;
    letter-spacing: 0.1em; flex-shrink: 0;
    font-family: Inter, sans-serif;
  }
  .deadline-info { flex: 1; }
  .deadline-name {
    color: rgba(255,255,255,0.62);
    font-size: 0.93rem; line-height: 1.5;
    font-family: Inter, 'Noto Sans SC', sans-serif;
    font-weight: 400; transition: color 0.2s;
  }
  .deadline-row:hover .deadline-name { color: rgba(255,255,255,0.92); }
  .deadline-meta {
    color: rgba(255,255,255,0.18);
    font-size: 0.72rem; flex-shrink: 0;
    font-family: Inter, sans-serif; letter-spacing: 0.04em;
  }
  .deadline-badge {
    font-size: 0.6rem; padding: 0.1rem 0.4rem;
    border-radius: 2px; font-weight: 600;
    font-family: Inter, sans-serif;
    border: 1px solid rgba(255,255,255,0.08);
  }
  .deadline-badge.soon { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.78); }
  .deadline-badge.upcoming { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.55); }
  .deadline-badge.later { background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.35); }
  .deadline-arrow {
    color: rgba(255,255,255,0.15); font-size: 1rem;
    flex-shrink: 0; transition: color 0.2s, transform 0.2s;
  }
  .tab:focus-visible, .sub-tab:focus-visible, .source-tab:focus-visible,
  .nav-link:focus-visible, .deadline-row:focus-visible,
  .arxiv-card:focus-visible, .nav-flyout-link:focus-visible {
    outline: 2px solid rgba(255,255,255,0.4);
    outline-offset: 2px;
  }
</style>
</head>
<body>
<!-- Fixed nav -->
<nav class="top-nav">
  <span class="nav-logo">DailyBrief</span>
  <div class="nav-links">
    ${renderNavTechLink(arxivTiles)}
    <a class="nav-link" href="#content" data-nav-tab="politics">${CATEGORY_LABELS.politics}</a>
    ${process.env.WEB_MODE === "true" ? `<a class="nav-link nav-link-archive" href="../archive.html">${STR.archiveLink}</a>` : ""}
  </div>
</nav>

<!-- Hero — 100vh with animated text pattern -->
<div class="hero-section">
  <div class="hero-pattern" aria-hidden="true">
    ${patternRows}
  </div>
  <div class="hero-content">
    <h1 class="hero-title">${escapeHtml(heroTitle)}</h1>
    <p class="${heroSubtitleClass}">${escapeHtml(heroSubtitle)}</p>
    ${REPORT_LOCALE === "en" ? `<span class="hero-date">${date}</span>` : ""}
  </div>
  <div class="scroll-indicator"></div>
</div>

${renderAboutSection(report)}
${renderArxivDirectionsSection(arxivTiles)}

<main id="content">
  <div class="section-label content-label">${contentLabel}</div>
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
</main>

<!-- Conference Deadlines — MiMo Careers style -->
${renderDeadlines()}

<footer class="mimo-footer">
  <span class="footer-logo">DailyBrief</span>
  <div class="footer-right">
    <span class="footer-disclaimer">${STR.footer}</span>
    <span class="footer-copy">© ${date.slice(0, 4)} DailyBrief</span>
  </div>
</footer>
<script>
  function activateTab(target) {
    document.querySelectorAll('.tabs > .tab').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === target);
    });
    document.querySelectorAll('.panel').forEach(function (p) {
      p.classList.toggle('active', p.dataset.panel === target);
    });
  }

  function scrollToArxivDirection(dir) {
    activateTab('tech');
    var panel = document.querySelector('.panel[data-panel="tech"]');
    if (!panel) return;
    var subBtn = panel.querySelector('[data-sub="arxiv-papers"]');
    if (subBtn) subBtn.click();
    var srcId = 'arxiv-' + dir;
    var dirBtn = panel.querySelector('[data-source="' + srcId + '"]');
    if (dirBtn) dirBtn.click();
    setTimeout(function () {
      var el = document.getElementById(srcId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else {
        var main = document.getElementById('content');
        if (main) main.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  document.querySelectorAll('[data-arxiv-dir]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      scrollToArxivDirection(el.dataset.arxivDir);
    });
  });

  document.querySelectorAll('[data-nav-tab]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      activateTab(link.dataset.navTab);
      var main = document.getElementById('content');
      if (main) main.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  document.querySelectorAll('.tabs > .tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      activateTab(btn.dataset.tab);
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
