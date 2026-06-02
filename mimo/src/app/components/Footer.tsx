export function Footer() {
  return (
    <footer
      className="px-8 py-10"
      style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <span
          style={{
            color: "#ffffff",
            fontWeight: 800,
            fontSize: "1.25rem",
            letterSpacing: "0.07em",
            fontFamily: "Inter, sans-serif",
          }}
        >
          MiMo
        </span>
        <span
          style={{
            color: "rgba(255,255,255,0.2)",
            fontSize: "0.72rem",
            fontFamily: "Inter, sans-serif",
            letterSpacing: "0.04em",
          }}
        >
          Copyright © 2010 – 2026 Xiaomi.
        </span>
      </div>
    </footer>
  );
}
