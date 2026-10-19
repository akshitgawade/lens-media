import { useState, useMemo } from "react";
import { X } from "lucide-react";
import type { EventBundle, Phrase } from "@/lib/narrative-data";

type OutletData = {
  id: string;
  name: string;
  source: { official: number; independent: number; hasEvidence: boolean; evidenceCount: number } | null;
  agency: { score: number; phrases: Phrase[] } | null;
  intensity: { Emotional: number; Certainty: number; Urgency: number } | null;
};

export function OutletComparison({
  outlets,
  sourceByOutlet,
  agencyByOutlet,
  intensityByOutlet,
  onClose,
}: {
  outlets: EventBundle["outlets"];
  sourceByOutlet: { outlet: string; official: number; independent: number; hasEvidence: boolean; evidenceCount: number }[];
  agencyByOutlet: { outlet: string; score: number; phrases: Phrase[] }[];
  intensityByOutlet: { outlet: string; Emotional: number; Certainty: number; Urgency: number }[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (name: string) => {
    setSelected((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name);
      if (prev.length >= 3) return prev;
      return [...prev, name];
    });
  };

  const outletData: OutletData[] = useMemo(() => {
    return selected.map((name) => {
      const outlet = outlets.find((o) => o.name === name);
      const src = sourceByOutlet.find((r) => r.outlet === name) ?? null;
      const ag = agencyByOutlet.find((r) => r.outlet === name) ?? null;
      const int = intensityByOutlet.find((r) => r.outlet === name) ?? null;
      return { id: outlet?.id ?? name, name, source: src, agency: ag, intensity: int };
    });
  }, [selected, outlets, sourceByOutlet, agencyByOutlet, intensityByOutlet]);

  if (selected.length < 2) {
    return (
      <div className="paper-card p-4">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Outlet comparison</p>
          <button type="button" onClick={onClose} className="text-ink-muted hover:text-ink" aria-label="Close comparison">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 font-serif text-sm text-ink-muted">Select at least 2 outlets to compare.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {outlets.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => toggle(o.name)}
              className={`rounded-md border px-2.5 py-1 text-xs font-mono transition ${
                selected.includes(o.name)
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-rule bg-card text-ink-muted hover:bg-secondary"
              }`}
            >
              {o.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="paper-card p-4">
      <div className="flex items-center justify-between border-b border-rule pb-3">
        <p className="eyebrow">Comparing {selected.length} outlets</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelected([])}
            className="text-[10px] font-mono text-ink-muted hover:text-ink"
          >
            Reset
          </button>
          <button type="button" onClick={onClose} className="text-ink-muted hover:text-ink" aria-label="Close comparison">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Outlet selector chips */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {outlets.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => toggle(o.name)}
            className={`rounded-md border px-2.5 py-1 text-xs font-mono transition ${
              selected.includes(o.name)
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-rule bg-card text-ink-muted hover:bg-secondary"
            }`}
          >
            {o.name}
          </button>
        ))}
      </div>

      {/* Comparison table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule">
              <th className="py-2 pr-4 text-left font-serif text-xs text-ink-muted">Signal</th>
              {outletData.map((o) => (
                <th key={o.id} className="py-2 px-3 text-center font-serif text-xs">
                  {o.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono text-xs">
            {/* Source Attribution */}
            <tr className="border-b border-rule/50">
              <td className="py-2.5 pr-4 font-serif text-xs text-ink-muted">Source Attribution</td>
              {outletData.map((o) => (
                <td key={o.id} className="py-2.5 px-3 text-center">
                  {o.source?.hasEvidence ? (
                    <span className="text-ink">
                      {o.source.official}% official · {o.source.independent}% independent
                    </span>
                  ) : (
                    <span className="text-ink-muted italic">No evidence</span>
                  )}
                </td>
              ))}
            </tr>
            {/* Agency Framing */}
            <tr className="border-b border-rule/50">
              <td className="py-2.5 pr-4 font-serif text-xs text-ink-muted">Agency Framing</td>
              {outletData.map((o) => (
                <td key={o.id} className="py-2.5 px-3 text-center">
                  {o.agency ? (
                    <span className="text-ink">{o.agency.score}/100</span>
                  ) : (
                    <span className="text-ink-muted italic">No evidence</span>
                  )}
                </td>
              ))}
            </tr>
            {/* Language Intensity */}
            <tr>
              <td className="py-2.5 pr-4 font-serif text-xs text-ink-muted">Language Intensity</td>
              {outletData.map((o) => (
                <td key={o.id} className="py-2.5 px-3 text-center">
                  {o.intensity ? (
                    <span className="text-ink">
                      E:{o.intensity.Emotional} C:{o.intensity.Certainty} U:{o.intensity.Urgency}
                    </span>
                  ) : (
                    <span className="text-ink-muted italic">No evidence</span>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
