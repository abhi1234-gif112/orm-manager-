# SECURITY — SAPTANGA Newsroom V1

Expands `ARCHITECTURE.md` §6 into the operational security policy for the backend, frontend, and
distribution layers built in Phase 1 onward.

## 1. Secrets Management

- All secrets (DB credentials, `SUPABASE_JWT_SECRET`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, S3
  keys, platform API tokens) are supplied via environment variables only.
- `backend/.env.example` and `.env.saptanga.example` enumerate every required key with placeholder
  values — never real ones. `.env`, `.env.saptanga`, and `backend/.env` are gitignored.
- No secret is ever logged. `structlog` output is reviewed for accidental secret leakage as part
  of code review on any change touching `core/config.py`, provider clients, or distribution
  adapters.
- No secret appears in an HTTP error response body — FastAPI exception handlers return generic
  messages for 5xx errors in non-development environments (tightened further in Phase 8).

## 2. Authentication

- Supabase Auth issues JWTs on successful login (frontend-side only — the backend never sees a
  password).
- The backend verifies every JWT server-side (`backend/app/core/security.py`,
  `decode_supabase_jwt`) using `SUPABASE_JWT_SECRET` and the expected audience. An invalid,
  expired, or unverifiable token is a `401`, unconditionally.
- The application-level role (`users.role`) is looked up from the database by the token's `sub`
  claim — it is **never** read from a client-supplied claim, so a forged or stale token claim
  cannot grant elevated access (see the docstring on `decode_supabase_jwt`).

## 3. Authorization (RBAC)

- `backend/app/core/permissions.py` defines `require_role()` and its shorthands
  (`require_editor`, `require_contributor`, `require_any_authenticated`) as FastAPI dependencies.
- Every mutating route depends on one of these — permission logic lives in one file, not scattered
  per-endpoint checks. `sources.py` is the reference implementation for Phase 1; every later
  router (stories, content, distribution) follows the same pattern.
- Deactivation over deletion: sources (and, in later phases, other provenance-bearing records) are
  deactivated rather than hard-deleted, so RBAC failures can't be used to destroy audit history.

## 4. Input / Output Validation

- Every API request/response body is a Pydantic model (`backend/app/schemas/`) — no raw dict
  passthrough.
- Every agent's LLM output is validated against a Pydantic schema before it is used anywhere
  downstream (`AGENTS.md` — schema validation failure is a retryable error, not silently accepted
  malformed data).

## 5. Audit Logging

- `audit_logs` (`backend/app/models/audit.py`) is written via
  `backend/app/services/audit.py:record_audit_event`, called from every mutating route handler
  (see `sources.py` for the pattern: create/update/deactivate all log before/after state).
- The table is designed to be insert-only at the application level; the Phase 1 migration does not
  yet revoke `UPDATE`/`DELETE` grants at the Postgres role level — **tracked as a Phase 8
  hardening item**, not yet done.

## 6. Rate Limiting

Not yet implemented in Phase 1 (no user-facing traffic to protect yet beyond the authenticated
dashboard). Required before Phase 2 ingestion goes live against real sources (per-source rate
limiting to respect source ToS) and before Phase 6 distribution/public website launch (per-IP/
per-user limits on public and auth endpoints). Tracked in `ROADMAP.md` Phase 8.

## 7. Platform Credentials (Distribution)

- Each platform adapter (`DISTRIBUTION.md` §3) uses exactly one set of official API credentials —
  SAPTANGA's own registered Instagram Business account and X developer account. No credential
  sharing across environments; production and any staging environment use separate app
  registrations where the platform allows it.
- No adapter has a code path for scraping-based publishing, engagement automation, or bypassing
  platform authentication.

## 8. Dependency Management

- Python dependencies pinned via `backend/pyproject.toml`; no unpinned "latest" installs in CI/
  Docker builds.
- `npm ci` (not `npm install`) in both frontend Dockerfiles, so builds are reproducible from
  `package-lock.json`.
- Dependency vulnerability scanning is a Phase 8 hardening item, not yet wired into CI.

## 9. Data Handling

- Object storage (S3-compatible) holds media assets only — no secrets, no raw credentials.
- `articles.raw_content`/`extracted_text` retain full source text for provenance; no separate PII
  scrubbing pass exists in V1 (news/press-release content is the expected corpus, not personal
  data submissions) — revisit if user-submitted content is added in a later phase.
- Backup strategy for Postgres + object storage is a Phase 8 deliverable (`ROADMAP.md`).

## 10. Known Gaps (tracked, not silently ignored)

- Rate limiting: not yet implemented (§6).
- DB-level insert-only enforcement on `audit_logs`: not yet implemented (§5).
- Dependency vulnerability scanning: not yet wired into CI (§8).
- Backup/DR procedure: not yet written (§9).

All four are explicit Phase 8 ("Hardening") deliverables in `docs/ROADMAP.md` — listed here so
they are visible before launch, not discovered at launch.

## 11. Scope Boundary

This document covers SAPTANGA Newsroom V1's own backend/frontend/distribution surface. It does
not audit, and makes no claim about, the unrelated NAZAR platform elsewhere in this repository —
see `ARCHITECTURE.md` §0.
