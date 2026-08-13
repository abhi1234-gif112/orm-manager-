# ROADMAP — SAPTANGA Newsroom V1

Phases match the build spec (§34) exactly, each scoped to what `ARCHITECTURE.md`, `DATABASE.md`,
`AGENTS.md`, and `DISTRIBUTION.md` already specify — no new architecture is introduced phase by
phase, only implementation.

## Phase 0 — Research (this deliverable)

- [x] Inspect `finaldie/auto-news`, `duanyytop/agents-radar` (`frankomondo/ai-social-media-post-automation` unreachable — documented in `REUSE_MAP.md`)
- [x] `docs/REUSE_MAP.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/AGENTS.md`, `docs/DISTRIBUTION.md`, `docs/ROADMAP.md`
- [ ] User sign-off on this architecture before Phase 1 begins

## Phase 1 — Foundation

- `backend/` FastAPI skeleton (`app/core`, `app/database`, health check route)
- `frontend/newsroom` and `frontend/website` Next.js skeletons
- PostgreSQL + `pgvector` via `docker-compose.yml`; Alembic initial migration for all tables in `DATABASE.md`
- Supabase Auth wiring + `require_role()` RBAC dependency
- Source Registry CRUD (`sources` table + API + minimal dashboard list view)
- `stories`/`content` schemas live (empty pipeline — no ingestion yet)
- `audit_logs` insert-only wiring, exercised by the auth/RBAC actions above
- `docs/PRD.md`, `docs/EDITORIAL_POLICY.md`, `docs/SECURITY.md` written (referenced but not required for Phase 0 per spec §42)
- **Exit criterion:** an admin can log in, register a source, and see it listed — nothing auto-ingests yet.

## Phase 2 — Ingestion ✅

- [x] RSS/Atom connector (`backend/app/ingestion/sources/rss.py`), one approved web-source connector (`.../sources/web.py`, listing-page + single-page modes), source health monitoring (`sources.last_checked`, `failure_count`, robots_txt_checked_at, auto-deactivation past `INGESTION_FAILURE_THRESHOLD`)
- [x] Scheduled ingestion (APScheduler `AsyncIOScheduler`, wired into the FastAPI lifespan, disabled in tests)
- [x] Dedup layers 1–2 (`backend/app/services/dedup.py`: hash exact-match, `pg_trgm` title similarity) — migration `89dee3155d70` adds the `pg_trgm` extension, GIN trigram index, and `uq_articles_source_hash` unique constraint
- [x] robots.txt respected before every fetch (`backend/app/ingestion/robots.py`)
- [x] `articles` populated end-to-end: discovered → extracted, plus `GET /api/v1/articles` and manual `POST /api/v1/sources/{id}/ingest` trigger
- [x] 12 new tests (connectors with mocked network, pipeline with a stub connector, dedup logic, API) — 27/27 passing
- [x] Live-verified against a real RSS feed (not just mocks): first poll stored 20 articles, re-poll fetched 20/stored 0/duplicate 20 — hash dedup confirmed idempotent end-to-end
- **Exit criterion — met:** registered sources produce `articles` rows automatically on a schedule, with duplicates suppressed at the hash/title layer (not yet clustered into Stories).

## Phase 3 — Intelligence

- `AIProvider` abstraction (Anthropic + OpenAI) per `ARCHITECTURE.md` §4
- `ScoutAgent` live on every new non-duplicate article
- Embedding generation (`articles.embedding`), pgvector-based semantic dedup (layer 3), entity/time/geography overlap (layer 4)
- `entities`, `story_entities`, `events`, `story_events`, `story_articles` populated by clustering
- `AnalystAgent`, `VerificationAgent` live on newly formed Stories
- **Exit criterion:** new articles are Scouted, clustered into Stories with correct provenance, and each Story carries Analyst context + a `verification_status`.

## Phase 4 — Editorial

- Editor Desk dashboard: incoming queue, filters (category/geography/importance), source inspection, AI analysis view, provenance view
- Merge/split Story tooling; manual `verification_status` override; approve/reject
- `editorial_reviews` fully wired to every editor action
- Correction workflow (`action=correction_issued`)
- **Exit criterion:** an editor can review the full pipeline output for a Story, adjust it, and move it to `editorial_status=approved` — no content generation yet.

## Phase 5 — Content

- `ContentAgent` for Instagram/Website/X drafts, `content_label` enforcement
- Draft review UI in Editor Desk; "request regeneration" action
- `approvals` records tied to `content` rows; `content.approval_status` gate enforced in application code
- **Exit criterion:** an approved Story can produce reviewable, platform-specific drafts for all three platforms; nothing publishes yet.

## Phase 6 — Distribution

- `DistributionAdapter` Protocol + `WebsiteAdapter`, `InstagramAdapter`, `XAdapter`
- Publish flow (`DISTRIBUTION.md` §2), scheduling, `distribution` table wired
- Public website: article pages, categories, search, tags, source/provenance display, corrections display, SEO metadata
- **Exit criterion:** approved content publishes to all three channels through the adapter interface; publication status is tracked; the website has a working canonical-URL archive.

## Phase 7 — Analytics

- Per-adapter `fetch_analytics` jobs, `analytics` table populated
- `AnalyticsAgent` rollups and recommendation generation (`AnalyticsInsight`)
- Analytics dashboard: topic/format/geography/headline/platform performance views
- Cost dashboard (`agent_tasks.cost_usd` rollups by story/agent/platform/day)
- **Exit criterion:** editors can see what performed and receive (non-binding) recommendations; cost is visible per story/day/month.

## Phase 8 — Hardening

- Security review against `docs/SECURITY.md`
- Test coverage push: unit (agents, services), integration (API), DB, agent-schema, adapter tests
- Error handling / rate limiting audit across ingestion and distribution
- Backup strategy for Postgres + object storage
- Deployment documentation
- Monitoring + cost monitoring alerts
- Editorial policy enforcement review (spot-check `content_label` correctness, approval-gate integrity)
- Small "eval" suite (spec §33/§38) run against golden fixtures for factual accuracy, source attribution, classification accuracy, headline/summary quality
- **Exit criterion:** matches spec §43's V1 success criteria in full.

## Explicitly Out of Scope for V1 (spec §35 — carried into every phase's definition of done)

50-account/multi-network scale, additional distribution channels beyond Instagram/Website/X,
constituency-level or election-specific tooling, voter profiling, automated political persuasion,
fake accounts/engagement, autonomous high-risk publishing, complex multi-agent swarms, predictive
election modeling, mass political targeting, automated propaganda generation. Any of these
appearing as a "quick add" during implementation is a scope violation, not a shortcut — flag it
instead of building it.
