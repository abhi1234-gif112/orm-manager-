# EDITORIAL_POLICY — SAPTANGA Newsroom V1

This document is the operational expression of build spec §18 ("Editorial Safety") and §2 ("Core
Principle"). It governs what the AI layer is and is not allowed to produce, and what a human
editor must do before anything reaches an audience.

## 1. The Core Rule

SAPTANGA is a human-supervised newsroom, not an autonomous publisher. No `content` row reaches
`status = published` without a corresponding `approvals` row tied to an authenticated editor or
admin and to that exact version of the content (see `DATABASE.md` §9, §17; `DISTRIBUTION.md` §2).
This is enforced in application code, not left to editorial discipline alone.

## 2. What AI Must Never Do

Directly from spec §18/§41, and binding on every agent defined in `AGENTS.md`:

- Invent facts not present in source material.
- Fabricate quotations.
- Create or cite fake sources.
- Impersonate citizens, officials, or organizations.
- Create fake grassroots accounts or manufacture the appearance of consensus.
- Coordinate deceptive personas.
- Disguise sponsored or political content as independent reporting.
- Publish high-risk political claims without human review — there is no automated-publish path
  for any content, but this is called out specifically because political claims are where the
  cost of an AI error is highest.

These are enforced today via system-prompt constraints on `AnalystAgent` and `ContentAgent` (see
`AGENTS.md` §2.2, §2.4) plus the mandatory human approval gate. Prompt-level enforcement is not a
formal guarantee — `QUALITY CONTROL` sampling (§8 below) is the backstop, and any confirmed
violation found in sampling is treated as a process failure requiring immediate agent-prompt or
process revision, not just a one-off correction.

## 3. Content Labeling

Every `content` row carries a mandatory `content_label` (`DATABASE.md` §9):

| Label | Meaning |
|---|---|
| `reporting` | Factual account of what happened, sourced and attributed |
| `analysis` | Explains context/significance; clearly reasoned, not just fact recitation |
| `opinion` | A stated viewpoint, clearly identified as such |
| `sponsored` | Paid placement — must be visibly labeled as such wherever it appears |
| `political_communication` | Content produced on behalf of, or advocating for, a political actor or position |

The label is set at generation time by `ContentAgent`, defaulting from the Story's editorial
classification, and is rendered on every published surface (website byline area, Instagram
caption/overlay convention, X post prefix) — an adapter is not permitted to drop it for a cleaner
look (`DISTRIBUTION.md` §7).

## 4. Verification Status Is Not Optional Metadata

Every Story carries a `verification_status` (`unverified` → `single_source` → `multi_source` →
`primary_source_backed` → `verified`, or `disputed`/`corrected`). Editors are expected to check
this before approving a Story for content generation, especially for anything in the
`political_communication` label. A `disputed` status must be visibly reflected in any published
content about that Story, not silently resolved by picking one side.

## 5. Corrections

Corrections are additive, not silent edits: a correction is an `editorial_reviews` row with
`action = correction_issued`, and the website renders a visible correction notice on the article
(`DISTRIBUTION.md` §3.1). The original text is not quietly rewritten. `verification_status` moves
to `corrected` when applicable. There is no AI-initiated correction path in V1 — only a human
editor issues one.

## 6. Human Approval Risk Tiers (spec §28)

| Risk tier | Requires explicit human approval before proceeding? |
|---|---|
| Scout triage, Analyst summarization, internal research/context notes | No — logged, not blocking |
| ContentAgent output before publish | **Yes, always** |
| Any `verification_status` transition to `verified` or `disputed` | **Yes, always** |
| Corrections | **Yes, always** (human-initiated only) |
| Anything labeled `political_communication` | **Yes, always**, regardless of agent confidence |

## 7. Source Standards (Source Registry)

Every registered source (`sources` table) must have a declared `source_type`, `geography`,
`language`, and an editor-maintained `reliability_score` — this score is set by a human, never by
an agent, and factors into `VerificationAgent`'s rollups. Sources are deactivated, not deleted,
when they prove unreliable, to preserve the historical provenance of anything already ingested
from them.

## 8. Quality Control (spec §38)

A sample of published stories/content is periodically reviewed by an editor against: factual
accuracy, source attribution correctness, classification accuracy, duplicate-detection accuracy,
headline/summary quality, and platform-adaptation quality (did the platform draft preserve the
Story's factual meaning). Findings feed back into agent prompt revisions and, where a pattern
emerges, into this policy document. This is a manual process in V1; automated eval fixtures
(`AGENTS.md` §5) supplement but do not replace it.

## 9. Scope Boundary

This policy governs SAPTANGA Newsroom V1's own content pipeline only. It does not extend to, and
makes no claim about, the unrelated NAZAR platform present elsewhere in this repository — see
`ARCHITECTURE.md` §0.
