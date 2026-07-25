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

export type SignalsBundle = {
  source_attribution: { article_id: string; official_ratio: number; independent_ratio: number }[];
  agency_framing: { article_id: string; agency_score: number; example_phrases: Phrase[] }[];
  language_intensity: {
    article_id: string;
    emotional_score: number;
    certainty_score: number;
    urgency_score: number;
  }[];
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

export type AnalyzeArticleInput = {
  article_id: string;
  text: string;
  outlet_id: string;
  is_headline?: boolean;
};

export type AnalyzeArticleResult =
  | {
      success: true;
      article_id: string;
      job_id?: string;
      queued?: boolean;
      signals?: Record<string, unknown>;
    }
  | {
      success: false;
      error: string;
    };

export async function fetchSampleEventId(): Promise<string> {
  const { data, error } = await supabase
    .from("events")
    .select("id")
    .order("first_reported_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No sample event seeded.");
  return data.id;
}

function getSupabaseEnv() {
  const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const publishableKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Missing Supabase environment variables for analyzeArticle().");
  }

  return { url, publishableKey };
}

export async function analyzeArticle(input: AnalyzeArticleInput): Promise<AnalyzeArticleResult> {
  const { url, publishableKey } = getSupabaseEnv();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  const response = await fetch(`${url.replace(/\/$/, "")}/functions/v1/analyze-article`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken ?? publishableKey}`,
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => ({}))) as AnalyzeArticleResult;

  if (!response.ok) {
    return {
      success: false,
      error:
        (payload && "error" in payload && payload.error) ||
        `Edge function request failed with ${response.status}`,
    };
  }

  return payload.success
    ? payload
    : {
        success: false,
        error: "Unexpected edge function response.",
      };
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
      source_attribution: (ssaRes.data ?? []) as SignalsBundle["source_attribution"],
      agency_framing: (safRes.data ?? []).map((r: { article_id: string; agency_score: number; example_phrases: unknown }) => ({
        article_id: r.article_id,
        agency_score: Number(r.agency_score),
        example_phrases: (r.example_phrases as Phrase[]) ?? [],
      })),
      language_intensity: (sliRes.data ?? []) as SignalsBundle["language_intensity"],
      coverage_matrix: (covRes.data ?? []) as SignalsBundle["coverage_matrix"],
    },
  };
}
