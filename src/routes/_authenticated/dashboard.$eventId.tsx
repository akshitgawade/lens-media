import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import { ArrowDown, ArrowUp, ArrowUpDown, HelpCircle, Loader2 } from "lucide-react";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { fetchEventBundle, type EventBundle } from "@/lib/narrative-data";

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

const OUTLET_TIER_LABELS: Record<string, string> = {
  "The Hindu": "Legacy",
  "Indian Express": "Independent",
  "The Wire": "Alternative",
  "Scroll.in": "Digital",
};

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

  return <DashboardBody bundle={data} />;
}

function DashboardBody({ bundle }: { bundle: EventBundle }) {
  const { event, outlets, articles, snapshots, stakeholders, signals } = bundle;

  const outletById = useMemo(
    () => Object.fromEntries(outlets.map((o) => [o.id, o])),
    [outlets],
  );
  const articleByOutlet = useMemo(
    () => Object.fromEntries(articles.map((a) => [a.outlet_id, a])),
    [articles],
  );
  const publishedRange = useMemo(() => {
    const dates = articles.map((a) => new Date(a.published_at).getTime());
    const min = new Date(Math.min(...dates, new Date(event.first_reported_at).getTime()));
    const max = new Date(Math.max(...dates));
    return { min, max };
  }, [articles, event]);

  return (
    <TooltipProvider delayDuration={150}>

    <div className="mx-auto max-w-7xl px-6 py-10">
      {/* Masthead */}
      <div className="border-b-4 border-double border-rule pb-8">
        <p className="eyebrow">Comparison Edition · {new Date(event.first_reported_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</p>
        <h1 className="headline mt-4 text-5xl leading-[1.02] sm:text-6xl">
          {event.title}
        </h1>
        <p className="mt-6 max-w-3xl font-serif text-lg leading-relaxed text-ink-muted">
          {event.summary}
        </p>
        <div className="mt-6 space-y-1.5 text-sm">
          <div className="flex flex-wrap items-baseline gap-x-0">
            <span className="eyebrow mr-2 text-xs">Outlets:</span>
            {outlets.map((o, i) => (
              <span key={o.id} className="text-ink">
                {o.name}
                <span className="ml-1 text-[11px] text-ink-muted">{OUTLET_TIER_LABELS[o.name] ?? o.authority_tier}</span>
                {i < outlets.length - 1 && (
                  <span className="mx-2 text-ink-muted/50" aria-hidden>·</span>
                )}
              </span>
            ))}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="eyebrow text-xs">Range:</span>
            <span className="font-mono text-[11px] text-ink-muted">
              {publishedRange.min.toLocaleString()} → {publishedRange.max.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Re-analyze controls */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="eyebrow mr-1">Re-run analysis:</span>
        {articles.map((article) => (
          <button
            key={article.id}
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 rounded-md border border-rule bg-card px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-60"
          >
            Re-analyze {outletById[article.outlet_id]?.name ?? "outlet"}
          </button>
        ))}
      </div>



      {/* Two-column newspaper grid */}
      <div className="mt-10 grid gap-8 lg:grid-cols-12">
        {/* LEFT column */}
        <div className="space-y-10 lg:col-span-7">
          <SectionCard n="01" title="Source Attribution Ratio" caption="Who is quoted — official versus independent voices, per outlet." tip="Who gets quoted: official voices vs. independent voices.">
            <SourceAttributionChart
              rows={signals.source_attribution.map((r) => {
                const art = articles.find((a) => a.id === r.article_id)!;
                return {
                  outlet: outletById[art.outlet_id].name,
                  official: r.official_ratio <= 1 ? Math.round(r.official_ratio * 100) : Math.round(r.official_ratio),
                  independent: r.independent_ratio <= 1 ? Math.round(r.independent_ratio * 100) : Math.round(r.independent_ratio),
                };
              })}
            />
          </SectionCard>

          <SectionCard n="03" title="Language Intensity" caption="Emotional load, certainty, and urgency in the writing, per outlet." tip="Emotional load, certainty, and urgency in language.">
            <LanguageIntensityChart
              rows={signals.language_intensity.map((r) => {
                const art = articles.find((a) => a.id === r.article_id)!;
                return {
                  outlet: outletById[art.outlet_id].name,
                  Emotional: r.emotional_score <= 1 ? Math.round(r.emotional_score * 100) : Math.round(r.emotional_score),
                  Certainty: r.certainty_score <= 1 ? Math.round(r.certainty_score * 100) : Math.round(r.certainty_score),
                  Urgency: r.urgency_score <= 1 ? Math.round(r.urgency_score * 100) : Math.round(r.urgency_score),
                };
              })}
            />
          </SectionCard>

          <SectionCard n="04" title="Perspective Coverage Matrix" caption="Which stakeholders are represented in each outlet's coverage." tip="Which stakeholders each outlet includes.">
            <CoverageMatrix
              stakeholders={stakeholders}
              outlets={outlets}
              articleByOutlet={articleByOutlet}
              coverage={signals.coverage_matrix}
            />
          </SectionCard>
        </div>

        {/* RIGHT column */}
        <div className="space-y-10 lg:col-span-5">
          <SectionCard n="02" title="Agency Framing" caption="Active vs. passive/agentless sentence construction — with example phrases." tip="How directly the text assigns responsibility.">
            <AgencyFraming
              rows={signals.agency_framing.map((r) => {
                const art = articles.find((a) => a.id === r.article_id)!;
                const phrases = r.example_phrases.map((p: any) => 
                  typeof p === 'string' ? { text: p, type: 'active' } : p
                );
                return {
                  outlet: outletById[art.outlet_id].name,
                  score: r.agency_score <= 1 && r.agency_score > 0 ? Math.round(r.agency_score * 100) : Math.round(r.agency_score),
                  phrases,
                };
              })}
            />
          </SectionCard>

          <SectionCard n="05" title="Headline Diff · FrameShift Replay" caption="How the headline changed between two snapshots." tip="How the headline changed over time.">
            <HeadlineDiff
              articles={articles}
              outletById={outletById}
              snapshots={snapshots}
            />
          </SectionCard>

          <SectionCard n="06" title="Narrative Evolution Timeline" caption="When each stakeholder or angle first entered the coverage." tip="When each stakeholder or angle first entered the coverage.">
            <NarrativeTimeline stakeholders={stakeholders} />
          </SectionCard>
        </div>
      </div>

      <p className="mt-16 border-t border-rule pt-6 text-xs italic text-ink-muted">
        Observations, not verdicts. See <Link to="/methodology" className="underline">methodology</Link> for how each signal is measured.
      </p>
    </div>
    </TooltipProvider>
  );
}

function SectionCard({ n, title, caption, tip, children }: { n: string; title: string; caption: string; tip?: string; children: React.ReactNode }) {
  return (
    <section className="paper-card p-6">
      <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-3">
        <div>
          <p className="font-mono text-[10px] text-ink-muted">{n}</p>
          <h2 className="headline mt-1 flex items-center gap-2 text-2xl">
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
      <p className="mt-3 text-sm text-ink-muted">{caption}</p>
      <div className="mt-6">{children}</div>
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

function SourceAttributionChart({ rows }: { rows: { outlet: string; official: number; independent: number }[] }) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer>
        <BarChart data={rows} layout="vertical" margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
          <CartesianGrid horizontal={false} stroke="var(--color-rule)" />
          <XAxis type="number" hide domain={[0, 100]} />
          <YAxis dataKey="outlet" type="category" tickLine={false} axisLine={false} width={130} tick={{ fontSize: 12, fill: INK }} />
          <Tooltip cursor={{ fill: "var(--color-secondary)" }} formatter={(v: number) => `${v}%`} contentStyle={{ fontSize: 12, borderColor: "var(--color-rule)", background: "var(--color-card)" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="official" name="Official voices" stackId="a" fill={INK} />
          <Bar dataKey="independent" name="Independent voices" stackId="a" fill={ACCENT} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function LanguageIntensityChart({ rows }: { rows: { outlet: string; Emotional: number; Certainty: number; Urgency: number }[] }) {
  const [view, setView] = useState<"bars" | "radar">("bars");
  const URGENCY = "oklch(0.62 0.11 150)";

  // Radar wants one axis point per outlet and one series per metric.
  const radarData = rows.map((r) => ({
    outlet: r.outlet,
    Emotional: r.Emotional,
    Certainty: r.Certainty,
    Urgency: r.Urgency,
  }));

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <ToggleGroup
          type="single"
          size="sm"
          value={view}
          onValueChange={(v) => v && setView(v as "bars" | "radar")}
          className="border border-rule bg-card"
        >
          <ToggleGroupItem value="bars" className="text-xs font-mono uppercase">Bars</ToggleGroupItem>
          <ToggleGroupItem value="radar" className="text-xs font-mono uppercase">Radar</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="h-[320px] w-full">
        <ResponsiveContainer>
          {view === "bars" ? (
            <BarChart data={rows} margin={{ left: 0, right: 12, top: 10, bottom: 10 }}>
              <CartesianGrid stroke="var(--color-rule)" vertical={false} />
              <XAxis dataKey="outlet" tick={{ fontSize: 11, fill: INK }} interval={0} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: INK }} />
              <Tooltip formatter={(v: number) => `${v}/100`} contentStyle={{ fontSize: 12, borderColor: "var(--color-rule)", background: "var(--color-card)" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Emotional" fill={ACCENT} />
              <Bar dataKey="Certainty" fill={INK} />
              <Bar dataKey="Urgency" fill={URGENCY} />
            </BarChart>
          ) : (
            <RadarChart data={radarData} outerRadius="72%">
              <PolarGrid stroke="var(--color-rule)" />
              <PolarAngleAxis dataKey="outlet" tick={{ fontSize: 11, fill: INK }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: MUTED }} angle={30} />
              <Tooltip formatter={(v: number) => `${v}/100`} contentStyle={{ fontSize: 12, borderColor: "var(--color-rule)", background: "var(--color-card)" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Radar name="Emotional" dataKey="Emotional" stroke={ACCENT} fill={ACCENT} fillOpacity={0.25} />
              <Radar name="Certainty" dataKey="Certainty" stroke={INK} fill={INK} fillOpacity={0.15} />
              <Radar name="Urgency" dataKey="Urgency" stroke={URGENCY} fill={URGENCY} fillOpacity={0.2} />
            </RadarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AgencyFraming({ rows }: { rows: { outlet: string; score: number; phrases: { text: string; type: string }[] }[] }) {
  return (
    <div className="space-y-6">
      {rows.map((r) => (
        <div key={r.outlet} className="border-b border-rule pb-4 last:border-none last:pb-0">
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
                  “{p.text}”
                </span>{" "}
                <span className="ml-1 font-mono text-[10px] uppercase text-ink-muted">{p.type}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

type CoverageSort =
  | { kind: "stakeholder"; dir: "asc" | "desc" }
  | { kind: "outlet"; outletId: string; dir: "asc" | "desc" };

function CoverageMatrix({
  stakeholders,
  outlets,
  articleByOutlet,
  coverage,
}: {
  stakeholders: EventBundle["stakeholders"];
  outlets: EventBundle["outlets"];
  articleByOutlet: Record<string, EventBundle["articles"][number]>;
  coverage: EventBundle["signals"]["coverage_matrix"];
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
      const art = articleByOutlet[sort.outletId];
      rows.sort((a, b) => {
        const pa = art ? (lookup.get(`${art.id}:${a.id}`) ? 1 : 0) : 0;
        const pb = art ? (lookup.get(`${art.id}:${b.id}`) ? 1 : 0) : 0;
        if (pa !== pb) return sort.dir === "asc" ? pa - pb : pb - pa;
        return a.name.localeCompare(b.name);
      });
    }
    return rows;
  }, [stakeholders, sort, articleByOutlet, lookup]);

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
              return (
                <th key={o.id} className="border-b border-rule px-2 py-2 text-center text-xs font-medium">
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
            <tr key={s.id} className="hover:bg-secondary/40">
              <td className="border-b border-rule py-3 pr-4">
                <span className="font-serif">{s.name}</span>
                <span className="ml-2 font-mono text-[10px] uppercase text-ink-muted">{s.role}</span>
              </td>
              {outlets.map((o) => {
                const art = articleByOutlet[o.id];
                const present = art ? lookup.get(`${art.id}:${s.id}`) : undefined;
                return (
                  <td key={o.id} className="border-b border-rule px-2 py-3 text-center">
                    {present ? (
                      <span title="Present" className="inline-flex items-center justify-center">
                        <svg
                          aria-hidden
                          viewBox="0 0 28 28"
                          className="h-7 w-7"
                        >
                          <circle
                            cx="14"
                            cy="14"
                            r="12.5"
                            fill="rgba(22,163,74,0.15)"
                            stroke="#16a34a"
                            strokeWidth="2"
                          />
                          <path
                            d="M8.5 14.5l4 4 7-8"
                            fill="none"
                            stroke="#16a34a"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span className="sr-only">present</span>
                      </span>
                    ) : (
                      <span title="Absent" className="inline-flex items-center justify-center">
                        <svg
                          aria-hidden
                          viewBox="0 0 28 28"
                          className="h-7 w-7"
                        >
                          <circle
                            cx="14"
                            cy="14"
                            r="12.5"
                            fill="rgba(220,38,38,0.15)"
                            stroke="#dc2626"
                            strokeWidth="2"
                          />
                          <path
                            d="M9 9l10 10M19 9l-10 10"
                            fill="none"
                            stroke="#dc2626"
                            strokeWidth="2.5"
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
            <circle cx="14" cy="14" r="12.5" fill="rgba(22,163,74,0.15)" stroke="#16a34a" strokeWidth="2" />
            <path d="M8.5 14.5l4 4 7-8" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Represented ·{" "}
          <svg aria-hidden viewBox="0 0 28 28" className="h-4 w-4">
            <circle cx="14" cy="14" r="12.5" fill="rgba(220,38,38,0.15)" stroke="#dc2626" strokeWidth="2" />
            <path d="M9 9l10 10M19 9l-10 10" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" />
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

      {diffSummary ? (
        <p className="font-mono text-xs text-ink-muted">{diffSummary}</p>
      ) : null}

      <div className="rounded-md border border-rule bg-background p-4 font-serif text-lg leading-snug">
        {parts.length === 0 || from?.id === to?.id ? (
          <span className="text-ink-muted">Select two different snapshots to see the diff.</span>
        ) : (
          parts.map((p, i) => {
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
          })
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
  const span = max - min || 1;
  const colorFor = (i: number) => SERIES_COLORS[i % SERIES_COLORS.length];
  const hovered = hover ? sorted.find((s) => s.id === hover.id) : null;

  return (
    <div>
      {/* Horizontal timeline rail */}
      <div className="relative rounded-md border border-rule bg-secondary/40 px-5 pb-8 pt-10">
        <div className="relative h-px w-full bg-rule">
          {sorted.map((s, i) => {
            const pct = ((new Date(s.first_appeared_at!).getTime() - min) / span) * 100;
            return (
              <button
                key={s.id}
                type="button"
                aria-label={s.name}
                onMouseEnter={(e) => setHover({ id: s.id, x: e.clientX, y: e.clientY })}
                onMouseMove={(e) => setHover({ id: s.id, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHover(null)}
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card transition hover:scale-125"
                style={{ left: `${pct}%`, background: colorFor(i) }}
              />
            );
          })}
        </div>
        <div className="mt-4 flex justify-between font-mono text-[10px] text-ink-muted">
          <span>{new Date(min).toLocaleDateString()}</span>
          <span>{new Date(max).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Mouse-following tooltip */}
      {hovered && hover ? (
        <div
          className="pointer-events-none fixed z-50 rounded-md border border-rule bg-popover px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          <span className="font-serif">{hovered.name}</span>
          <span className="ml-2 font-mono text-[10px] uppercase text-ink-muted">{hovered.role}</span>
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
              {s.name}{" "}
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

