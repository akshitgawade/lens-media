import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/methodology")({
  head: () => ({
    meta: [
      { title: "Methodology — Narrative Lens" },
      {
        name: "description",
        content:
          "How Narrative Lens measures sourcing, framing, tone, and coverage, and why every output is an observation, not a verdict.",
      },
      { property: "og:title", content: "Methodology — Narrative Lens" },
      {
        property: "og:description",
        content: "Plain-language explanations of each signal we surface.",
      },
    ],
  }),
  component: MethodologyPage,
});

const signals = [
  {
    n: "01",
    name: "Source Attribution Ratio",
    body: "For each article we tag quoted sources as either official (government, police, corporate spokespeople, credentialed experts) or independent (eyewitnesses, affected residents, NGOs). The ratio tells you whose voice dominates a story. It does not judge whether that mix is appropriate.",
  },
  {
    n: "02",
    name: "Agency Framing",
    body: "We score sentences on active vs. passive/agentless construction. 'Police shoot man' assigns clear agency; 'Man dies in police encounter' obscures it. A low score means agency is often removed from actors. A high score means actors are named. This is descriptive linguistics, not an ethics claim.",
  },
  {
    n: "03",
    name: "Language Intensity",
    body: "Three sub-scores measure emotional load (charged adjectives), certainty (hedging vs. absolute claims), and urgency (present-tense, imperative, and time-pressure vocabulary). Higher is not 'worse': human-interest reporting is often high-emotion by design.",
  },
  {
    n: "04",
    name: "Perspective Coverage Matrix",
    body: "For each event we identify stakeholders (victim, police, government, witnesses, experts, advocacy groups). The matrix shows which stakeholders are represented in each outlet's coverage. Absence is a signal; it is not proof of intent.",
  },
  {
    n: "05",
    name: "Headline Diff (FrameShift Replay)",
    body: "We snapshot headlines over time, from live pages and archives, and diff them. Additions, removals, and rewordings are highlighted so you can see how framing evolved after publication.",
  },
  {
    n: "06",
    name: "Narrative Evolution Timeline",
    body: "A chronological view of when each stakeholder or angle first appeared in coverage. This helps you see whether the story broadened, narrowed, or shifted its center of gravity over time.",
  },
];

function MethodologyPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-20">
      <p className="eyebrow">Methodology</p>
      <h1 className="headline mt-3 text-5xl">Observations, not verdicts.</h1>
      <div className="mt-6 border-l-2 border-accent/60 bg-secondary/40 px-6 py-5">
        <p className="eyebrow">Interpretive lens</p>
        <h2 className="headline mt-2 text-3xl">Where these ideas come from.</h2>
        <p className="mt-3 max-w-3xl font-serif text-lg leading-relaxed">
          These signals are inspired by decades of media framing scholarship, including
          Herman &amp; Chomsky's <em>Propaganda Model</em>, Entman's framing theory, and
          journalism ethics on sourcing and agency. We treat these frameworks as{" "}
          <strong>interpretive lenses</strong>, not as the truth about any specific article.
        </p>
        <p className="mt-3 max-w-3xl font-serif text-lg leading-relaxed">
          The metrics you see are aids for thinking, not machine verdicts. Two thoughtful
          readers can look at the same Source Attribution Ratio and reasonably disagree
          about what it means.
        </p>
      </div>
      <p className="mt-8 max-w-2xl font-serif text-xl leading-relaxed text-ink-muted">
        Narrative Lens provides six features that surface measurable properties of
        text&mdash;allowing you to inspect language, sourcing, framing, perspective gaps,
        narrative evolution, and headline shifts. These tools describe exactly what a
        story emphasizes, giving you the evidence to analyze, argue with, or dismiss the
        data without us telling you what to conclude.
      </p>

      <div className="mt-16 space-y-6">
        {signals.map((s) => (
          <article
            key={s.n}
            className="paper-card grid gap-6 p-6 md:grid-cols-12"
          >
            <div className="md:col-span-3">
              <p className="font-mono text-xs text-ink-muted">{s.n}</p>
              <h2 className="headline mt-1 text-2xl">{s.name}</h2>
            </div>
            <p className="font-serif text-lg leading-relaxed md:col-span-9">{s.body}</p>
          </article>
        ))}
      </div>

      <section className="mt-20 rule-divider pt-12">
        <p className="eyebrow">Limitations</p>
        <ul className="mt-6 space-y-3 font-serif text-lg">
          <li>· NLP scoring is approximate; edge cases and irony are hard.</li>
          <li>· Archive coverage of a headline is incomplete for many outlets.</li>
          <li>· Stakeholder taxonomies are event-specific and imperfect.</li>
          <li>· Our sample data is illustrative. Real ingestion adds noise you should expect.</li>
        </ul>
      </section>
    </div>
  );
}
