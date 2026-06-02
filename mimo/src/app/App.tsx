import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { About } from "./components/About";
import { Products } from "./components/Products";
import { QuickAccess } from "./components/QuickAccess";
import { Blog } from "./components/Blog";
import { Careers } from "./components/Careers";
import { Footer } from "./components/Footer";

export default function App() {
  return (
    <div
      style={{
        background: "#0a0a0a",
        minHeight: "100vh",
        fontFamily: "Inter, 'Noto Sans SC', sans-serif",
        scrollBehavior: "smooth",
      }}
    >
      <Nav />
      <Hero />
      <About />
      <Products />
      <QuickAccess />
      <Blog />
      <Careers />
      <Footer />
    </div>
  );
}
