import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { methodFeatures } from "@/lib/methodology-data";
import { useReducedMotion } from "@/components/three/useReducedMotion";
import { getLenisInstance } from "@/components/motion/SmoothScrollProvider";

function FeatureCard({
  f, i, isExpanded, onToggle, cardRef, isActive,
}: {
  f: (typeof methodFeatures)[number]; i: number; isExpanded: boolean;
  onToggle: () => void; cardRef: (el: HTMLElement | null) => void;
  isActive: boolean;
}) {
  const slide = i % 2 === 0 ? "left" : "right";
  const innerRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = innerRef.current;
    if (!el || reduced) return;
    el.style.opacity = "0";
    el.style.translate = slide === "left" ? "-20px 0" : "20px 0";
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.style.opacity = "1"; el.style.translate = "0 0"; obs.disconnect(); } }, { threshold: 0.12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [slide, reduced]);
  return (
    <article id={f.id} ref={(el) => { cardRef(el); (innerRef as React.MutableRefObject<HTMLElement | null>).current = el; }}
      style={{ scrollMarginTop: "160px", transition: "translate 600ms cubic-bezier(0.22,1,0.36,1), opacity 600ms ease-out, box-shadow 350ms ease, border-color 350ms ease" }}
      className={`card-lift paper-card relative grid gap-6 overflow-hidden p-6 md:grid-cols-12 scroll-mt-[160px] ${isActive ? "border-l-2 border-l-accent/40" : ""} ${isExpanded ? "border-accent/20" : ""}`}><div className="md:col-span-3"><p className="section-number font-mono text-[11px] tracking-[0.2em]">{f.n}</p><h2 className="headline mt-1 text-2xl">{f.cardTitle}</h2><p className="mt-2 font-serif text-sm leading-relaxed text-ink-muted">{f.summary}</p></div><div className="md:col-span-9"><div className="flex items-start justify-between gap-4"><p className="font-serif text-sm leading-relaxed text-ink-muted">{f.what}</p>
          <button type="button" onClick={onToggle} aria-expanded={isExpanded} aria-controls={`panel-${f.id}`} aria-label={isExpanded ? `Collapse ${f.name}` : `Expand ${f.name}`} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-rule bg-card text-ink-muted hover:bg-secondary hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} /></button></div>
        {isExpanded && (<div id={`panel-${f.id}`} className="mt-4 space-y-4 rounded-md border border-rule bg-secondary/20 p-4 animate-in fade-in duration-200"><div><h4 className="font-semibold text-ink">What it measures</h4><p className="mt-1 font-serif text-sm leading-relaxed text-ink-muted">{f.why}</p></div><div><h4 className="font-semibold text-ink">How we calculate it</h4><p className="mt-1 font-serif text-sm leading-relaxed text-ink-muted">{f.how}</p></div><div><h4 className="font-semibold text-ink">How to read it</h4><p className="mt-1 font-serif text-sm leading-relaxed text-ink-muted">{f.interpret}</p></div>
            <div><h4 className="font-semibold text-ink">What it cannot prove</h4><p className="mt-1 font-serif text-sm leading-relaxed text-ink-muted">This signal describes a pattern in available text. It does not establish editorial motive, intent, or accuracy.</p></div>
            <div className="rounded-md bg-card px-3 py-2.5"><p className="font-mono text-xs text-ink-muted">In the dashboard</p><p className="mt-1 font-serif text-sm">{f.dashboard}</p></div></div>)}
      </div></article>
  );
}

type PhraseTag = { text: string; type: "active" | "passive" | "agentless" };
type SourceExample = { sentence: string; official: number | null; independent: number | null; status: "analyzed" | "no_evidence"; evidenceCount: number; note: string };
type AgencyExample = { sentence: string; isHeadline: boolean; score: number | null; displayScore: number; phrases: PhraseTag[]; note: string };
type IntensityExample = { sentence: string; headline: string; emotional: number | null; certainty: number | null; urgency: number | null; status: string; note: string };

const SOURCE_EXAMPLES: SourceExample[] = [
  { sentence: "Police said the order was approved.", official: 1.0, independent: 0.0, status: "analyzed", evidenceCount: 1, note: "One official voice (police) attributed with a speech verb." },
  { sentence: "Residents said they received no notice.", official: 0.0, independent: 1.0, status: "analyzed", evidenceCount: 1, note: "One independent voice (residents) attributed directly." },
  { sentence: "The mayor announced the policy, and residents described the impact.", official: 0.5, independent: 0.5, status: "analyzed", evidenceCount: 2, note: "One official (mayor) and one independent (residents) voice in the same article." },
  { sentence: "The city council met on Tuesday to discuss zoning changes.", official: null, independent: null, status: "no_evidence", evidenceCount: 0, note: "No attribution verb detected. The algorithm reports no evidence rather than guessing." },
];

const AGENCY_EXAMPLES: AgencyExample[] = [
  { sentence: "Police said the order was approved.", isHeadline: false, score: 0.92, displayScore: 93, phrases: [{ text: "Police said", type: "active" }], note: "Speech verb with a clear subject. The actor (police) is named." },
  { sentence: "Residents were removed from their homes by officers.", isHeadline: false, score: 0.15, displayScore: 28, phrases: [{ text: "Residents were removed from their homes", type: "passive" }], note: "Passive construction. The actor (officers) appears after 'by'." },
  { sentence: "40 families displaced before dawn.", isHeadline: true, score: 0.08, displayScore: 22, phrases: [{ text: "40 families displaced", type: "agentless" }], note: "Agentless headline. No actor is named at all." },
];

const INTENSITY_EXAMPLES: IntensityExample[] = [
  { sentence: "The shocking and tragic decision has left families devastated. Outrage erupted across the community.", headline: "", emotional: 0.68, certainty: 0.12, urgency: 0.08, status: "analyzed", note: "Strong emotional vocabulary: shocking, tragic, devastated, outrage." },
  { sentence: "The court confirmed the ruling. It is absolutely certain that the verdict stands. The judge declared the decision final.", headline: "", emotional: 0.05, certainty: 0.72, urgency: 0.04, status: "analyzed", note: "High-certainty language: confirmed, absolutely, certain, declared, final." },
  { sentence: "Breaking: emergency crews rushed to the scene. Crisis escalated rapidly as residents fled.", headline: "Breaking: Crisis Escalates Rapidly", emotional: 0.18, certainty: 0.06, urgency: 0.82, status: "analyzed", note: "Urgency signals: breaking, emergency, rushed, crisis, escalated, rapidly, fled." },
  { sentence: "The committee held a meeting on Tuesday. Members discussed the agenda items and reviewed the budget.", headline: "", emotional: 0.03, certainty: 0.05, urgency: 0.02, status: "analyzed", note: "Neutral, procedural language. All three dimensions score near zero." },
];

function BarSegment({ value, color, label }: { value: number; color: string; label: string }) {
  return (<div className="flex items-center gap-2"><span className="w-24 text-right font-mono text-xs text-ink-muted">{label}</span><div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden"><div className="h-full rounded-full" style={{ width: `${value * 100}%`, backgroundColor: color }} /></div><span className="w-12 text-left font-mono text-xs tabular-nums">{(value * 100).toFixed(0)}%</span></div>);
}

function ScoreBar({ value, max = 100, color = "var(--color-ink)" }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (<div className="h-2 w-full rounded-full bg-secondary overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} /></div>);
}

function DemoPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (<button type="button" onClick={onClick} className={`rounded-md border px-2.5 py-1 font-serif text-xs transition ${active ? "border-accent/40 bg-accent/10 font-semibold text-accent" : "border-rule bg-card text-ink-muted hover:bg-secondary"}`}>{children}</button>);
}

function SourceDemo() {
  const [idx, setIdx] = useState(0);
  const ex = SOURCE_EXAMPLES[idx];
  return (<div className="space-y-4"><div className="flex flex-wrap gap-1.5">{SOURCE_EXAMPLES.map((_, i) => (<DemoPill key={i} active={i === idx} onClick={() => setIdx(i)}>Example {i + 1}</DemoPill>))}</div><div className="rounded-md border border-rule bg-secondary/20 p-4"><p className="font-serif text-sm italic text-ink-muted">{"“"}{ex.sentence}{"”"}</p>{ex.status === "analyzed" ? (<div className="mt-3 space-y-2"><BarSegment value={ex.official ?? 0} color="oklch(0.19 0.015 60)" label="Official" /><BarSegment value={ex.independent ?? 0} color="var(--signal-violet, oklch(0.55 0.15 290))" label="Independent" /><p className="mt-2 font-mono text-xs text-ink-muted">{ex.evidenceCount} attributed voice{ex.evidenceCount !== 1 ? "s" : ""} detected</p></div>) : (<p className="mt-3 rounded-md border border-dashed border-rule bg-card px-3 py-2 text-sm italic text-ink-muted">No attributable voices found in the available text.</p>)}<p className="mt-3 font-serif text-xs leading-relaxed text-ink-muted">{ex.note}</p></div></div>);
}

function AgencyDemo() {
  const [idx, setIdx] = useState(0);
  const ex = AGENCY_EXAMPLES[idx];
  return (<div className="space-y-4"><div className="flex flex-wrap gap-1.5">{AGENCY_EXAMPLES.map((e, i) => (<DemoPill key={i} active={i === idx} onClick={() => setIdx(i)}>{e.isHeadline ? "Headline" : `Example ${i + 1}`}</DemoPill>))}</div><div className="rounded-md border border-rule bg-secondary/20 p-4"><p className="font-serif text-sm italic text-ink-muted">{"“"}{ex.sentence}{"”"}</p><div className="mt-3 flex items-center gap-3"><ScoreBar value={ex.displayScore} color="var(--color-ink)" /><span className="font-mono text-sm tabular-nums"><strong>{ex.displayScore}</strong><span className="text-ink-muted">/100</span></span></div><ul className="mt-3 space-y-1">{ex.phrases.map((p, i) => (<li key={i} className="text-sm"><span className={p.type === "active" ? "border-b-2 border-ink" : p.type === "passive" ? "bg-accent/10 border-b-2 border-accent" : "bg-muted/50 line-through decoration-ink-muted/50"}>{"“"}{p.text}{"”"}</span><span className="ml-1.5 font-mono text-[10px] uppercase text-ink-muted">{p.type}</span></li>))}</ul><p className="mt-3 font-serif text-xs leading-relaxed text-ink-muted">{ex.note}</p></div></div>);
}

function IntensityDemo() {
  const [idx, setIdx] = useState(0);
  const ex = INTENSITY_EXAMPLES[idx];
  return (<div className="space-y-4"><div className="flex flex-wrap gap-1.5">{INTENSITY_EXAMPLES.map((_, i) => (<DemoPill key={i} active={i === idx} onClick={() => setIdx(i)}>Example {i + 1}</DemoPill>))}</div><div className="rounded-md border border-rule bg-secondary/20 p-4">{ex.headline ? <p className="font-mono text-xs text-ink-muted">Headline: <span className="text-ink">{ex.headline}</span></p> : null}<p className={`font-serif text-sm italic text-ink-muted ${ex.headline ? "mt-2" : ""}`}>{"“"}{ex.sentence}{"”"}</p><div className="mt-3 space-y-2"><BarSegment value={ex.emotional ?? 0} color="var(--signal-rose, oklch(0.60 0.18 15))" label="Emotional" /><BarSegment value={ex.certainty ?? 0} color="var(--signal-blue, oklch(0.55 0.15 250))" label="Certainty" /><BarSegment value={ex.urgency ?? 0} color="var(--signal-amber, oklch(0.70 0.15 75))" label="Urgency" /></div><p className="mt-3 font-serif text-xs leading-relaxed text-ink-muted">{ex.note}</p></div></div>);
}

function SignalDemo() {
  const [tab, setTab] = useState<"source" | "agency" | "intensity">("source");
  const tabs = [{ key: "source" as const, label: "Source Attribution" }, { key: "agency" as const, label: "Agency Framing" }, { key: "intensity" as const, label: "Language Intensity" }];
  return (<section className="mt-10 paper-card overflow-hidden"><div className="border-b border-rule bg-secondary/30 px-6 py-4"><p className="eyebrow">See it in action</p><h2 className="headline mt-1 text-2xl">How the algorithms score real sentences</h2><p className="mt-2 font-serif text-sm text-ink-muted">Pre-computed examples from the same NLP pipeline that analyzes your articles. Click each example to see how the algorithm interprets different kinds of language.</p></div><div className="border-b border-rule px-6"><div className="flex gap-1 -mb-px">{tabs.map((t) => (<button key={t.key} type="button" onClick={() => setTab(t.key)} className={`px-3 py-2.5 font-serif text-sm border-b-2 transition ${tab === t.key ? "border-accent font-semibold text-accent" : "border-transparent text-ink-muted hover:text-ink"}`}>{t.label}</button>))}</div></div><div className="p-6">{tab === "source" && <SourceDemo />}{tab === "agency" && <AgencyDemo />}{tab === "intensity" && <IntensityDemo />}</div></section>);
}

const STORYLINE_SIGNALS = [
  { n: "01", name: "Source Attribution", short: "Source" },
  { n: "02", name: "Agency Framing", short: "Agency" },
  { n: "03", name: "Language Intensity", short: "Language" },
  { n: "04", name: "Perspective Coverage", short: "Perspective" },
  { n: "05", name: "Headline Diff", short: "Headlines" },
  { n: "06", name: "Narrative Timeline", short: "Timeline" },
];

export const Route = createFileRoute("/methodology")({
  head: () => ({ meta: [
    { title: "Methodology — Narrative Lens" },
    { name: "description", content: "How Narrative Lens measures sourcing, framing, tone, and coverage, and why every output is an observation, not a verdict." },
    { property: "og:title", content: "Methodology — Narrative Lens" },
    { property: "og:description", content: "Plain-language explanations of each signal we surface." },
  ] }),
  component: MethodologyPage,
});

function MethodologyPage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const reducedMotion = useReducedMotion();
  const cardRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const NAV_BOTTOM = 65 + 48;
    let ticking = false;
    const update = () => {
      ticking = false;
      const cards = cardRefs.current.filter(Boolean) as HTMLElement[];
      if (!cards.length) return;
      const scrollY = window.scrollY;
      const triggerPoint = scrollY + NAV_BOTTOM + 24;
      let best = 0; let bestDist = Infinity;
      for (let i = 0; i < cards.length; i++) {
        const rect = cards[i].getBoundingClientRect();
        const dist = Math.abs(rect.top + scrollY - triggerPoint);
        if (dist < bestDist) { bestDist = dist; best = i; }
      }
      setActiveIndex(best);
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToCard = (index: number) => {
    setActiveIndex(index);
    const el = document.getElementById(methodFeatures[index].id);
    if (!el) return;
    const headerOffset = 160;
    const lenis = getLenisInstance() as unknown as { scrollTo?: (t: HTMLElement, o?: { offset?: number; immediate?: boolean }) => void } | null;
    if (lenis?.scrollTo && !reducedMotion) {
      lenis.scrollTo(el, { offset: -headerOffset });
    } else {
      const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top, behavior: reducedMotion ? "instant" as ScrollBehavior : "smooth" as ScrollBehavior });
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-20">
      <div className="text-center">
        <p className="eyebrow">Methodology</p>
        <h1 className="headline mt-3 text-5xl">Observations, not verdicts.</h1>
        <p className="mt-4 mx-auto max-w-2xl font-serif text-lg leading-relaxed text-ink-muted">
          Narrative Lens examines coverage from six angles. Each signal is an observation about language, sourcing, or framing &mdash; not a conclusion about intent or truth.
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-3xl border-l-2 border-accent/60 bg-secondary/40 px-6 py-5">
        <p className="eyebrow">Interpretive lens</p>
        <p className="mt-2 font-serif text-base leading-relaxed text-ink-muted">
          These signals are inspired by decades of media framing scholarship, including Herman &amp; Chomsky&apos;s <em>Propaganda Model</em>, Entman&apos;s framing theory, and journalism ethics on sourcing and agency. We treat these frameworks as interpretive lenses, not as the truth about any specific article.
        </p>
      </div>

      <SignalDemo />

      <nav aria-label="Methodology features" className="sticky top-[65px] z-10 -mx-6 mt-10 border-y border-rule/40 bg-background/90 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        {/* Desktop: storyline + feature buttons */}
        <div className="hidden lg:block">
          {/* Storyline rail */}
          <div className="relative mx-auto max-w-3xl mb-1">
            <div className="absolute top-5 left-0 right-0 h-px bg-rule" />
            <div className="absolute top-5 left-0 h-px bg-accent transition-all duration-500" style={{ width: `${(activeIndex / (STORYLINE_SIGNALS.length - 1)) * 100}%` }} />
            <div className="relative flex justify-between">
              {STORYLINE_SIGNALS.map((s, i) => {
                const isActive = i === activeIndex;
                const isVisited = i < activeIndex;
                return (
                  <button key={s.n} type="button" onClick={() => scrollToCard(i)}
                    className="group flex flex-col items-center gap-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1 py-0.5"
                    aria-label={`Go to ${s.name}`}>
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${isActive ? "border-accent bg-accent/10 text-accent scale-110" : isVisited ? "border-accent/40 bg-accent/5 text-accent/60" : "border-rule bg-card text-ink-muted group-hover:border-ink/30"}`}>
                      <span className="font-mono text-[10px] font-semibold">{s.n}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          {/* Feature buttons — directly below circles */}
          <div className="flex gap-2 -mt-0.5">
            {methodFeatures.map((f, i) => (
              <button key={f.id} type="button" onClick={() => scrollToCard(i)} aria-current={activeIndex === i ? "true" : undefined}
                className={`min-w-0 flex-1 text-left font-serif text-sm leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${activeIndex === i ? "font-semibold text-accent" : "font-normal text-ink-muted hover:text-ink"}`}>
                {f.name}
              </button>
            ))}
          </div>
        </div>
        {/* Mobile: horizontal scroll buttons */}
        <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden" style={{ scrollbarWidth: "thin" }}>
          {methodFeatures.map((f, i) => (
            <button key={f.id} type="button" onClick={() => scrollToCard(i)} aria-current={activeIndex === i ? "true" : undefined}
              className={`shrink-0 rounded-md border px-3 py-1.5 text-left font-serif text-xs leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeIndex === i ? "border-accent/40 bg-accent/10 font-semibold text-accent" : "border-rule bg-card text-ink-muted"}`}>
              {f.name}
            </button>
          ))}
        </div>
      </nav>

      <div className="mt-10 space-y-6">{methodFeatures.map((f, i) => (<FeatureCard key={f.id} f={f} i={i} isExpanded={expanded === i} onToggle={() => setExpanded(expanded === i ? null : i)} cardRef={(el) => { cardRefs.current[i] = el; }} isActive={activeIndex === i} />))}</div>

      <section className="mt-16 overflow-hidden rounded-lg border border-rule bg-card">
        <div className="border-b border-rule bg-secondary/30 px-6 py-4 text-center"><p className="eyebrow">Important context</p><h2 className="headline mt-1 text-2xl">What this can and cannot tell you</h2></div>
        <div className="grid gap-0 sm:grid-cols-2">
          {[
            { n: "01", title: "No quote detected does not mean no viewpoint exists.", body: "Our attribution detection relies on explicit cues like \"said\" or \"according to.\" Absence of a detected source is an observation about the text, not a claim about the article\u2019s perspective." },
            { n: "02", title: "High intensity does not mean an article is false.", body: "Emotional, certain, or urgent language is common in legitimate journalism. Human-interest reporting is often high-emotion by design. These scores describe tone, not accuracy." },
            { n: "03", title: "Missing coverage is not proof of editorial intent.", body: "If a stakeholder group does not appear in an outlet\u2019s coverage, it may reflect the outlet\u2019s beat, available sources, or the article\u2019s scope. Absence is a signal to investigate, not a conclusion." },
            { n: "04", title: "Scores summarize available text, not editorial motives.", body: "NLP scoring is approximate. Irony, idiom, and very short texts are often misread. Headline snapshots depend on live pages and public archives. Our samples are illustrative." },
          ].map(({ n, title, body }) => (
            <div key={n} className="border-b sm:border-b-0 sm:border-r border-rule p-6 last:border-0 hover:bg-secondary/20 transition-colors"><p className="font-mono text-xs text-accent">{n}</p><h3 className="headline mt-1 text-lg">{title}</h3><p className="mt-2 font-serif text-sm leading-relaxed text-ink-muted">{body}</p></div>
          ))}
        </div>
      </section>

      <div className="mt-16 text-center">
        <p className="font-serif text-lg text-ink-muted">Ready to see how outlets differ?</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/analyze" className="group inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-accent">Analyze coverage</Link>
          <Link to="/" className="inline-flex items-center gap-2 rounded-md border border-rule px-6 py-3 text-sm font-medium hover:bg-secondary">Back to home</Link>
        </div>
      </div>
    </div>
  );
}