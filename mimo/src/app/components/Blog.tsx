import { useState } from "react";

const posts = [
  { id: "01", title: "MiMo 推理优化：让小模型跑出大模型的推理效果", date: "2025-12-01" },
  { id: "02", title: "自动语音识别（ASR）新突破：MiMo 的聆听之道", date: "2025-11-18" },
  { id: "03", title: "TTS 语音合成：给智能体一个声音，给它一个灵魂", date: "2025-11-05" },
  { id: "04", title: "多模态理解：视觉与语言的深度融合", date: "2025-10-22" },
  { id: "05", title: "人文社科基准测试：AI 的人文知识边界探索", date: "2025-10-10" },
  { id: "06", title: "强化学习驱动的自主代理能力演进", date: "2025-09-28" },
  { id: "07", title: "MiMo-V2.5-Pro：长程任务连贯性的技术突破", date: "2025-09-15" },
  { id: "08", title: "代理框架设计：让 AI 从对话走向真实行动", date: "2025-09-02" },
  { id: "09", title: "多语言能力：跨越语言边界的理解与生成", date: "2025-08-20" },
  { id: "10", title: "智能压缩论：从 Ilya 的预测理论到 MiMo 的实践", date: "2025-08-08" },
];

export function Blog() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <section id="blog" className="py-24 px-8" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="max-w-4xl mx-auto">
        <div
          style={{
            color: "rgba(255,255,255,0.25)",
            fontSize: "0.7rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            marginBottom: "3.5rem",
            fontFamily: "Inter, sans-serif",
          }}
        >
          Blog
        </div>

        <div>
          {posts.map((post, i) => (
            <div
              key={post.id}
              className="flex items-baseline gap-6 cursor-pointer transition-all duration-200"
              style={{
                padding: "1.3rem 0",
                borderTop: "1px solid rgba(255,255,255,0.055)",
                paddingLeft: hovered === i ? "1rem" : "0",
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <span
                style={{
                  color: "rgba(255,255,255,0.14)",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  flexShrink: 0,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {post.id}
              </span>

              <span
                className="flex-1"
                style={{
                  color: hovered === i ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.62)",
                  fontSize: "0.93rem",
                  lineHeight: 1.5,
                  fontFamily: "Inter, 'Noto Sans SC', sans-serif",
                  fontWeight: 400,
                  transition: "color 0.2s",
                }}
              >
                {post.title}
              </span>

              <span
                style={{
                  color: "rgba(255,255,255,0.18)",
                  fontSize: "0.72rem",
                  flexShrink: 0,
                  fontFamily: "Inter, sans-serif",
                  letterSpacing: "0.04em",
                }}
              >
                {post.date}
              </span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.055)" }} />
        </div>
      </div>
    </section>
  );
}
