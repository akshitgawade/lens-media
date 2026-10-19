import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { fetchSampleEventId, saveAnalysis } from "@/lib/narrative-data";
import { supabase } from "@/integrations/supabase/client";
import { useReducedMotion } from "@/components/three/useReducedMotion";

const OUTLETS = [
  { name: "NDTV", label: "NDTV", tier: "Broadcast" },
  { name: "India Today", label: "India Today", tier: "Broadcast" },
  { name: "Hindustan Times", label: "Hindustan Times", tier: "Legacy" },
  { name: "Times of India", label: "Times of India", tier: "Mass Market" },
  { name: "Indian Express", label: "Indian Express", tier: "Independent" },
  { name: "The Hindu", label: "The Hindu", tier: "Legacy" },
];

// Local development must not accidentally use the deployed backend from a
// shared .env file. Production keeps using the configured public backend.
const SEARCH_BACKEND_URL = import.meta.env.DEV
  ? (import.meta.env.VITE_LOCAL_BACKEND_URL || "http://127.0.0.1:8000")
  : (import.meta.env.VITE_BACKEND_URL ||
    import.meta.env.VITE_SEARCH_BACKEND_URL ||
    "https://narrative-lens-backend-production.up.railway.app");

export const Route = createFileRoute("/analyze")({
  head: () => ({
    meta: [
      { title: "Analyze coverage — Narrative Lens" },
      {
        name: "description",
        content:
          "Submit a news topic or article URL and compare coverage across outlets side by side.",
      },
      { property: "og:title", content: "Analyze coverage — Narrative Lens" },
      { property: "og:description", content: "Submit a topic or URL to compare outlet coverage." },
    ],
  }),
  component: AnalyzePage,
});

function useEntrance(ref: React.RefObject<HTMLElement | null>, delay = 0) {
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) return;
    el.style.opacity = "0";
    el.style.translate = "0 10px";
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setTimeout(() => {
          el.style.transition = "opacity 700ms ease-out, translate 700ms cubic-bezier(0.22,1,0.36,1)";
          el.style.opacity = "1";
          el.style.translate = "0 0";
        }, delay);
        obs.disconnect();
      }
    }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay, reduced]);
}

function AnalyzePage() {
  const [query, setQuery] = useState("");
  const [selectedOutlets, setSelectedOutlets] = useState<string[]>(
    OUTLETS.map((o) => o.name)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const topicRef = useRef<HTMLDivElement>(null);
  const sourcesRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  useEntrance(topicRef, 0);
  useEntrance(sourcesRef, 80);
  useEntrance(actionsRef, 160);

  function toggleOutlet(name: string) {
    setSelectedOutlets((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedOutlets.length < 2) {
      setError("Select at least 2 outlets to compare coverage.");
      return;
    }
    if (!SEARCH_BACKEND_URL) {
      setError("Search backend is not configured. Set VITE_BACKEND_URL in your environment.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${SEARCH_BACKEND_URL.replace(/\/$/, "")}/events/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, outlets: selectedOutlets }),
      });
      if (!response.ok) {
        let errorText = "";
        try {
          const errData = await response.json();
          errorText = errData.detail || JSON.stringify(errData);
        } catch {
          errorText = await response.text();
        }
        if (response.status === 404) {
          setError("No articles found matching your query. RSS feeds only return recent headlines — try a current news topic, broaden your query, or select different outlets.");
        } else {
          setError(errorText || "Failed to search articles");
        }
        setLoading(false);
        return;
      }
      const data = await response.json();
      // Save completed analyses for signed-in users before opening the dashboard.
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) await saveAnalysis(data.event_id);
      navigate({ to: "/dashboard/$eventId", params: { eventId: data.event_id } });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(false);
    }
  }

  async function openSample() {
    setLoading(true);
    setError(null);
    try {
      const id = await fetchSampleEventId();
      navigate({ to: "/dashboard/$eventId", params: { eventId: id } });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <p className="eyebrow">Analyze</p>
      <h1 className="headline mt-3 text-5xl">Analyze an event.</h1>
      <p className="mt-4 max-w-2xl font-serif text-lg leading-relaxed text-ink-muted">
        Enter a news topic and choose where to look. We’ll pull recent coverage and build a comparison you can inspect.
      </p>

      <form onSubmit={handleSubmit} className="mt-10 space-y-6">
        <div ref={topicRef} className="paper-card p-6">
          <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-3">
            <h2 className="headline text-xl">Topic</h2>
            <span className="font-mono text-xs text-ink-muted">Step 01</span>
          </div>
          <p className="mt-3 font-serif text-sm text-ink-muted">A concise event or theme works best. One to four words.</p>
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Supreme Court, Electoral bonds, CAA"
              className="w-full rounded-md border border-rule bg-card py-3.5 pl-11 pr-4 font-serif text-base outline-none transition-colors focus:border-ink focus:ring-2 focus:ring-ring"
              disabled={loading}
            />
          </div>
        </div>

        <div ref={sourcesRef} className="paper-card p-6">
          <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-3">
            <h2 className="headline text-xl">Sources</h2>
            <span className="font-mono text-xs text-ink-muted">Step 02 · {selectedOutlets.length} of {OUTLETS.length}</span>
          </div>
          <p className="mt-3 font-serif text-sm text-ink-muted">Pick at least two. Each outlet is an independent lens on the same event.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {OUTLETS.map((outlet) => {
              const active = selectedOutlets.includes(outlet.name);
              return (
                <button
                  key={outlet.name}
                  type="button"
                  onClick={() => toggleOutlet(outlet.name)}
                  aria-pressed={active}
                  className={`flex items-center justify-between rounded-md border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    active ? "border-ink bg-ink text-card shadow-sm" : "border-rule bg-card text-ink hover:bg-secondary"
                  }`}
                >
                  <span className="font-serif text-sm">{outlet.label}</span>
                  <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${active ? "bg-white/15 text-white" : "bg-secondary text-ink-muted"}`}>{outlet.tier}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 font-mono text-xs text-ink-muted">Tip: fewer outlets can make differences easier to see.</p>
        </div>

        <div className="paper-card p-6 mb-6">
          <p className="eyebrow">What you'll receive</p>
          <ul className="mt-3 space-y-2 font-serif text-sm leading-relaxed text-ink-muted">
            <li>· <strong>Source Attribution</strong> — who gets quoted: official vs. independent voices</li>
            <li>· <strong>Agency Framing</strong> — whether actors are named directly or obscured</li>
            <li>· <strong>Language Intensity</strong> — emotional load, certainty, and urgency in the writing</li>
            <li>· <strong>Perspective Coverage</strong> — which stakeholder groups appear across outlets</li>
            <li>· <strong>Headline Diff</strong> — how headlines changed over time</li>
            <li>· <strong>Timeline</strong> — when each angle first entered coverage</li>
          </ul>
        </div>

        <div ref={actionsRef} className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={loading || !query.trim() || selectedOutlets.length < 2}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Processing coverage…" : "Search & Analyze"}
          </button>
          <button
            type="button"
            onClick={openSample}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-rule px-5 py-3 text-sm font-medium hover:bg-secondary disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Open sample dashboard
          </button>
        </div>
      </form>

      {error ? (
        <div className="mt-6 rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <p className="font-semibold">Search failed:</p>
          <p className="mt-1 leading-relaxed">{error}</p>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 paper-card p-6">
          <div className="flex items-center gap-3 border-b border-rule pb-3">
            <Loader2 className="h-4 w-4 animate-spin text-ink-muted" />
            <h3 className="headline text-lg">Processing coverage</h3>
            <span className="ml-auto font-mono text-xs text-ink-muted">Please keep this tab open</span>
          </div>
          <ul className="mt-4 space-y-2 font-serif text-sm leading-relaxed text-ink-muted">
            <li>· Fetching RSS feeds from selected outlets</li>
            <li>· Extracting full article text</li>
            <li>· Matching articles to your query</li>
            <li>· Analyzing framing and sourcing</li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
