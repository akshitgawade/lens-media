import { supabase } from "@/integrations/supabase/client";

export type Outlet = {
  id: string;
  name: string;
  url: string;
  authority_tier: string;
};

export type EventRow = {
  id: string;
  title: string;
  summary: string;
  first_reported_at: string;
};

export type Article = {
  id: string;
  event_id: string;
  outlet_id: string;
  url: string;
  headline: string;
  published_at: string;
  full_text: string;
  extraction_quality?: "full" | "partial" | "headline_only" | "failed" | "unknown" | string;
};

export type HeadlineSnapshot = {
  id: string;
  article_id: string;
  headline_text: string;
  captured_at: string;
  source: "wayback" | "live";
};

export type Stakeholder = {
  id: string;
  event_id: string;
  name: string;
  role: string;
  first_appeared_at: string | null;
};


export type Phrase = { text: string; type: "active" | "passive" | "agentless" };

type SignalMeta = {
  evidence_count?: number;
  analysis_status?: string;
  analysis_method?: string;
};

export type SignalsBundle = {
  source_attribution: ({ article_id: string; official_ratio: number | null; independent_ratio: number | null } & SignalMeta)[];
  agency_framing: ({ article_id: string; agency_score: number | null; example_phrases: Phrase[] } & SignalMeta)[];
  language_intensity: ({
    article_id: string;
    emotional_score: number | null;
    certainty_score: number | null;
    urgency_score: number | null;
  } & SignalMeta)[];
  coverage_matrix: { article_id: string; stakeholder_id: string; present: boolean }[];
};

export type EventBundle = {
  event: EventRow;
  outlets: Outlet[];
  articles: Article[];
  snapshots: HeadlineSnapshot[];
  stakeholders: Stakeholder[];
  signals: SignalsBundle;
};

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePhrases(value: unknown): Phrase[] {
  let parsed = value;
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch { parsed = []; }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((phrase) => {
    if (typeof phrase === "string") return [{ text: phrase, type: "active" as const }];
    if (!phrase || typeof phrase !== "object") return [];
    const text = "text" in phrase && typeof phrase.text === "string" ? phrase.text : "";
    const type = "type" in phrase && (phrase.type === "active" || phrase.type === "passive" || phrase.type === "agentless") ? phrase.type : "active";
    return text ? [{ text, type } as Phrase] : [];
  });
}

export async function fetchSampleEventId(): Promise<string> {
  const { data, error } = await supabase
    .from("events")
    .select("id")
    .order("first_reported_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No events found. Search for a topic on the Analyze page first.");
  return data.id;
}



export async function fetchEventBundle(eventId: string): Promise<EventBundle> {
  const [
    eventRes,
    articlesRes,
    stakeholdersRes,
  ] = await Promise.all([
    supabase.from("events").select("*").eq("id", eventId).maybeSingle(),
    supabase.from("articles").select("*").eq("event_id", eventId).order("published_at"),
    supabase.from("stakeholders").select("*").eq("event_id", eventId).order("first_appeared_at"),
  ]);
  if (eventRes.error) throw eventRes.error;
  if (!eventRes.data) throw new Error("Event not found");
  if (articlesRes.error) throw articlesRes.error;
  if (stakeholdersRes.error) throw stakeholdersRes.error;

  const articles = (articlesRes.data ?? []) as Article[];
  const articleIds = articles.map((a) => a.id);
  const outletIds = Array.from(new Set(articles.map((a) => a.outlet_id)));

  if (articleIds.length === 0 || outletIds.length === 0) {
    return {
      event: eventRes.data as EventRow,
      outlets: [],
      articles: [],
      snapshots: [],
      stakeholders: (stakeholdersRes.data ?? []) as Stakeholder[],
      signals: {
        source_attribution: [],
        agency_framing: [],
        language_intensity: [],
        coverage_matrix: [],
      },
    };
  }

  const [
    outletsRes,
    snapsRes,
    ssaRes,
    safRes,
    sliRes,
    covRes,
  ] = await Promise.all([
    supabase.from("outlets").select("*").in("id", outletIds),
    supabase.from("headline_snapshots").select("*").in("article_id", articleIds).order("captured_at"),
    supabase.from("signals_source_attribution").select("*").in("article_id", articleIds),
    supabase.from("signals_agency_framing").select("*").in("article_id", articleIds),
    supabase.from("signals_language_intensity").select("*").in("article_id", articleIds),
    supabase.from("coverage_matrix").select("*").in("article_id", articleIds),
  ]);

  for (const r of [outletsRes, snapsRes, ssaRes, safRes, sliRes, covRes]) {
    if (r.error) throw r.error;
  }

  return {
    event: eventRes.data as EventRow,
    outlets: (outletsRes.data ?? []) as Outlet[],
    articles,
    snapshots: (snapsRes.data ?? []) as HeadlineSnapshot[],
    stakeholders: (stakeholdersRes.data ?? []) as Stakeholder[],
    signals: {
      source_attribution: (ssaRes.data ?? []).map((r) => ({
        article_id: r.article_id,
        official_ratio: nullableNumber(r.official_ratio),
        independent_ratio: nullableNumber(r.independent_ratio),
        evidence_count: r.evidence_count,
        analysis_status: r.analysis_status,
        analysis_method: r.analysis_method,
      })),
      agency_framing: (safRes.data ?? []).map((r) => ({
        article_id: r.article_id,
        agency_score: nullableNumber(r.agency_score),
        example_phrases: normalizePhrases(r.example_phrases),
        evidence_count: r.evidence_count,
        analysis_status: r.analysis_status,
        analysis_method: r.analysis_method,
      })),
      language_intensity: (sliRes.data ?? []).map((r) => ({
        article_id: r.article_id,
        emotional_score: nullableNumber(r.emotional_score),
        certainty_score: nullableNumber(r.certainty_score),
        urgency_score: nullableNumber(r.urgency_score),
        evidence_count: r.evidence_count,
        analysis_status: r.analysis_status,
        analysis_method: r.analysis_method,
      })),
      coverage_matrix: (covRes.data ?? []) as SignalsBundle["coverage_matrix"],
    },
  };
}

// ---- Saved Analyses ----

export async function saveAnalysis(eventId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to save an analysis.");

  const { error } = await supabase
    .from("saved_analyses")
    .upsert({ user_id: user.id, event_id: eventId }, { onConflict: "user_id,event_id" });
  if (error) throw error;
}

export async function unsaveAnalysis(eventId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");

  const { error } = await supabase
    .from("saved_analyses")
    .delete()
    .eq("user_id", user.id)
    .eq("event_id", eventId);
  if (error) throw error;
}

export async function isEventSaved(eventId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("saved_analyses")
    .select("event_id")
    .eq("user_id", user.id)
    .eq("event_id", eventId)
    .maybeSingle();
  return !!data;
}

export type SavedAnalysisRow = {
  id: string;
  user_id: string;
  event_id: string;
  created_at: string;
};

export async function fetchSavedAnalyses(): Promise<SavedAnalysisRow[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("saved_analyses")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

const ANALYZE_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://lnycmvscjimmdritmoul.supabase.co";
const ANALYZE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxueWNtdnNjamltbWRyaXRtb3VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwMDMzMzAsImV4cCI6MjEwMDU3OTMzMH0.FDxriw9LT9NOkXnvvOtvACMHV000owMCENBOqk8ydDo";
const LOCAL_BACKEND_URL = import.meta.env.VITE_LOCAL_BACKEND_URL || "http://127.0.0.1:8000";

export async function analyzeArticle(
  articleId: string,
  text: string,
  outletId: string,
  isHeadline: boolean = false,
): Promise<void> {
  // During local development call the local FastAPI process directly. A
  // hosted Edge Function cannot reach a developer machine's localhost.
  if (import.meta.env.DEV) {
    const response = await fetch(`${LOCAL_BACKEND_URL.replace(/\/$/, "")}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        article_id: articleId,
        text,
        outlet_id: outletId,
        is_headline: isHeadline,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Local analysis failed: ${error || response.statusText}`);
    }
    return;
  }

  // Use Supabase Edge Function — never expose service-role key, use anon key + user JWT
  const { data: sessData } = await supabase.auth.getSession();
  const token = sessData.session?.access_token ?? ANALYZE_ANON_KEY;

  const response = await fetch(`${ANALYZE_SUPABASE_URL}/functions/v1/analyze-article`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANALYZE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      article_id: articleId,
      text,
      outlet_id: outletId,
      is_headline: isHeadline,
    }),
  });

  // Edge Function returns 202 when backend times out but queues the job — treat as success
  if (response.status === 202) return;

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Analysis failed: ${error}`);
  }
}

