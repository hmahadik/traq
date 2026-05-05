# Timesheet Prompt Preview — Design Spec

**Date:** 2026-05-05
**Branch:** feat/timesheet-preview
**Status:** Approved, awaiting implementation

---

## Goal

Before any LLM call fires for timesheet AI notes, show the user every prompt that will be sent. This serves two purposes:

1. **LLM transparency** — the user sees exactly what the model will be asked to write.
2. **Data validation** — the structured inputs (hours, session summaries, git commits) expose attribution/bucketing correctness before notes are generated.

---

## Flow

**Current:** Generate Notes → fetch data + LLM in one shot → notes appear in table.

**New:** Generate Notes → fetch data + build prompts → **preview modal** → user confirms → LLM calls fire.

The modal sits between data preparation and LLM execution. All data is already computed when the modal opens; the user is only reviewing before the expensive/irreversible step.

---

## Backend

### New binding

```go
func (a *App) GetTimesheetPrompts(startDate, endDate string) ([]TimesheetPromptPreview, error)
```

Internally runs the same path as `GenerateTimesheet` (build timesheet → resolve FF mappings) but stops before the LLM call. For each non-skipped, non-unattributed entry it calls `buildAgentInput` then `aiagent.BuildPrompt`, collecting the result. No new prompt logic — just a new exit point in the existing pipeline.

### New response type

```go
// TimesheetPromptPreview is the per-row payload returned by GetTimesheetPrompts.
// The structured fields drive the collapsible sections in the modal;
// FullPrompt is the verbatim string that will be sent to the LLM.
type TimesheetPromptPreview struct {
    Date         string   `json:"date"`         // "YYYY-MM-DD"
    Project      string   `json:"project"`      // canonical Traq project name
    Hours        float64  `json:"hours"`        // rounded hours for this row
    AISummaries  []string `json:"aiSummaries"`  // per-session summaries attributed to this project
    GitCommits   []string `json:"gitCommits"`   // commit messages attributed to this project
    WindowTitles []string `json:"windowTitles"` // fallback window titles (shown only if no summaries/commits)
    FullPrompt   string   `json:"fullPrompt"`   // verbatim prompt string
}
```

Skipped and unattributed rows are excluded from the response — they won't be sent to the LLM so they have no prompt to preview.

---

## Frontend

### Trigger

The existing "Generate Notes" button calls `GetTimesheetPrompts` instead of `GenerateTimesheet`. If the response is non-empty, the preview modal opens. On confirm, `GenerateTimesheet` fires as before. On cancel, nothing happens.

If `GetTimesheetPrompts` returns an empty array (all rows skipped/unattributed), skip the modal and proceed directly — there is nothing to send.

### Modal structure

**Header:**
> Review Prompts · N rows · Sending to: [backend name]

**Body — top of scroll area:**
The instruction preamble (the "write a concise paragraph…" directive) is shown once here, in a muted `<pre>` block. It is identical for every row so repeating it per card would be noise.

**Body — per-row cards**, ordered the same as the timesheet preview table:

Each card has:
- **Sticky sub-header** (always visible): `ProjectName · YYYY-MM-DD · X.XX hrs`
- **Collapsible section — Session Summaries** (item count shown in toggle label): starts expanded; lists `aiSummaries` strings
- **Collapsible section — Git Commits** (item count shown in toggle label): starts expanded; lists `gitCommits` strings
- **Collapsible section — Window Titles** (item count shown in toggle label): starts expanded; lists `windowTitles` strings; only rendered if no summaries and no commits exist (fallback case)
- **"Show full prompt" toggle**: reveals `fullPrompt` in a `<pre>` block for users who want to inspect the exact text

**Warning indicator:** Cards where all three data sources are empty (no summaries, no commits, no window titles) get a subtle visual warning — the LLM will have only the project name and hours to work from.

**Footer:**
- Cancel (dismisses modal, no LLM calls)
- **Generate Notes** (primary action — closes modal, fires `GenerateTimesheet`)

### State

The modal is stateless beyond open/closed. It receives the `TimesheetPromptPreview[]` array as a prop and renders it. No edits are possible — the preview is read-only.

---

## Out of Scope

- Editing prompts before sending (read-only by design)
- Per-section editing or overrides
- Persisting the preview across sessions
- Showing prompts for already-generated notes (post-hoc view)

---

## Files Affected

**Backend (new):**
- `internal/service/timesheet.go` — add `TimesheetPromptPreview` type and `BuildPromptPreviews` method
- `app.go` — add `GetTimesheetPrompts` binding

**Frontend (new):**
- `frontend/src/components/reports/TimesheetPromptPreviewModal.tsx` — the modal component

**Frontend (modified):**
- `frontend/src/api/client.ts` — add `getTimesheetPrompts` call
- `frontend/src/api/hooks.ts` — add `useTimesheetPrompts` hook (or inline the call)
- `frontend/src/pages/ReportsPage.tsx` (or wherever the Generate Notes button lives) — wire modal into the flow

**Generated (regenerate after backend changes):**
- `frontend/wailsjs/go/main/App.ts`
- `frontend/wailsjs/go/models.ts`
