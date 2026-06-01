import { jsonrepair } from "jsonrepair";
import { runLlm } from "./llm";
import { extractJson } from "./json-util";
import { REPORT_LOCALE } from "../sources/registry";

interface EnrichInput {
  url: string;
  title: string;
  excerpt?: string;
  source?: string;
}

const GH_SYSTEM_PROMPT_ZH = `你是一名技术编辑，负责为 GitHub Trending 项目写中文介绍。

输入：每个项目有 owner/repo 名 + 一行英文 description（可能没有）。

任务：根据 repo 名和 description，写一段 60-120 字的**通顺中文介绍**，要说清：
  1. 这个项目是做什么的，解决了什么问题
  2. 用了什么技术 / 方法（能从 repo 名 + description 推断的话）
  3. 谁会用它，典型场景是什么

写作风格：
  - 信息密度高，不写"这是一个…"这种废话开头
  - 中文术语优先，技术名词保留英文
  - 不要标题党，事实陈述为主
  - 如果信息不足，宁可短不要编造

输出严格 JSON 对象，不要 markdown：
{
  "summaries": [
    { "url": "<原 url，从输入中精确复制>", "summary": "<60-120 字中文介绍>" },
    ...
  ]
}`;

const GH_SYSTEM_PROMPT_EN = `You are a technical editor writing English summaries for GitHub Trending repositories.

Input: each repo has owner/repo name + a one-line description (may be missing).

Task: write a 60-120 word **fluent English summary** covering:
  1. What the project does and what problem it solves
  2. What technology / approach (inferable from repo name + description)
  3. Who uses it, typical use case

Style:
  - High information density; avoid "This is a..." filler openings
  - Concrete; if info is insufficient, prefer shorter over fabrication
  - Factual statements only, no hype

Output STRICTLY a JSON object, no markdown:
{
  "summaries": [
    { "url": "<exact url from input>", "summary": "<60-120 word English summary>" },
    ...
  ]
}`;

const MERGED_SUBGROUP_PROMPT_ZH = `你是一名中文新闻编辑，为英文/中文新闻生成**中文事实摘要**。

输入：每条新闻有 url、title、excerpt 和 source（来源媒体名）。

任务：根据 title + excerpt，生成一段 50-100 字的**中文摘要**：
  - 原文是英文 → 翻译关键信息为中文（不是逐字翻译，而是抽出要点）
  - 原文是中文 → 凝练为信息密度更高的中文
  - 必须保留：关键数字、机构/公司/人名、地区
  - 必须中性事实陈述，不带情绪、不标题党
  - 信息不足时宁可短，不要编造或扩展

输出严格 JSON 对象，不要 markdown 包裹：
{
  "summaries": [
    { "url": "<原 url，从输入中精确复制>", "summary": "<50-100 字中文摘要>" },
    ...
  ]
}

**引号规则（重要！）**：summary 内的引用一律用中文全角引号「」或""，**绝不**用英文双引号 \" —— 否则会导致 JSON 解析失败。`;

const MERGED_SUBGROUP_PROMPT_EN = `You are an English-language news editor producing **factual summaries**.

Input: each news item has url, title, excerpt, and source (publisher name).

Task: from title + excerpt, write a 50-100 word **English summary**:
  - If the source text is non-English, translate the key information (not word-for-word; extract the points)
  - If already English, condense to higher information density
  - Preserve: key numbers, institutions / companies / people / regions
  - Neutral factual tone — no emotion, no clickbait
  - If info is insufficient, prefer shorter over fabrication

Output STRICTLY a JSON object, no markdown wrapping:
{
  "summaries": [
    { "url": "<exact url from input>", "summary": "<50-100 word English summary>" },
    ...
  ]
}

**Quote rule (important!)**: For any quotation INSIDE a summary string, use single quotes ' or curly quotes '" — **never** a raw double quote, which breaks JSON parsing.`;

const XVIRAL_SYSTEM_PROMPT_ZH = `你是一名中文 AI 圈编辑，为 X（Twitter）上的爆款 AI 帖子生成**中文摘要**。

输入：每条帖子有 url、title、author（@handle 形式）、previewText（推文开头几句）。

注意 X 帖子的特点：
  - title 经常是博主自己起的标题党，**摘要不要照搬标题**
  - previewText 是推文实际内容开头，**信息源以它为准**
  - 内容多是 prompt 工程 / 工作流 / 工具对比 / 案例分享 / 教程

任务：生成 60-100 字中文摘要，说清楚：
  1. **博主在分享什么**（教程？工作流？踩坑？产品发布？）
  2. **关键数字/工具/概念**（如果有）：如 \"用 Claude Code 月入 4 万美元\"、\"40 条 prompt 模板\"、\"3 个 sub-agent 协作\"
  3. **价值/角度**（如果能推断）：是新发现还是老话题？

写作风格：
  - 信息密度高，不写 \"博主分享了…\" 这种废话开头
  - 中文术语优先，工具名/平台名保留英文（Claude、GPT、Codex、Cursor 等）
  - 不带营销腔，不要 "震惊！" "必看！" 这种标题党
  - 信息不足宁可短，不要硬扩

输出严格 JSON 对象，不要 markdown 包裹：
{
  "summaries": [
    { "url": "<原 url，从输入中精确复制>", "summary": "<60-100 字中文摘要>" },
    ...
  ]
}

**引号规则（重要！）**：summary 内的引用一律用中文全角引号「」或""，**绝不**用英文双引号 \" —— 否则会导致 JSON 解析失败。`;

const XVIRAL_SYSTEM_PROMPT_EN = `You are an editor producing **English summaries** of viral AI-related X (Twitter) posts.

Input: each post has url, title, author (@handle), and previewText (first lines of the tweet).

X-post patterns:
  - title is often the author's clickbait headline — **do not just rephrase the title**
  - previewText is the actual tweet opening — **treat it as the source of truth**
  - typical content: prompt engineering / workflows / tool comparisons / case studies / tutorials

Task: write a 60-100 word English summary covering:
  1. **What the author is sharing** (tutorial? workflow? gotcha? product launch?)
  2. **Key numbers / tools / concepts** (if present): e.g. "\$40k/month with Claude Code", "40 prompt templates", "3 sub-agents collaborating"
  3. **Angle / value** (if inferable): novel finding or established take?

Style:
  - High information density; avoid "The author shares..." filler
  - Keep tool / platform names in original case (Claude, GPT, Codex, Cursor, etc.)
  - No marketing tone; no "Mind-blowing!" / "Must-read!" hype
  - If info is insufficient, prefer shorter over fabrication

Output STRICTLY a JSON object, no markdown wrapping:
{
  "summaries": [
    { "url": "<exact url from input>", "summary": "<60-100 word English summary>" },
    ...
  ]
}

**Quote rule (important!)**: For any quotation INSIDE a summary string, use single quotes ' or curly quotes '" — **never** a raw double quote, which breaks JSON parsing.`;

const PAPERS_SYSTEM_PROMPT_ZH = `你是一名 AI 研究方向的中文编辑，为 HuggingFace 上的热门论文写**中文摘要**。

输入：每篇论文有 url、title（英文标题）、excerpt（英文摘要开头）。

任务：根据 title + excerpt，写一段 60-110 字的**中文摘要**，说清：
  1. 这篇论文解决什么问题 / 提出什么方法
  2. 核心技术思路（模型、训练方式、数据等，能从摘要推断的话）
  3. 关键结果或贡献（有量化指标就保留，如准确率、加速比）

写作风格：
  - 信息密度高，不写"这篇论文…"这种废话开头
  - 中文表达，专业术语 / 模型名 / 方法名保留英文（Transformer、RLHF、CoT、MoE 等）
  - 事实陈述，不夸大、不标题党
  - 信息不足宁可短，不要编造

输出严格 JSON 对象，不要 markdown：
{
  "summaries": [
    { "url": "<原 url，从输入中精确复制>", "summary": "<60-110 字中文摘要>" },
    ...
  ]
}

**引号规则（重要！）**：summary 内的引用一律用中文全角引号「」或""，**绝不**用英文双引号 \" —— 否则会导致 JSON 解析失败。`;

const PAPERS_SYSTEM_PROMPT_EN = `You are an AI-research editor writing **English summaries** of trending HuggingFace papers.

Input: each paper has url, title, and excerpt (start of the English abstract).

Task: from title + excerpt, write a 60-110 word **English summary** covering:
  1. What problem the paper tackles / what method it proposes
  2. The core technical approach (model, training method, data — if inferable)
  3. Key result or contribution (keep quantitative metrics if present)

Style:
  - High information density; avoid "This paper..." filler openings
  - Keep model / method names in original form (Transformer, RLHF, CoT, MoE, etc.)
  - Factual, no hype
  - If info is insufficient, prefer shorter over fabrication

Output STRICTLY a JSON object, no markdown:
{
  "summaries": [
    { "url": "<exact url from input>", "summary": "<60-110 word English summary>" },
    ...
  ]
}

**Quote rule (important!)**: For any quotation INSIDE a summary string, use single quotes ' or curly quotes '" — **never** a raw double quote, which breaks JSON parsing.`;

// Pick the right localized prompt set at module init. Each enricher reaches
// in via PROMPTS.<key> so the call sites stay locale-agnostic.
const PROMPTS =
  REPORT_LOCALE === "en"
    ? { gh: GH_SYSTEM_PROMPT_EN, merged: MERGED_SUBGROUP_PROMPT_EN, xViral: XVIRAL_SYSTEM_PROMPT_EN, papers: PAPERS_SYSTEM_PROMPT_EN }
    : { gh: GH_SYSTEM_PROMPT_ZH, merged: MERGED_SUBGROUP_PROMPT_ZH, xViral: XVIRAL_SYSTEM_PROMPT_ZH, papers: PAPERS_SYSTEM_PROMPT_ZH };

const USER_PROMPT_HEADER =
  REPORT_LOCALE === "en"
    ? (n: number) => `Candidate items (${n} entries, JSON array):`
    : (n: number) => `候选条目（共 ${n} 条，JSON 数组）：`;
const USER_PROMPT_FOOTER =
  REPORT_LOCALE === "en"
    ? `Output \`{"summaries": [{"url": ..., "summary": ...}, ...]}\` — url must be copied exactly from input.`
    : `请输出 {"summaries": [{"url": ..., "summary": ...}, ...]}，url 必须精确回填输入值。`;

async function runEnrichment(
  payload: unknown[],
  systemPrompt: string,
  scope: string,
): Promise<Map<string, string>> {
  // Sonnet has a strong "match input language" reflex — when items contain
  // English titles + Chinese-tinted source names (or just a Chinese-leaning
  // RLHF default), system-prompt-only language constraints get ignored. Pin
  // the output language as the first line of the *user* prompt for recency.
  const langHeader =
    REPORT_LOCALE === "en"
      ? "**Output language: ENGLISH ONLY.** Every summary string must be written entirely in English, even if the input title or description contains Chinese."
      : "**输出语言：仅中文。** 每个 summary 字段必须全部是中文，即使输入条目是英文。";
  const userPrompt = [
    langHeader,
    "",
    USER_PROMPT_HEADER(payload.length),
    JSON.stringify(payload),
    "",
    USER_PROMPT_FOOTER,
  ].join("\n");

  const result = new Map<string, string>();

  try {
    const { text } = await runLlm({
      systemPrompt,
      userPrompt,
      timeoutMs: 240_000,
    });
    const cleaned = extractJson(text);

    let parsed: { summaries?: Array<{ url?: string; summary?: string }> };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = JSON.parse(jsonrepair(cleaned));
    }

    for (const s of parsed.summaries ?? []) {
      if (s.url && s.summary) result.set(s.url, s.summary.trim());
    }

    // Diagnostic: if we got back substantially fewer entries than asked for,
    // dump the raw LLM output so the cause is visible without re-running.
    // Common reasons: provider max_tokens too low → truncated JSON, model
    // refused some items, URL field altered so the upstream URL-match drops
    // entries downstream. Without this dump the failure is silent.
    if (result.size < payload.length / 2 && payload.length >= 3) {
      try {
        const fs = await import("node:fs");
        fs.mkdirSync("logs", { recursive: true });
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        const tag = scope.replace(/[^a-z0-9]/gi, "-");
        fs.writeFileSync(
          `logs/enrich-undercount-${tag}-${ts}.txt`,
          `scope=${scope}\nrequested=${payload.length}\nreturned=${result.size}\n\n--- raw LLM output ---\n${text}`,
          "utf8",
        );
        console.warn(
          `[enrich] ${scope}: undercount ${result.size}/${payload.length} — raw dumped to logs/enrich-undercount-${tag}-${ts}.txt`,
        );
      } catch {
        // Can't write log (read-only fs?) — non-fatal, just skip.
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[enrich] ${scope} failed: ${msg}`);
  }

  return result;
}

/**
 * Generate Chinese summaries for a batch of GitHub Trending repos in
 * a single Claude CLI call. Failures are non-fatal — caller gets an
 * empty map and the rendering simply omits summaries.
 */
export async function enrichGithubTrendingSummaries(
  items: EnrichInput[],
): Promise<Map<string, string>> {
  if (items.length === 0) return new Map();
  const payload = items.map((it) => ({
    url: it.url,
    repo: it.title,
    description: (it.excerpt ?? "").slice(0, 200),
  }));
  return runEnrichment(payload, PROMPTS.gh, "GH summaries");
}

/**
 * Generate factual summaries for merged subgroup items (politics, ai-news).
 * One LLM call covers the whole batch.
 */
export async function enrichMergedSubgroupSummaries(
  items: EnrichInput[],
): Promise<Map<string, string>> {
  if (items.length === 0) return new Map();
  const payload = items.map((it) => ({
    url: it.url,
    title: it.title,
    source: it.source ?? "",
    excerpt: (it.excerpt ?? "").slice(0, 280),
  }));
  return runEnrichment(payload, PROMPTS.merged, "merged subgroup summaries");
}

/**
 * Generate Chinese summaries for viral X posts. Different prompt from
 * X tweets are usually clickbait titles + first-person
 * tutorial / case-study text — the model needs to dig past the headline.
 */
export async function enrichXViralSummaries(
  items: Array<EnrichInput & { author?: string }>,
): Promise<Map<string, string>> {
  if (items.length === 0) return new Map();
  const payload = items.map((it) => ({
    url: it.url,
    title: it.title,
    author: it.author ?? "",
    previewText: (it.excerpt ?? "").slice(0, 280),
  }));
  return runEnrichment(payload, PROMPTS.xViral, "X-viral summaries");
}

/**
 * Generate summaries for trending HuggingFace papers. Separate prompt
 * from GH because papers need a problem/method/result framing
 * and the excerpt is an English research abstract.
 */
export async function enrichTrendingPapersSummaries(
  items: EnrichInput[],
): Promise<Map<string, string>> {
  if (items.length === 0) return new Map();
  const payload = items.map((it) => ({
    url: it.url,
    title: it.title,
    excerpt: (it.excerpt ?? "").slice(0, 300),
  }));
  return runEnrichment(payload, PROMPTS.papers, "papers summaries");
}

// ----- arXiv paper classification -----

export interface ClassifiedPaper {
  url: string;
  category: "motion" | "video" | "world-model" | "cv-other" | "irrelevant";
  relevance: number; // 1-10
  codeUrl?: string; // GitHub/GitLab repo URL if mentioned in abstract
}

const ARXIV_CLASSIFY_PROMPT_ZH = `你是一名 CV / 多模态方向的研究助理，负责对 arXiv 论文进行严格分类。

输入：论文列表，每篇有 url、title、excerpt（摘要）。

分类规则（必须严格遵守，宁可漏选也不要错选）：
  - "motion"：**必须**是关于人体动作/姿态的论文。
    关键词：Human Motion Generation, Text to Motion, Motion Diffusion, Motion Synthesis,
    Action Generation, Locomotion, Human-Object Interaction, Human-Scene Interaction,
    Gesture Generation, Facial Expression, Motion Capture, Human Pose Estimation,
    Human Mesh Recovery, Physics-based Animation, Character Animation
    ✓ 示例："Generating 3D Human Motion from Text" → motion
    ✗ 反例："Robot arm manipulation" → 不是 motion（是 robotics）

  - "video"：**必须**是关于视频生成/理解的论文。
    关键词：Video Generation, Video Model, Video Diffusion, Text-to-Video,
    Image-to-Video, Video Prediction, Video Synthesis, Video Editing,
    Video Understanding, Video Transformer, Frame Interpolation
    ✓ 示例："High-resolution video generation with diffusion" → video
    ✗ 反例："Video surveillance object detection" → 不是 video（是 detection）

  - "world-model"：**必须**是关于世界模型/环境建模的论文。
    关键词：World Model, World Simulator, 4D Generation, Scene Generation,
    Neural Rendering, 3D Gaussian Splatting, NeRF, Scene Reconstruction,
    View Synthesis, Novel View Generation
    ✓ 示例："Learning world models for autonomous driving" → world-model
    ✗ 反例："3D object detection from point clouds" → 不是 world-model

  - "cv-other"：其他**明确的**计算机视觉论文（不属于以上三类，但仍然是好的 CV 工作）
  - "irrelevant"：与 CV / 多模态**无关**的论文（纯 NLP、纯理论、纯系统、纯 RL、纯机器人控制等）

**重要**：
  - 每篇论文只能属于一个分类
  - 如果不确定，选 "irrelevant" 而不是猜一个分类
  - relevance 用 1-10 的整数表示，7 分以上才能放入 motion/video/world-model

**代码仓库检测**：
  - 如果摘要中提到了 GitHub、GitLab 链接，或 "code at"、"code available at"、"github.com" 等字样，提取到 codeUrl
  - 如果没有提到代码仓库，省略 codeUrl 字段

输出严格 JSON 对象，不要 markdown：
{
  "papers": [
    { "url": "<精确 url>", "category": "motion", "relevance": 9, "codeUrl": "https://github.com/..." },
    ...
  ]
}`;

const ARXIV_CLASSIFY_PROMPT_EN = `You are a strict research assistant for CV / multimodal learning, classifying arXiv papers.

Input: paper list, each with url, title, excerpt (abstract).

Classification rules (MUST be strict — better to miss than to misclassify):
  - "motion": MUST be about human body motion/pose.
    Keywords: Human Motion Generation, Text to Motion, Motion Diffusion, Motion Synthesis,
    Action Generation, Locomotion, Human-Object Interaction, Human-Scene Interaction,
    Gesture Generation, Facial Expression, Motion Capture, Human Pose Estimation,
    Human Mesh Recovery, Physics-based Animation, Character Animation
    ✓ Example: "Generating 3D Human Motion from Text" → motion
    ✗ Counter: "Robot arm manipulation" → NOT motion (it's robotics)

  - "video": MUST be about video generation/understanding.
    Keywords: Video Generation, Video Model, Video Diffusion, Text-to-Video,
    Image-to-Video, Video Prediction, Video Synthesis, Video Editing,
    Video Understanding, Video Transformer, Frame Interpolation
    ✓ Example: "High-resolution video generation with diffusion" → video
    ✗ Counter: "Video surveillance object detection" → NOT video (it's detection)

  - "world-model": MUST be about world models/environment modeling.
    Keywords: World Model, World Simulator, 4D Generation, Scene Generation,
    Neural Rendering, 3D Gaussian Splatting, NeRF, Scene Reconstruction,
    View Synthesis, Novel View Generation
    ✓ Example: "Learning world models for autonomous driving" → world-model
    ✗ Counter: "3D object detection from point clouds" → NOT world-model

  - "cv-other": other CLEARLY CV papers (not in above 3, but still good CV work)
  - "irrelevant": papers NOT related to CV / multimodal (pure NLP, pure theory, pure systems, pure RL, pure robotics control, etc.)

**IMPORTANT**:
  - Each paper belongs to exactly ONE category
  - If unsure, choose "irrelevant" rather than guessing
  - Relevance is an integer 1-10; only papers with 7+ can go into motion/video/world-model

**Code repository detection**:
  - If the abstract mentions a GitHub, GitLab link, or phrases like "code at", "code available at", "github.com", extract it to codeUrl
  - If no code repository is mentioned, omit the codeUrl field

Output STRICTLY a JSON object, no markdown:
{
  "papers": [
    { "url": "<exact url>", "category": "motion", "relevance": 9, "codeUrl": "https://github.com/..." },
    ...
  ]
}`;

/** Batch size for LLM classification — smaller batches = better accuracy */
const CLASSIFY_BATCH_SIZE = 25;

/**
 * Classify a single batch of arXiv papers using LLM.
 */
async function classifyBatch(
  items: EnrichInput[],
  systemPrompt: string,
): Promise<ClassifiedPaper[]> {
  const payload = items.map((it) => ({
    url: it.url,
    title: it.title,
    excerpt: (it.excerpt ?? "").slice(0, 500),
  }));

  const langHeader =
    REPORT_LOCALE === "en"
      ? "**Output language: ENGLISH ONLY.**"
      : "**输出语言：仅中文。**";

  const userPrompt = [
    langHeader,
    "",
    `Candidate papers (${payload.length} entries, JSON array):`,
    JSON.stringify(payload),
    "",
    'Output {"papers": [{"url": ..., "category": ..., "relevance": ...}, ...]}',
  ].join("\n");

  const { text } = await runLlm({
    systemPrompt,
    userPrompt,
    timeoutMs: 120_000,
  });
  const cleaned = extractJson(text);

  let parsed: { papers?: ClassifiedPaper[] };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = JSON.parse(jsonrepair(cleaned));
  }

  const VALID_CATEGORIES = new Set(["motion", "video", "world-model", "cv-other"]);

  return (parsed.papers ?? [])
    .filter((p) => p.url && p.category && p.category !== "irrelevant")
    .map((p) => ({
      ...p,
      category: VALID_CATEGORIES.has(p.category) ? p.category : "cv-other",
    }));
}

/**
 * Classify arXiv papers into research directions using LLM.
 * Processes in batches of 25 for better accuracy.
 * Returns classified papers, excluding irrelevant ones.
 */
export async function classifyArxivPapers(
  items: EnrichInput[],
): Promise<ClassifiedPaper[]> {
  if (items.length === 0) return [];

  const systemPrompt =
    REPORT_LOCALE === "en" ? ARXIV_CLASSIFY_PROMPT_EN : ARXIV_CLASSIFY_PROMPT_ZH;

  // Split into batches
  const batches: EnrichInput[][] = [];
  for (let i = 0; i < items.length; i += CLASSIFY_BATCH_SIZE) {
    batches.push(items.slice(i, i + CLASSIFY_BATCH_SIZE));
  }

  console.log(
    `[daily] arxiv classification: ${items.length} papers in ${batches.length} batches of ${CLASSIFY_BATCH_SIZE}`,
  );

  const allResults: ClassifiedPaper[] = [];

  // Process batches sequentially to avoid overwhelming the LLM API
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(
      `[daily] classifying batch ${i + 1}/${batches.length} (${batch.length} papers)...`,
    );

    try {
      const results = await classifyBatch(batch, systemPrompt);
      allResults.push(...results);
      console.log(
        `[daily] batch ${i + 1}: ${results.length}/${batch.length} relevant`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[daily] batch ${i + 1} failed: ${msg}`);
      // Continue with other batches even if one fails
    }
  }

  // Deduplicate by URL (in case of overlaps)
  const seen = new Set<string>();
  const deduped = allResults.filter((p) => {
    if (seen.has(p.url)) return false;
    seen.add(p.url);
    return true;
  });

  console.log(
    `[daily] arxiv classification total: ${deduped.length}/${items.length} relevant`,
  );

  return deduped;
}
