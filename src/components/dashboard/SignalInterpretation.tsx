import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { EventBundle } from "@/lib/narrative-data";

/** Concise plain-English interpretation below a signal chart. */
export function SignalInterpretation({
  signal,
  data,
}: {
  signal: "source" | "agency" | "intensity" | "coverage";
  data: any;
}) {
  const text = getInterpretation(signal, data);
  if (!text) return null;
  return (
    <p className="mt-3 border-t border-rule pt-3 font-serif text-xs leading-relaxed text-ink-muted italic">
      {text}
    </p>
  );
}

function getInterpretation(signal: string, data: any): string | null {
  if (signal === "source") {
    const rows = data as { outlet: string; official: number; independent: number; hasEvidence?: boolean }[];
    if (!rows.length) return null;
    const withEvidence = rows.filter((r) => r.hasEvidence);
    if (withEvidence.length === 0)
      return "No attributable sources were detected in the available text. This does not mean no viewpoints exist — only that attribution cues were not found.";
    const avgOfficial = withEvidence.reduce((s, r) => s + r.official, 0) / withEvidence.length;
    if (avgOfficial > 80)
      return "Official sources dominate this coverage. Independent voices appear less frequently in the sampled text.";
    if (avgOfficial < 20)
      return "Independent voices are well-represented in this coverage. Official sources appear less frequently.";
    return "Both official and independent voices appear in this coverage. The balance varies across outlets.";
  }
  if (signal === "agency") {
    const rows = data as { outlet: string; score: number }[];
    if (!rows.length) return null;
    const avg = rows.reduce((s, r) => s + r.score, 0) / rows.length;
    if (avg > 70)
      return "Coverage generally names actors directly. Sentences tend toward active construction with identifiable subjects.";
    if (avg < 40)
      return "Coverage often uses passive or agentless construction. Actors and responsibility are less explicitly named.";
    return "Agency framing varies across outlets. Some name actors directly; others use more passive construction.";
  }
  if (signal === "intensity") {
    const rows = data as { outlet: string; Emotional: number; Certainty: number; Urgency: number }[];
    if (!rows.length) return null;
    const avgEmo = rows.reduce((s, r) => s + r.Emotional, 0) / rows.length;
    const avgCer = rows.reduce((s, r) => s + r.Certainty, 0) / rows.length;
    const avgUrg = rows.reduce((s, r) => s + r.Urgency, 0) / rows.length;
    const parts: string[] = [];
    if (avgEmo > 40) parts.push("emotionally charged");
    if (avgCer > 40) parts.push("highly certain");
    if (avgUrg > 40) parts.push("urgent in tone");
    if (parts.length === 0)
      return "Language intensity is relatively low across all dimensions. The writing stays measured and procedural.";
    return `Coverage tends to be ${parts.join(", ")}. These are descriptions of language patterns, not judgments about accuracy.`;
  }
  if (signal === "coverage") {
    const { stakeholders, outlets, coverage } = data as {
      stakeholders: EventBundle["stakeholders"];
      outlets: EventBundle["outlets"];
      coverage: EventBundle["signals"]["coverage_matrix"];
    };
    if (!stakeholders.length || !outlets.length) return null;
    const total = stakeholders.length * outlets.length;
    const present = coverage.filter((c) => c.present).length;
    const pct = total > 0 ? Math.round((present / total) * 100) : 0;
    if (pct > 70)
      return "Most stakeholder groups appear across most outlets. Coverage breadth is relatively wide in this sample.";
    if (pct < 30)
      return "Only a few stakeholder groups appear across outlets. Significant perspective gaps may exist.";
    return "Coverage breadth is moderate. Some stakeholder groups are well-represented; others appear in fewer outlets.";
  }
  return null;
}

/** Collapsible "How to read this" panel reusing methodology content. */
export function HowToReadPanel({
  signal,
}: {
  signal: "source" | "agency" | "intensity" | "coverage";
}) {
  const [open, setOpen] = useState(false);
  const content = HOW_TO_READ[signal];
  if (!content) return null;

  return (
    <div className="mt-3 flex flex-col items-center">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-md border border-rule bg-card px-3 py-1.5 text-[11px] font-mono text-ink-muted transition hover:bg-secondary hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={open}
      >
        <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        How to read this
      </button>
      {open && (
        <div className="mt-3 w-full max-w-lg rounded-md border border-rule bg-secondary/20 px-5 py-4 text-xs leading-relaxed text-ink-muted animate-in fade-in duration-200">
          {content}
        </div>
      )}
    </div>
  );
}

const HOW_TO_READ: Record<string, React.ReactNode> = {
  source: (
    <>
      <p><strong>Source Attribution Ratio</strong> shows who gets quoted: official voices (government, police, corporate) vs. independent voices (residents, witnesses, advocates).</p>
      <p className="mt-2">A higher official share means institutions speak more; a higher independent share means community voices do. Neither is automatically right — it depends on whether the story is about policy or lived impact.</p>
      <p className="mt-2">A "no evidence" label means no attribution cues were found in the available text. This does not mean no viewpoints exist.</p>
    </>
  ),
  agency: (
    <>
      <p><strong>Agency Framing</strong> scores whether sentences name the actor clearly. "Police shot the man" is active and direct; "Man died in police encounter" is agentless.</p>
      <p className="mt-2">Lower means agency is often removed; higher means actors are usually named. Compare the same event across outlets rather than judging a single score alone.</p>
      <p className="mt-2">The 15–100 display scale is separate from the raw 0–1 score used internally.</p>
    </>
  ),
  intensity: (
    <>
      <p><strong>Language Intensity</strong> measures emotional load, certainty, and urgency in the writing.</p>
      <p className="mt-2">Higher is not worse. Human-interest reporting is often high-emotion by design. Use this to notice when one outlet leans more emotive, more absolute, or more urgent than others on the same facts.</p>
      <p className="mt-2">The 0–100 scale is truthful: a zero means no matching intensity cues were detected.</p>
    </>
  ),
  coverage: (
    <>
      <p><strong>Perspective Coverage Matrix</strong> shows which stakeholder groups appear across different outlets.</p>
      <p className="mt-2">A check means mentioned; empty means not found. Absence is a signal of breadth, not proof of intent.</p>
      <p className="mt-2">Stakeholder taxonomies are event-specific and imperfect. They may miss nuance or group distinct voices.</p>
    </>
  ),
};
