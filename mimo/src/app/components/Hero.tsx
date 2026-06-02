export function Hero() {
  const singlePass = "M I M O   ".repeat(25);
  const rowText = singlePass + singlePass;

  return (
    <section
      className="relative flex items-center justify-center overflow-hidden"
      style={{ height: "100vh", background: "#0a0a0a" }}
    >
      {/* Animated MIMO typographic background */}
      <div
        className="absolute inset-0 pointer-events-none select-none"
        style={{ overflow: "hidden" }}
      >
        {Array.from({ length: 24 }, (_, i) => (
          <div
            key={i}
            className="whitespace-nowrap"
            style={{
              color: "#ffffff",
              opacity: 0.042,
              fontSize: "2.6rem",
              letterSpacing: "0.55em",
              fontWeight: 800,
              lineHeight: "3.6rem",
              fontFamily: "Inter, sans-serif",
              animation: `${i % 2 === 0 ? "mimoScrollLeft" : "mimoScrollRight"} ${
                22 + i * 1.8
              }s linear infinite`,
            }}
          >
            {rowText}
          </div>
        ))}
      </div>

      {/* Center content */}
      <div className="relative z-10 text-center px-8">
        <h1
          style={{
            color: "#ffffff",
            fontSize: "clamp(2.5rem, 5vw, 4.5rem)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            marginBottom: "1rem",
            fontFamily: "Inter, 'Noto Sans SC', sans-serif",
          }}
        >
          你好，我是 MiMo
        </h1>
        <p
          style={{
            color: "rgba(255,255,255,0.38)",
            fontSize: "clamp(0.9rem, 2vw, 1.2rem)",
            fontWeight: 400,
            letterSpacing: "0.4em",
            textTransform: "uppercase",
            fontFamily: "Inter, sans-serif",
          }}
        >
          Hello, I'm MiMo
        </p>

        {/* Scroll indicator */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{ bottom: "-8rem" }}
        >
          <div
            style={{
              width: "1px",
              height: "3rem",
              background: "linear-gradient(to bottom, rgba(255,255,255,0.4), transparent)",
              margin: "0 auto",
            }}
          />
        </div>
      </div>
    </section>
  );
}
