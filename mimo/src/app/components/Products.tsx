import { useState } from "react";

const products = [
  {
    id: "01",
    name: "MiMo-V2.5-Pro",
    tagline: "A leap in agentic and long horizon coherence.",
    description:
      "专为复杂长程任务设计，在代理能力和任务连贯性上实现突破性提升。支持超长上下文推理，专注多步骤目标拆解与执行。",
    tags: ["Agentic", "Long Context", "Reasoning"],
    badge: "Pro",
  },
  {
    id: "02",
    name: "MiMo-V2.5",
    tagline: "A leap in agency and multimodality.",
    description:
      "融合视觉与语言理解，赋予智能体感知多模态世界的能力。在图文理解、跨模态推理方面实现突破。",
    tags: ["Multimodal", "Vision", "Agency"],
    badge: null,
  },
  {
    id: "03",
    name: "MiMo-V2.5-TTS",
    tagline: "Give your agent a voice. Give it a soul.",
    description:
      "自然流畅的语音合成系列，让你的智能体不仅能思考，更能开口说话。支持多音色、多情感、多语言语音生成。",
    tags: ["TTS", "Voice", "Audio"],
    badge: "Series",
  },
];

export function Products() {
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
          产品矩阵
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px" style={{ background: "rgba(255,255,255,0.05)" }}>
          {products.map((product, i) => (
            <div
              key={product.id}
              className="relative p-9 cursor-pointer transition-all duration-300"
              style={{
                background: hovered === i ? "#161616" : "#0a0a0a",
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Number */}
              <div
                style={{
                  color: "rgba(255,255,255,0.12)",
                  fontSize: "0.7rem",
                  letterSpacing: "0.15em",
                  fontWeight: 700,
                  marginBottom: "2.5rem",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {product.id}
              </div>

              {/* Name + badge */}
              <div className="flex items-start gap-3 mb-3">
                <h3
                  style={{
                    color: "#ffffff",
                    fontSize: "1.15rem",
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                    lineHeight: 1.3,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  {product.name}
                </h3>
                {product.badge && (
                  <span
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.5)",
                      fontSize: "0.62rem",
                      padding: "0.15rem 0.45rem",
                      borderRadius: "2px",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      marginTop: "0.2rem",
                      flexShrink: 0,
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    {product.badge}
                  </span>
                )}
              </div>

              {/* Tagline */}
              <p
                style={{
                  color: "rgba(255,255,255,0.45)",
                  fontSize: "0.875rem",
                  lineHeight: 1.65,
                  marginBottom: "1.5rem",
                  fontFamily: "Inter, 'Noto Sans SC', sans-serif",
                  fontWeight: 400,
                }}
              >
                {product.tagline}
              </p>

              {/* Description */}
              <p
                style={{
                  color: "rgba(255,255,255,0.28)",
                  fontSize: "0.8rem",
                  lineHeight: 1.8,
                  fontFamily: "Inter, 'Noto Sans SC', sans-serif",
                  fontWeight: 300,
                  marginBottom: "2rem",
                }}
              >
                {product.description}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mt-auto">
                {product.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      color: "rgba(255,255,255,0.32)",
                      fontSize: "0.68rem",
                      padding: "0.22rem 0.55rem",
                      borderRadius: "2px",
                      letterSpacing: "0.06em",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Hover arrow */}
              <div
                className="absolute bottom-9 right-9 transition-all duration-300"
                style={{
                  color: hovered === i ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.1)",
                  fontSize: "1rem",
                }}
              >
                →
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
