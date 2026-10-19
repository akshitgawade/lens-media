import { Inbox, FileText, Eye, Users, MessageSquareQuote, Clock } from "lucide-react";

/** Reusable empty states for dashboard sections. */
export function EmptyState({
  icon: Icon,
  title,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-rule bg-secondary/20 px-6 py-8 text-center">
      <Icon className="h-6 w-6 text-ink-muted/50" />
      <p className="font-serif text-sm font-medium text-ink">{title}</p>
      <p className="max-w-xs text-xs leading-relaxed text-ink-muted">{detail}</p>
    </div>
  );
}

export function NoArticlesEmpty() {
  return (
    <EmptyState
      icon={Inbox}
      title="No articles found"
      detail="No articles were matched for this event. Try searching with different keywords or outlets."
    />
  );
}

export function PartialExtractionEmpty({ count }: { count: number }) {
  return (
    <EmptyState
      icon={FileText}
      title={`${count} article${count !== 1 ? "s" : ""} with limited text`}
      detail="Some articles could not be fully extracted. Scores from these articles may be less representative."
    />
  );
}

export function HeadlineOnlyEmpty({ count }: { count: number }) {
  return (
    <EmptyState
      icon={Eye}
      title={`${count} headline-only article${count !== 1 ? "s" : ""}`}
      detail="Only the headline was captured. Scores from headline-only articles reflect limited text."
    />
  );
}

export function NoAttributionEmpty() {
  return (
    <EmptyState
      icon={MessageSquareQuote}
      title="No attributable sources detected"
      detail="No quote or attribution cues were found in the available text. This does not mean no viewpoints exist."
    />
  );
}

export function NoHeadlineSnapshotsEmpty() {
  return (
    <EmptyState
      icon={Clock}
      title="No headline snapshots"
      detail="No historical headline snapshots are available yet. Snapshots are captured when articles are first indexed."
    />
  );
}

export function NoStakeholdersEmpty() {
  return (
    <EmptyState
      icon={Users}
      title="No stakeholders identified"
      detail="No stakeholder groups were identified for this event. The coverage matrix will appear once stakeholders are detected."
    />
  );
}
