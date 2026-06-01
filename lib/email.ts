/**
 * Email notification via Resend API (zero-dependency, REST only).
 *
 * Triggered at the end of scripts/daily.ts when EMAIL_TO is set.
 * Environment variables:
 *   RESEND_API_KEY  — required
 *   EMAIL_TO        — recipient (comma-separated for multiple)
 *   EMAIL_FROM      — sender (default: onboarding@resend.dev)
 *   REPORT_BASE_URL — base URL for the "View Full Report" link
 */

import type { DailyReport } from "./ai/pipeline.js";

// ----- i18n strings -----

interface EmailStrings {
  subject: (date: string) => string;
  brand: string;
  viewReport: string;
  reportLink: (url: string) => string;
  overview: string;
  techSection: string;
  politicsSection: string;
  editorNote: (note: string) => string;
  keywordsLabel: string;
  footer: string;
  emptyBriefs: string;
}

const STRINGS: Record<"zh" | "en", EmailStrings> = {
  zh: {
    subject: (date) => `每日简报 · ${date}`,
    brand: "每日简报",
    viewReport: "📄 查看完整报告",
    reportLink: (url) => `查看完整报告：${url}`,
    overview: "今日总览",
    techSection: "--- 技术动态 ---",
    politicsSection: "--- 时政观察 ---",
    editorNote: (note) => `编辑短评：${note}`,
    keywordsLabel: "关键词：",
    footer: "内容均来自原媒体，本站仅作摘要整理与回链。",
    emptyBriefs: "（无）",
  },
  en: {
    subject: (date) => `Daily Brief · ${date}`,
    brand: "Daily Brief",
    viewReport: "📄 View Full Report",
    reportLink: (url) => `View full report: ${url}`,
    overview: "Today's Overview",
    techSection: "--- Tech Updates ---",
    politicsSection: "--- World News ---",
    editorNote: (note) => `Editor's Note: ${note}`,
    keywordsLabel: "Keywords: ",
    footer: "All content from original media. This site only summarizes and links back.",
    emptyBriefs: "(none)",
  },
};

// ----- public API -----

export interface SendEmailOptions {
  report: DailyReport;
  date: string; // e.g. "2026-05-28"
}

/**
 * Send the daily report email via Resend.
 * No-op when RESEND_API_KEY or EMAIL_TO is missing.
 */
export async function sendDailyEmail({
  report,
  date,
}: SendEmailOptions): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping email");
    return;
  }
  const to = process.env.EMAIL_TO;
  if (!to) {
    console.warn("[email] EMAIL_TO not set — skipping email");
    return;
  }

  const locale = (process.env.REPORT_LOCALE ?? "zh") as "zh" | "en";
  const S = STRINGS[locale];
  const reportUrl = process.env.REPORT_BASE_URL?.replace(/\/+$/, "") || undefined;

  const from = process.env.EMAIL_FROM || "DailyBrief <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: to.split(",").map((s) => s.trim()),
        subject: S.subject(date),
        text: buildPlainText(report, date, reportUrl, S),
        html: buildHtml(report, date, reportUrl, S),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend API ${res.status}: ${body}`);
    }
    console.log("[email] notification sent to", to);
  } catch (err) {
    // Email failure is non-fatal — log and continue
    console.warn(
      "[email] failed:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

// ----- plain-text body -----

function buildPlainText(
  report: DailyReport,
  date: string,
  reportUrl: string | undefined,
  S: EmailStrings,
): string {
  const lines: string[] = [];

  lines.push(`${S.brand} · ${date}`);
  lines.push("=".repeat(40));
  lines.push("");

  if (reportUrl) lines.push(S.reportLink(reportUrl));
  lines.push("");

  if (report.daily_overview) {
    lines.push(`【${S.overview}】`);
    lines.push(report.daily_overview);
    lines.push("");
  }

  // --- Tech ---
  lines.push(S.techSection);
  if (report.tech_briefs.length === 0) {
    lines.push(S.emptyBriefs);
  }
  for (const b of report.tech_briefs) {
    lines.push(`• ${b.title} [${b.importance}/10]`);
    lines.push(`  ${b.source} — ${b.summary}`);
    lines.push(`  ${b.url}`);
    lines.push("");
  }

  // --- Politics ---
  lines.push(S.politicsSection);
  if (report.politics_briefs.length === 0) {
    lines.push(S.emptyBriefs);
  }
  for (const b of report.politics_briefs) {
    lines.push(`• ${b.title} [${b.importance}/10]`);
    lines.push(`  ${b.source} — ${b.summary}`);
    lines.push(`  ${b.url}`);
    lines.push("");
  }

  if (report.editor_note) {
    lines.push(S.editorNote(report.editor_note));
    lines.push("");
  }

  if (report.keywords.length > 0) {
    lines.push(`${S.keywordsLabel}${report.keywords.join(" · ")}`);
  }

  return lines.join("\n");
}

// ----- HTML body -----

function buildHtml(
  report: DailyReport,
  date: string,
  reportUrl: string | undefined,
  S: EmailStrings,
): string {
  const briefCard = (b: (typeof report.tech_briefs)[number]) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #e5e5e5;">
        <a href="${escUrl(b.url)}" style="color:#1a1a1a;font-weight:600;text-decoration:none;font-size:15px;">${escHtml(b.title)}</a>
        <span style="display:inline-block;background:#f0f0f0;color:#555;font-size:11px;padding:1px 6px;border-radius:3px;margin-left:6px;">${b.importance}/10</span>
        <p style="margin:4px 0 0;color:#666;font-size:13px;">${escHtml(b.source)} — ${escHtml(b.summary)}</p>
      </td>
    </tr>`;

  const section = (heading: string, briefs: typeof report.tech_briefs) =>
    briefs.length === 0
      ? ""
      : `
    <tr><td style="padding:20px 0 8px;">
      <h2 style="margin:0;font-size:16px;color:#1a1a1a;border-bottom:2px solid #e5e5e5;padding-bottom:6px;">${heading}</h2>
    </td></tr>
    ${briefs.map(briefCard).join("")}`;

  const keywordsHtml =
    report.keywords.length === 0
      ? ""
      : `<tr><td style="padding:16px 0 0;">
           <p style="margin:0;color:#888;font-size:12px;">${S.keywordsLabel}${report.keywords.map((k) => `<span style="display:inline-block;background:#f0f0f0;padding:2px 8px;border-radius:10px;margin:2px 4px;font-size:12px;">${escHtml(k)}</span>`).join("")}</p>
         </td></tr>`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;">

  <!-- Header -->
  <tr><td style="background:#1a1a1a;padding:24px 32px;">
    <h1 style="margin:0;color:#fff;font-size:20px;letter-spacing:0.04em;">${S.brand}</h1>
    <p style="margin:6px 0 0;color:#999;font-size:13px;">${escHtml(date)}</p>
  </td></tr>

  <!-- Report link -->
  ${
    reportUrl
      ? `<tr><td style="padding:20px 32px 0;">
    <a href="${escUrl(reportUrl)}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;">${S.viewReport}</a>
  </td></tr>`
      : ""
  }

  <!-- Overview -->
  ${
    report.daily_overview
      ? `<tr><td style="padding:20px 32px 0;">
    <h2 style="margin:0 0 8px;font-size:15px;color:#1a1a1a;">${S.overview}</h2>
    <p style="margin:0;color:#444;font-size:14px;line-height:1.65;">${escHtml(report.daily_overview)}</p>
  </td></tr>`
      : ""
  }

  <!-- Briefs -->
  <tr><td style="padding:8px 32px 0;">
    <table width="100%" cellpadding="0" cellspacing="0">
      ${section(S.techSection.replace(/---/g, "").trim(), report.tech_briefs)}
      ${section(S.politicsSection.replace(/---/g, "").trim(), report.politics_briefs)}
    </table>
  </td></tr>

  <!-- Editor note -->
  ${
    report.editor_note
      ? `<tr><td style="padding:20px 32px 0;">
    <h2 style="margin:0 0 6px;font-size:15px;color:#1a1a1a;">${S.editorNote("").replace("：", "").replace(":", "").replace("Editor's Note", "Editor's Note")}</h2>
    <p style="margin:0;color:#444;font-size:14px;line-height:1.6;font-style:italic;">${escHtml(report.editor_note)}</p>
  </td></tr>`
      : ""
  }

  <!-- Keywords -->
  <tr><td style="padding:16px 32px 0;">${keywordsHtml}</td></tr>

  <!-- Footer -->
  <tr><td style="padding:24px 32px;">
    <p style="margin:0;color:#aaa;font-size:11px;line-height:1.5;">${S.footer}</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escUrl(u: string): string {
  return u.replace(/"/g, "%22");
}
