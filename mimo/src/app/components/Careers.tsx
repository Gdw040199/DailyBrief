import { useState } from "react";

const roles = [
  { title: "大模型算法研究员", dept: "AI Research", location: "北京" },
  { title: "多模态研究工程师", dept: "Vision & Language", location: "北京" },
  { title: "强化学习工程师", dept: "AI Training", location: "北京 / 上海" },
  { title: "语音技术研究员（TTS / ASR）", dept: "Audio AI", location: "北京" },
  { title: "全栈工程师（AI 产品）", dept: "Engineering", location: "北京" },
  { title: "产品经理（AI 方向）", dept: "Product", location: "北京" },
];

export function Careers() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <section id="careers" className="py-24 px-8" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
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
          加入我们
        </div>

        <p
          style={{
            color: "rgba(255,255,255,0.45)",
            fontSize: "1rem",
            lineHeight: 1.75,
            marginBottom: "4rem",
            maxWidth: "520px",
            fontFamily: "Inter, 'Noto Sans SC', sans-serif",
            fontWeight: 300,
          }}
        >
          我们正在寻找对 AI 有深刻理解和无限热情的同路人，一起推动智能的边界。如果你也相信压缩即智慧，欢迎加入。
        </p>

        <div>
          {roles.map((role, i) => (
            <div
              key={i}
              className="flex items-center justify-between cursor-pointer transition-all duration-200"
              style={{
                padding: "1.3rem 0",
                borderTop: "1px solid rgba(255,255,255,0.055)",
                paddingLeft: hovered === i ? "1rem" : "0",
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div>
                <div
                  style={{
                    color: hovered === i ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.72)",
                    fontSize: "0.93rem",
                    marginBottom: "0.3rem",
                    fontFamily: "Inter, 'Noto Sans SC', sans-serif",
                    transition: "color 0.2s",
                  }}
                >
                  {role.title}
                </div>
                <div
                  style={{
                    color: "rgba(255,255,255,0.22)",
                    fontSize: "0.72rem",
                    fontFamily: "Inter, sans-serif",
                    letterSpacing: "0.04em",
                  }}
                >
                  {role.dept} · {role.location}
                </div>
              </div>
              <span
                style={{
                  color: hovered === i ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.15)",
                  fontSize: "1rem",
                  transition: "color 0.2s, transform 0.2s",
                  transform: hovered === i ? "translateX(4px)" : "translateX(0)",
                }}
              >
                →
              </span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.055)" }} />
        </div>

        <div
          style={{
            color: "rgba(255,255,255,0.28)",
            fontSize: "0.85rem",
            marginTop: "3rem",
            fontFamily: "Inter, 'Noto Sans SC', sans-serif",
          }}
        >
          简历投递：{" "}
          <a
            href="mailto:mimo@xiaomi.com"
            style={{ color: "rgba(255,255,255,0.55)", textDecoration: "underline", textUnderlineOffset: "4px" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.9)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
          >
            mimo@xiaomi.com
          </a>
        </div>
      </div>
    </section>
  );
}
