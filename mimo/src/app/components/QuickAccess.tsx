import { useState } from "react";

const tiles = [
  {
    num: "01",
    title: "Web 体验",
    subtitle: "立即对话，无需注册",
    description:
      "在浏览器中直接体验 MiMo 的对话与推理能力。支持中英双语，覆盖代码生成、逻辑推理、创意写作等多种场景。",
    cta: "开始体验",
  },
  {
    num: "02",
    title: "API 接入",
    subtitle: "For Developers",
    description:
      "通过标准 RESTful API 将 MiMo 集成到你的应用中。兼容 OpenAI 接口格式，支持流式输出与函数调用。",
    cta: "查看文档",
  },
];

export function QuickAccess() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <section className="py-24 px-8" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="max-w-6xl mx-auto">
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
          快速体验
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px" style={{ background: "rgba(255,255,255,0.05)" }}>
          {tiles.map((tile, i) => (
            <div
              key={tile.num}
              className="relative p-10 cursor-pointer transition-all duration-300"
              style={{ background: hovered === i ? "#141414" : "#0a0a0a" }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div
                style={{
                  color: "rgba(255,255,255,0.07)",
                  fontSize: "5rem",
                  fontWeight: 800,
                  lineHeight: 1,
                  marginBottom: "2rem",
                  fontFamily: "Inter, sans-serif",
                  letterSpacing: "-0.04em",
                }}
              >
                {tile.num}
              </div>

              <h3
                style={{
                  color: "#ffffff",
                  fontSize: "1.4rem",
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  marginBottom: "0.4rem",
                  fontFamily: "Inter, 'Noto Sans SC', sans-serif",
                }}
              >
                {tile.title}
              </h3>
              <div
                style={{
                  color: "rgba(255,255,255,0.28)",
                  fontSize: "0.75rem",
                  letterSpacing: "0.06em",
                  marginBottom: "1.8rem",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {tile.subtitle}
              </div>

              <p
                style={{
                  color: "rgba(255,255,255,0.42)",
                  fontSize: "0.875rem",
                  lineHeight: 1.75,
                  marginBottom: "2.5rem",
                  fontFamily: "Inter, 'Noto Sans SC', sans-serif",
                  fontWeight: 300,
                }}
              >
                {tile.description}
              </p>

              <div
                className="flex items-center gap-2 transition-all duration-200"
                style={{
                  color: hovered === i ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
                  fontSize: "0.875rem",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                <span>{tile.cta}</span>
                <span style={{ transform: hovered === i ? "translateX(4px)" : "translateX(0)", transition: "transform 0.2s" }}>→</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
