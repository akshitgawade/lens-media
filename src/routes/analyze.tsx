import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { fetchSampleEventId } from "@/lib/narrative-data";

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

function AnalyzePage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // Prototype: route any query to the seeded sample event.
      const id = await fetchSampleEventId();
      await new Promise((r) => setTimeout(r, 700));
      navigate({ to: "/dashboard/$eventId", params: { eventId: id } });
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  async function openSample() {
    setLoading(true);
    try {
      const id = await fetchSampleEventId();
      navigate({ to: "/dashboard/$eventId", params: { eventId: id } });
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="headline mt-3 text-5xl">Analyze an event.</h1>
      <p className="mt-4 text-ink-muted">
        Enter a news topic, event, or a link to a specific article. We'll pull coverage from
        multiple outlets and build a comparison dashboard.
      </p>

      <form onSubmit={handleSubmit} className="mt-10 space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter a topic - Or paste an article URL"
            className="w-full rounded-md border border-rule bg-card py-4 pl-11 pr-4 font-serif text-lg outline-none transition-colors focus:border-ink focus:ring-2 focus:ring-ring"
            disabled={loading}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Gathering coverage…" : "Analyze"}
          </button>
          <button
            type="button"
            onClick={openSample}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-rule px-5 py-3 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            Open sample dashboard
          </button>
        </div>
      </form>

      {loading ? (
        <div className="mt-10 paper-card space-y-3 p-6">
          <p className="eyebrow">Working</p>
          <p className="font-serif text-lg">Aggregating outlet coverage…</p>
          <ul className="space-y-2 text-sm text-ink-muted">
            <li>· Fetching articles from indexed outlets</li>
            <li>· Extracting sourcing patterns</li>
            <li>· Comparing headline snapshots</li>
            <li>· Mapping stakeholder presence</li>
          </ul>
        </div>
      ) : (
        <p className="mt-10 text-xs text-ink-muted">
          Prototype note: this build ships with one fully seeded sample event.
          Any query routes to it so every visualization is demonstrable.
        </p>
      )}
    </div>
  );
}
