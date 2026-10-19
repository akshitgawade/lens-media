-- Preserve the distinction between measured zero and unavailable evidence.
-- Existing numeric values remain valid; newly computed rows may be NULL when
-- the available text cannot support a particular signal.

alter table public.articles
  add column if not exists extraction_quality text not null default 'unknown';

alter table public.signals_source_attribution
  add column if not exists evidence_count integer not null default 0,
  add column if not exists analysis_status text not null default 'legacy',
  add column if not exists analysis_method text not null default 'legacy';

alter table public.signals_agency_framing
  add column if not exists evidence_count integer not null default 0,
  add column if not exists analysis_status text not null default 'legacy',
  add column if not exists analysis_method text not null default 'legacy';

alter table public.signals_language_intensity
  add column if not exists evidence_count integer not null default 0,
  add column if not exists analysis_status text not null default 'legacy',
  add column if not exists analysis_method text not null default 'legacy';

alter table public.signals_source_attribution
  alter column official_ratio drop not null,
  alter column independent_ratio drop not null;

alter table public.signals_agency_framing
  alter column agency_score drop not null;

alter table public.signals_language_intensity
  alter column emotional_score drop not null,
  alter column certainty_score drop not null,
  alter column urgency_score drop not null;

update public.articles
set extraction_quality = case
  when length(trim(full_text)) = 0 then 'failed'
  when length(trim(full_text)) < 500 then 'partial'
  else 'full'
end
where extraction_quality = 'unknown';

update public.signals_source_attribution
set analysis_status = case
  when official_ratio is null and independent_ratio is null then 'no_evidence'
  when coalesce(evidence_count, 0) = 0 and official_ratio = 0 and independent_ratio = 0 then 'legacy_unknown'
  else 'analyzed'
end
where analysis_status = 'legacy';

update public.signals_agency_framing
set analysis_status = case
  when agency_score is null then 'no_evidence'
  else 'analyzed'
end
where analysis_status = 'legacy';

update public.signals_language_intensity
set analysis_status = case
  when emotional_score is null and certainty_score is null and urgency_score is null then 'no_evidence'
  else 'analyzed'
end
where analysis_status = 'legacy';
