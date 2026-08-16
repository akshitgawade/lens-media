import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, X } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Narrative Lens — See how coverage differs, measurably" },
      {
        name: "description",
        content:
          "Compare how outlets cover the same news event. Narrative Lens visualizes measurable changes in language, sourcing, emphasis, and perspective — never a verdict.",
      },
      { property: "og:title", content: "Narrative Lens — See how coverage differs, measurably" },
      {
        property: "og:description",
        content:
          "Compare how outlets cover the same news event. Narrative Lens visualizes measurable changes in language, sourcing, emphasis, and perspective — never a verdict.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div>
      {/* HERO */}
      <section className="border-b border-rule">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-12 lg:py-28">
          <div className="lg:col-span-8">
            <h1 className="headline mt-6 text-5xl leading-[0.98] sm:text-6xl lg:text-7xl">
              See how the same story is <em className="text-accent not-italic">told differently</em>.
            </h1>
            <p className="mt-6 max-w-2xl font-serif text-xl leading-relaxed text-ink-muted">
              Instead of deciding what's true, Narrative Lens visualizes measurable
              changes in language, sourcing, emphasis, and perspective across outlets
              and over time.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                to="/analyze"
                className="group inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-accent"
              >
                Try a sample analysis
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/methodology"
                className="inline-flex items-center gap-2 rounded-md border border-rule px-5 py-3 text-sm font-medium hover:bg-secondary"
              >
                How we measure
              </Link>
            </div>
          </div>
          <aside className="lg:col-span-4 lg:border-l lg:border-rule lg:pl-8">
            <p className="eyebrow">In this issue</p>
            <ul className="mt-4 space-y-4 text-base">
              {[
                ["01", "Source Attribution Ratio"],
                ["02", "Agency Framing"],
                ["03", "Language Intensity"],
                ["04", "Perspective Coverage Matrix"],
                ["05", "Headline Diff (FrameShift Replay)"],
                ["06", "Narrative Evolution Timeline"],
              ].map(([n, t]) => (
                <li key={n} className="flex gap-3 border-b border-rule pb-3">
                  <span className="font-mono text-sm text-ink-muted">{n}</span>
                  <span className="font-serif">{t}</span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      {/* WHAT WE SURFACE / REJECT */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="headline mt-3 text-4xl sm:text-5xl">Your Toolkit, Not Our Verdict</h2>
        <p className="mt-4 max-w-2xl text-ink-muted">
          Narrative Lens provides the instruments for your inspection, not the conclusions for your judgment.
        </p>

        <div className="mt-10 overflow-hidden rounded-md border border-rule">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-rule">
                <th className="w-1/2 bg-success/10 px-6 py-4">
                  <p className="eyebrow text-success">We Surface</p>
                </th>
                <th className="w-1/2 bg-accent/10 px-6 py-4">
                  <p className="eyebrow text-accent">We Reject</p>
                </th>
              </tr>
            </thead>
            <tbody className="font-serif text-base">
              {[
                [
                  "Measurable Signals",
                  "Quantifiable data on language, sourcing, and framing for your analysis.",
                  "Binary Labels",
                  "We apply no \u201Cbiased\u201D or \u201Cpropaganda\u201D tags.",
                ],
                [
                  "Evidence",
                  "Raw materials provided for you to interpret.",
                  "AI Verdicts",
                  "We make no automated declarations of truth.",
                ],
                [
                  "Perspective Gaps",
                  "Visualizations highlighting what appears or is missing across outlets.",
                  "Spectrum Ratings",
                  "We offer no reductive left\u2013right scores.",
                ],
                [
                  "Narrative Evolution",
                  "Timelines tracking how headlines and framing shift over time.",
                  "Content Suppression",
                  "We engage in no flagging, downranking, or hiding of coverage.",
                ],
              ].map(([surfaceTitle, surfaceBody, rejectTitle, rejectBody], i) => (
                <tr key={i} className="border-b border-rule last:border-b-0">
                  <td className="bg-success/[0.06] px-6 py-4 align-top">
                    <div className="flex gap-3">
                      <Check className="mt-1 h-4 w-4 flex-shrink-0 text-success" />
                      <span>
                        <strong>{surfaceTitle}.</strong> <span className="text-ink-muted">{surfaceBody}</span>
                      </span>
                    </div>
                  </td>
                  <td className="bg-accent/[0.06] px-6 py-4 align-top">
                    <div className="flex gap-3">
                      <X className="mt-1 h-4 w-4 flex-shrink-0 text-accent" />
                      <span>
                        <strong>{rejectTitle}.</strong> <span className="text-ink-muted">{rejectBody}</span>
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}
