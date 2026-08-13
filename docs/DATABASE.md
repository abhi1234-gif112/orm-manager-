# DATABASE — SAPTANGA Newsroom V1

PostgreSQL 16, `pgvector` extension enabled. This is the Phase 0 logical schema; exact Alembic
migrations are produced in Phase 1. Every table has `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`,
`created_at TIMESTAMPTZ DEFAULT now()` unless noted, and `updated_at TIMESTAMPTZ` maintained by a
trigger where the entity is mutable. Enum-like columns are Postgres `ENUM` types unless marked
"open text" (kept as `TEXT` + application-level validation because the set is expected to grow).

## Entity-Relationship Summary

```
sources ──1:N── articles ──N:M── stories ──1:N── content ──1:N── distribution
                   │                │  │                            │
                   │                │  └──N:M── entities            └──1:N── analytics
                   │                │
                   │                └──N:M── events
                   │
                   └── embedding (pgvector)

users ──1:N── editorial_reviews, approvals, audit_logs
agent_runs ──1:N── agent_tasks ──0:1── approvals
```

The **N:M between `articles` and `stories`** (via `story_articles`) is the core design decision
from spec §13: articles are never deleted or merged away when a duplicate is found — they are
clustered under a `Story` while retaining full source provenance.

---

## 1. `sources`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `name` | TEXT NOT NULL | |
| `url` | TEXT NOT NULL | feed/homepage URL |
| `source_type` | ENUM(`rss`,`atom`,`web`,`youtube`,`official_release`,`press_release`) | |
| `language` | TEXT | BCP-47 tag, e.g. `en`, `hi`, `mr` |
| `geography` | TEXT[] | e.g. `{Maharashtra, India}` |
| `category` | TEXT | open text, e.g. `government`, `infrastructure` |
| `reliability_score` | NUMERIC(3,2) | 0.00–1.00, editor-maintained, not AI-set |
| `active` | BOOLEAN DEFAULT true | |
| `ingestion_method` | ENUM(`rss_poll`,`web_scrape`,`api`,`manual`) | |
| `robots_txt_checked_at` | TIMESTAMPTZ | ingestion refuses to run if stale beyond policy window |
| `last_checked` | TIMESTAMPTZ | |
| `last_success_at` | TIMESTAMPTZ | |
| `failure_count` | INTEGER DEFAULT 0 | consecutive; used for backoff, auto-deactivation threshold |
| `metadata` | JSONB | source-specific config (feed selectors, auth refs — never raw secrets) |

## 2. `articles` (source items)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `source_id` | UUID FK → sources | |
| `title` | TEXT | |
| `url` | TEXT NOT NULL | |
| `author` | TEXT NULL | |
| `published_at` | TIMESTAMPTZ NULL | as reported by source |
| `discovered_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | when SAPTANGA ingested it |
| `raw_content` | TEXT | as fetched, pre-extraction |
| `extracted_text` | TEXT | cleaned body used for downstream processing |
| `image_url` | TEXT NULL | |
| `language` | TEXT | |
| `hash` | TEXT NOT NULL | content hash, used for layer-1 dedup; indexed |
| `embedding` | VECTOR(1536) NULL | populated after extraction; used for layer-3 dedup and memory |
| `processing_status` | ENUM(`discovered`,`extracted`,`scouted`,`clustered`,`failed`) | |
| `scout_output` | JSONB NULL | raw `ScoutAgent` structured output for this article (see AGENTS.md), pre-clustering |

Indexes: unique-ish index on `(source_id, hash)`; `pg_trgm` GIN index on `title` for layer-2 dedup;
`ivfflat`/`hnsw` index on `embedding`.

## 3. `stories`

The canonical unit. See spec §10 — a Story is not an article; it is the newsroom's understanding
of a real-world happening, backed by one or more articles.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | human-facing as `STORY-{sequence}` via a separate `display_id` if desired |
| `canonical_title` | TEXT NOT NULL | editor-editable |
| `summary` | TEXT | |
| `category` | TEXT | |
| `subcategory` | TEXT NULL | |
| `geography` | TEXT[] | |
| `importance_score` | NUMERIC(4,2) | from `AnalystAgent`/`ScoutAgent`, editor-overridable |
| `relevance_score` | NUMERIC(4,2) | |
| `novelty_score` | NUMERIC(4,2) | |
| `verification_status` | ENUM(`unverified`,`single_source`,`multi_source`,`primary_source_backed`,`verified`,`disputed`,`corrected`) | spec §14 |
| `editorial_status` | ENUM(`incoming`,`in_review`,`approved`,`rejected`,`published`,`archived`) | |
| `embedding` | VECTOR(1536) NULL | story-level semantic centroid, used for "related stories" and memory |
| `created_at`, `updated_at` | | |

## 4. `story_articles` (join — cluster membership)

| Column | Type | Notes |
|---|---|---|
| `story_id` | UUID FK → stories | |
| `article_id` | UUID FK → articles | |
| `cluster_method` | ENUM(`hash`,`title_similarity`,`semantic`,`entity_overlap`,`manual`) | which layer attached it |
| `cluster_confidence` | NUMERIC(4,3) NULL | |
| `added_at` | TIMESTAMPTZ | |
| PK | `(story_id, article_id)` | an article may — rarely, pending editor split/merge — belong to more than one story only transiently during review; the editorial "split" action re-parents rows here, it never deletes the underlying article |

## 5. `entities`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `name` | TEXT NOT NULL | |
| `entity_type` | ENUM(`person`,`organization`,`location`,`institution`,`party`,`other`) | |
| `canonical_key` | TEXT | normalized name for merge/dedupe of entity records |
| `metadata` | JSONB | e.g. Wikidata QID if later linked |
| `future_page_slug` | TEXT NULL | reserved for `/people/`, `/organizations/`, `/locations/` pages (spec §20), not required to be populated/routed in V1 |

## 6. `story_entities`

| Column | Type | Notes |
|---|---|---|
| `story_id` | UUID FK | |
| `entity_id` | UUID FK | |
| `role` | TEXT NULL | e.g. `subject`, `mentioned`, `source_quoted` |
| PK | `(story_id, entity_id)` | |

## 7. `events`

Allows multiple stories to relate to one larger event (spec §9), e.g. an election, a policy
rollout, a disaster — a longer-lived container than any single Story.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `title` | TEXT | |
| `description` | TEXT | |
| `starts_at` | TIMESTAMPTZ NULL | |
| `ends_at` | TIMESTAMPTZ NULL | |
| `geography` | TEXT[] | |

## 8. `story_events`

| `story_id` | UUID FK | |
| `event_id` | UUID FK | |
| PK | `(story_id, event_id)` |

## 9. `content`

One row per platform-specific draft/publication generated from an approved Story.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `story_id` | UUID FK → stories NOT NULL | |
| `platform` | ENUM(`instagram`,`website`,`x`) | extensible — see DISTRIBUTION.md; new platforms add enum values, not new tables |
| `content_type` | TEXT | e.g. `reel_script`, `carousel`, `article`, `post`, `thread` |
| `title` | TEXT NULL | |
| `body` | TEXT NULL | |
| `caption` | TEXT NULL | |
| `script` | TEXT NULL | |
| `media_reference` | TEXT NULL | S3-compatible object key |
| `content_label` | ENUM(`reporting`,`analysis`,`opinion`,`sponsored`,`political_communication`) | spec §18 — required at generation time, shown on every published surface |
| `status` | ENUM(`draft`,`regenerating`,`ready_for_review`,`scheduled`,`published`,`failed`) | |
| `approval_status` | ENUM(`pending`,`approved`,`rejected`) NOT NULL DEFAULT `pending` | publication is blocked in application logic while this is not `approved` |
| `approved_by` | UUID FK → users NULL | |
| `approved_at` | TIMESTAMPTZ NULL | |
| `scheduled_at` | TIMESTAMPTZ NULL | |
| `published_at` | TIMESTAMPTZ NULL | |
| `generated_by_agent_task_id` | UUID FK → agent_tasks NULL | traceability to the generating `ContentAgent` run |

## 10. `distribution`

Tracks platform-specific publication state and identifiers — kept separate from `content` because
one `content` row can have multiple publish attempts (retry, correction repost).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `content_id` | UUID FK → content | |
| `platform` | ENUM | mirrors `content.platform`, denormalized for query convenience |
| `platform_post_id` | TEXT NULL | ID returned by the platform API |
| `platform_url` | TEXT NULL | canonical public URL (website slug, IG permalink, X status URL) |
| `attempt_status` | ENUM(`pending`,`success`,`failed`,`retrying`) | |
| `error_detail` | TEXT NULL | |
| `attempted_at` | TIMESTAMPTZ | |

## 11. `analytics`

Time-bucketed performance facts per `content`. One row per `(content_id, metric_date)` for daily
rollups; adapters may also write raw event rows to a higher-volume table in a later phase.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `content_id` | UUID FK → content | |
| `metric_date` | DATE | |
| `impressions`, `reach`, `views`, `likes`, `comments`, `shares`, `saves`, `clicks` | INTEGER NULL | platform-dependent; NULL where a platform doesn't expose the metric |
| `watch_time_seconds` | INTEGER NULL | Reels only |
| `website_sessions`, `avg_time_on_page_seconds` | INTEGER NULL | website only |
| `raw_payload` | JSONB | full platform API response for auditability/reprocessing |

## 12. `users`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | mirrors Supabase Auth user id |
| `email` | TEXT UNIQUE | |
| `display_name` | TEXT | |
| `role` | ENUM(`admin`,`editor`,`contributor`,`viewer`) | see `roles` below for permission expansion |
| `active` | BOOLEAN DEFAULT true | |

## 13. `roles` / `permissions`

Kept as a small lookup table rather than hardcoded enum logic so permission sets can be adjusted
without a migration touching `users`:

| `role` (`roles.name`) | `permission` (`role_permissions.permission`) |
|---|---|
| `admin` | all |
| `editor` | review, approve, publish, edit stories/content, manage sources |
| `contributor` | create drafts, request AI regeneration, cannot approve/publish |
| `viewer` | read-only dashboard access |

## 14. `editorial_reviews`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `story_id` | UUID FK | |
| `reviewer_id` | UUID FK → users | |
| `action` | ENUM(`viewed`,`edited_title`,`edited_summary`,`merged`,`split`,`verification_set`,`approved`,`rejected`,`correction_issued`) | |
| `notes` | TEXT NULL | |
| `before_state`, `after_state` | JSONB NULL | for diffable audit trail |
| `created_at` | | |

## 15. `agent_runs`

A logical execution of one agent invocation (may contain one or more `agent_tasks` if the agent
call is decomposed, but typically 1:1 in V1's simple orchestration).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `agent_name` | ENUM(`scout`,`analyst`,`verification`,`content`,`analytics`,`editorial_assistant`) | |
| `trigger` | ENUM(`scheduled`,`manual`,`event`) | |
| `story_id` | UUID FK NULL | |
| `article_id` | UUID FK NULL | |
| `started_at`, `completed_at` | TIMESTAMPTZ | |
| `status` | ENUM(`running`,`completed`,`failed`) | |

## 16. `agent_tasks`

Per spec §27 — every field listed there is a column:

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `agent_run_id` | UUID FK → agent_runs | |
| `agent_name` | ENUM | same domain as above |
| `input_ref` | JSONB | pointer/summary of input (not always the full payload, to avoid bloating the row — full payload kept in object storage for large inputs) |
| `expected_output_schema` | TEXT | Pydantic model name, for traceability when schemas evolve |
| `output` | JSONB NULL | validated structured output |
| `status` | ENUM(`PENDING`,`RUNNING`,`WAITING_APPROVAL`,`APPROVED`,`REJECTED`,`COMPLETED`,`FAILED`,`ESCALATED`) | |
| `priority` | SMALLINT | |
| `created_at`, `completed_at` | TIMESTAMPTZ | |
| `model_used` | TEXT | e.g. `claude-sonnet-5`, `gpt-5.1` |
| `token_count_input`, `token_count_output` | INTEGER | |
| `cost_usd` | NUMERIC(10,4) | |
| `error_state` | TEXT NULL | |
| `human_approval_required` | BOOLEAN | per spec §28 risk tiering |

## 17. `approvals`

Explicit approval records — separate from `agent_tasks.status` so a single approval action can be
tied to a specific human, reason, and (for content) the exact version approved.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `agent_task_id` | UUID FK NULL | |
| `content_id` | UUID FK NULL | |
| `story_id` | UUID FK NULL | |
| `approver_id` | UUID FK → users | |
| `decision` | ENUM(`approved`,`rejected`) | |
| `reason` | TEXT NULL | required when `rejected` |
| `decided_at` | TIMESTAMPTZ | |

## 18. `audit_logs`

Append-only. Every important AI and human action (spec §9, §32).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `actor_type` | ENUM(`user`,`agent`,`system`) | |
| `actor_id` | UUID NULL | `users.id` or `agent_runs.id` depending on `actor_type` |
| `action` | TEXT | e.g. `content.published`, `source.deactivated`, `story.verification_status_changed` |
| `target_type`, `target_id` | TEXT, UUID | polymorphic reference |
| `before_state`, `after_state` | JSONB NULL | |
| `ip_address` | INET NULL | for human actions only |
| `created_at` | TIMESTAMPTZ | |

No `UPDATE`/`DELETE` grants on this table for the application role — insert-only at the DB
permission level.

---

## Design Notes

- **Why UUIDs, not serials:** agent outputs, S3 keys, and cross-service references (n8n,
  distribution adapters) are generated/stored outside strict transaction order; UUIDs avoid
  ID-guessing and coordination issues across those boundaries.
- **Why `pgvector` on both `articles` and `stories`:** article-level embeddings drive
  article→article dedup (layer 3); story-level embeddings drive "related stories" and the
  `memory` layer's semantic recall without needing a second vector database, per spec §7/§25.
- **Why JSONB for agent I/O:** agent output schemas will evolve across phases; JSONB plus the
  `expected_output_schema` column lets us keep historical rows readable even after a Pydantic
  model changes shape, without a migration per schema change.
- **Memory tables:** `articles.embedding`, `stories.embedding`, and `agent_tasks.output` together
  constitute source/story/editorial memory per spec §25; a dedicated `entity` embedding column is
  deferred to Phase 3+ (entity memory) since it's not required for V1's success criteria.
