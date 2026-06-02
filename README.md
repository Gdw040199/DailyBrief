<a id="zh"></a>

# 📰 daily-brief · 本地 AI 每日简报

**中文** · [English ↓](#en)

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node 20+](https://img.shields.io/badge/node-20%2B-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6.svg)](https://www.typescriptlang.org/)
[![LLM](https://img.shields.io/badge/LLM-6%20backends-orange.svg)](#-llm-后端)
[![Deploy](https://img.shields.io/badge/deploy-GitHub%20Actions-2088ff.svg)](#a-github-actions--pages)

> **本地优先的 AI 日报流水线**：抓取 RSS / API 信源 → LLM 摘要与精选 → 输出单文件 HTML（CSS/JS 内联）。可本机定时跑，也可 GitHub Actions 发布到 Pages。
>
> 本仓库为 [leiting-eric/DailyBrief](https://github.com/leiting-eric/DailyBrief) 的 **个人 fork**，侧重 **AI / 视觉 / 具身** 科研资讯（arXiv 定向检索、HuggingFace 热榜论文、实验室主页监控等）。上游完整版含财经信源与 21 标的行情面板，见上游 README。

**部署三选一**：[GitHub Actions + Pages](#a-github-actions--pages) · [本地一键装](#b-本地一键装) · [交给 AI Agent](#c-交给-ai-agent)

---

## ✨ 本仓库能做什么

| 能力 | 说明 |
|---|---|
| **多源聚合** | 信源集中在 [`sources.config.json`](sources.config.json)；当前 locale 下约 **18** 个启用源（`npm run sources` 看实时列表） |
| **技术 Tab** | GitHub Trending · AI 媒体合并流 · X 推文 · HuggingFace 热榜论文 · **arXiv 定向论文**（按人体动作 / 视频 / 世界模型 / 广义 CV 分类并摘要） |
| **时政 Tab** | BBC / Guardian / NYT / NPR / DW 中文 / Al Jazeera / The Diplomat 等合并要闻流 |
| **Lab Watch** | 监控 [`lab-watchlist.json`](lab-watchlist.json) 中的实验室/教授主页更新，写入日报 |
| **LLM 可插拔** | `claude-cli` / `anthropic` / `openai` / `deepseek` / `minimax` / **`zhipu`（智谱）** |
| **中英双语** | `REPORT_LOCALE=zh`（默认）或 `en`，影响信源过滤、Prompt、UI 文案 |
| **邮件通知** | 可选 Resend（`RESEND_API_KEY` + `EMAIL_TO`） |
| **零数据源 API Key** | 抓取走公开 RSS / API；仅 LLM 与邮件需要密钥 |

**不包含（相对上游）**：财经 RSS 信源、「市场行情」技术指标面板、`regen-trading` 命令。

---

## 📚 信源与报告结构

运行 `npm run sources` 查看各源的 `enabled` / `locales` 状态。改源只编辑 `sources.config.json`，无需改 TypeScript（非 RSS 类型需在 `lib/sources/` 增加 fetcher 并在 `dispatch.ts` 注册）。

**技术**（L2 子栏目顺序见 `lib/output/render.ts`）：

- `github-trending` — GitHub 热榜
- `arxiv-papers` — arXiv API + 关键词过滤 + LLM 分方向精选
- `trending-papers` — HuggingFace Daily Papers
- `x-viral` — AttentionVC X 推文
- `ai-news` — OpenAI / DeepMind / HF Blog / TLDR AI / Smol AI / Latent Space / MIT TR AI 等合并流

**时政**：`world` — 多家国际媒体合并要闻（过滤体育标题）

**Lab Watch**：独立于信源表，由 `lab-watchlist.json` 配置主页 URL。

报告输出目录：`daily_reports/<YYYY-MM-DD>/` → `<date>.html`（主交付物）、`<date>.json`、`<date>-articles.json`（侧车缓存，供 `render` / `regen-enrich` 使用）。设 `OUTPUT_MARKDOWN=true` 可额外生成 `.md`。

---

## 🚀 部署

| 方式 | 适合 | 需要 |
|---|---|---|
| **A. GitHub Actions + Pages** | 无常开机器 | 任一 LLM API Key + 公开仓库 |
| **B. 本地一键装** | 本机/服务器定时跑 | Node 20+；可选 Claude Code 登录 |
| **C. AI Agent** | 让 Cursor / Claude Code 代装 | 同 B |

### A. GitHub Actions + Pages

1. Fork 本仓库 → **Settings → Actions → General** → Workflow permissions 选 **Read and write**
2. **Settings → Pages** → Deploy from branch → `gh-pages` / `/`（须等首次 workflow 成功后才有该分支）
3. **Settings → Secrets and variables → Actions**：
   - **Secret**：对应后端的 API Key（如 `ANTHROPIC_API_KEY`、`DEEPSEEK_API_KEY`、`ZHIPU_API_KEY`…）
   - **Variable**：`LLM_BACKEND`（必须与 Secret 匹配；默认 `anthropic`，只填 DeepSeek key 不填 variable 会报 Anthropic 相关错误）
   - 可选：`LLM_MODEL`、`LLM_BASE_URL`、`REPORT_LOCALE`、`REPORT_TZ`、`REPORT_HOUR`、`REPORT_DAYS`
   - 邮件可选：`RESEND_API_KEY`（Secret）、`EMAIL_TO`、`EMAIL_FROM`、`REPORT_BASE_URL`（Variable）
4. **Actions → Daily Brief → Run workflow** 手动触发一次

报告地址：`https://<用户名>.github.io/<仓库名>/`。调度：workflow **每小时**触发，由 `gate` job 按 `REPORT_TZ` + `REPORT_HOUR` + `REPORT_DAYS` 决定是否构建（支持夏令时）；`workflow_dispatch` 始终跳过 gate。

> GH Actions **无法**使用本机 `claude` CLI。使用 **zhipu** 时需在 [`.github/workflows/daily.yml`](.github/workflows/daily.yml) 的 build job 中自行加入 `ZHIPU_API_KEY` 环境变量（当前 workflow 已注入 anthropic / openai / deepseek / minimax）。

**常见坑（精简）**：

- Pages 要求 **Public** 仓库（Free 套餐）
- Secret 放在 **Repository** scope（Settings → Secrets and variables → **Actions**），不要只放在 Environment 且 workflow 未声明 `environment:`
- `LLM_BACKEND` 变量名勿用中文输入法的全角下划线
- 失败看 Actions log 里 “Generate today's report” 步骤（401/402 = Key 或余额）

### B. 本地一键装

```bash
# Linux / macOS — 默认克隆本 fork
curl -sSL https://raw.githubusercontent.com/Gdw040199/DailyBrief/main/bootstrap.mjs | node

# 或克隆上游
curl -sSL https://raw.githubusercontent.com/leiting-eric/DailyBrief/main/bootstrap.mjs | node

# Windows PowerShell
irm https://raw.githubusercontent.com/Gdw040199/DailyBrief/main/bootstrap.mjs | node -
```

自定义：`node bootstrap.mjs --target /path/to/repo --at 07:30 --repo https://github.com/you/DailyBrief.git`

完成后：注册系统定时（默认本地 08:00）、`npm run dry-run` 烟测、可选 `~/.claude/` skill 链接。

| 平台 | 手动触发 |
|---|---|
| Windows | `Start-ScheduledTask -TaskName DailyBrief` |
| macOS | `launchctl start com.daily-brief` |
| Linux | `node scripts/run-daily.mjs` |

### C. 交给 AI Agent

> 按 README 用 bootstrap 安装本仓库，装完告诉我下次自动运行时间：  
> https://github.com/Gdw040199/DailyBrief

协议文档：[`AGENTS.md`](AGENTS.md) · Claude Code： [`.claude/skills/daily-brief/SKILL.md`](.claude/skills/daily-brief/SKILL.md)

---

## 📋 前置要求

- **Node.js 20+**、npm、git（仅本地部署）
- **LLM**：Claude Code CLI 已登录，或任一 API 后端 Key
- Windows 10+ / macOS 12+ / Linux

---

## 🔧 手动安装

```bash
git clone git@github.com:Gdw040199/DailyBrief.git   # 或你的 fork URL
cd DailyBrief
npm install
cp .env.example .env.local   # 按需编辑 LLM / 时区 / 邮件等

# 默认 claude CLI（首次需浏览器登录一次）
echo "hi" | claude --print --model sonnet

node scripts/install.mjs --global
# 测试：Windows / macOS 见上表；Linux: node scripts/run-daily.mjs
```

---

## 🛠️ 命令

| 命令 | 用途 | 耗时 |
|---|---|---|
| `npm run daily` | 完整流水线（抓取 + LLM + 渲染 + 可选邮件） | 约 5–8 min |
| `npm run dry-run` | 只抓取，不调 LLM | ~30s |
| `npm run render [date]` | 从侧车重渲染 HTML | <1s |
| `npm run regen-enrich -- <cat:sub> [date]` | 补某合并子栏缺失摘要；例 `politics:world`、`tech:ai-news` | ~30s |
| `npm run lab-watch` | 单独检查实验室主页（`-- --dry` 不写状态） | 秒级 |
| `npm run open` | 打开今日报告 | 即时 |
| `npm run build-site` | 生成 Pages 用 index + archive | <1s |
| `npm run deploy [date]` | scp 到自托管服务器（需 `DEPLOY_*`） | 视网络 |
| `npm run quota-report` | LLM 调用统计 | 即时 |
| `npm run sources` | 列出信源与 locale 过滤结果 | 即时 |
| `npm run sources:check` | 校验 `sources.config.json` | 即时 |

调试：`logs/daily-<日期>.log`、`logs/llm-calls.jsonl`。

---

## 🤖 LLM 后端

通过 `.env.local`（本地）或 GitHub **Secrets + Variables**（Actions）配置。所有调用走 `lib/ai/llm.ts` 的 `runLlm()`。

| backend | Key 环境变量 | 默认 model |
|---|---|---|
| `claude-cli`（默认） | 无（Claude Code OAuth） | `sonnet` |
| `anthropic` | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` |
| `openai` | `OPENAI_API_KEY` | `gpt-4o-mini` |
| `deepseek` | `DEEPSEEK_API_KEY` | `deepseek-v4-flash` |
| `minimax` | `MINIMAX_API_KEY` | `MiniMax-M2.7` |
| `zhipu` | `ZHIPU_API_KEY` | `claude-sonnet-4-6` |

通用覆盖：`LLM_MODEL`、`LLM_API_KEY`、`LLM_BASE_URL`；各后端另有 `<BACKEND>_BASE_URL`。

快速验证（约 30s、1 次 LLM）：

```bash
npm run regen-enrich -- politics:world
```

智谱本地测试：`ZHIPU_API_KEY=... npx tsx scripts/test-zhipu.ts`

完整示例见 [`.env.example`](.env.example)。

---

## 🔔 邮件与自托管（可选）

**邮件**（[Resend](https://resend.com)）：`.env.local` 或 Actions 中设置 `RESEND_API_KEY`、`EMAIL_TO`；可选 `EMAIL_FROM`、`REPORT_BASE_URL`（邮件内「查看完整报告」链接）。

**自托管**：设置 `DEPLOY_HOST`、`DEPLOY_PATH` 后，每次 `npm run daily` 结束由 `run-daily.mjs` 尝试 scp；失败不阻断本地 HTML 生成。

---

## 🔬 Lab Watch

编辑 [`lab-watchlist.json`](lab-watchlist.json) 添加 `id`、`name`、`url`。流水线在 `daily` 中自动检查；也可：

```bash
npm run lab-watch
npm run lab-watch -- --dry
```

状态保存在 `daily_reports/.lab-watch-state.json`。

---

## 💡 Claude Code

`node scripts/install.mjs --global` 后，任意目录可用 `/run-daily`、`/check-daily`；描述「日报挂了」等会触发 `daily-brief` skill。

---

## 📁 项目结构

```
lib/
  sources/       # 抓取与 dispatch
  ai/            # LLM 后端 + enrich + pipeline
  output/        # HTML/MD 渲染
  lab-watch.ts   # 实验室主页监控
  email.ts       # Resend 邮件
scripts/
  daily.ts       # 主管线
  dry-run.ts · render.ts · regen-enrich.ts · lab-watch.ts
  install.mjs · run-daily.mjs · build-site.mjs · deploy.mjs
sources.config.json
lab-watchlist.json
daily_reports/   # 输出（gitignore）
```

---

## 🗑️ 卸载

```bash
node scripts/uninstall.mjs
```

---

## 🛠️ 自定义

改信源、排版、调度、arXiv 关键词等 → [FORKING.md](FORKING.md)。

---

## 🙏 致谢

- 上游项目：[leiting-eric/DailyBrief](https://github.com/leiting-eric/DailyBrief)
- 社区：[LINUX DO](https://linux.do)

## 📝 License

MIT

---

<br>

<a id="en"></a>

# 📰 daily-brief · local AI daily brief

[↑ 中文](#zh) · **English**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node 20+](https://img.shields.io/badge/node-20%2B-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6.svg)](https://www.typescriptlang.org/)
[![LLM](https://img.shields.io/badge/LLM-6%20backends-orange.svg)](#-llm-backends)
[![Deploy](https://img.shields.io/badge/deploy-GitHub%20Actions-2088ff.svg)](#a-github-actions--pages-en)

> **Local-first AI daily brief pipeline**: fetch RSS/API sources → LLM summaries & curation → single self-contained HTML (inlined CSS/JS). Run on a local OS scheduler, or publish via GitHub Actions to Pages.
>
> This repo is a **personal fork** of [leiting-eric/DailyBrief](https://github.com/leiting-eric/DailyBrief), focused on **AI / vision / embodied** research (arXiv keyword search, HuggingFace trending papers, lab homepage monitoring, etc.). The upstream project includes finance feeds and a 21-ticker market panel — see the upstream README.

**Pick one deployment path**: [GitHub Actions + Pages](#a-github-actions--pages-en) · [Local one-liner install](#b-local-one-liner-install) · [Have an AI agent install it](#c-have-an-ai-agent-install-it)

---

## ✨ What this fork does

| Capability | Description |
|---|---|
| **Multi-source aggregation** | Sources live in [`sources.config.json`](sources.config.json); roughly **18** enabled sources for the current locale (run `npm run sources` for the live list) |
| **Tech tab** | GitHub Trending · merged AI media stream · X posts · HuggingFace trending papers · **arXiv targeted papers** (classified into human motion / video / world models / broad CV, then summarized) |
| **Politics tab** | Merged world-news stream from BBC / Guardian / NYT / NPR / DW Chinese / Al Jazeera / The Diplomat, etc. |
| **Lab Watch** | Monitor lab/professor homepages listed in [`lab-watchlist.json`](lab-watchlist.json); updates appear in the daily report |
| **Pluggable LLM** | `claude-cli` / `anthropic` / `openai` / `deepseek` / `minimax` / **`zhipu` (Zhipu AI)** |
| **Bilingual** | `REPORT_LOCALE=zh` (default) or `en` — affects source filtering, prompts, and UI copy |
| **Email notifications** | Optional Resend (`RESEND_API_KEY` + `EMAIL_TO`) |
| **Zero data-source API keys** | Fetching uses public RSS/API endpoints; only the LLM and email need secrets |

**Not included (vs upstream)**: finance RSS sources, the “markets” technical-indicator panel, and the `regen-trading` command.

---

## 📚 Sources & report layout

Run `npm run sources` to see each source’s `enabled` / `locales` status. To add or disable sources, edit `sources.config.json` only — no TypeScript changes for plain RSS (non-RSS types need a fetcher under `lib/sources/` and a branch in `dispatch.ts`).

**Tech** (L2 sub-tab order is defined in `lib/output/render.ts`):

- `github-trending` — GitHub Trending
- `arxiv-papers` — arXiv API + keyword filter + LLM direction-based selection
- `trending-papers` — HuggingFace Daily Papers
- `x-viral` — AttentionVC X posts
- `ai-news` — merged stream: OpenAI / DeepMind / HF Blog / TLDR AI / Smol AI / Latent Space / MIT TR AI, etc.

**Politics**: `world` — merged headlines from major international outlets (sports titles filtered out)

**Lab Watch**: separate from the source registry; homepage URLs live in `lab-watchlist.json`.

Output directory: `daily_reports/<YYYY-MM-DD>/` → `<date>.html` (main deliverable), `<date>.json`, `<date>-articles.json` (sidecar cache for `render` / `regen-enrich`). Set `OUTPUT_MARKDOWN=true` to also write `.md`.

---

## 🚀 Deployment

| Path | Best for | You need |
|---|---|---|
| **A. GitHub Actions + Pages** | No always-on machine | Any LLM API key + a public repo |
| **B. Local one-liner** | Desktop or server on a schedule | Node 20+; optional Claude Code login |
| **C. AI agent** | Let Cursor / Claude Code handle setup | Same as B |

<a id="a-github-actions--pages-en"></a>

### A. GitHub Actions + Pages

1. Fork this repo → **Settings → Actions → General** → Workflow permissions → **Read and write permissions**
2. **Settings → Pages** → Build and deployment → Deploy from branch → `gh-pages` / `/` (the `gh-pages` branch only exists after the first successful workflow run)
3. **Settings → Secrets and variables → Actions**:
   - **Secret**: API key for your backend (e.g. `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, `ZHIPU_API_KEY`, …)
   - **Variable**: `LLM_BACKEND` (must match the secret; default is `anthropic` — setting only a DeepSeek key without the variable triggers Anthropic-related errors)
   - Optional: `LLM_MODEL`, `LLM_BASE_URL`, `REPORT_LOCALE`, `REPORT_TZ`, `REPORT_HOUR`, `REPORT_DAYS`
   - Email (optional): `RESEND_API_KEY` (Secret), `EMAIL_TO`, `EMAIL_FROM`, `REPORT_BASE_URL` (Variables)
4. **Actions → Daily Brief → Run workflow** to trigger manually once

Report URL: `https://<username>.github.io/<repo-name>/`. Schedule: the workflow runs **hourly**; a `gate` job checks `REPORT_TZ` + `REPORT_HOUR` + `REPORT_DAYS` before building (DST-aware). `workflow_dispatch` always bypasses the gate.

> GitHub Actions **cannot** use your local `claude` CLI. For **zhipu**, add `ZHIPU_API_KEY` to the build job env in [`.github/workflows/daily.yml`](.github/workflows/daily.yml) yourself (the workflow already injects anthropic / openai / deepseek / minimax).

**Common gotchas (short list)**:

- GitHub Pages on the Free plan requires a **public** repository
- Put secrets in **Repository** scope (**Settings → Secrets and variables → Actions**), not only under Environments unless the workflow declares `environment:`
- Don’t let a CJK input method turn `LLM_BACKEND` underscores into full-width `＿`
- On failure, read the “Generate today's report” step log (401/402 = bad key or no credit)

<a id="b-local-one-liner-install"></a>

### B. Local one-liner install

```bash
# Linux / macOS — clones this fork by default
curl -sSL https://raw.githubusercontent.com/Gdw040199/DailyBrief/main/bootstrap.mjs | node

# Or clone upstream instead
curl -sSL https://raw.githubusercontent.com/leiting-eric/DailyBrief/main/bootstrap.mjs | node

# Windows PowerShell
irm https://raw.githubusercontent.com/Gdw040199/DailyBrief/main/bootstrap.mjs | node -
```

Customize: `node bootstrap.mjs --target /path/to/repo --at 07:30 --repo https://github.com/you/DailyBrief.git`

After install: OS scheduler registered (default 08:00 local), `npm run dry-run` smoke test, optional `~/.claude/` skill symlinks.

| Platform | Manual trigger |
|---|---|
| Windows | `Start-ScheduledTask -TaskName DailyBrief` |
| macOS | `launchctl start com.daily-brief` |
| Linux | `node scripts/run-daily.mjs` |

<a id="c-have-an-ai-agent-install-it"></a>

### C. Have an AI agent install it

> Install this repo using the README bootstrap flow and tell me when the next scheduled run will fire:  
> https://github.com/Gdw040199/DailyBrief

Agent docs: [`AGENTS.md`](AGENTS.md) · Claude Code: [`.claude/skills/daily-brief/SKILL.md`](.claude/skills/daily-brief/SKILL.md)

---

## 📋 Requirements

- **Node.js 20+**, npm, git (local deployment only)
- **LLM**: Claude Code CLI logged in, or any API backend key
- Windows 10+ / macOS 12+ / Linux

---

## 🔧 Manual install

```bash
git clone git@github.com:Gdw040199/DailyBrief.git   # or your fork URL
cd DailyBrief
npm install
cp .env.example .env.local   # edit LLM / timezone / email as needed

# Default claude CLI (one-time browser login)
echo "hi" | claude --print --model sonnet

node scripts/install.mjs --global
# Test: see platform table above; Linux: node scripts/run-daily.mjs
```

Sleep/wake at the next scheduled run:

- **Windows** — can wake the machine from sleep, run, then sleep again
- **macOS** — launchd does not wake from deep sleep; skipped if asleep (use `pmset wake schedule` if you need wake)
- **Linux** — cron does not wake either; skipped if suspended

---

## 🛠️ Commands

| Command | Purpose | Time |
|---|---|---|
| `npm run daily` | Full pipeline (fetch + LLM + render + optional email) | ~5–8 min |
| `npm run dry-run` | Fetch only, no LLM | ~30s |
| `npm run render [date]` | Re-render HTML from sidecar cache | <1s |
| `npm run regen-enrich -- <cat:sub> [date]` | Fill missing summaries for a merged subgroup; e.g. `politics:world`, `tech:ai-news` | ~30s |
| `npm run lab-watch` | Check lab homepages only (`-- --dry` skips saving state) | seconds |
| `npm run open` | Open today’s report | instant |
| `npm run build-site` | Build Pages index + archive | <1s |
| `npm run deploy [date]` | scp to self-hosted server (needs `DEPLOY_*`) | network-dependent |
| `npm run quota-report` | LLM usage summary | instant |
| `npm run sources` | List sources and locale filter status | instant |
| `npm run sources:check` | Validate `sources.config.json` schema | instant |

Debugging: `logs/daily-<date>.log`, `logs/llm-calls.jsonl`.

---

<a id="llm-backends"></a>

## 🤖 LLM backends

Configure via `.env.local` (local) or GitHub **Secrets + Variables** (Actions). All calls go through `runLlm()` in `lib/ai/llm.ts`.

| backend | API key env var | Default model |
|---|---|---|
| `claude-cli` (default) | none (Claude Code OAuth) | `sonnet` |
| `anthropic` | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` |
| `openai` | `OPENAI_API_KEY` | `gpt-4o-mini` |
| `deepseek` | `DEEPSEEK_API_KEY` | `deepseek-v4-flash` |
| `minimax` | `MINIMAX_API_KEY` | `MiniMax-M2.7` |
| `zhipu` | `ZHIPU_API_KEY` | `claude-sonnet-4-6` |

Universal overrides: `LLM_MODEL`, `LLM_API_KEY`, `LLM_BASE_URL`; each backend also supports `<BACKEND>_BASE_URL`.

Quick validation (~30s, one LLM call):

```bash
npm run regen-enrich -- politics:world
```

Zhipu local smoke test: `ZHIPU_API_KEY=... npx tsx scripts/test-zhipu.ts`

Full copy-paste examples: [`.env.example`](.env.example).

### How to pick

| Your situation | Recommended backend |
|---|---|
| Already using Claude Code (any tier) | `claude-cli` — zero config |
| Not on Claude Code, want lowest cost | `openai` + `gpt-4o-mini`, or `deepseek` |
| Best Chinese summary quality | `anthropic` + `claude-sonnet-4-6` |
| Need a China-accessible API | `deepseek` or `minimax` (or `zhipu` for Coding Plan) |

**Switching backends needs no code changes** — prompts live in `lib/ai/prompts.ts`. After switching, run `npm run daily` once and inspect `logs/llm-calls.jsonl`.

---

## 🔔 Email & self-hosted (optional)

**Email** ([Resend](https://resend.com)): set `RESEND_API_KEY` and `EMAIL_TO` in `.env.local` or Actions; optional `EMAIL_FROM`, `REPORT_BASE_URL` (link to the full report in the email body).

**Self-hosted**: set `DEPLOY_HOST` and `DEPLOY_PATH`. After each successful `npm run daily`, `run-daily.mjs` attempts scp; failure does not block local HTML generation. Retry with `npm run deploy [YYYY-MM-DD]`.

---

## 🔬 Lab Watch

Edit [`lab-watchlist.json`](lab-watchlist.json) and add `id`, `name`, `url`. The `daily` pipeline checks automatically; or run standalone:

```bash
npm run lab-watch
npm run lab-watch -- --dry
```

State is stored in `daily_reports/.lab-watch-state.json`.

---

## 💡 Claude Code integration

After `node scripts/install.mjs --global`, from any directory:

| Trigger | Behavior |
|---|---|
| `/run-daily` | Run daily immediately and monitor until done |
| `/check-daily` | Task status + report files + quota |
| Describe a problem (“report didn’t generate”, etc.) | Auto-loads the `daily-brief` skill |

`install.mjs --global` symlinks [`.claude/skills/daily-brief/SKILL.md`](.claude/skills/daily-brief/SKILL.md) and [`.claude/commands/`](.claude/commands/) into `~/.claude/` (copies on Windows if symlinks fail). `~/.daily-brief-config` stores the project path.

---

## 📁 Project structure

```
lib/
  sources/       # fetchers + dispatch
  ai/            # LLM backends + enrich + pipeline
  output/        # HTML/MD rendering
  lab-watch.ts   # lab homepage monitoring
  email.ts       # Resend email
scripts/
  daily.ts       # main pipeline
  dry-run.ts · render.ts · regen-enrich.ts · lab-watch.ts
  install.mjs · run-daily.mjs · build-site.mjs · deploy.mjs
sources.config.json
lab-watchlist.json
daily_reports/   # output (gitignored)
logs/            # run logs (gitignored)
.github/workflows/   # GitHub Actions (path A)
.claude/             # Claude Code skill + slash commands
```

---

## 🗑️ Uninstall

```bash
node scripts/uninstall.mjs
# Removes: scheduled task + ~/.claude/ links + ~/.daily-brief-config
# Keeps: project dir, daily_reports/, logs/
```

---

## 🛠️ Customize / fork

Change sources, layout, schedule, arXiv keywords, etc. → [FORKING.md](FORKING.md).

---

## 🙏 Acknowledgments

- Upstream: [leiting-eric/DailyBrief](https://github.com/leiting-eric/DailyBrief)
- Community: [LINUX DO](https://linux.do)

## 📝 License

MIT
