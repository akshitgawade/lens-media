/** Extraction quality badge for article text coverage. */
const LABELS: Record<string, { label: string; color: string }> = {
  full: { label: "Full article", color: "border-green-300/40 bg-green-50/50 text-green-700" },
  partial: { label: "Partial text", color: "border-amber-300/40 bg-amber-50/50 text-amber-700" },
  headline_only: { label: "Headline only", color: "border-orange-300/40 bg-orange-50/50 text-orange-700" },
  failed: { label: "Extraction failed", color: "border-red-300/40 bg-red-50/50 text-red-700" },
  unknown: { label: "Text quality unknown", color: "border-rule bg-secondary/20 text-ink-muted" },
};

export function ExtractionBadge({ quality }: { quality?: string }) {
  const q = quality ?? "unknown";
  const info = LABELS[q] ?? LABELS.unknown;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono ${info.color}`}>
      {info.label}
    </span>
  );
}
