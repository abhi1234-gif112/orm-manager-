# DISTRIBUTION — SAPTANGA Newsroom V1

## 1. Principle

The Story Engine and Editor Desk contain **zero platform-specific logic**. Everything that knows
about Instagram's Graph API, X's API, or how to render a website page lives behind one interface:

```python
class DistributionAdapter(Protocol):
    platform: Platform  # "instagram" | "website" | "x"

    async def publish(self, content: Content) -> PublishResult: ...
    async def schedule(self, content: Content, at: datetime) -> PublishResult: ...
    async def fetch_analytics(self, distribution: Distribution, since: date) -> list[AnalyticsFact]: ...
    async def validate(self, content: Content) -> list[ValidationError]: ...  # platform-specific
                                                                               # constraints, e.g.
                                                                               # X char limits
```

Adding a platform in the future means writing one new class that implements this Protocol and
registering it — the Story Engine, `content` table, and Editor Desk code do not change. This is
the mechanism behind spec §19/§36's "3 today → 5 tomorrow → 10 later" requirement.

## 2. Publish Flow

```
content.approval_status = approved
          │
          ▼
POST /api/v1/content/{id}/publish  (editor-initiated, or scheduler at content.scheduled_at)
          │
          ▼
application looks up DistributionAdapter for content.platform
          │
          ▼
adapter.validate(content)  ──fails──▶ 422, content.status stays ready_for_review, editor notified
          │ passes
          ▼
adapter.publish(content)  ──raises──▶ distribution row: attempt_status=failed, error_detail set,
          │                            content.status=failed, editor notified — no silent retry loop
          │ succeeds
          ▼
distribution row: attempt_status=success, platform_post_id, platform_url set
content.status = published, content.published_at = now()
audit_logs row: actor_type=user (the approving editor) OR system (scheduled run), action=content.published
```

**The application layer — not any adapter — enforces `approval_status == "approved"` before this
flow is reachable at all.** An adapter is never called on unapproved content; this is checked in
the route handler / scheduler job, not left to each adapter to remember.

## 3. V1 Adapters

### 3.1 `WebsiteAdapter`

- Publishing = writing/updating a row consumed by the public Next.js site (`frontend/website`) —
  effectively "publish" here means flipping visibility + assigning the canonical slug, since the
  website is SAPTANGA's own surface (no external platform API).
- Responsibilities: slug generation/uniqueness, SEO metadata (title, description, OG image),
  canonical URL assignment, category/tag association, related-stories linking, correction display
  (spec §20 — corrections are rendered on the article, sourced from `editorial_reviews` rows with
  `action=correction_issued`, never by silently editing the original text without a visible trail).
- `fetch_analytics`: pulls website sessions / time-on-page from the site's own analytics
  integration (implementation detail deferred to Phase 6; interface is platform-agnostic).

### 3.2 `InstagramAdapter`

- Uses the official Meta Graph API (Instagram Content Publishing API) under SAPTANGA's one
  registered Instagram Business account. No unofficial/scraping-based posting path.
- `validate()` enforces Instagram's real constraints (caption length, media requirements, carousel
  item counts) before attempting a call, so failures surface as review-stage errors, not
  post-publish surprises.
- `fetch_analytics`: Graph API Insights endpoint → impressions, reach, likes, comments, shares,
  saves, watch time (Reels).
- Account creation, engagement automation, and fake-engagement generation are explicitly out of
  scope (spec §21) — the adapter has no code path for any of those.

### 3.3 `XAdapter`

- Uses the official X API v2 under SAPTANGA's one registered X account.
- Supports single posts and threads (`content_type = post` vs `thread`); thread items are stored
  as an ordered list within `content.body` (JSON array) and posted as a chain of replies by the
  adapter, with the resulting root `platform_post_id`/`platform_url` recorded.
- `fetch_analytics`: X API metrics endpoint → impressions, likes, reposts, replies, clicks.
- No automated engagement (likes/follows/retweets to inflate reach) — spec §22.

## 4. Scheduling

`content.scheduled_at` is set by an editor in the dashboard. A scheduler job (APScheduler in the
backend, or an n8n workflow calling a backend trigger endpoint per spec §7's "n8n for glue, not
core logic") polls for `content.status = scheduled AND scheduled_at <= now()` and invokes the same
publish flow described in §2 — scheduling does not bypass the approval check; a scheduled item
that somehow lost its approval (e.g. a post-approval correction was requested) is skipped and
flagged, not published anyway.

## 5. Analytics Ingestion

Each adapter's `fetch_analytics` is called on a schedule (e.g. hourly for the first 48h post-
publish, then daily) and writes/upserts `analytics` rows keyed `(content_id, metric_date)`,
including `raw_payload` for auditability. This feeds `AnalyticsAgent` (see `AGENTS.md` §2.5)
without any adapter needing to know how its numbers get analyzed.

## 6. Future Adapters (not built in V1)

Interface-compatible future adapters — `YouTubeAdapter`, `FacebookAdapter`, `LinkedInAdapter`,
`WhatsAppAdapter`, `NewsletterAdapter`, additional `InstagramAdapter`/`WebsiteAdapter` instances
for regional/constituency-level publications — all implement the same `DistributionAdapter`
Protocol. The only V1 requirement is that this interface not need to change shape to accommodate
them; `platform` becomes an open enum/lookup table rather than a hardcoded 3-value enum the moment
a second platform of the same *type* is needed (e.g. a second Instagram account), which is a
one-column migration, not a schema redesign.

## 7. Compliance Guardrails (apply to every adapter, present and future)

- Official APIs only; no bypass of platform authentication or access controls.
- No fake accounts, no fake engagement, no coordinated inauthentic posting.
- No content published without a human `approvals` record tied to that exact `content` version.
- `content_label` (reporting/analysis/opinion/sponsored/political_communication) is always carried
  through to the published surface — adapters render it, they don't strip it for a cleaner post.
