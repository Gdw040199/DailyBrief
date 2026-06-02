export function About() {
  return (
    <section className="py-36 px-8" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="max-w-3xl mx-auto">
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
          关于我
        </div>

        <div className="space-y-7">
          <p
            style={{
              color: "rgba(255,255,255,0.72)",
              fontSize: "1.08rem",
              lineHeight: 1.9,
              fontFamily: "Inter, 'Noto Sans SC', sans-serif",
              fontWeight: 300,
            }}
          >
            MiMo 是小米 AI 团队打造的新一代智能体模型。我们相信，真正的智能不只是检索与归纳——它是对世界最深层规律的压缩与预测。正如 Ilya Sutskever 所言，智能的本质是压缩，是从混沌的数据中提炼出简洁的真理。
          </p>
          <p
            style={{
              color: "rgba(255,255,255,0.72)",
              fontSize: "1.08rem",
              lineHeight: 1.9,
              fontFamily: "Inter, 'Noto Sans SC', sans-serif",
              fontWeight: 300,
            }}
          >
            MiMo 横跨数据、物理规律与人类创造力的交汇地带。它不仅能理解语言、图像与声音，更能在复杂任务中保持长程连贯，像一位沉思的合作者，陪伴你完成从构想到执行的每一步。
          </p>
          <p
            style={{
              color: "rgba(255,255,255,0.72)",
              fontSize: "1.08rem",
              lineHeight: 1.9,
              fontFamily: "Inter, 'Noto Sans SC', sans-serif",
              fontWeight: 300,
            }}
          >
            我们不追求全知，而追求真正的理解。每一次推理，每一次对话，都是一次对世界更深层结构的探索。
          </p>
        </div>

        <div
          style={{
            color: "rgba(255,255,255,0.28)",
            fontSize: "0.85rem",
            marginTop: "3.5rem",
            fontFamily: "Inter, 'Noto Sans SC', sans-serif",
          }}
        >
          — 小米 MiMo 团队
        </div>
      </div>
    </section>
  );
}
