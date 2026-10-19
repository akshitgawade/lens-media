import { useState, useEffect, useCallback } from "react";

const SIGNALS = [
  { id: "source-attribution", label: "Source Attribution", n: "01" },
  { id: "agency-framing", label: "Agency Framing", n: "02" },
  { id: "language-intensity", label: "Language Intensity", n: "03" },
  { id: "perspective-coverage", label: "Coverage Matrix", n: "04" },
  { id: "headline-diff", label: "Headline Diff", n: "05" },
  { id: "narrative-timeline", label: "Timeline", n: "06" },
];

export function SignalNav() {
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleClick = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const offset = 120; // account for header (65px) + signal nav (~48px) + buffer
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, []);

  // Track which section is currently in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => {
            const aTop = a.boundingClientRect.top;
            const bTop = b.boundingClientRect.top;
            return Math.abs(aTop - 80) - Math.abs(bTop - 80);
          });
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { threshold: 0.1, rootMargin: "-80px 0px -40% 0px" }
    );

    // Observe all signal sections
    for (const sig of SIGNALS) {
      const el = document.getElementById(sig.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <nav
      aria-label="Signal sections"
      className="sticky top-[65px] z-10 -mx-6 border-y border-rule/40 bg-background/90 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/75"
    >
      <div className="overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
      <div className="mx-auto flex w-max min-w-full justify-center gap-1 py-2">
        {SIGNALS.map((sig) => (
          <button
            key={sig.id}
            type="button"
            onClick={() => handleClick(sig.id)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-left font-serif text-xs leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeId === sig.id
                ? "border border-accent/40 bg-accent/10 font-semibold text-accent"
                : "border border-transparent text-ink-muted hover:text-ink hover:bg-secondary/50"
            }`}
          >
            <span className="font-mono text-[10px] text-ink-muted mr-1">{sig.n}</span>
            {sig.label}
          </button>
        ))}
      </div>
      </div>
    </nav>
  );
}
