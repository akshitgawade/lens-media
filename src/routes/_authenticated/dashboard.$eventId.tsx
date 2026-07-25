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
import { ArrowDown, ArrowUp, ArrowUpDown, Check, HelpCircle, Loader2, Minus } from "lucide-react";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { analyzeArticle, fetchEventBundle, type EventBundle } from "@/lib/narrative-data";

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

  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const runAnalysis = async (articleId: string, text: string, outletId: string) => {
    setAnalyzingId(articleId);
    setAnalyzeError(null);
    try {
      await analyzeArticle(articleId, text, outletId);
      window.location.reload();
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : "Analysis failed");
      setAnalyzingId(null);
    }
  };

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
        <div className="mt-6 flex flex-wrap items-center gap-2 text-xs">
          <span className="eyebrow mr-2">Outlets:</span>
          {outlets.map((o) => (
            <span key={o.id} className="rounded-full border border-rule bg-card px-3 py-1 font-medium">
              {o.name} <span className="text-ink-muted">· {o.authority_tier}</span>
            </span>
          ))}
          <span className="ml-4 eyebrow">Range:</span>
          <span className="font-mono text-[11px] text-ink-muted">
            {publishedRange.min.toLocaleString()} → {publishedRange.max.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Re-analyze controls */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="eyebrow mr-1">Re-run analysis:</span>
        {articles.map((article) => (
          <button
            key={article.id}
            type="button"
            disabled={analyzingId !== null}
            onClick={() => runAnalysis(article.id, article.full_text, article.outlet_id)}
            className="inline-flex items-center gap-1.5 rounded-md border border-rule bg-card px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-60"
          >
            {analyzingId === article.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Re-analyze {outletById[article.outlet_id]?.name ?? "outlet"}
          </button>
        ))}
      </div>
      {analyzeError ? (
        <p className="mt-2 text-xs text-destructive">{analyzeError}</p>
      ) : null}



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
                  official: Math.round(r.official_ratio * 100),
                  independent: Math.round(r.independent_ratio * 100),
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
                  Emotional: Math.round(r.emotional_score * 100),
                  Certainty: Math.round(r.certainty_score * 100),
                  Urgency: Math.round(r.urgency_score * 100),
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
                return {
                  outlet: outletById[art.outlet_id].name,
                  score: Math.round(r.agency_score * 100),
                  phrases: r.example_phrases,
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
              <button
                type="button"
                onClick={toggleStakeholder}
                className="inline-flex items-center gap-1.5 hover:text-accent"
                aria-label="Sort by stakeholder name"
              >
                Stakeholder
                {sortIcon(sort.kind === "stakeholder", sort.kind === "stakeholder" ? sort.dir : "asc")}
              </button>
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
                      <span title="Present" className="inline-flex items-center gap-1 text-success">
                        <Check className="h-4 w-4" />
                        <span className="sr-only">present</span>
                      </span>
                    ) : (
                      <span title="Absent" className="inline-flex items-center gap-1 text-ink-muted">
                        <Minus className="h-4 w-4" />
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
      <p className="mt-3 text-xs text-ink-muted">
        <Check className="mr-1 inline h-3 w-3 text-success" /> Represented ·{" "}
        <Minus className="ml-2 mr-1 inline h-3 w-3" /> Not represented. Click a column header to sort. Absence is a signal, not proof of intent.
      </p>
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
  // LCS table
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

  // Coalesce adjacent removed+added (ignoring whitespace equals between) into reworded.
  const out: DiffPart[] = [];
  let k = 0;
  while (k < raw.length) {
    const r = raw[k];
    if (r.type === "removed") {
      // collect run of removed
      let removedText = "";
      while (k < raw.length && raw[k].type === "removed") {
        removedText += (raw[k] as { value: string }).value;
        k++;
      }
      // skip optional whitespace equal
      let ws = "";
      while (k < raw.length && raw[k].type === "equal" && /^\s+$/.test((raw[k] as { value: string }).value)) {
        ws += (raw[k] as { value: string }).value;
        k++;
      }
      if (k < raw.length && raw[k].type === "added") {
        let addedText = "";
        while (k < raw.length && raw[k].type === "added") {
          addedText += (raw[k] as { value: string }).value;
          k++;
        }
        out.push({ type: "reworded", from: removedText, to: addedText });
      } else {
        out.push({ type: "removed", value: removedText });
        if (ws) out.push({ type: "equal", value: ws });
      }
    } else {
      out.push(r);
      k++;
    }
  }
  return out;
}


function NarrativeTimeline({ stakeholders }: { stakeholders: EventBundle["stakeholders"] }) {
  const withDates = stakeholders.filter((s) => s.first_appeared_at);
  if (withDates.length === 0) return <p className="text-sm text-ink-muted">No timeline data.</p>;
  const sorted = [...withDates].sort(
    (a, b) => new Date(a.first_appeared_at!).getTime() - new Date(b.first_appeared_at!).getTime(),
  );

  return (
    <ul className="space-y-3">
      {sorted.map((s) => (
        <li
          key={s.id}
          className="flex items-center gap-3 border-b border-rule pb-2 last:border-none"
        >
          <span
            className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-accent"
            style={{ marginRight: 4 }}
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
  );
}

