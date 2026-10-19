import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

function useSlide(dir: "left" | "right" = "left") {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { el.style.opacity = "1"; el.style.transform = "none"; return; }
    el.style.opacity = "0";
    el.style.transform = dir === "left" ? "translateX(-28px)" : "translateX(28px)";
    el.style.transition = "transform 700ms cubic-bezier(0.22,1,0.36,1), opacity 700ms ease-out";
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.style.opacity = "1"; el.style.transform = "translateX(0)"; obs.disconnect(); } }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [dir]);
  return ref;
}

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — Narrative Lens" },
      { name: "description", content: "Sign in or create an account to open the comparison dashboard." },
      { property: "og:title", content: "Sign in — Narrative Lens" },
      { property: "og:description", content: "Access the Narrative Lens comparison dashboard." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: search.redirect ?? "/account", replace: true });
      else setChecking(false);
    });
  }, [navigate, search.redirect]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/account" },
        });
        if (error) throw error;
        setInfo("Check your email to confirm — then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: search.redirect ?? "/account" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const leftRef = useSlide("left");
  const rightRef = useSlide("right");
  if (checking) return <div className="mx-auto max-w-6xl px-6 py-20"><div className="h-64 animate-pulse rounded-md bg-secondary/50" /></div>;
  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-2 overflow-hidden">
      <div ref={leftRef}>
        <p className="eyebrow">Access</p>
        <h1 className="headline mt-3 text-5xl">
          {mode === "signin" ? "Sign in." : "Create your account."}
        </h1>
        <p className="mt-4 max-w-md text-ink-muted">
          The comparison dashboard is gated so we can track your saved analyses and
          rate-limit ingestion fairly. Email &amp; password only — no tracking.
        </p>
      </div>

      <div ref={rightRef} className="relative">
        <form onSubmit={submit} className="paper-card relative space-y-4 p-8 will-change-transform transition-[transform,box-shadow] duration-[1600ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:shadow-[0_20px_40px_-16px_oklch(0_0_0/0.12)]">
        <div className="flex gap-2 border-b border-rule pb-4">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null); setInfo(null); }}
              className={`rounded-md px-3 py-1.5 text-sm ${mode === m ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              {m === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>
        <label className="block text-sm">
          <span className="eyebrow">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-md border border-rule bg-background px-3 py-2.5 outline-none focus:border-ink focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="block text-sm">
          <span className="eyebrow">Password</span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-md border border-rule bg-background px-3 py-2.5 outline-none focus:border-ink focus:ring-2 focus:ring-ring"
          />
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {info ? <p className="text-sm text-success">{info}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-accent disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mode === "signin" ? "Sign in" : "Create account"}
        </button>
        </form>
      </div>
    </div>
  );
}
