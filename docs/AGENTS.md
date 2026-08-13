# AGENTS — SAPTANGA Newsroom V1

## 1. Orchestration Philosophy

Per spec §26: no swarm, no agent-initiated agent-to-agent calls, no self-directed planning loop.
Every agent is invoked by the application (a route handler, a scheduled job, or an editor action
in the dashboard) with a specific input and a specific expected output schema. Agents are pure
functions from the orchestration layer's point of view: `input → validated structured output`.
None of them call another agent, call a distribution adapter, or write to `content.status =
published` directly — those are application-code decisions gated by the `agent_tasks` state
machine and, where required, an `approvals` record.

```
                 ┌────────────────────────────────────────────────────┐
                 │              APPLICATION ORCHESTRATION              │
                 │   (FastAPI route / scheduled job / editor action)   │
                 └───┬─────────┬─────────┬─────────┬─────────┬────────┘
                     │         │         │         │         │
                     ▼         ▼         ▼         ▼         ▼
                  Scout    Analyst  Verification  Content  Analytics
                  Agent     Agent      Agent       Agent     Agent
                     │         │         │            │        │
                     └─────────┴────┬────┴────────────┴────────┘
                                    ▼
                          AIProvider (Anthropic | OpenAI)
```

`EditorialAssistant` is not a peer of the five task agents above — it is a thin coordination
helper the dashboard calls to summarize *what needs the editor's attention right now* (e.g. "7
stories require your attention," per spec §30). It reads existing `agent_tasks`/`stories`/`content`
state and composes it for display; it does not itself call the LLM to make editorial decisions.

## 2. Agent Definitions

### 2.1 ScoutAgent

**Trigger:** after an article passes ingestion + deduplication layers 1–2 (hash, title — see
`ARCHITECTURE.md` §5) and has no confident semantic/entity match to an existing Story.
**Model tier:** `fast` (cheap/fast model — spec §37; this runs on every new, non-duplicate item).
**Input:** one `articles` row (`extracted_text`, `title`, `source.reliability_score`,
`source.geography`).
**Output schema** (`ScoutOutput`, Pydantic, matches spec §12 exactly):

```python
class ScoutOutput(BaseModel):
    importance_score: float = Field(ge=0, le=10)
    relevance_score: float = Field(ge=0, le=10)
    novelty_score: float = Field(ge=0, le=10)
    category: str
    geography: list[str]
    entities: list[EntityMention]
    event_candidate: bool
    recommendation: Literal["EDITOR_REVIEW", "LOW_PRIORITY", "DISCARD_CANDIDATE"]
    reasoning_summary: str
```

**Hard constraints:** never sets `stories.editorial_status`; `DISCARD_CANDIDATE` still creates a
row (nothing is silently deleted — an editor can always find it, matching spec §13's "never
delete" rule for articles, extended here to Scout's recommendation). `human_approval_required` is
always `false` for pure Scout runs — this is triage, not publication.

### 2.2 AnalystAgent

**Trigger:** once a `Story` has ≥1 clustered article and has passed Scout triage into
`editorial_status = incoming`.
**Model tier:** `reasoning` (spec §37 — complex analysis warrants the stronger model).
**Input:** the Story's clustered articles' `extracted_text` + existing `entities`/`events`.
**Output schema** (`AnalystOutput`):

```python
class AnalystOutput(BaseModel):
    what_happened: str
    why_relevant: str
    who_is_involved: list[EntityMention]
    known_facts: list[str]
    open_questions: list[str]
    primary_sources: list[str]        # article_ids or external URLs identified as primary
    related_story_ids: list[UUID]
    context_notes: str
```

**Hard constraint:** must not introduce facts absent from the input articles (spec §15) — the
system prompt enforces "cite only what appears in the provided source text; flag anything you
cannot support as an open question, never state it as fact." This is a prompting/process control
in V1, not a formally verified constraint; `QUALITY CONTROL` (spec §38) sampling is the backstop.

### 2.3 VerificationAgent

**Trigger:** same point as AnalystAgent, can run in parallel (see architecture diagram).
**Model tier:** `fast` for the mechanical rollup (source-count/primary-source classification is
deterministic — see `ARCHITECTURE.md` §5), `reasoning` only when sources actively disagree and the
disagreement itself needs to be characterized in prose.
**Input:** the Story's `story_articles` set with each source's `reliability_score` and content.
**Output schema** (`VerificationOutput`):

```python
class VerificationOutput(BaseModel):
    verification_status: Literal["unverified","single_source","multi_source",
                                   "primary_source_backed","verified","disputed"]
    source_count: int
    independent_source_count: int
    disagreements: list[SourceDisagreement]   # empty list if sources agree
    confidence_notes: str
```

**Hard constraint:** never outputs `corrected` (that status is only set by a human editor via
`editorial_reviews.action = correction_issued`, after publication — an agent cannot unilaterally
declare a live story wrong).

### 2.4 ContentAgent

**Trigger:** editor action ("create content" / "request AI regeneration") in the Editor Desk, only
reachable for `stories.editorial_status = approved`.
**Model tier:** `reasoning` (spec §37 — "high-value content" tier).
**Input:** the approved Story (canonical_title, summary, verification_status, entities) + platform.
**Output schema:** one of `InstagramDraft`, `WebsiteDraft`, `XDraft` (fields per spec §17 — hook/
script/caption/carousel outline; headline/SEO title/slug/body/sources; short post/thread/source).
Every draft schema includes `content_label` (spec §18: reporting/analysis/opinion/sponsored/
political_communication) — the agent must set it, defaulting to the Story's editorial
classification, and the field is always rendered on the published surface.
**Hard constraints (enforced in the system prompt and, where mechanically checkable, in output
validation):** no invented quotes, no invented statistics, no fabricated "public reaction," no
impersonation. `content.status` starts at `draft`; only an editor moving `approval_status` to
`approved` unlocks the distribution layer (`DISTRIBUTION.md` §3).

### 2.5 AnalyticsAgent

**Trigger:** scheduled (e.g. daily) rollup job.
**Model tier:** `fast` for rollups; `reasoning` only for the natural-language "recommendation"
summaries surfaced to editors.
**Input:** `analytics` rows over a lookback window, joined to `content`/`stories` for topic/format/
platform breakdowns.
**Output schema** (`AnalyticsInsight`):

```python
class AnalyticsInsight(BaseModel):
    finding: str                 # e.g. "Explainer content about civic issues has higher saves"
    supporting_metric: str
    sample_size: int
    confidence: Literal["low","medium","high"]
    suggested_action: str
```

**Hard constraint:** output is a *recommendation*, never an automatic change to future content
generation parameters — spec §24/§28. Recommendations are stored and surfaced; adopting one is a
manual config change made by a human editor.

### 2.6 EditorialAssistant

Not a separate LLM-driven agent pipeline in V1 — a read-model/aggregation service behind the
dashboard's "N stories need your attention" summary (spec §30). It queries `stories`,
`agent_tasks`, and `content` for anything in an actionable state and renders it in editorial
language. If a later phase adds LLM-generated prioritization copy, it goes through the same
`AIProvider` + Pydantic-schema discipline as the other agents — no exception is planned for it.

## 3. Task Lifecycle (spec §27)

Every agent invocation creates one `agent_runs` row and one or more `agent_tasks` rows (see
`DATABASE.md` §15–16). State machine:

```
PENDING → RUNNING → COMPLETED
                  → FAILED (retryable per agent-specific policy, capped)
                  → WAITING_APPROVAL → APPROVED → (unlocked for next step)
                                     → REJECTED  → (terminal; editor may re-trigger fresh task)
                  → ESCALATED (schema-validation failure exhausted retries, or agent flags
                                low-confidence output requiring senior editor attention)
```

`WAITING_APPROVAL` is entered whenever `human_approval_required = true`. Per spec §28:

| Risk tier | Examples | `human_approval_required` |
|---|---|---|
| Low | Scout triage, Analyst summarization, internal research/context notes | `false` (still fully logged, but does not block the pipeline) |
| High | ContentAgent output before publish, any `verification_status` transition to `verified`/`disputed`, corrections, any content tagged `political_communication` | `true` — always, regardless of agent confidence |

## 4. Cost Control (spec §37)

- `model_tier` is chosen per agent as documented above, not left to the caller.
- `articles.scout_output` and `stories.embedding` act as a cache: an article already Scouted, or a
  Story whose Analyst output hasn't changed since the last clustering event, is not re-sent to the
  `reasoning` model on every dashboard view.
- `agent_tasks.cost_usd`/`token_count_input`/`token_count_output` roll up by story/agent/platform/
  day into the cost dashboard (Phase 7).

## 5. Testing Strategy (spec §33)

Each agent's system/user prompt construction and output-schema validation is unit-tested with
fixed input fixtures and fixture LLM responses (mocked at the `AIProvider` boundary) — no live
model calls in the default test run. A small, separately-run "eval" suite (Phase 8) exercises a
sample of real model calls against golden fixtures for drift detection; it is not part of CI's
default `pytest` invocation.
