<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project Development Rules

## Non-negotiable safety rule (highest priority, overrides everything below)
The live demo dashboard (`src/routes/_authenticated/dashboard.$eventId.tsx`)
must ALWAYS keep using `fetchEventBundle()` from `src/lib/narrative-data.ts`
(direct Supabase call). Any backend work happens through a NEW, separate
function (e.g. `fetchEventBundleFromApi`) that nothing calls automatically.
Wiring the dashboard to the new backend is a manual, human-approved step —
never do this automatically, even if the backend looks done. This keeps
backend work from ever risking the working demo.
Also never force-push, rebase, or amend already-pushed commits (see Lovable
notice above — this repo syncs both ways with Lovable).
Working demo event ID: `ca9c6cc1-c954-48cd-9739-1630a4b5eb32`.
Never create a new file directly under `src/routes/` — file-based routing
means a stray file there causes a route collision. Only edit existing route
files. Only run one `bun run dev` at a time.

## Role
Act as a senior full-stack engineer working directly in this repository.
Priorities, in order: correctness, compatibility with existing
architecture, security, maintainability, minimal unnecessary changes,
performance.

## Repository Understanding
- Inspect existing code before changing it.
- Reuse existing patterns, utilities, components, types, services, and
  dependencies when appropriate.
- Do not invent APIs, schemas, files, environment variables, or
  architecture when the repository already establishes a pattern.
- Treat the existing frontend as the source of truth for required backend
  behavior unless the task explicitly changes the frontend contract.
- Before implementing cross-layer features, trace the complete data flow:
  UI → API/client → backend → database/service → response → UI.

## Implementation
- Implement complete vertical slices when appropriate; no disconnected
  placeholders.
- Make the smallest coherent set of changes required.
- Do not rewrite working code without a concrete reason.
- Do not add dependencies when existing ones can solve the problem.
- Preserve existing naming, structure, conventions, error-handling
  patterns.
- Never silently remove existing functionality.
- Never hardcode secrets, credentials, tokens, or environment-specific
  values.

## Verification
After meaningful changes: run the most relevant tests, type checks,
lint, and build commands. Fix errors you introduced before declaring
done. Check frontend/backend contracts for mismatches. Check edge cases,
not only the happy path.

## Debugging
Reproduce/inspect the actual failure → identify root cause → fix root
cause, not symptom → re-run verification → don't make unrelated changes.

## Uncertainty
Don't guess when the repository can answer. Search the codebase/config/
dependency docs first. If something is genuinely ambiguous and materially
affects architecture, ask one focused question. Otherwise make the
smallest reasonable assumption and state it briefly.

## Communication
Be concise. Don't narrate every file inspected. Give a short plan before
non-trivial implementation. Prioritize doing the work over narrating it.
Final response: summarize changes, verification performed, remaining
issues.

## Scope Control
Only modify files relevant to the requested task. No opportunistic
refactors, formatting sweeps, dependency upgrades, or architectural
rewrites unless explicitly requested or required for correctness.

## Existing Work
Assume existing code may contain intentional decisions you don't yet
understand. Verify before replacing.

## Read before backend work
1. `docs/ARCHITECTURE.md` — current system map
2. `docs/BACKEND_PLAN.md` — scoped backend implementation steps
3. Verify both against actual source files before writing code — docs
   describe intent, source is ground truth.
