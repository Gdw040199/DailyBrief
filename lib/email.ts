import type { DailyReport } from "./ai/pipeline";

/**
 * Send a daily brief summary email via Resend API.
 *
 * Gated by EMAIL_TO — if unset, the function returns silently.
 * Failures are non-fatal (logged only) so the pipeline is never aborted.
 *
 * Resend free plan: 100 emails/day, no credit card needed.
 * Sign up → get API key → verify sender domain (or use onboarding@resend.dev).
 */
export async function sendDailyEmail(
  date: string,
  report: DailyReport,
): Promise<void> {
  const to = process.env.EMAIL_TO;
  if (!to) return; // not configured — skip silently

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      "[email] EMAIL_TO is set but RESEND_API_KEY is missing — skipping",
    );
    return;
  }

  const from = process.env.EMAIL_FROM ?? "DailyBrief <onboarding@resend.dev>";

  // Build report URL from env (e.g. https://user.github.io/repo)
  // Links to the index page which lists all reports
  const reportUrl = process.env.REPORT_BASE_URL?.replace(/\/+$/, "") || undefined;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `每日简报 · ${date}`,
        text: buildPlainText(date, report, reportUrl),
        html: buildHtml(date, report, reportUrl),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend API ${res.status}: ${body}`);
    }

    const data = (await res.json()) as { id?: string };
    console.log(`[daily] email sent to ${to} (${data.id ?? "ok"})`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[daily] email failed: ${msg}`);
  }
}

// ----- content builders -----

function buildPlainText(
  date: string,
  report: DailyReport,
  reportUrl?: string,
): string {
  const lines: string[] = [];
  lines.push(`每日简报 · ${date}`);
  lines.push("=".repeat(40));
  if (reportUrl) lines.push(`\n查看完整报告：${reportUrl}\n`);
  if (report.hero_headline) lines.push(`\n${report.hero_headline}\n`);
  if (report.daily_overview) lines.push(report.daily_overview);
  if (report.tech_briefs.length > 0) {
    lines.push("\n--- 技术动态 ---");
    for (const b of report.tech_briefs) {
      lines.push(`• [${b.importance}/10] ${b.title} — ${b.source}`);
      lines.push(`  ${b.summary}`);
    }
  }
  if (report.politics_briefs.length > 0) {
    lines.push("\n--- 时政观察 ---");
    for (const b of report.politics_briefs) {
      lines.push(`• [${b.importance}/10] ${b.title} — ${b.source}`);
      lines.push(`  ${b.summary}`);
    }
  }
  if (report.editor_note) lines.push(`\n编辑短评：${report.editor_note}`);
  if (report.keywords.length > 0)
    lines.push(`关键词：${report.keywords.map((k) => `#${k}`).join(" ")}`);
  return lines.join("\n");
}

function buildHtml(
  date: string,
  report: DailyReport,
  reportUrl?: string,
): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const briefCard = (b: {
    title: string;
    source: string;
    summary: string;
    importance: number;
    url: string;
  }) =>
    `<div style="padding:12px 16px;border:1px solid #e4e4e7;border-radius:8px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <a href="${esc(b.url)}" style="font-weight:600;color:#18181b;text-decoration:none;font-size:15px">${esc(b.title)}</a>
        <span style="font-size:12px;color:#71717a;background:#f4f4f5;padding:2px 8px;border-radius:999px">${b.importance}/10</span>
      </div>
      <div style="font-size:12px;color:#71717a;margin-bottom:4px">${esc(b.source)}</div>
      <p style="margin:0;font-size:14px;color:#3f3f46;line-height:1.6">${esc(b.summary)}</p>
    </div>`;

  const section = (
    title: string,
    briefs: Array<{
      title: string;
      source: string;
      summary: string;
      importance: number;
      url: string;
    }>,
  ) =>
    briefs.length === 0
      ? ""
      : `<h2 style="font-size:16px;font-weight:600;margin:20px 0 10px;padding-bottom:6px;border-bottom:1px solid #e4e4e7">${title}</h2>
         ${briefs.map(briefCard).join("\n")}`;

  const keywordsHtml =
    report.keywords.length > 0
      ? `<div style="margin:16px 0;display:flex;flex-wrap:wrap;gap:6px">
          ${report.keywords.map((k) => `<span style="background:#f4f4f5;color:#3f3f46;padding:4px 12px;border-radius:999px;font-size:13px">#${esc(k)}</span>`).join("")}
         </div>`
      : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC',sans-serif">
<div style="max-width:600px;margin:0 auto;padding:24px 16px">
  <div style="margin-bottom:16px">
    <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a;font-weight:500">每日简报</div>
    <h1 style="font-size:24px;font-weight:700;margin:4px 0 16px;color:#18181b">${esc(date)}</h1>
  </div>

  ${reportUrl ? `<a href="${esc(reportUrl)}" style="display:inline-block;padding:10px 20px;background:#18181b;color:#fafaf9;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;margin-bottom:16px">📄 查看完整报告</a>` : ""}

  ${report.hero_headline ? `<div style="background:linear-gradient(135deg,#fafaf9,#f4f4f5);border:1px solid #e4e4e7;border-left:4px solid #18181b;padding:16px 20px;border-radius:8px;margin-bottom:16px">
    <p style="margin:0;font-size:18px;font-weight:600;color:#18181b;line-height:1.5">${esc(report.hero_headline)}</p>
  </div>` : ""}

  ${report.daily_overview ? `<div style="padding:12px 16px;background:#f4f4f5;border-radius:8px;border-left:3px solid #71717a;margin-bottom:16px">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a;font-weight:500;margin-bottom:6px">今日总览</div>
    <p style="margin:0;font-size:14px;color:#3f3f46;line-height:1.7">${esc(report.daily_overview)}</p>
  </div>` : ""}

  ${section("技术动态", report.tech_briefs)}
  ${section("时政观察", report.politics_briefs)}

  ${report.editor_note ? `<div style="padding:12px 16px;background:#f4f4f5;border-radius:8px;border-left:3px solid #71717a;margin:16px 0">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a;font-weight:500;margin-bottom:6px">编辑短评</div>
    <p style="margin:0;font-size:14px;color:#18181b;line-height:1.7">${esc(report.editor_note)}</p>
  </div>` : ""}

  ${keywordsHtml}

  <div style="margin-top:24px;padding-top:12px;border-top:1px solid #e4e4e7;color:#71717a;font-size:12px">
    内容均来自原媒体，本站仅作摘要整理与回链。
  </div>
</div>
</body>
</html>`;
}
