import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useReducedMotion } from "@/components/three/useReducedMotion";
import { fetchSavedAnalyses, fetchSampleEventId, unsaveAnalysis, type SavedAnalysisRow } from "@/lib/narrative-data";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Your account — Narrative Lens" },
      { name: "description", content: "Manage your Narrative Lens account." },
      { property: "og:title", content: "Your account — Narrative Lens" },
      { property: "og:description", content: "Manage your Narrative Lens account." },
    ],
  }),
  component: AccountPage,
});

function useEntrance(ref: React.RefObject<HTMLElement | null>, delay = 0) {
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) return;
    el.style.opacity = "0";
    el.style.translate = "0 12px";
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setTimeout(() => {
          el.style.transition = "opacity 700ms ease-out, translate 700ms cubic-bezier(0.22,1,0.36,1)";
          el.style.opacity = "1";
          el.style.translate = "0 0";
        }, delay);
        obs.disconnect();
      }
    }, { threshold: 0.12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay, reduced]);
}

type SavedWithEvent = SavedAnalysisRow & {
  event_title: string;
  event_summary: string;
  event_date: string;
};

function AccountPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [sampleId, setSampleId] = useState<string | null>(null);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [savedAnalyses, setSavedAnalyses] = useState<SavedWithEvent[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState<string | null>(null);
  const navigate = useNavigate();
  const headerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const savedRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  useEntrance(headerRef, 0);
  useEntrance(cardRef, 80);
  useEntrance(savedRef, 120);
  useEntrance(actionsRef, 200);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setCreatedAt(data.user?.created_at ?? null);
    });
    fetchSampleEventId()
      .then((id) => setSampleId(id))
      .catch((err) => setSampleError(err instanceof Error ? err.message : "Sample dashboard unavailable"));
    // Fetch saved analyses with event metadata
    fetchSavedAnalyses()
      .then(async (rows) => {
        if (rows.length === 0) {
          setSavedAnalyses([]);
          setSavedLoading(false);
          return;
        }
        const eventIds = rows.map((r) => r.event_id);
        const { data: events } = await supabase
          .from("events")
          .select("id, title, summary, first_reported_at")
          .in("id", eventIds);
        const eventMap = new Map((events ?? []).map((e) => [e.id, e]));
        const enriched: SavedWithEvent[] = rows.map((r) => {
          const ev = eventMap.get(r.event_id);
          return {
            ...r,
            event_title: ev?.title ?? "Untitled event",
            event_summary: ev?.summary ?? "",
            event_date: ev?.first_reported_at ?? r.created_at,
          };
        });
        setSavedAnalyses(enriched);
        setSavedLoading(false);
      })
      .catch((err) => {
        setSavedError(err instanceof Error ? err.message : "Failed to load saved analyses");
        setSavedLoading(false);
      });
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  async function openSample() {
    setSampleLoading(true);
    setSampleError(null);
    try {
      const id = sampleId ?? await fetchSampleEventId();
      setSampleId(id);
      navigate({ to: "/dashboard/$eventId", params: { eventId: id } });
    } catch (err) {
      setSampleError(err instanceof Error ? err.message : "Sample dashboard unavailable");
    } finally {
      setSampleLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div ref={headerRef}>
        <p className="eyebrow">Account</p>
        <h1 className="headline mt-3 text-5xl">Your Account</h1>
        <p className="mt-3 max-w-2xl font-serif text-lg leading-relaxed text-ink-muted">
          Your saved analyses and account details. Everything here is private to your browser session.
        </p>
      </div>

      <div ref={cardRef} className="mt-10 overflow-hidden rounded-lg border border-rule bg-card">
        <div className="border-b border-rule bg-secondary/30 px-6 py-4">
          <h2 className="headline text-xl">Profile</h2>
          <p className="mt-1 font-mono text-xs text-ink-muted">Private · not shared</p>
        </div>
        <div className="divide-y divide-rule">
          <div className="grid gap-2 p-6 sm:grid-cols-12 sm:gap-4">
            <span className="eyebrow sm:col-span-3">Email</span>
            <span className="font-serif sm:col-span-9">{email ?? "—"}</span>
          </div>
          <div className="grid gap-2 p-6 sm:grid-cols-12 sm:gap-4">
            <span className="eyebrow sm:col-span-3">Joined</span>
            <span className="font-serif sm:col-span-9">
              {createdAt ? new Date(createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—"}
            </span>
          </div>
          <div className="grid gap-2 p-6 sm:grid-cols-12 sm:gap-4">
            <span className="eyebrow sm:col-span-3">Plan</span>
            <span className="font-serif sm:col-span-9">Reader (free) — unlimited viewing, shared ingestion limits</span>
          </div>
        </div>
        <div className="border-t border-rule px-6 py-4">
          <p className="text-xs leading-relaxed text-ink-muted">Your saved analyses are stored in your account and visible only to you. We do not share or sell your reading history.</p>
        </div>
      </div>

      {/* Saved Analyses */}
      <div ref={savedRef} className="mt-10 overflow-hidden rounded-lg border border-rule bg-card">
        <div className="border-b border-rule bg-secondary/30 px-6 py-4">
          <div className="flex items-baseline justify-between"><h2 className="headline text-xl">Saved analyses</h2>{savedAnalyses.length > 0 ? <span className="font-mono text-xs text-ink-muted">{savedAnalyses.length} saved</span> : null}</div>
          <p className="mt-1 font-mono text-xs text-ink-muted">Your reading desk</p>
        </div>
        <div className="p-6">
          {savedLoading ? (
            <div className="flex items-center gap-2 text-sm text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading saved analyses…
            </div>
          ) : savedError ? (
            <p className="text-sm text-destructive">{savedError}</p>
          ) : savedAnalyses.length === 0 ? (
            <div className="py-4 text-center">
              <p className="font-serif text-sm leading-relaxed text-ink-muted">
                Your saved analyses will appear here. Run an analysis or save one from the dashboard to build your reading desk.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {savedAnalyses.map((sa) => (
                <div
                  key={sa.id}
                  className="group flex items-start justify-between gap-4 border-b border-rule pb-4 last:border-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/dashboard/$eventId"
                      params={{ eventId: sa.event_id }}
                      className="headline text-lg hover:text-accent transition-colors"
                    >
                      {sa.event_title}
                    </Link>
                    {sa.event_summary ? (
                      <p className="mt-1 font-serif text-sm leading-relaxed text-ink-muted line-clamp-2">
                        {sa.event_summary}
                      </p>
                    ) : null}
                    <div className="mt-2 flex items-center gap-3 text-xs text-ink-muted">
                      <span className="font-mono">
                        Saved {new Date(sa.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      <span>·</span>
                      <span className="font-mono">
                        Event {new Date(sa.event_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      to="/dashboard/$eventId"
                      params={{ eventId: sa.event_id }}
                      className="inline-flex items-center gap-1 rounded-md border border-rule bg-card px-3 py-1.5 text-xs font-medium transition hover:bg-secondary hover:shadow-sm"
                    >
                      Open analysis
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await unsaveAnalysis(sa.event_id);
                          setSavedAnalyses((prev) => prev.filter((x) => x.event_id !== sa.event_id));
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-rule px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Remove ${sa.event_title} from saved analyses`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div ref={actionsRef} className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={openSample}
          disabled={sampleLoading}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {sampleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {sampleLoading ? "Opening sample…" : "Open sample dashboard"}
        </button>
        {sampleError ? <p className="basis-full text-sm text-destructive">{sampleError}</p> : null}
        <button
          onClick={signOut}
          className="inline-flex items-center gap-2 rounded-md border border-rule px-5 py-3 text-sm font-medium hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Sign out
        </button>
        <Link
          to="/methodology"
          className="inline-flex items-center gap-2 rounded-md border border-transparent px-5 py-3 text-sm font-medium text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          How we measure
        </Link>
      </div>
    </div>
  );
}
