# REUSE_MAP — Reference Repository Analysis

Phase 0 technical reconnaissance for SAPTANGA Newsroom V1. This document records what was
inspected in each reference repository, the license and risk posture, and an explicit
**REUSE / ADAPT / REIMPLEMENT / REJECT** decision per component, per the instructions in the
build spec. No code from these repositories has been copied into SAPTANGA. Where a pattern is
marked ADAPT, SAPTANGA reimplements the *idea* from scratch in our own stack (Python/FastAPI or
TypeScript/Next.js as appropriate) rather than vendoring source.

## Methodology

Each repository was shallow-cloned and inspected directly (file tree, `README.md`, dependency
manifests, CI/workflow configs, and representative source files) rather than reviewed from
memory. One of the three repositories named in the spec could not be reached — see below.

---

## Repository 1: `finaldie/auto-news`

| | |
|---|---|
| **Purpose** | Personal AI news/content aggregator: pulls RSS/Reddit/Twitter/YouTube, summarizes with an LLM, files curated notes into Notion, generates weekly recaps and TODOs. |
| **Language** | Python (≥3.9) |
| **Orchestration** | Apache Airflow (DAGs in `dags/`, task modules prefixed `af_*.py` — collect, clean, save, publish, sync, journal) |
| **Database** | MySQL (relational), plus a pluggable vector store: ChromaDB, Milvus, or Pinecone (`embedding.py`, `*_cli.py` per backend) |
| **Ingestion** | `ops_rss.py`, `ops_reddit.py`, `ops_twitter.py`, `ops_youtube.py`, `ops_article.py` — one module per source type, each normalizing into a common `data_model.py` shape |
| **AI architecture** | LangChain-mediated, multi-provider (OpenAI, Google Gemini, Ollama) via `llm_agent.py` / `llm_const.py` / `llm_prompts.py`; separate embedding backends (`embedding_openai.py`, `embedding_hf.py`, `embedding_ollama.py`) selected by config |
| **Agent architecture** | Mostly a linear DAG pipeline, not multi-agent. One experimental multi-agent path (`ops_deepdive.py`) uses `ag2`/AutoGen for open-ended web-search research |
| **Scheduling** | Airflow DAG schedules (cron-like), containerized workers |
| **Deployment** | Docker Compose for local; Helm charts + ArgoCD manifests for Kubernetes |
| **Testing** | GitHub Actions Python workflow (`python.yml`), flake8 lint config; no strong evidence of a deep unit-test suite for agent outputs |
| **Distribution** | None — output is consumed by the user via Notion and an optional companion mobile app (Dots Agent). Not built for automated multi-platform publishing. |
| **License** | **MIT** (Copyright 2023–2025 Yuzhang Hu) — permissive, safe to draw architectural ideas from |
| **Security concerns** | Single-user trust model: no RBAC, no approval workflow, no audit log — everything an authenticated user connects auto-publishes to their own Notion. Secrets via `.env`, consistent with SAPTANGA's own approach. Not designed for a multi-editor, public-facing newsroom, so its trust model does not transfer. |
| **Technical debt / fit issues** | Tightly coupled to Notion as the human-facing surface (no dedicated editorial UI); Airflow is heavy operational overhead for V1's scale; three interchangeable vector-DB backends is more configuration surface than SAPTANGA needs on day one (spec calls for pgvector only). |

**Reusable concepts (not code):**
- Per-source-type ingestion module pattern with a shared normalized item model.
- Multi-provider LLM/embedding abstraction (provider selected by config, not hardcoded) — validates SAPTANGA's own requirement for an AI abstraction layer.
- Semantic-similarity-based deduplication via embeddings, layered under simpler hash/title checks.

**Not reusable:** Airflow as the orchestrator (operationally heavy for V1's single-newsroom scale — a scheduler inside FastAPI/cron, or n8n for cross-service glue, is a better fit); Notion-as-CMS (SAPTANGA needs a purpose-built Editor Desk with approval gates); the single-user trust model.

---

## Repository 2: `duanyytop/agents-radar`

| | |
|---|---|
| **Purpose** | Fully-automated daily digest of AI-ecosystem signals (GitHub releases, Hacker News, Product Hunt, ArXiv, Hugging Face, Dev.to, Lobsters, Anthropic/OpenAI blogs) published as GitHub Issues, committed Markdown, a static site, an RSS feed, and a hosted MCP server. |
| **Language** | TypeScript (Node, ESM), `tsx` runtime, no build step for the workflow itself |
| **Orchestration** | GitHub Actions cron (`.github/workflows/daily-digest.yml`, 08:00 CST daily) — fully serverless, no persistent process |
| **Database** | **None.** State is the git repository itself: digests live as committed Markdown under `digests/`, plus a generated `manifest.json` and `feed.xml`. |
| **Ingestion** | One file per source under `src/` (`arxiv.ts`, `hn.ts`, `hf.ts`, `devto.ts`, `lobsters.ts`, `ph.ts`, `github.ts`, `trending.ts`, `web.ts`) — each calls a public API/sitemap and returns a normalized list of items. Clean, small, single-responsibility modules. |
| **AI architecture** | `src/providers/` — a small, clean interface (`types.ts` defines the provider contract; `anthropic.ts`, `openai.ts`, `openai-compatible.ts`, `deepseek.ts`, `openrouter.ts`, `github-copilot.ts` implement it) selected via `providers/index.ts`. This is the best multi-provider abstraction pattern seen across both accessible repos. |
| **Agent architecture** | None — single linear pipeline (fetch → summarize → build report → save/notify). No task states, no human approval step, no retries/escalation model. |
| **Scheduling** | GitHub Actions cron only |
| **Deployment** | None beyond GitHub Actions + GitHub Pages (static site) + a Cloudflare Worker for the MCP server |
| **Testing** | `vitest`, with real unit tests for config, i18n, prompt builders, report builders, and each provider (`src/__tests__/*.test.ts`) — a good example of testing prompt-construction and provider-selection logic deterministically without live LLM calls |
| **Distribution** | `notify.ts` (Telegram), `feishu.ts` (Feishu group), `social.ts` (posts to Xiaohongshu) — each a small, isolated "send this content to platform X" module. Structurally the closest thing in either repo to SAPTANGA's `DistributionAdapter` concept, at a much smaller scale. |
| **License** | **MIT** (Copyright 2026 Dylan) — permissive |
| **Security concerns** | Fully autonomous: it fetches, summarizes, and **publishes with no human review step** by design (it's a personal digest bot, not a publication with editorial stakes). Secrets via GitHub Actions secrets — fine for its use case, not a pattern to copy for SAPTANGA's higher-stakes political/public-interest publishing. |
| **Technical debt / fit issues** | No persistence layer at all — fine for a stateless daily digest, unworkable for SAPTANGA's Story/Entity/provenance model which needs a real relational database. No concept of approval, verification, or provenance — the opposite of what SAPTANGA's editorial-safety requirements demand. |

**Reusable concepts (not code):**
- The `providers/` interface shape (a `generate(prompt, opts) → text` contract with one file per vendor) is a strong, directly-adaptable pattern for SAPTANGA's `AIProvider` abstraction (Anthropic + OpenAI backends).
- One-module-per-source ingestion layout, mirrored by `distribution/` having one-module-per-platform — validates SAPTANGA's adapter-per-platform requirement.
- Deterministic testing of prompt-building and provider-selection with mocked responses, matching the spec's own testing requirement (§33).

**Not reusable:** the fully-autonomous, no-approval, no-database publishing model — this is structurally incompatible with SAPTANGA's mandatory human-in-the-loop approval gate and is exactly the kind of "AI automatically publishes" architecture the spec (§2) says NOT to build.

---

## Repository 3: `frankomondo/ai-social-media-post-automation` — **INACCESSIBLE**

This repository could not be retrieved through any available channel during reconnaissance:

- `git clone` (anonymous, public-read path): failed — `could not read Username for 'https://github.com': terminal prompts disabled` (this is the signature of a private/renamed/deleted repo, not a network error; the other two repos cloned anonymously without issue).
- GitHub API (`get_file_contents`, `search_code`): repo not attachable to this session (cross-owner attach rejected) and not found via GitHub's code search index.
- Direct web fetch (`github.com/.../blob/master/main.py`) and `raw.githubusercontent.com`: both returned **404**.
- Web search still surfaces a cached link to `.../blob/master/main.py`, which is why the URL appears findable at first glance — but the underlying repository no longer resolves. Most likely explanation: the repo was deleted, made private, or renamed after being indexed.

**Decision: REJECT (unavailable) — proceeding without it.** No component decisions are made against
this repo since no content could be inspected. If the user has a mirror, fork, or updated URL, it
can be re-reviewed and this section updated. This does not block Phase 0 — the other two repos
already validate the two patterns V1 most needs (multi-source ingestion, multi-provider AI
abstraction), and generic social-scheduling automation (post now / post later to a platform API)
is a well-understood problem SAPTANGA's `DistributionAdapter` interface (see `DISTRIBUTION.md`)
covers on its own.

---

## Component-Level Decisions

| Component | Source | Decision | Reason | SAPTANGA Implementation |
|---|---|---|---|---|
| Multi-provider LLM abstraction | agents-radar `src/providers/` | **ADAPT** | Clean, minimal contract (one interface, one file per vendor); directly matches spec §7's model-abstraction requirement | `backend/app/agents/providers/` — `AIProvider` Protocol with `AnthropicProvider` and `OpenAIProvider`, model selected per call site by cost tier |
| Per-source ingestion modules | auto-news `ops_*.py`, agents-radar per-source `.ts` files | **ADAPT** | Both repos independently converge on "one module per source type, normalized output shape" — validates the pattern | `backend/app/ingestion/sources/{rss,web,youtube}.py`, each returning a common `RawItem` Pydantic model |
| Semantic dedup via embeddings | auto-news `embedding*.py` + vector store | **ADAPT** | Concept is sound (hash/title first, embedding similarity as a later layer); their 3-way vector-store choice is unneeded complexity | `backend/app/services/dedup.py` using pgvector cosine similarity on `article.embedding`, layered after hash/title checks |
| Airflow DAG orchestration | auto-news | **REJECT** | Heavy ops burden (scheduler + workers + metadata DB) for V1's scale; FastAPI background tasks/cron cover the single-newsroom ingestion cadence; n8n is already the spec's designated tool for cross-service glue | APScheduler-driven ingestion jobs inside the backend, or n8n workflows per spec §7 |
| Notion-as-CMS / reader UI | auto-news | **REJECT** | SAPTANGA needs a purpose-built, RBAC-gated Editor Desk with approval gates, provenance display, and merge/split tooling — Notion cannot express the Story/Entity/approval model | Custom Next.js Editor Desk (`frontend/`) per spec §16 |
| One-module-per-platform distribution | agents-radar `notify.ts`/`feishu.ts`/`social.ts` | **ADAPT** | Validates the "small isolated adapter per destination" shape at a toy scale | `backend/app/distribution/{website,instagram,x}/adapter.py`, all implementing a shared `DistributionAdapter` ABC |
| Fully autonomous publish pipeline | agents-radar (whole system) | **REJECT** | No human approval step by design — directly conflicts with spec §2/§28's mandatory human-in-the-loop gate for publication | Explicit `approval_status` gate in `content` table; `POST /publish` is unreachable until an editor approves |
| Single-user trust model / no RBAC / no audit log | auto-news (whole system) | **REJECT** | SAPTANGA is a multi-editor, public-interest system requiring RBAC and full auditability (spec §31/§32) | `users`, `roles`, `audit_logs` tables; every agent and editorial action logged |
| Multi-agent "deepdive" research (AutoGen) | auto-news `ops_deepdive.py` | **REJECT for V1** | Spec §26 explicitly says V1 does not need a swarm architecture; keep orchestration simple and observable | Deferred; V1 uses explicit, single-purpose agents (Scout/Analyst/Verification/Content/Analytics) with no agent-to-agent autonomy |
| Deterministic provider/prompt unit tests | agents-radar `src/__tests__/` | **ADAPT** | Directly matches spec §33's requirement to test agents with mocked responses, not live LLM calls | `backend/tests/agents/` — fixture-based tests per agent, no network calls in CI |
| Generic social post scheduling | *(frankomondo repo — inaccessible)* | **N/A** | Repository could not be inspected | Not blocking — covered by SAPTANGA's own `DistributionAdapter` design |

---

## License Summary

| Repository | License | Compatible with SAPTANGA (proprietary or any OSS license) |
|---|---|---|
| finaldie/auto-news | MIT | Yes — no code copied, but MIT would permit it if we later did |
| duanyytop/agents-radar | MIT | Yes — same |
| frankomondo/ai-social-media-post-automation | Unknown (inaccessible) | N/A |

No code, prompts, or configuration files were copied verbatim from either accessible repository.
All "ADAPT" rows above mean SAPTANGA re-implements the *pattern* in its own codebase and stack.
