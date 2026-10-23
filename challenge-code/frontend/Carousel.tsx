import { useEffect, useState } from "react";

export interface Slide {
  src: string;
  alt: string;
}

export default function Carousel({ slides, intervalMs = 5000 }: { slides: Slide[]; intervalMs?: number }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;
  const go = (i: number) => setIndex(((i % count) + count) % count); // wraps both ways, even for negative i

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (paused || reduceMotion || count < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), intervalMs);
    return () => clearInterval(t); // restarts the timer whenever the user navigates or pauses
  }, [paused, count, intervalMs, index]);

  if (count === 0) return null;
  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(index - 1);
        if (e.key === "ArrowRight") go(index + 1);
      }}
      style={{ position: "relative", overflow: "hidden", maxWidth: 640 }}
    >
      <div style={{ display: "flex", transition: "transform 300ms", transform: `translateX(-${index * 100}%)` }}>
        {slides.map((s, i) => (
          <div key={s.src} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${count}`} aria-hidden={i !== index} style={{ flex: "0 0 100%" }}>
            {/* only the current and next images load eagerly */}
            <img src={s.src} alt={s.alt} loading={Math.abs(i - index) <= 1 ? "eager" : "lazy"} style={{ width: "100%", display: "block" }} />
          </div>
        ))}
      </div>
      <button onClick={() => go(index - 1)} aria-label="Previous slide">
        ‹
      </button>
      <button onClick={() => go(index + 1)} aria-label="Next slide">
        ›
      </button>
      <button onClick={() => setPaused((p) => !p)} aria-label={paused ? "Play" : "Pause"}>
        {paused ? "▶" : "⏸"}
      </button>
      <div role="tablist" aria-label="Choose slide">
        {slides.map((s, i) => (
          <button key={s.src} role="tab" aria-selected={i === index} aria-label={`Slide ${i + 1}`} onClick={() => go(i)}>
            •
          </button>
        ))}
      </div>
      <p aria-live={paused ? "polite" : "off"} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
        Slide {index + 1} of {count}: {slides[index].alt}
      </p>
    </section>
  );
}
