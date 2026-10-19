import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { SmoothScrollProvider } from "@/components/motion/SmoothScrollProvider";
import { Atmosphere } from "@/components/Atmosphere";
import { PaperGrain } from "@/components/PaperGrain";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="eyebrow">Error 404</p>
        <h1 className="headline mt-3 text-5xl">Page not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="eyebrow">Something broke</p>
        <h1 className="headline mt-3 text-3xl">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Narrative Lens — See how coverage differs, measurably" },
      {
        name: "description",
        content:
          "Compare how outlets cover the same news event. Narrative Lens visualizes measurable changes in language, sourcing, emphasis, and perspective — never a verdict.",
      },
      { name: "author", content: "Narrative Lens" },
      { property: "og:title", content: "Narrative Lens — See how coverage differs, measurably" },
      {
        property: "og:description",
        content:
          "Compare how outlets cover the same news event. Narrative Lens visualizes measurable changes in language, sourcing, emphasis, and perspective — never a verdict.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Narrative Lens — See how coverage differs, measurably" },
      { name: "twitter:description", content: "Compare how outlets cover the same news event. Narrative Lens visualizes measurable changes in language, sourcing, emphasis, and perspective — never a verdict." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/a407881b-d434-426e-a3eb-824d4f66e824" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/a407881b-d434-426e-a3eb-824d4f66e824" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function SiteHeader() {
  const [isAuthed, setIsAuthed] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setIsAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setIsAuthed(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return (
    <header className="border-b border-rule bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="Narrative Lens Logo" className="h-14 w-14 object-contain" />
          <span className="headline text-2xl">Narrative Lens</span>
          <span className="eyebrow hidden translate-y-1 sm:inline text-[0.6rem]">A media-literacy tool</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link to="/analyze" activeProps={{ className: "font-semibold" }} className="hover:text-accent transition-colors">
            Analyze
          </Link>
          <Link to="/methodology" activeProps={{ className: "font-semibold" }} className="hover:text-accent transition-colors">
            Methodology
          </Link>
          <Link to={isAuthed ? "/account" : "/auth"} activeProps={{ className: "font-semibold" }} className="hover:text-accent transition-colors">
            {isAuthed ? "Account" : "Sign in"}
          </Link>
        </nav>
      </div>
    </header>
  );
}



function SiteFooter() {
  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  return (
    <footer className="mt-24 border-t border-rule">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p className="shrink-0">© {new Date().getFullYear()} Narrative Lens.</p>
        <p className="flex-1 text-center italic sm:mx-8">
          Observations, not verdicts. See <Link to="/methodology" className="underline hover:text-foreground">methodology</Link> for how each signal is measured.
        </p>
        <div className="flex items-center gap-4 shrink-0">
          <Link to="/methodology" className="hover:text-foreground">Methodology</Link>
          <Link to="/analyze" className="hover:text-foreground">Analyze</Link>
          <button
            type="button"
            onClick={scrollTop}
            className="inline-flex items-center gap-1 rounded-md border border-rule bg-card px-3 py-1.5 text-xs font-medium transition hover:bg-secondary hover:shadow-sm"
          >
            Page up ↑
          </button>
        </div>
      </div>
    </footer>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const isDashboard = router.state.location.pathname.startsWith("/dashboard");
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Splash: rotate 360 (0.6s) + wait 0.5s + fade out (0.4s) = ~1.5s total
    const t = setTimeout(() => setShowSplash(false), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Splash overlay */}
      {showSplash ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-background"
          style={{
            animation: "splashFadeOut 0.4s ease-in 1.1s forwards",
          }}
        >
          <img
            src="/logo.png"
            alt="Narrative Lens"
            className="object-contain"
            style={{
              height: 200,
              width: 200,
              animation: "splashSpin 0.6s ease-in-out forwards, splashLogoFade 0.4s ease-in 1.1s forwards",
            }}
          />
        </div>
      ) : null}
      <SmoothScrollProvider>
        <Atmosphere variant={isDashboard ? "dashboard" : "public"} />
        <PaperGrain variant={isDashboard ? "dashboard" : "public"} />
        <div className="relative z-10 flex min-h-screen flex-col">
          <SiteHeader />
          <main className="flex-1">
            <Outlet />
          </main>
          <SiteFooter />
        </div>
      </SmoothScrollProvider>
    </QueryClientProvider>
  );
}
