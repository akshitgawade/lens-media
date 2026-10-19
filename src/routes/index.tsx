import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, X } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ClientOnly } from "@/components/three/ClientOnly";
import { SceneCanvas } from "@/components/three/SceneCanvas";
import { useGsapContext } from "@/components/motion/gsap";
import { motionTokens } from "@/components/motion/motionConfig";

const LandingScene = lazy(() => import("@/components/three/LandingScene"));

function useSlideIn(dir: "left" | "right" = "left") {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { el.style.opacity = "1"; el.style.transform = "none"; return; }
    el.style.opacity = "0";
    el.style.transform = dir === "left" ? "translateX(-36px)" : "translateX(36px)";
    el.style.transition = "transform 700ms cubic-bezier(0.22,1,0.36,1), opacity 700ms ease-out";
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.style.opacity = "1"; el.style.transform = "translateX(0)"; obs.disconnect(); } }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [dir]);
  return ref;
}

const SIGNALS = [
  { n: "01", name: "Source Attribution", color: "var(--color-ink)", desc: "Who gets quoted — official voices (government, police, institutions) versus independent voices (residents, witnesses, advocates). The ratio shows whether a story centers institutional or community perspectives.", method: "/methodology#source-attribution" },
  { n: "02", name: "Agency Framing", color: "var(--accent)", desc: "Whether the text names actors directly or obscures them. Active construction names who did what; passive and agentless construction removes the actor from view.", method: "/methodology#agency-framing" },
  { n: "03", name: "Language Intensity", color: "var(--signal-amber)", desc: "Emotional load, certainty, and urgency in the writing. A zero means no matching intensity cues were detected — not that the article is neutral.", method: "/methodology#language-intensity" },
  { n: "04", name: "Perspective Coverage", color: "var(--signal-blue)", desc: "Which stakeholder groups appear across different outlets. Absence is a signal of breadth, not proof of editorial intent.", method: "/methodology#perspective-coverage" },
  { n: "05", name: "Headline Diff", color: "var(--signal-green)", desc: "How a headline changed between two snapshots — words added, removed, or reworded. Useful for tracking editorial revision.", method: "/methodology#headline-diff" },
  { n: "06", name: "Narrative Timeline", color: "var(--signal-violet)", desc: "When each stakeholder or angle first entered the coverage. Shows the sequence of narrative emergence across outlets.", method: "/methodology#narrative-timeline" },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Narrative Lens — See how coverage differs, measurably" },
      {
        name: "description",
        content:
          "Compare how outlets cover the same news event. Narrative Lens visualizes measurable changes in language, sourcing, emphasis, and perspective — never a verdict.",
      },
      { property: "og:title", content: "Narrative Lens — See how coverage differs, measurably" },
      {
        property: "og:description",
        content:
          "Compare how outlets cover the same news event. Narrative Lens visualizes measurable changes in language, sourcing, emphasis, and perspective — never a verdict.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const heroLeft = useSlideIn("left");
  const heroRight = useSlideIn("right");
  const tableRef = useSlideIn("left");
  const processRef = useSlideIn("left");
  const listRef = useRef<HTMLUListElement>(null);
  useGsapContext((gsap) => {
    if (!listRef.current) return;
    gsap.from(listRef.current.children, {
      y: 10,
      opacity: 0,
      duration: motionTokens.duration.base,
      ease: motionTokens.ease.smooth,
      stagger: 0.05,
      clearProps: "transform,opacity",
    });
  }, []);
  const sceneFallback = <div className="h-full w-full bg-secondary/10" aria-hidden />;
  return (
    <div>
      {/* ── HERO ── */}
      <section className="relative border-b border-rule">
        <div
          aria-hidden
          className="pointer-events-none absolute right-8 top-1/2 hidden h-[340px] w-[340px] -translate-y-1/2 overflow-hidden rounded-full border border-rule/10 bg-card/10 lg:block -z-10"
        >
          <ClientOnly fallback={sceneFallback}>
            <Suspense fallback={sceneFallback}>
              <SceneCanvas className="h-full w-full" style={{ background: "transparent" }} fallback={sceneFallback} quality="medium" sceneName="landing-aperture">
                <LandingScene />
              </SceneCanvas>
            </Suspense>
          </ClientOnly>
        </div>
        <div className="relative mx-auto max-w-7xl px-6 py-20 lg:py-28">
          <div ref={heroLeft} className="max-w-3xl">
            <h1 className="headline mt-6 text-5xl leading-[0.98] sm:text-6xl lg:text-7xl">
              See how the same story is <em className="text-accent not-italic">told differently</em>.
            </h1>
            <p className="mt-6 max-w-2xl font-serif text-xl leading-relaxed text-ink-muted">
              Instead of deciding what's true, Narrative Lens visualizes measurable
              changes in language, sourcing, emphasis, and perspective across outlets
              and over time.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                to="/analyze"
                className="group inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-accent"
              >
                Analyze coverage
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/methodology"
                className="inline-flex items-center gap-2 rounded-md border border-rule px-6 py-3 text-sm font-medium hover:bg-secondary"
              >
                How we measure
              </Link>
            </div>
          </div>
          <aside ref={heroRight} className="mt-12 lg:mt-0 lg:absolute lg:right-6 lg:top-1/2 lg:-translate-y-1/2 lg:w-72 lg:border-l lg:border-rule lg:pl-8">
            <p className="eyebrow">In this issue</p>
            <ul ref={listRef} className="mt-4 space-y-4 text-base">
              {SIGNALS.map(({ n, name }) => (
                <li key={n} className="flex gap-3 border-b border-rule pb-3">
                  <span className="font-mono text-sm text-ink-muted">{n}</span>
                  <span className="font-serif">{name}</span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      {/* ── THREE-STEP PROCESS ── */}
      <section className="border-b border-rule">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center">
          <p className="eyebrow">How it works</p>
          <h2 className="headline mt-3 text-3xl sm:text-4xl">Three steps to insight</h2>
          <p className="mt-3 mx-auto max-w-xl font-serif text-base text-ink-muted">
            From headline to evidence, in minutes.
          </p>

          <div ref={processRef} className="mt-12 grid gap-8 sm:grid-cols-3 sm:gap-6 lg:gap-10">
            {[
              { n: "01", title: "Gather", body: "Recent coverage is collected from selected outlets via RSS feeds and article extraction.", accent: "var(--signal-blue)" },
              { n: "02", title: "Measure", body: "The writing is examined through six comparable signals — sourcing, framing, tone, and more.", accent: "var(--color-ink)" },
              { n: "03", title: "Inspect", body: "You review differences, evidence, source articles, and limitations at your own pace.", accent: "var(--accent)" },
            ].map(({ n, title, body, accent }) => (
              <div key={n} className="relative text-center">
                <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-rule bg-card">
                  <span className="font-mono text-xs" style={{ color: accent }}>{n}</span>
                </div>
                <h3 className="headline text-xl">{title}</h3>
                <p className="mt-2 mx-auto max-w-xs font-serif text-sm leading-relaxed text-ink-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── THREE WAYS TO READ THIS TOOL ── */}
      <section className="border-b border-rule bg-secondary/20">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center">
          <p className="eyebrow">Your approach</p>
          <h2 className="headline mt-3 text-3xl sm:text-4xl">Three ways to read this tool</h2>
          <p className="mt-3 mx-auto max-w-xl font-serif text-base text-ink-muted">
            How you approach the results matters as much as the results themselves.
          </p>

          <div className="mt-10 grid gap-8 text-left sm:grid-cols-3 sm:gap-6 lg:gap-10">
            {[
              { n: "01", title: "Compare", accent: "var(--signal-blue)", body: "See how different outlets construct the same event differently. Comparison reveals pattern, not truth." },
              { n: "02", title: "Inspect", accent: "var(--color-ink)", body: "Open the underlying phrases, source evidence, scores, and article links. Every number comes from real text." },
              { n: "03", title: "Question", accent: "var(--accent)", body: "Treat patterns as signals to investigate, not as final judgments. Absence and emphasis both deserve scrutiny." },
            ].map(({ n, title, accent, body }) => (
              <div key={n} className="paper-card p-6 text-center">
                <div className="mx-auto mb-3 flex h-8 w-8 items-center justify-center rounded-full border border-rule bg-background">
                  <span className="font-mono text-[10px]" style={{ color: accent }}>{n}</span>
                </div>
                <h3 className="headline text-lg">{title}</h3>
                <p className="mt-2 font-serif text-sm leading-relaxed text-ink-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SIGNAL LENS SELECTOR ── */}
      <SignalLens />

      {/* ── YOUR TOOLKIT, NOT OUR VERDICT ── */}
      <section className="border-t border-rule">
        <div className="mx-auto max-w-5xl px-6 py-20 overflow-hidden">
          <div className="text-center">
            <h2 className="headline text-4xl sm:text-5xl">Your Toolkit, Not Our Verdict</h2>
            <p className="mt-4 mx-auto max-w-2xl text-ink-muted">
              Narrative Lens provides the instruments for your inspection, not the conclusions for your judgment.
            </p>
          </div>

          <div ref={tableRef} className="mt-10 will-change-transform transition-[transform,box-shadow] duration-[2000ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1.5 hover:shadow-[0_20px_40px_-16px_oklch(0.55_0.11_150/0.20),0_20px_40px_-16px_oklch(0.52_0.14_25/0.20),0_8px_20px_oklch(0_0_0/0.07)]">
            <div className="overflow-hidden rounded-md border border-rule">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-rule">
                  <th className="w-1/2 bg-success/10 px-6 py-4">
                    <p className="eyebrow text-success">We Surface</p>
                  </th>
                  <th className="w-1/2 bg-accent/10 px-6 py-4">
                    <p className="eyebrow text-accent">We Reject</p>
                  </th>
                </tr>
              </thead>
              <tbody className="font-serif text-base">
                {[
                  [
                    "Measurable Signals",
                    "Quantifiable data on language, sourcing, and framing for your analysis.",
                    "Binary Labels",
                    "We apply no \u201Cbiased\u201D or \u201Cpropaganda\u201D tags.",
                  ],
                  [
                    "Evidence",
                    "Raw materials provided for you to interpret.",
                    "AI Verdicts",
                    "We make no automated declarations of truth.",
                  ],
                  [
                    "Perspective Gaps",
                    "Visualizations highlighting what appears or is missing across outlets.",
                    "Spectrum Ratings",
                    "We offer no reductive left\u2013right scores.",
                  ],
                  [
                    "Narrative Evolution",
                    "Timelines tracking how headlines and framing shift over time.",
                    "Content Suppression",
                    "We engage in no flagging, downranking, or hiding of coverage.",
                  ],
                ].map(([surfaceTitle, surfaceBody, rejectTitle, rejectBody], i) => (
                  <tr key={i} className="border-b border-rule last:border-b-0">
                    <td className="bg-success/[0.06] px-6 py-4 align-top">
                      <div className="flex gap-3">
                        <Check className="mt-1 h-4 w-4 flex-shrink-0 text-success" />
                        <span>
                          <strong>{surfaceTitle}.</strong> <span className="text-ink-muted">{surfaceBody}</span>
                        </span>
                      </div>
                    </td>
                    <td className="bg-accent/[0.06] px-6 py-4 align-top">
                      <div className="flex gap-3">
                        <X className="mt-1 h-4 w-4 flex-shrink-0 text-accent" />
                        <span>
                          <strong>{rejectTitle}.</strong> <span className="text-ink-muted">{rejectBody}</span>
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="border-t border-rule">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="headline text-4xl">See coverage differently.</h2>
          <p className="mt-4 font-serif text-lg text-ink-muted">Enter a topic. Choose outlets. Read the signals for yourself.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/analyze" className="group inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-accent">Analyze coverage<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></Link>
            <Link to="/methodology" className="inline-flex items-center gap-2 rounded-md border border-rule px-6 py-3 text-sm font-medium hover:bg-secondary">How we measure</Link>
          </div>
        </div>
      </section>

    </div>
  );
}

/* ── Signal Lens: interactive six-signal selector ── */

function SignalLens() {
  const [active, setActive] = useState<number | null>(null);

  return (
    <section className="border-b border-rule">
      <div className="mx-auto max-w-5xl px-6 py-16 text-center">
        <p className="eyebrow">The six signals</p>
        <h2 className="headline mt-3 text-3xl sm:text-4xl">What each signal reveals</h2>
        <p className="mt-3 mx-auto max-w-xl font-serif text-base text-ink-muted">
          Select a signal to learn what it measures and why it matters.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {SIGNALS.map((s, i) => (
            <button
              key={s.n}
              type="button"
              onClick={() => setActive(active === i ? null : i)}
              className={`group inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-mono transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active === i
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-rule bg-card text-ink-muted hover:bg-secondary hover:text-ink"
              }`}
            >
              <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: s.color }} />
              {s.name}
            </button>
          ))}
        </div>

        {active !== null && (
          <div className="mx-auto mt-6 max-w-lg text-left animate-in fade-in duration-200">
            <div className="rounded-md border border-rule bg-card p-5">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[10px] tracking-wider text-ink-muted">{SIGNALS[active].n}</span>
                <h3 className="headline text-lg">{SIGNALS[active].name}</h3>
              </div>
              <p className="mt-2 font-serif text-sm leading-relaxed text-ink-muted">
                {SIGNALS[active].desc}
              </p>
              <div className="mt-3 border-t border-rule pt-3">
                <Link
                  to={SIGNALS[active].method}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
                >
                  Read the full methodology
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
