import { useState } from "react";

export function Nav() {
  const [lang, setLang] = useState<"zh" | "en">("zh");

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4"
      style={{
        background: "rgba(10,10,10,0.88)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <div className="flex items-center">
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontWeight: 800,
            fontSize: "1.35rem",
            color: "#fff",
            letterSpacing: "0.06em",
          }}
        >
          MiMo
        </span>
      </div>

      <div className="flex items-center gap-8">
        <a
          href="#blog"
          className="transition-colors"
          style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.875rem", fontWeight: 400 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.9)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
        >
          Blog
        </a>
        <a
          href="#careers"
          className="transition-colors"
          style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.875rem", fontWeight: 400 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.9)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
        >
          加入我们
        </a>
        <div
          className="flex items-center gap-0.5 rounded-full p-1"
          style={{ border: "1px solid rgba(255,255,255,0.15)" }}
        >
          <button
            onClick={() => setLang("en")}
            className="rounded-full transition-all duration-200"
            style={{
              padding: "0.2rem 0.65rem",
              fontSize: "0.72rem",
              fontWeight: 500,
              letterSpacing: "0.03em",
              background: lang === "en" ? "#ffffff" : "transparent",
              color: lang === "en" ? "#0a0a0a" : "rgba(255,255,255,0.45)",
            }}
          >
            EN
          </button>
          <button
            onClick={() => setLang("zh")}
            className="rounded-full transition-all duration-200"
            style={{
              padding: "0.2rem 0.65rem",
              fontSize: "0.72rem",
              fontWeight: 500,
              letterSpacing: "0.03em",
              background: lang === "zh" ? "#ffffff" : "transparent",
              color: lang === "zh" ? "#0a0a0a" : "rgba(255,255,255,0.45)",
            }}
          >
            中文
          </button>
        </div>
      </div>
    </nav>
  );
}
