import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState, useEffect } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, HelpCircle, Loader2 } from "lucide-react";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ExtractionBadge } from "@/components/dashboard/ExtractionBadge";
import { SignalInterpretation, HowToReadPanel } from "@/components/dashboard/SignalInterpretation";
import { OutletComparison } from "@/components/dashboard/OutletComparison";
import { NoHeadlineSnapshotsEmpty, NoStakeholdersEmpty } from "@/components/dashboard/EmptyStates";
import { SignalNav } from "@/components/dashboard/SignalNav";

import { analyzeArticle, fetchEventBundle, isEventSaved, saveAnalysis, unsaveAnalysis, type EventBundle, type Phrase } from "@/lib/narrative-data";

export const Route = createFileRoute("/_authenticated/dashboard/$eventId")({
  head: () => ({
    meta: [
      { title: "Coverage dashboard — Narrative Lens" },
      { name: "description", content: "Compare how outlets cover the same event, signal by signal." },
      { property: "og:title", content: "Coverage dashboard — Narrative Lens" },
      { property: "og:description", content: "Compare outlet coverage across measurable signals." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { eventId } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["event-bundle", eventId],
    queryFn: () => fetchEventBundle(eventId),
  });

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-24 text-ink-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading coverage…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24">
        <p className="eyebrow">Error</p>
        <h1 className="headline mt-2 text-3xl">Couldn't load this event.</h1>
        <Link to="/analyze" className="mt-4 inline-block text-accent underline">
          Back to Analyze
        </Link>
      </div>
    );
  }

  return <DashboardBody bundle={data} eventId={eventId} />;
}

function DashboardBody({ bundle, eventId }: { bundle: EventBundle; eventId: string }) {
  const { event, outlets, articles, snapshots, stakeholders, signals } = bundle;
  const queryClient = useQueryClient();
  const [reanalyzing, setReanalyzing] = useState<string | null>(null);
  const [highlightedOutlet, setHighlightedOutlet] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [saving, setSaving] = useState(false);

  // Check if this event is already saved
  useEffect(() => {
    isEventSaved(eventId).then(setSaved).catch(() => {});
  }, [eventId]);
  const sourceArticlesRef = useRef<HTMLDivElement>(null);
  const leftColRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);

  // Auto-clear highlight after 2s fade
  useEffect(() => {
    if (!highlightedOutlet) return;
    const t = setTimeout(() => setHighlightedOutlet(null), 2000);
    return () => clearTimeout(t);
  }, [highlightedOutlet]);

  // Phase 3: subtle scroll parallax (respects reduced-motion, desktop only)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let ticking = false;
    const onScroll = () => {
      if (window.innerWidth < 1024) return;
      if (!ticking) {
        requestAnimationFrame(() => {
          const y = window.scrollY;
          if (leftColRef.current) leftColRef.current.style.transform = `translateY(${y * 0.015}px)`;
          if (rightColRef.current) rightColRef.current.style.transform = `translateY(${y * -0.008}px)`;
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const outletById = useMemo(
    () => Object.fromEntries(outlets.map((o) => [o.id, o])),
    [outlets],
  );

  // Aggregate signals by outlet (average if outlet has multiple articles)
  const sourceByOutlet = useMemo(() => {
    const map = new Map<string, { official: number; independent: number; count: number; articleCount: number }>();
    for (const article of articles) {
      const name = outletById[article.outlet_id]?.name ?? article.outlet_id;
      if (!map.has(name)) map.set(name, { official: 0, independent: 0, count: 0, articleCount: 0 });
      map.get(name)!.articleCount += 1;
    }
    for (const r of signals.source_attribution) {
      const art = articles.find((a) => a.id === r.article_id);
      if (!art) continue;
      const name = outletById[art.outlet_id]?.name ?? art.outlet_id;
      const existing = map.get(name) ?? { official: 0, independent: 0, count: 0, articleCount: 0 };
      if (r.official_ratio !== null && r.independent_ratio !== null && r.analysis_status !== "legacy_unknown") {
        existing.official += r.official_ratio;
        existing.independent += r.independent_ratio;
        existing.count += 1;
      }
      map.set(name, existing);
    }
    return Array.from(map.entries()).map(([outlet, v]) => ({
      outlet,
      official: v.count ? Math.round((v.official / v.count) * 100) : 0,
      independent: v.count ? Math.round((v.independent / v.count) * 100) : 0,
      hasEvidence: v.count > 0,
      evidenceCount: v.count,
      noEvidence: v.count > 0 ? 0 : 100,
    }));
  }, [signals.source_attribution, articles, outletById]);

  const agencyByOutlet = useMemo(() => {
    const map = new Map<string, { score: number; phrases: Phrase[]; count: number }>();
    for (const r of signals.agency_framing) {
      if (r.analysis_status === "no_evidence") continue;
      if (r.agency_score === null) continue;
      const art = articles.find((a) => a.id === r.article_id);
      if (!art) continue;
      const name = outletById[art.outlet_id]?.name ?? art.outlet_id;
      const phrases = r.example_phrases.map((p: any) =>
        typeof p === 'string' ? { text: p, type: 'active' as const } : p
      );
      const existing = map.get(name);
      if (existing) {
        existing.score += r.agency_score;
        existing.phrases.push(...phrases);
        existing.count += 1;
      } else {
        map.set(name, { score: r.agency_score, phrases, count: 1 });
      }
    }
    return Array.from(map.entries())
      .map(([outlet, v]) => ({
        outlet,
        // Scale 0-1 → 15-100
        score: Math.round(15 + ((v.score / v.count) * 85)),
        phrases: v.phrases.slice(0, 3),
      }))
      .sort((a, b) => b.score - a.score);
  }, [signals.agency_framing, articles, outletById]);

  const intensityByOutlet = useMemo(() => {
    const map = new Map<string, { emotional: number; certainty: number; urgency: number; count: number }>();
    for (const r of signals.language_intensity) {
      if (r.analysis_status === "no_evidence") continue;
      if (r.emotional_score === null || r.certainty_score === null || r.urgency_score === null) continue;
      const art = articles.find((a) => a.id === r.article_id);
      if (!art) continue;
      const name = outletById[art.outlet_id]?.name ?? art.outlet_id;
      const existing = map.get(name);
      if (existing) {
        existing.emotional += r.emotional_score;
        existing.certainty += r.certainty_score;
        existing.urgency += r.urgency_score;
        existing.count += 1;
      } else {
        map.set(name, { emotional: r.emotional_score, certainty: r.certainty_score, urgency: r.urgency_score, count: 1 });
      }
    }
    return Array.from(map.entries()).map(([outlet, v]) => ({
      outlet,
      // Preserve the real 0-100 intensity scale. Zero means no matching
      // intensity cues were detected; it is not a missing or default value.
      Emotional: Math.round((v.emotional / v.count) * 100),
      Certainty: Math.round((v.certainty / v.count) * 100),
      Urgency: Math.round((v.urgency / v.count) * 100),
    }));
  }, [signals.language_intensity, articles, outletById]);
  // Keep every article/outlet visible. A missing signal is evidence about the
  // text, not a reason to erase that outlet from the rest of the dashboard.
  const validOutletNames = useMemo(() => {
    return new Set(outlets.map((outlet) => outlet.name));
  }, [outlets]);
  const displaySourceByOutlet = useMemo(() => sourceByOutlet.filter((r) => validOutletNames.has(r.outlet)), [sourceByOutlet, validOutletNames]);
  const displayAgencyByOutlet = useMemo(() => agencyByOutlet.filter((r) => validOutletNames.has(r.outlet)), [agencyByOutlet, validOutletNames]);
  const displayIntensityByOutlet = useMemo(() => intensityByOutlet.filter((r) => validOutletNames.has(r.outlet)), [intensityByOutlet, validOutletNames]);
  const displayOutlets = useMemo(() => outlets.filter((o) => validOutletNames.has(o.name)), [outlets, validOutletNames]);
  const displayArticles = useMemo(() => articles.filter((a) => validOutletNames.has(outletById[a.outlet_id]?.name ?? "")), [articles, validOutletNames, outletById]);
  const hasSourceData = articles.length > 0;
  const hasAgencyData = articles.length > 0;
  const hasIntensityData = articles.length > 0;

  const articlesByOutlet = useMemo(() => {
    const map: Record<string, EventBundle["articles"]> = {};
    for (const a of articles) {
      (map[a.outlet_id] ??= []).push(a);
    }
    return map;
  }, [articles]);
  const publishedRange = useMemo(() => {
    const dates = articles.map((a) => new Date(a.published_at).getTime()).filter((n) => !Number.isNaN(n));
    const eventTime = new Date(event.first_reported_at).getTime();
    if (dates.length === 0) {
      const d = Number.isNaN(eventTime) ? new Date() : new Date(eventTime);
      return { min: d, max: d };
    }
    const min = new Date(Math.min(...dates, eventTime));
    const max = new Date(Math.max(...dates));
    return { min, max };
  }, [articles, event]);

  return (
    <TooltipProvider delayDuration={150}>

    <div className="mx-auto max-w-7xl px-6 py-10">
      {/* Masthead — editorial reading room */}
      <div className="pb-6 text-center">
        <h1 className="headline mt-4 text-4xl leading-[1.05] sm:text-5xl lg:text-6xl mx-auto max-w-4xl">
          {event.title}
        </h1>
        {event.summary ? (
          <p className="mt-4 mx-auto max-w-3xl font-serif text-base leading-relaxed text-ink-muted">
            {event.summary}
          </p>
        ) : null}
        <div className="mt-4 space-y-2 text-sm">
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="eyebrow mr-1 text-xs">Outlets:</span>
            {displayOutlets.map((o) => {
              const tierLabel: Record<string, string> = {
                tier_1: "legacy",
                tier_2: "established",
                tier_3: "digital",
                mass_market: "mass",
                business: "business",
                regional: "regional",
              };
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    setHighlightedOutlet(o.id);
                    requestAnimationFrame(() => {
                      const firstArt = articles.find((a) => a.outlet_id === o.id);
                      if (firstArt) {
                        const el = document.getElementById(`article-${firstArt.id}`);
                        if (el) {
                          const rect = el.getBoundingClientRect();
                          const scrollTo = window.scrollY + rect.top - (window.innerHeight / 2) + (rect.height / 2);
                          window.scrollTo({ top: Math.max(0, scrollTo), behavior: "smooth" });
                        }
                      }
                    });
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-rule bg-card px-3 py-1.5 text-xs font-medium transition hover:bg-secondary hover:shadow-sm"
                >
                  {o.name}
                  {o.authority_tier ? (
                    <span className="text-[10px] text-ink-muted">{tierLabel[o.authority_tier] ?? o.authority_tier}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          {/* Dateline-style range display */}
          <div className="mt-3 flex items-center justify-center gap-3">
            <div className="flex items-baseline gap-1.5 rounded-md border border-rule bg-secondary/50 px-3 py-1.5">
              <span className="font-serif text-sm text-ink">{new Date(publishedRange.min).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
              <span className="font-mono text-[10px] text-ink-muted">{new Date(publishedRange.min).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <span className="text-accent font-serif text-lg">—</span>
            <div className="flex items-baseline gap-1.5 rounded-md border border-rule bg-secondary/50 px-3 py-1.5">
              <span className="font-serif text-sm text-ink">{new Date(publishedRange.max).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
              <span className="font-mono text-[10px] text-ink-muted">{new Date(publishedRange.max).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Re-analyze controls — compact, after coverage brief */}
      <div className="mt-4 mb-2 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              if (saved) {
                await unsaveAnalysis(eventId);
                setSaved(false);
              } else {
                await saveAnalysis(eventId);
                setSaved(true);
              }
            } catch (err) {
              console.error(err);
            } finally {
              setSaving(false);
            }
          }}
          className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition hover:shadow-sm ${
            saved
              ? "border-accent/40 bg-accent/10 text-accent"
              : "border-rule bg-card text-ink-muted hover:bg-secondary"
          }`}
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          {saved ? "Saved" : "Save to account"}
        </button>
        <span className="eyebrow mr-1">Re-run analysis:</span>
        {displayOutlets.map((outlet) => {
          const outletArticles = articles.filter((a) => a.outlet_id === outlet.id);
          if (outletArticles.length === 0) return null;
          return (
            <button
              key={outlet.id}
              type="button"
              disabled={reanalyzing === outlet.id}
              onClick={async () => {
                setReanalyzing(outlet.id);
                try {
                  for (const art of outletArticles) {
                    const text = art.full_text || art.headline;
                    await analyzeArticle(art.id, text, art.outlet_id, !art.full_text);
                  }
                  queryClient.invalidateQueries({ queryKey: ["event-bundle", eventId] });
                } catch (err) {
                  console.error(err);
                } finally {
                  setReanalyzing(null);
                }
              }}
              className="inline-flex items-center gap-1 rounded-md border border-rule bg-card px-3 py-1.5 text-xs font-medium transition hover:bg-secondary hover:shadow-sm disabled:opacity-60"
            >
              {reanalyzing === outlet.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : null}
              {outlet.name}
            </button>
          );
        })}
      </div>

      <SignalNav />

      {/* Two-column newspaper grid */}
      <div className="mt-10 grid gap-8 lg:grid-cols-12">
        {/* LEFT column */}
        <div ref={leftColRef} className="space-y-10 lg:col-span-7 will-change-transform">
          {hasSourceData ? (
            <SectionCard slide="left" n="01" id="source-attribution" title="Source Attribution Ratio" caption="Who is quoted — official versus independent voices, per outlet." tip="Who gets quoted: official voices vs. independent voices.">
              <SourceAttributionChart rows={displaySourceByOutlet} highlightedOutlet={highlightedOutlet} />
              <SignalInterpretation signal="source" data={displaySourceByOutlet} />
              <HowToReadPanel signal="source" />
            </SectionCard>
          ) : null}

          {hasIntensityData ? (
            <SectionCard slide="left" n="03" id="language-intensity" title="Language Intensity" caption="Emotional load, certainty, and urgency in the writing, per outlet." tip="Emotional load, certainty, and urgency in language.">
              <LanguageIntensityChart rows={displayIntensityByOutlet} highlightedOutlet={highlightedOutlet} />
              <SignalInterpretation signal="intensity" data={displayIntensityByOutlet} />
              <HowToReadPanel signal="intensity" />
            </SectionCard>
          ) : null}

          <SectionCard slide="left" n="04" id="perspective-coverage" title="Perspective Coverage Matrix" caption="Which stakeholders are represented in each outlet's coverage." tip="Which stakeholders each outlet includes.">
            {stakeholders.length === 0 ? <NoStakeholdersEmpty /> : <CoverageMatrix
              stakeholders={stakeholders}
              outlets={displayOutlets}
              articlesByOutlet={articlesByOutlet}
              coverage={signals.coverage_matrix}
              highlightedOutlet={highlightedOutlet}
            />}
              <SignalInterpretation signal="coverage" data={{ stakeholders, outlets, coverage: signals.coverage_matrix }} />
              <HowToReadPanel signal="coverage" />
          </SectionCard>
        </div>

        {/* RIGHT column */}
        <div ref={rightColRef} className="space-y-10 lg:col-span-5 will-change-transform">
          {hasAgencyData ? (
            <SectionCard slide="right" n="02" id="agency-framing" title="Agency Framing" caption="Active vs. passive/agentless sentence construction — with example phrases." tip="How directly the text assigns responsibility.">
              <AgencyFraming rows={displayAgencyByOutlet} highlightedOutlet={highlightedOutlet} />
              <SignalInterpretation signal="agency" data={displayAgencyByOutlet} />
              <HowToReadPanel signal="agency" />
            </SectionCard>
          ) : null}

          <SectionCard slide="right" n="05" id="headline-diff" title="Headline Diff · FrameShift Replay" caption="How the headline changed between two snapshots." tip="How the headline changed over time.">
            {snapshots.length === 0 ? <NoHeadlineSnapshotsEmpty /> : <HeadlineDiff
              articles={articles}
              outletById={outletById}
              snapshots={snapshots}
            />}
          </SectionCard>

          <SectionCard slide="right" n="06" id="narrative-timeline" title="Narrative Evolution Timeline" caption="When each stakeholder or angle first entered the coverage." tip="When each stakeholder or angle first entered the coverage.">
            <NarrativeTimeline stakeholders={stakeholders} />
          </SectionCard>
        </div>
      </div>

      {/* Source Articles — full-width, always at bottom */}
      <div ref={sourceArticlesRef} className="mt-10">
        <SectionCard slide="left" n="" title="Source Articles" caption="Links to the original coverage from each outlet." tip="Original source links for each outlet's coverage.">
          <div className="space-y-5">
            {displayArticles.map((art) => {
              const outletName = outletById[art.outlet_id]?.name ?? "Unknown";
              const isHighlighted = highlightedOutlet === art.outlet_id;
              return (
                <div
                  key={art.id}
                  id={`article-${art.id}`}
                  className={`border-b border-rule pb-4 last:border-0 transition-all duration-500 ${
                    isHighlighted
                      ? "bg-accent/10 -mx-2 px-2 py-2 rounded-md shadow-sm"
                      : highlightedOutlet
                        ? "opacity-40"
                        : ""
                  }`}
                >
                  <div className="flex items-center gap-2"><p className="font-mono text-xs font-bold uppercase text-ink">{outletName}</p><ExtractionBadge quality={art.extraction_quality} /></div>
                  <a
                    href={art.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block font-serif text-base text-ink-muted hover:text-ink hover:underline"
                  >
                    {art.headline}
                  </a>
                </div>
              );
            })}
          </div>
        </SectionCard>      </div>

      {/* Actions + comparison — below source articles */}
      <div className="mt-8 flex flex-col items-center gap-4">
        <DashboardActions eventId={eventId} bundle={bundle} />
        <button type="button" onClick={() => setShowComparison(!showComparison)}
          className="inline-flex items-center gap-1.5 rounded-md border border-rule bg-card px-3 py-1.5 text-xs font-mono text-ink-muted transition hover:bg-secondary hover:shadow-sm"
          aria-expanded={showComparison}>
          {showComparison ? "Hide comparison" : "Compare outlets"}
        </button>
        {showComparison ? (
          <div className="w-full max-w-5xl">
            <OutletComparison outlets={displayOutlets} sourceByOutlet={displaySourceByOutlet}
              agencyByOutlet={displayAgencyByOutlet} intensityByOutlet={displayIntensityByOutlet}
              onClose={() => setShowComparison(false)} />
          </div>
        ) : null}
      </div>

    </div>
    </TooltipProvider>
  );
}

/* ── Dashboard orientation + completeness ── */

/* ── Export/share controls ── */

function DashboardActions({ eventId, bundle }: { eventId: string; bundle: EventBundle }) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const printView = () => window.print();

  const exportJson = () => {
    const data = {
      event: bundle.event,
      outlets: bundle.outlets,
      articles: bundle.articles.map((a) => ({ id: a.id, headline: a.headline, outlet_id: a.outlet_id, url: a.url, extraction_quality: a.extraction_quality })),
      signals: {
        source_attribution: bundle.signals.source_attribution,
        agency_framing: bundle.signals.agency_framing,
        language_intensity: bundle.signals.language_intensity,
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `narrative-lens-${eventId.slice(0, 8)}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button type="button" onClick={copyLink}
        className="inline-flex items-center gap-1 rounded-md border border-rule bg-card px-3 py-1.5 text-[11px] font-mono text-ink-muted transition hover:bg-secondary hover:text-ink">
        {copied ? "Copied" : "Copy link"}
      </button>
      <button type="button" onClick={printView}
        className="inline-flex items-center gap-1 rounded-md border border-rule bg-card px-3 py-1.5 text-[11px] font-mono text-ink-muted transition hover:bg-secondary hover:text-ink">
        Print
      </button>
      <button type="button" onClick={exportJson}
        className="inline-flex items-center gap-1 rounded-md border border-rule bg-card px-3 py-1.5 text-[11px] font-mono text-ink-muted transition hover:bg-secondary hover:text-ink">
        Export JSON
      </button>
    </div>
  );
}

function SectionCard({ n, id, title, caption, tip, children, slide }: { n: string; id?: string; title: string; caption: string; tip?: string; children: React.ReactNode; slide?: "left" | "right" }) {
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setRevealed(true); return; }
    (el as HTMLElement).style.opacity = "0";
    (el as HTMLElement).style.translate = slide === "right" ? "32px 0" : "-32px 0";
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) { setRevealed(true); (el as HTMLElement).style.opacity = "1"; (el as HTMLElement).style.translate = "0 0"; obs.disconnect(); }
      },
      { threshold: 0.12 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [slide]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs2 = new IntersectionObserver(([e]) => setActive(e.isIntersecting && e.intersectionRatio > 0.5), { threshold: 0.5, rootMargin: "-20% 0px -20% 0px" });
    obs2.observe(el);
    return () => obs2.disconnect();
  }, []);
  return (
    <section
      id={id}
      ref={ref}
      style={{ transition: "translate 700ms cubic-bezier(0.22,1,0.36,1), transform 700ms cubic-bezier(0.22,1,0.36,1), opacity 700ms ease-out, box-shadow 2000ms cubic-bezier(0.22,1,0.36,1)" }}
      className={`card-lift paper-card p-6 ${active ? "border-l-2 border-l-accent/30" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-4">
        <div>
          {n ? <p className="section-number font-mono text-[11px] tracking-[0.2em]">{n}</p> : null}
          <h2 className="headline mt-1 flex items-center gap-2 text-xl font-medium tracking-[0.02em]">
            {title}
            {tip ? (
              <UITooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`About ${title}`}
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-ink-muted transition hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs font-sans text-xs leading-relaxed">
                  {tip}
                </TooltipContent>
              </UITooltip>
            ) : null}
          </h2>
        </div>
      </div>
      <p className="mt-2 text-sm text-ink-muted">{caption}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/* -------- Charts / signal renderers -------- */

const INK = "oklch(0.19 0.015 60)";
const ACCENT = "oklch(0.52 0.14 25)";
const MUTED = "oklch(0.72 0.02 70)";

const SERIES_COLORS = [
  "oklch(0.30 0.03 250)",
  "oklch(0.62 0.03 250)",
  "oklch(0.48 0.17 265)",
  "oklch(0.60 0.04 80)",
  "oklch(0.45 0.17 20)",
  "oklch(0.55 0.10 150)",
  "oklch(0.70 0.13 75)",
  "oklch(0.45 0.09 200)",
];

function SourceAttributionChart({ rows, highlightedOutlet }: { rows: { outlet: string; official: number; independent: number; hasEvidence?: boolean; evidenceCount?: number; noEvidence?: number }[]; highlightedOutlet?: string | null }) {
  if (rows.length === 0) {
    return <SignalUnavailable text="No attributable voices were found in the available article text." />;
  }
  const chartData = highlightedOutlet ? rows.map((r) => ({ ...r, _opacity: r.outlet === highlightedOutlet ? 1 : 0.3 })) : rows.map((r) => ({ ...r, _opacity: 1 }));
  const allZeroIndependent = rows.some((r) => r.hasEvidence) && rows.filter((r) => r.hasEvidence).every((r) => r.independent === 0);
  const unavailableOutlets = rows.filter((r) => !r.hasEvidence).map((r) => r.outlet);
  return (
    <div>
      <div className="h-[280px] w-full">
        <ResponsiveContainer>
          <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
            <CartesianGrid horizontal={false} stroke="var(--color-rule)" strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tick={{ fontSize: 10, fill: MUTED }} axisLine={{ stroke: "var(--color-rule)" }} tickLine={false} />
            <YAxis dataKey="outlet" type="category" tickLine={false} axisLine={false} width={130} tick={{ fontSize: 12, fill: INK }} />
            <Tooltip cursor={{ fill: "var(--color-secondary)" }} formatter={(v: number) => `${v}%`} contentStyle={{ fontSize: 12, borderColor: "var(--color-rule)", background: "var(--color-card)" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="official" name="Official voices" stackId="a" fill={INK} radius={[0, 3, 3, 0]} barSize={20} />
            <Bar dataKey="independent" name="Independent voices" stackId="a" fill="var(--signal-violet)" radius={[0, 3, 3, 0]} barSize={20} />
            <Bar dataKey="noEvidence" name="No attributable voice" stackId="a" fill="#8b6f52" fillOpacity={0.5} radius={[0, 3, 3, 0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {allZeroIndependent ? (
        <p className="mt-2 text-xs text-ink-muted italic">No independent voices found in this coverage — all sourced entities are official/institutional.</p>
      ) : null}
      {unavailableOutlets.length > 0 ? (
        <p className="mt-2 text-xs text-ink-muted italic">
          No attributable voice detected in: {unavailableOutlets.join(", ")}. These outlets remain visible, but a ratio is not inferred without a source cue.
        </p>
      ) : null}
    </div>
  );
}

function LanguageIntensityChart({ rows, highlightedOutlet }: { rows: { outlet: string; Emotional: number; Certainty: number; Urgency: number }[]; highlightedOutlet?: string | null }) {
  if (rows.length === 0) {
    return <SignalUnavailable text="There is not enough article text to score language intensity." />;
  }
  const [view, setView] = useState<"bars" | "radar">("bars");
  const [hoveredOutlet, setHoveredOutlet] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const URGENCY = "var(--signal-amber)";
  const METRICS = [
    { key: "Emotional", color: ACCENT },
    { key: "Certainty", color: "var(--signal-blue)" },
    { key: "Urgency", color: URGENCY },
  ] as const;

  const barData = highlightedOutlet ? rows.map((r) => ({ ...r, _opacity: r.outlet === highlightedOutlet ? 1 : 0.3 })) : rows.map((r) => ({ ...r, _opacity: 1 }));
  const radarData = rows.map((r) => ({
    outlet: r.outlet,
    Emotional: r.Emotional,
    Certainty: r.Certainty,
    Urgency: r.Urgency,
  }));

  const orderedMetrics = [...METRICS].sort((a, b) => {
    const sumA = radarData.reduce((acc, r) => acc + (r[a.key as keyof typeof r] as number), 0);
    const sumB = radarData.reduce((acc, r) => acc + (r[b.key as keyof typeof r] as number), 0);
    return sumB - sumA;
  });

  const radarOpacity: Record<string, number> = { Emotional: 0.35, Certainty: 0.25, Urgency: 0.3 };

  const hoveredRow = hoveredOutlet ? rows.find((r) => r.outlet === hoveredOutlet) ?? null : null;

  const handleRadarMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rows.length === 0) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const chartRadius = Math.min(rect.width, rect.height) / 2;
    if (dist > chartRadius * 1.4) { setHoveredOutlet(null); return; }
    const mouseAngle = Math.atan2(dy, dx);
    const n = rows.length;
    const step = (2 * Math.PI) / n;
    let minDist = Infinity;
    let closest = 0;
    for (let i = 0; i < n; i++) {
      const outletAngle = -Math.PI / 2 + i * step;
      let diff = mouseAngle - outletAngle;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      if (Math.abs(diff) < minDist) { minDist = Math.abs(diff); closest = i; }
    }
    setHoveredOutlet(rows[closest].outlet);
  };

  return (
    <div>
      <div className="mb-3 flex justify-end gap-1.5">
        <button
          type="button"
          onClick={() => setView("bars")}
          className={`rounded-md px-3 py-1.5 text-xs font-mono uppercase transition ${
            view === "bars"
              ? "bg-accent text-white shadow-sm"
              : "border border-rule bg-card text-ink-muted hover:bg-secondary"
          }`}
        >
          Bars
        </button>
        <button
          type="button"
          onClick={() => setView("radar")}
          className={`rounded-md px-3 py-1.5 text-xs font-mono uppercase transition ${
            view === "radar"
              ? "bg-accent text-white shadow-sm"
              : "border border-rule bg-card text-ink-muted hover:bg-secondary"
          }`}
        >
          Radar
        </button>
      </div>
      <div ref={containerRef} className="h-[320px] w-full [filter:drop-shadow(0_0_12px_oklch(0.52_0.14_25/0.08))] data-[view=radar]:[filter:drop-shadow(0_0_14px_oklch(0.52_0.14_25/0.12))]" data-view={view} onMouseMove={view === "radar" ? handleRadarMouseMove : undefined} onMouseLeave={view === "radar" ? () => setHoveredOutlet(null) : undefined}>
        {view === "bars" ? (
          <ResponsiveContainer>
            <BarChart data={barData} margin={{ left: 0, right: 12, top: 10, bottom: 10 }}>
              <CartesianGrid stroke="var(--color-rule)" vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="outlet" tick={{ fontSize: 11, fill: INK }} interval={0} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: INK }} />
              <Tooltip formatter={(v: number) => [`${v}`, "Score"]} contentStyle={{ fontSize: 12, borderColor: "var(--color-rule)", background: "var(--color-card)" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Emotional" fill={ACCENT} radius={[3, 3, 0, 0]} />
              <Bar dataKey="Certainty" fill="var(--signal-blue)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Urgency" fill={URGENCY} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer>
            <RadarChart data={radarData} outerRadius="68%">
              <PolarGrid stroke="var(--color-rule)" />
              <PolarAngleAxis
                dataKey="outlet"
                tick={({ payload, x, y }) => {
                  const isHovered = hoveredOutlet === payload.value;
                  const cx = 160, cy = 160;
                  const angle = Math.atan2(y - cy, x - cx);
                  const push = 22;
                  return (
                    <text
                      x={x + Math.cos(angle) * push}
                      y={y + Math.sin(angle) * push}
                      textAnchor="middle"
                      dominantBaseline="central"
                      style={{ fontSize: 11, fill: INK, fontWeight: isHovered ? 700 : 400 }}
                    >
                      {payload.value}
                    </text>
                  );
                }}
              />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} tickCount={6} />
              {orderedMetrics.map((m) => (
                <Radar key={m.key} name={m.key} dataKey={m.key} stroke={m.color} fill={m.color} fillOpacity={radarOpacity[m.key]} strokeWidth={2} />
              ))}
            </RadarChart>
          </ResponsiveContainer>
          )}
      </div>
      {view === "radar" ? (
        <div className="mt-3 flex justify-center gap-5">
          {METRICS.map((m) => (
            <div key={m.key} className="flex flex-col items-center">
              <span
                className="font-mono text-sm font-bold transition-opacity"
                style={{ color: m.color, opacity: hoveredRow ? 1 : 0 }}
              >
                {hoveredRow ? hoveredRow[m.key] : "\u00A0"}
              </span>
              <div
                className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-mono"
                style={{ borderColor: m.color, color: m.color }}
              >
                <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ background: m.color }} />
                <span>{m.key}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <p className="mt-2 text-center text-xs italic text-ink-muted">
        Scores use the full 0–100 scale. A zero indicates no matching intensity cues were detected.
      </p>
    </div>
  );
}

function AgencyFraming({ rows, highlightedOutlet }: { rows: { outlet: string; score: number; phrases: { text: string; type: string }[] }[]; highlightedOutlet?: string | null }) {
  if (rows.length === 0) {
    return <SignalUnavailable text="There are not enough analyzable sentences to determine agency framing." />;
  }
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const sorted = [...rows].sort((a, b) => sortDir === "desc" ? b.score - a.score : a.score - b.score);

  return (
    <div>
      <div className="flex items-center justify-end mb-1">
        <button
          type="button"
          onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")}
          className="inline-flex items-center gap-0.5 rounded border border-rule bg-card px-1.5 py-0 text-[9px] font-mono uppercase text-ink-muted transition hover:bg-secondary"
        >
          Agency {sortDir === "desc" ? "↓" : "↑"}
        </button>
      </div>
      <div className="space-y-4">
      {sorted.map((r) => (
        <div key={r.outlet} className={`border-b border-rule pb-4 last:border-none last:pb-0 transition-opacity duration-300 ${highlightedOutlet && r.outlet !== highlightedOutlet ? "opacity-30" : ""}`}>
          <div className="flex items-baseline justify-between">
            <p className="font-serif text-lg">{r.outlet}</p>
            <span className="font-mono text-sm">
              <strong className="text-xl">{r.score}</strong>
              <span className="text-ink-muted">/100 agency</span>
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-ink" style={{ width: `${r.score}%` }} />
          </div>
          <ul className="mt-3 space-y-1.5">
            {r.phrases.map((p, i) => (
              <li key={i} className="text-sm">
                <span
                  className={
                    p.type === "active"
                      ? "border-b-2 border-ink"
                      : p.type === "passive"
                      ? "bg-accent/10 border-b-2 border-accent"
                      : "bg-muted line-through decoration-ink-muted"
                  }
                >
                  {"\u201c"}{p.text}{"\u201d"}
                </span>{" "}
                <span className="ml-1 font-mono text-[10px] uppercase text-ink-muted">{p.type}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      </div>
    </div>
  );
}

function SignalUnavailable({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed border-rule bg-secondary/40 px-4 py-5 text-sm italic text-ink-muted">{text}</p>;
}

type CoverageSort =
  | { kind: "stakeholder"; dir: "asc" | "desc" }
  | { kind: "outlet"; outletId: string; dir: "asc" | "desc" };

function CoverageMatrix({
  stakeholders,
  outlets,
  articlesByOutlet,
  coverage,
  highlightedOutlet,
}: {
  stakeholders: EventBundle["stakeholders"];
  outlets: EventBundle["outlets"];
  articlesByOutlet: Record<string, EventBundle["articles"]>;
  coverage: EventBundle["signals"]["coverage_matrix"];
  highlightedOutlet?: string | null;
}) {
  const lookup = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const c of coverage) m.set(`${c.article_id}:${c.stakeholder_id}`, c.present);
    return m;
  }, [coverage]);

  const [sort, setSort] = useState<CoverageSort>({ kind: "stakeholder", dir: "asc" });

  const sortedStakeholders = useMemo(() => {
    const rows = [...stakeholders];
    if (sort.kind === "stakeholder") {
      rows.sort((a, b) => a.name.localeCompare(b.name));
      if (sort.dir === "desc") rows.reverse();
    } else {
      const arts = articlesByOutlet[sort.outletId] ?? [];
      rows.sort((a, b) => {
        const pa = arts.some((art) => lookup.get(`${art.id}:${a.id}`)) ? 1 : 0;
        const pb = arts.some((art) => lookup.get(`${art.id}:${b.id}`)) ? 1 : 0;
        if (pa !== pb) return sort.dir === "asc" ? pa - pb : pb - pa;
        return a.name.localeCompare(b.name);
      });
    }
    return rows;
  }, [stakeholders, sort, articlesByOutlet, lookup]);

  const toggleStakeholder = () =>
    setSort((s) =>
      s.kind === "stakeholder"
        ? { kind: "stakeholder", dir: s.dir === "asc" ? "desc" : "asc" }
        : { kind: "stakeholder", dir: "asc" },
    );
  const toggleOutlet = (outletId: string) =>
    setSort((s) =>
      s.kind === "outlet" && s.outletId === outletId
        ? { kind: "outlet", outletId, dir: s.dir === "asc" ? "desc" : "asc" }
        : { kind: "outlet", outletId, dir: "desc" },
    );

  const sortIcon = (active: boolean, dir: "asc" | "desc") => {
    if (!active) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-b border-rule py-2 text-left font-serif text-base font-normal">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleStakeholder}
                  className="inline-flex items-center gap-1.5 hover:text-accent"
                  aria-label="Sort by stakeholder name"
                >
                  Stakeholder
                  {sortIcon(sort.kind === "stakeholder", sort.kind === "stakeholder" ? sort.dir : "asc")}
                </button>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="About sorting the perspective coverage matrix"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-ink-muted transition hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs font-sans text-xs leading-relaxed">
                    Click a column header to sort.
                  </TooltipContent>
                </UITooltip>
              </div>
            </th>
            {outlets.map((o) => {
              const active = sort.kind === "outlet" && sort.outletId === o.id;
              const colDimmed = highlightedOutlet && o.id !== highlightedOutlet;
              return (
                <th key={o.id} className={`border-b border-rule px-2 py-2 text-center text-xs font-medium transition-opacity duration-300 ${colDimmed ? 'opacity-30' : ''}`}>
                  <button
                    type="button"
                    onClick={() => toggleOutlet(o.id)}
                    className="inline-flex items-center gap-1.5 hover:text-accent"
                    aria-label={`Sort by ${o.name} coverage`}
                  >
                    {o.name}
                    {sortIcon(active, active ? sort.dir : "desc")}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedStakeholders.map((s) => (
            <tr key={s.id} className="group hover:bg-secondary/40">
              <td className="border-b border-rule py-3 pr-4">
                <span className="font-serif">{s.name.replace(/\b\w+/g, (w) => {
                  if (w === w.toUpperCase() && w.length >= 2) return w;
                  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
                })}</span>
                <span className="ml-2 font-mono text-[10px] uppercase text-ink-muted">{s.role}</span>
              </td>
              {outlets.map((o) => {
                const arts = articlesByOutlet[o.id] ?? [];
                const present = arts.some((art) => lookup.get(`${art.id}:${s.id}`));
                const cellDimmed = highlightedOutlet && o.id !== highlightedOutlet;
                return (
                  <td key={o.id} className={`border-b border-rule px-2 py-3 text-center transition-opacity duration-300 ${cellDimmed ? 'opacity-30' : ''}`}>
                    {present ? (
                      <span title="Present" className="relative inline-flex items-center justify-center">
                        <span className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-[#166534]/15 scale-0 group-hover:scale-[1.8] opacity-0 group-hover:opacity-100 transition-[transform,opacity] duration-300 ease-out" />
                        <svg
                          aria-hidden
                          viewBox="0 0 24 24"
                          className="h-6 w-6"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            fill="rgba(22,83,54,0.12)"
                            stroke="#166534"
                            strokeWidth="1.5"
                          />
                          <path
                            d="M7 12.5l3.5 3.5 6.5-7.5"
                            fill="none"
                            stroke="#166534"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span className="sr-only">present</span>
                      </span>
                    ) : (
                      <span title="Absent" className="relative inline-flex items-center justify-center">
                        <span className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-[#7f1d1d]/15 scale-0 group-hover:scale-[1.8] opacity-0 group-hover:opacity-100 transition-[transform,opacity] duration-300 ease-out" />
                        <svg
                          aria-hidden
                          viewBox="0 0 24 24"
                          className="h-6 w-6"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            fill="rgba(120,28,28,0.12)"
                            stroke="#7f1d1d"
                            strokeWidth="1.5"
                          />
                          <path
                            d="M8 8l8 8M16 8l-8 8"
                            fill="none"
                            stroke="#7f1d1d"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="sr-only">absent</span>
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex items-center justify-between gap-4 text-xs text-ink-muted">
        <p>Absence is a signal, not proof of intent.</p>
        <p className="flex items-center gap-1.5">
          <svg aria-hidden viewBox="0 0 28 28" className="h-4 w-4">
            <circle cx="14" cy="14" r="12.5" fill="rgba(22,83,54,0.12)" stroke="#166534" strokeWidth="2" />
            <path d="M8.5 14.5l4 4 7-8" fill="none" stroke="#166534" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Represented ·{" "}
          <svg aria-hidden viewBox="0 0 28 28" className="h-4 w-4">
            <circle cx="14" cy="14" r="12.5" fill="rgba(120,28,28,0.12)" stroke="#7f1d1d" strokeWidth="2" />
            <path d="M9 9l10 10M19 9l-10 10" fill="none" stroke="#7f1d1d" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          Not represented.
        </p>
      </div>
    </div>
  );
}

function HeadlineDiff({
  articles,
  outletById,
  snapshots,
}: {
  articles: EventBundle["articles"];
  outletById: Record<string, EventBundle["outlets"][number]>;
  snapshots: EventBundle["snapshots"];
}) {
  const articleById = useMemo(
    () => Object.fromEntries(articles.map((a) => [a.id, a])),
    [articles],
  );
  const allSnaps = useMemo(
    () => [...snapshots].sort((a, b) => a.captured_at.localeCompare(b.captured_at)),
    [snapshots],
  );

  if (allSnaps.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        No headline snapshots available for this event yet. Snapshots are captured when articles are first indexed.
      </p>
    );
  }

  // Check if all snapshots are one-per-article (no historical comparison possible)
  const byArticle = new Map<string, typeof allSnaps>();
  for (const s of allSnaps) {
    const arr = byArticle.get(s.article_id) ?? [];
    arr.push(s);
    byArticle.set(s.article_id, arr);
  }
  const hasMultiSnapArticle = Array.from(byArticle.values()).some((arr) => arr.length >= 2);

  // Default to two snapshots from the SAME article so rewording is visible.
  const defaultPair = useMemo(() => {
    const byArticle = new Map<string, typeof allSnaps>();
    for (const s of allSnaps) {
      const arr = byArticle.get(s.article_id) ?? [];
      arr.push(s);
      byArticle.set(s.article_id, arr);
    }
    for (const arr of byArticle.values()) {
      if (arr.length >= 2) return { from: arr[0].id, to: arr[arr.length - 1].id };
    }
    return { from: allSnaps[0]?.id ?? "", to: allSnaps[allSnaps.length - 1]?.id ?? "" };
  }, [allSnaps]);

  const [fromId, setFromId] = useState(defaultPair.from);
  const [toId, setToId] = useState(defaultPair.to);

  const from = allSnaps.find((s) => s.id === fromId) ?? allSnaps[0];
  const to = allSnaps.find((s) => s.id === toId) ?? allSnaps[allSnaps.length - 1];

  const parts = useMemo(() => {
    if (!from || !to) return [] as DiffPart[];
    return wordDiff(from.headline_text, to.headline_text);
  }, [from, to]);

  const diffSummary = useMemo(() => {
    if (!from || !to || from.id === to.id) return null;
    let addedWords = 0;
    let removedWords = 0;
    let rewordedPhrases = 0;
    for (const p of parts) {
      if (p.type === "added") addedWords += p.value.split(/\s+/).filter(Boolean).length;
      else if (p.type === "removed") removedWords += p.value.split(/\s+/).filter(Boolean).length;
      else if (p.type === "reworded") rewordedPhrases += 1;
    }
    const bits: string[] = [];
    if (addedWords > 0) bits.push(`${addedWords} word${addedWords === 1 ? "" : "s"} added`);
    if (removedWords > 0) bits.push(`${removedWords} word${removedWords === 1 ? "" : "s"} removed`);
    if (rewordedPhrases > 0) bits.push(`${rewordedPhrases} phrase${rewordedPhrases === 1 ? "" : "s"} reworded`);
    return bits.join(" · ");
  }, [from, to, parts]);

  const labelFor = (s: EventBundle["snapshots"][number]) => {
    const art = articleById[s.article_id];
    const outletName = art ? outletById[art.outlet_id]?.name ?? "Unknown" : "Unknown";
    return `${outletName} · ${new Date(s.captured_at).toLocaleString()} · ${s.source}`;
  };

  const crossArticle = from && to && from.article_id !== to.article_id;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="eyebrow">From snapshot</span>
          <select
            value={from?.id ?? ""}
            onChange={(e) => setFromId(e.target.value)}
            className="mt-1 w-full rounded-md border border-rule bg-background px-2 py-2 text-sm"
          >
            {allSnaps.map((s) => (
              <option key={s.id} value={s.id}>
                {labelFor(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="eyebrow">To snapshot</span>
          <select
            value={to?.id ?? ""}
            onChange={(e) => setToId(e.target.value)}
            className="mt-1 w-full rounded-md border border-rule bg-background px-2 py-2 text-sm"
          >
            {allSnaps.map((s) => (
              <option key={s.id} value={s.id}>
                {labelFor(s)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {crossArticle ? (
        <p className="rounded-md border border-dashed border-rule bg-secondary/40 px-3 py-2 text-xs text-ink-muted">
          Comparing snapshots from two different articles — differences reflect editorial choice, not one headline revised over time.
        </p>
      ) : null}

      <div className="rounded-md border border-rule bg-background p-4 font-serif text-lg leading-snug">
        {parts.length === 0 || from?.id === to?.id ? (
          <span className="text-ink-muted">Select two different snapshots to see the diff.</span>
        ) : (
          <>
            {parts.map((p, i) => {
              if (p.type === "reworded") {
                return (
                  <span key={i}>
                    <span className="bg-yellow-200/70 text-ink line-through decoration-ink-muted">{p.from}</span>
                    <span className="bg-yellow-200/70 text-ink"> {p.to}</span>
                  </span>
                );
              }
              if (p.type === "added") {
                return (
                  <span key={i} className="bg-green-200/70 text-green-900">
                    {p.value}
                  </span>
                );
              }
              if (p.type === "removed") {
                return (
                  <span key={i} className="bg-red-200/70 text-red-900 line-through">
                    {p.value}
                  </span>
                );
              }
              return <span key={i}>{p.value}</span>;
            })}
            {diffSummary ? (
              <p className="mt-3 block font-mono text-xs text-ink-muted">{diffSummary}</p>
            ) : null}
          </>
        )}
      </div>

      <p className="text-xs text-ink-muted">
        <span className="rounded bg-green-200/70 px-1 text-green-900">added</span>{" "}
        <span className="ml-2 rounded bg-red-200/70 px-1 text-red-900 line-through">removed</span>{" "}
        <span className="ml-2 rounded bg-yellow-200/70 px-1 text-ink">reworded</span>
      </p>
    </div>
  );
}

type DiffPart =
  | { type: "equal"; value: string }
  | { type: "added"; value: string }
  | { type: "removed"; value: string }
  | { type: "reworded"; from: string; to: string };

function wordDiff(a: string, b: string): DiffPart[] {
  const aw = a.split(/(\s+)/);
  const bw = b.split(/(\s+)/);
  const n = aw.length;
  const m = bw.length;

  // LCS table (suffix form)
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = aw[i] === bw[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const raw: DiffPart[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (aw[i] === bw[j]) {
      raw.push({ type: "equal", value: aw[i] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      raw.push({ type: "removed", value: aw[i] });
      i++;
    } else {
      raw.push({ type: "added", value: bw[j] });
      j++;
    }
  }
  while (i < n) raw.push({ type: "removed", value: aw[i++] });
  while (j < m) raw.push({ type: "added", value: bw[j++] });

  // Coalesce: a run of removals immediately followed by a run of additions
  // becomes ONE "reworded" part. Everything else stays added / removed / equal.
  const out: DiffPart[] = [];
  let k = 0;
  while (k < raw.length) {
    if (raw[k].type === "removed") {
      let removedText = "";
      while (k < raw.length && raw[k].type === "removed") {
        removedText += (raw[k++] as { value: string }).value;
      }
      let addedText = "";
      while (k < raw.length && raw[k].type === "added") {
        addedText += (raw[k++] as { value: string }).value;
      }
      if (addedText.trim()) {
        out.push({ type: "reworded", from: removedText.trim(), to: addedText.trim() });
      } else {
        out.push({ type: "removed", value: removedText });
      }
    } else {
      out.push(raw[k++]);
    }
  }
  return out;
}


function NarrativeTimeline({ stakeholders }: { stakeholders: EventBundle["stakeholders"] }) {
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);

  const withDates = stakeholders.filter((s) => s.first_appeared_at);
  if (withDates.length === 0) return <p className="text-sm text-ink-muted">No timeline data.</p>;

  const sorted = [...withDates].sort(
    (a, b) => new Date(a.first_appeared_at!).getTime() - new Date(b.first_appeared_at!).getTime(),
  );

  const times = sorted.map((s) => new Date(s.first_appeared_at!).getTime());
  const min = Math.min(...times);
  const max = Math.max(...times);
  const span = max - min;
  const allSameTime = span === 0;
  const colorFor = (i: number) => SERIES_COLORS[i % SERIES_COLORS.length];

  // Group by timestamp
  const groups = new Map<number, typeof sorted>();
  for (const s of sorted) {
    const t = new Date(s.first_appeared_at!).getTime();
    const arr = groups.get(t) ?? [];
    arr.push(s);
    groups.set(t, arr);
  }
  const uniqueTimes = [...groups.keys()].sort((a, b) => a - b);

  // Position calculation: groups at their time positions, clusters within groups
  const positions = new Map<string, number>();
  for (const t of uniqueTimes) {
    const group = groups.get(t)!;
    const timePct = span === 0 ? 50 : ((t - min) / span) * 100;

    if (group.length === 1) {
      positions.set(group[0].id, Math.max(3, Math.min(97, timePct)));
    } else {
      // Olympic cluster: arrange in overlapping arc at the time position
      const n = group.length;
      const spacing = 2.8; // percent between centers
      const rawStart = timePct - ((n - 1) * spacing) / 2;
      const clampedStart = Math.max(3, Math.min(97 - (n - 1) * spacing, rawStart));
      for (let i = 0; i < n; i++) {
        positions.set(group[i].id, clampedStart + i * spacing);
      }
    }
  }

  // Hover group detection: find which group the hovered stakeholder belongs to
  const hoveredStakeholder = hover ? sorted.find((s) => s.id === hover.id) : null;
  const hoveredGroup = hoveredStakeholder
    ? groups.get(new Date(hoveredStakeholder.first_appeared_at!).getTime())!
    : null;
  const isAllSameTime = hoveredGroup && hoveredGroup.length === sorted.length;

  return (
    <div>
      {/* Horizontal timeline rail */}
      <div className="relative rounded-md border border-rule bg-secondary/40 px-5 pb-8 pt-10">
        <div className="relative h-px w-full bg-rule">
          {sorted.map((s, i) => {
            const pct = positions.get(s.id) ?? 50;
            const inHoveredGroup = hoveredGroup?.some((h) => h.id === s.id);
            const dimmed = hover && !inHoveredGroup;
            return (
              <button
                key={s.id}
                type="button"
                aria-label={s.name}
                onMouseEnter={(e) => setHover({ id: s.id, x: e.clientX, y: e.clientY })}
                onMouseMove={(e) => setHover({ id: s.id, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHover(null)}
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card transition hover:scale-125"
                style={{
                  left: `${pct}%`,
                  background: colorFor(i),
                  opacity: dimmed ? 0.3 : 1,
                  zIndex: inHoveredGroup ? 10 : 1,
                }}
              />
            );
          })}
        </div>
        <div className="mt-4 flex justify-between font-mono text-[10px] text-ink-muted">
          <span>{new Date(min).toLocaleDateString()}</span>
          {allSameTime ? (
            <span className="italic">All first appeared same day</span>
          ) : (
            <span>{new Date(max).toLocaleDateString()}</span>
          )}
        </div>
      </div>

      {/* Mouse-following tooltip — shows group or individual */}
      {hover && hoveredGroup ? (
        <div
          className="pointer-events-none fixed z-50 rounded-md border border-rule bg-popover px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: hover.x + 12, top: hover.y - 60 }}
        >
          {isAllSameTime ? (
            <span className="font-serif font-medium">All Stakeholders</span>
          ) : hoveredGroup.length > 1 ? (
            <div className="font-serif font-medium leading-tight">
              {hoveredGroup.map((h) => (
                <div key={h.id}>{h.name}</div>
              ))}
            </div>
          ) : (
            <>
              <span className="font-serif">{hoveredGroup[0].name}</span>
              <span className="ml-2 font-mono text-[10px] uppercase text-ink-muted">{hoveredGroup[0].role}</span>
            </>
          )}
        </div>
      ) : null}

      {/* Source table */}
      <ul className="mt-5 space-y-3">
        {sorted.map((s, i) => (
          <li key={s.id} className="flex items-center gap-3 border-b border-rule pb-2 last:border-none">
            <span
              className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
              style={{ background: colorFor(i), marginRight: 4 }}
              aria-hidden
            />
            <p className="min-w-0 flex-1 font-serif text-base">
              {(s.name.replace(/\b\w+/g, (w) => {
                // Skip ALL CAPS (acronyms like NDRRMA)
                if (w === w.toUpperCase() && w.length >= 2) return w;
                // Title case everything else
                return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
              }))}{" "}
              <span className="ml-1 font-mono text-[10px] uppercase text-ink-muted">{s.role}</span>
            </p>
            <span className="flex-shrink-0 font-mono text-[11px] text-ink-muted">
              {new Date(s.first_appeared_at!).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}




