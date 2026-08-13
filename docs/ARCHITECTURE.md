# ARCHITECTURE — SAPTANGA Newsroom V1

## 0. Relationship to existing repo contents

This repository already contains an unrelated prior build, **NAZAR — Political Intelligence &
Reputation Monitoring Platform** (`packages/backend`, `packages/frontend`, Node/Express/Prisma/
React, root `package.json` name `nazar-platform`). By explicit decision, SAPTANGA Newsroom V1 is
built as a **separate top-level application** in this same repository — NAZAR's code is left
untouched under `packages/`. The new tree (`backend/`, `frontend/`, `docs/`, `workflows/`,
`scripts/`, root `docker-compose.yml`, root `.env.example`) is additive, not a rewrite.

**Flagged, not resolved here:** NAZAR performs individual-level risk/stance/threat scoring on
political actors and generates "grassroots forward" content assets. SAPTANGA Newsroom's own
editorial-safety rules (§18/§35/§41 of the build spec) explicitly prohibit voter profiling and
manufactured grassroots content. This is a pre-existing product decision outside the scope of
this build and is not modified, disabled, or otherwise acted on here — noted for visibility only,
per explicit user instruction.

## 1. System Overview

SAPTANGA Newsroom is a human-supervised content pipeline, not an autonomous publisher. Every box
below is a real component with a defined input/output contract; the only component allowed to
cause a public-facing side effect (publishing) is gated by an explicit human approval record.

```
SOURCES ─▶ INGESTION ─▶ SCOUT AGENT ─▶ DEDUPLICATION ─▶ STORY ENGINE
                                                              │
                                              ┌───────────────┼───────────────┐
                                              ▼                               ▼
                                       ANALYST AGENT                VERIFICATION AGENT
                                              │                               │
                                              └───────────────┬───────────────┘
                                                              ▼
                                                        EDITOR DESK (human)
                                                              │
                                                       [APPROVAL GATE]
                                                              ▼
                                                     MASTER STORY (approved)
                                                              │
                                                       CONTENT AGENT
                                              ┌───────────────┼───────────────┐
                                              ▼               ▼               ▼
                                        INSTAGRAM        WEBSITE              X
                                        ADAPTER          ADAPTER          ADAPTER
                                              └───────────────┼───────────────┘
                                                              ▼
                                                         ANALYTICS
                                                              ▼
                                                           MEMORY
                                                              ▼
                                                       LEARNING LOOP ─▶ (recommendations surfaced to editors, never auto-applied)
```

Two properties are structural, not aspirational:

1. **One Story, many Content objects.** There is exactly one canonical `Story` per real-world
   event/claim cluster. `Content` rows reference a `story_id` and a `platform`; there is never an
   independent Instagram-pipeline or X-pipeline that can drift from the Story's facts.
2. **Every irreversible action requires a human-approved record.** Publication, correction, and
   any agent output flagged `human_approval_required=true` cannot proceed on agent output alone —
   see `agent_tasks.status` in `DATABASE.md` and the approval gate in `AGENTS.md`.

## 2. Technology Stack

| Layer | Choice | Notes |
|---|---|---|
| Backend | Python 3.12, FastAPI, Pydantic v2 | All agent I/O is a Pydantic model — never raw LLM text passed downstream unvalidated |
| ORM / Migrations | SQLAlchemy 2.x + Alembic | |
| Database | PostgreSQL 16 + `pgvector` extension | One database; embeddings live alongside relational data as a `vector` column, not a separate vector store |
| Frontend | Next.js (App Router) + React + TypeScript + Tailwind CSS | Editor Desk + public website share the same repo, separate Next.js apps (see §4) |
| Workflow glue | n8n | Used for cross-service scheduling/glue only (e.g. "every 15 min, hit the ingestion trigger endpoint," notification fan-out). Core editorial and publishing logic never lives in an n8n workflow — see spec §7. |
| AI | Anthropic Claude + OpenAI, behind a common `AIProvider` interface | See §5 |
| Object storage | S3-compatible (MinIO locally, S3/R2 in production) | Media assets (images, video, generated visuals) |
| Auth | Supabase Auth (V1) | Email/password + magic link for editors; JWT verified by FastAPI middleware; RBAC enforced in `app/core/permissions.py`, not just at the UI |
| Observability | Structured JSON logging (`structlog`) everywhere; OpenTelemetry-compatible tracing hooks reserved for Langfuse | No Langfuse dependency in V1 — the interface is designed so it can be added without refactoring agent call sites |
| Deployment | Docker Compose (V1); `docker-compose.saptanga.yml` at repo root covers Postgres+pgvector, Redis (task queue only, not Redis-as-DB), backend, both frontend apps, n8n | Named `docker-compose.saptanga.yml`/`.env.saptanga.example`, not the bare `docker-compose.yml`/`.env.example` — those paths are already NAZAR's; kept as documented in §0 |

## 3. Repository Structure

```
saptanga-newsroom/                 (this repo, additive to existing packages/)
├── CLAUDE.md
├── README.md
├── docs/
│   ├── PRD.md                     (Phase 1)
│   ├── ARCHITECTURE.md            (this file)
│   ├── REUSE_MAP.md
│   ├── DATABASE.md
│   ├── AGENTS.md
│   ├── DISTRIBUTION.md
│   ├── EDITORIAL_POLICY.md        (Phase 1)
│   ├── SECURITY.md                (Phase 1, expands §7 below)
│   └── ROADMAP.md
├── backend/
│   └── app/
│       ├── api/                   FastAPI routers (REST, versioned /api/v1)
│       ├── core/                  config, security, permissions, logging setup
│       ├── models/                SQLAlchemy models
│       ├── schemas/                Pydantic request/response + agent I/O schemas
│       ├── services/              dedup, verification helpers, cost tracking
│       ├── agents/                ScoutAgent, AnalystAgent, VerificationAgent, ContentAgent, AnalyticsAgent, EditorialAssistant; providers/ (AI abstraction)
│       ├── ingestion/              source connectors + scheduler
│       ├── editorial/             editor-desk API surface (queue, approvals, merges)
│       ├── distribution/          DistributionAdapter + website/instagram/x adapters
│       ├── analytics/             performance ingestion + rollups
│       ├── memory/                pgvector-backed semantic memory access layer
│       └── database/              session/engine setup, Alembic env
│   └── tests/                     unit, integration, agent-schema, adapter tests
├── frontend/
│   ├── website/                   public Next.js site (canonical story URLs)
│   └── newsroom/                  Editor Desk / dashboard Next.js app
├── workflows/                     n8n workflow exports (JSON), documented, not hand-edited in the n8n UI without export-back
├── scripts/                       one-off ops scripts (seed data, backfills)
└── tests/                         cross-service/e2e tests
```

**Deviation from the spec's suggested layout:** the frontend is split into two Next.js apps
(`website/`, `newsroom/`) instead of one `frontend/`. Reason: the public website and the internal
Editor Desk have entirely different auth models (public/anonymous vs. authenticated editors),
deployment cadence, and SEO requirements; splitting them avoids leaking internal routes/bundle
size into the public site. Both still read from the same backend API.

## 4. AI Abstraction Layer

Modeled on the cleanest pattern found in reconnaissance (`agents-radar/src/providers/`, see
`REUSE_MAP.md`), reimplemented for our stack:

```python
class AIProvider(Protocol):
    async def complete(self, *, system: str, messages: list[Message], schema: type[BaseModel],
                        model_tier: Literal["fast", "reasoning"]) -> BaseModel: ...
```

- `AnthropicProvider` and `OpenAIProvider` both implement this Protocol.
- Every agent calls `provider.complete(..., schema=ScoutOutput)` — the return value is always a
  validated Pydantic instance, never raw text. Schema validation failure is a retryable error, not
  a downstream data-quality bug.
- `model_tier` maps to a concrete model name via config (`backend/app/core/config.py`), not
  hardcoded in agent code — swapping the "fast" model or adding a third provider touches one file.
- Cost per call (`services/cost_tracker.py`) is recorded against `agent_tasks.cost_usd` /
  `token_count` regardless of provider, keyed by story/agent/platform/day for the cost dashboard
  (spec §37).

## 5. Deduplication & Verification (architecture-level)

Layered, cheapest-first, matching the reconnaissance finding that both auto-news and agents-radar
converge on "structural check first, semantic check second":

1. URL/content-hash exact match (`articles.hash`)
2. Title similarity (trigram/`pg_trgm`)
3. Semantic similarity (pgvector cosine distance on `articles.embedding`, threshold-gated)
4. Entity overlap + time-window + geography overlap (structured signals, not LLM calls — cheap)

Only items that survive layers 1–4 as "not an obvious duplicate" are scored by `ScoutAgent`
(an LLM call — the expensive resource). Matches at any layer attach the new article to an existing
`Story` via `story_articles`, never delete the article. `VerificationAgent`/`verification_status`
consumes the resulting cluster's source diversity (single-source vs. multi-source vs.
primary-source-backed) — this is a deterministic rollup over `story_articles`, not itself an LLM
judgment call, though its "are these sources actually independent" nuance may involve an LLM assist
in later iterations.

## 6. Security Model (overview — full detail in Phase 1's `docs/SECURITY.md`)

- **Secrets:** environment variables only, `.env` gitignored, `.env.example` documents every key
  with no real values. No provider API key, DB credential, or platform token appears in source,
  logs, or error responses.
- **AuthN:** Supabase Auth-issued JWTs, verified server-side on every request via FastAPI
  dependency; no client-trusted role claims.
- **AuthZ:** role-based (`users.role`: `admin`, `editor`, `contributor`, `viewer`), enforced in a
  single `require_role()` dependency reused across routers — not per-endpoint ad hoc checks.
- **Input/output validation:** Pydantic on every API boundary and every agent I/O boundary.
- **Rate limiting:** per-IP and per-user on public/auth endpoints; per-source rate limiting in the
  ingestion layer to respect source ToS.
- **Audit:** `audit_logs` records actor (human or `agent_run_id`), action, target, before/after
  where applicable — append-only, never deleted by the application.
- **Platform compliance:** distribution adapters call only official platform APIs with credentials
  scoped to the one SAPTANGA account per platform; no scraping-based publishing, no engagement
  automation, no bypass of platform auth.

## 7. Conflicts Identified Between Reference Architectures, and Resolution

| Conflict | auto-news says | agents-radar says | SAPTANGA resolution |
|---|---|---|---|
| Orchestration weight | Airflow (heavy, stateful scheduler + metastore) | GitHub Actions cron (stateless, no persistence at all) | Neither fits directly: V1 needs persistence (Postgres) but not Airflow's operational weight. Use lightweight in-process scheduling (APScheduler / FastAPI background tasks) for ingestion cadence, n8n only for cross-service glue, per spec §7. |
| Human role | Human curates *after* auto-filing to Notion (soft gate, easy to ignore) | No human role at all (hard automation) | Neither is acceptable per spec §2/§28. SAPTANGA makes the approval gate a hard database constraint (`content.approval_status`), not a UI convention. |
| State/persistence | Full relational DB (MySQL) + vector store | No database — git-as-database | SAPTANGA needs the auditable, queryable, relational model auto-news has (Story/Entity/provenance cannot live as flat files), but on Postgres+pgvector per spec §7, not MySQL + a third-party vector service. |
| Multi-agent scope | Experimental AutoGen swarm for "deepdive" research | No multi-agent concept | Spec §26 is explicit: V1 does not need a swarm. Deferred; SAPTANGA V1 uses fixed, single-purpose agents with no agent-initiated agent-to-agent calls. |

No conflict required inventing new major architecture beyond what the build spec already
specifies — reconciliation was picking the spec-compliant option in each case.
