# PRD — SAPTANGA Newsroom V1

## 1. Problem

SAPTANGA wants to run one strong digital publication across three channels (Instagram, website,
X) without building three separate, drifting content pipelines, and without the AI publishing
anything a human hasn't reviewed. This is the first technical foundation for a larger future
media-intelligence network — but V1 itself is deliberately small: one newsroom, three channels.

## 2. Goals (V1)

1. Sources can be registered and ingested on a schedule.
2. New information is triaged, deduplicated into Stories, analyzed, and given a verification
   status — with full provenance back to the original articles.
3. Editors review, adjust, and approve Stories through a purpose-built dashboard.
4. Approved Stories generate platform-specific drafts (Instagram, Website, X), which editors
   approve before anything publishes.
5. Publication is tracked per platform; performance is measured; editors get (non-binding)
   recommendations from what performed.
6. Every AI and human action of consequence is logged and auditable.
7. Adding a fourth distribution channel later requires writing one adapter, not touching the
   Story Engine.

## 3. Non-Goals (V1)

Per the build spec §35 — not built now, and not accidentally grown into during implementation:
additional distribution channels beyond the three named, constituency/election-specific tooling,
voter profiling, automated political persuasion, fake accounts or engagement, autonomous
high-risk publishing, complex multi-agent swarms, predictive election modeling, mass political
targeting, automated propaganda generation.

## 4. Users / Roles

| Role | Can do |
|---|---|
| Admin | Everything editor can, plus user/role management, source registry lifecycle |
| Editor | Review, approve/reject, publish, edit stories/content, manage sources |
| Contributor | Create drafts, request AI regeneration; cannot approve or publish |
| Viewer | Read-only dashboard access (e.g. stakeholders who want visibility, not editorial control) |
| Reader (public) | Reads the public website; no account required |

## 5. Core User Stories

- *As an editor*, I see a prioritized list of incoming stories with importance/relevance scores,
  source provenance, and AI analysis, so I can decide what deserves attention today.
- *As an editor*, I can merge two stories that turn out to be the same event, or split one that
  was incorrectly merged, without losing any source article.
- *As an editor*, I can approve a Story and then review AI-generated Instagram/Website/X drafts
  before anything goes out, and request regeneration if a draft is off.
- *As an editor*, I can issue a correction on a published Story and see it reflected visibly on
  the website, not silently edited away.
- *As a contributor*, I can prepare drafts but cannot publish — only an editor/admin can approve.
- *As an admin*, I can register a new source with its type, geography, and reliability, and
  deactivate one that's no longer trustworthy — without losing historical articles from it.
- *As a reader*, I can read a published story on the website and see its sources, verification
  status, and any corrections.

## 6. Success Criteria (V1)

Verbatim from the build spec §43 — this is the acceptance bar for calling V1 done:

Sources can be registered and ingested automatically; new information is stored; AI can classify
incoming information; duplicate stories can be clustered; stories have provenance; editors can
review stories; AI can generate platform-specific drafts; humans can approve content; approved
content can be published to the website; Instagram and X distribution architecture works;
publication status is tracked; analytics are captured; editorial feedback is recorded; the system
is observable; the system is secure; adding another distribution platform does not require
rewriting the Story Engine.

## 7. Phased Delivery

See `docs/ROADMAP.md` for the full phase breakdown (0–8). This PRD does not restate it.

## 8. Relationship to Existing Repo Contents

This repository also contains NAZAR, an unrelated prior build (`packages/`). SAPTANGA Newsroom is
additive, not a replacement — see `docs/ARCHITECTURE.md` §0 for the explicit scoping decision.
