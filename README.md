# NAZAR — Political Intelligence & Reputation Monitoring Platform

> Command-grade political intelligence for Indian/South Asian politicians and organizations.
> Built by Saptanga Labs.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         NAZAR Platform                          │
├────────────────────┬────────────────────┬───────────────────────┤
│   React Frontend   │   Express Backend  │   AI Engine           │
│   (Vite + TS)      │   (Node.js + TS)   │   (Claude claude-sonnet-4-6)  │
├────────────────────┼────────────────────┼───────────────────────┤
│   PostgreSQL       │   Redis            │   BullMQ              │
│   (Prisma ORM)     │   (Cache+Queue)    │   (Job Workers)       │
└────────────────────┴────────────────────┴───────────────────────┘
```

### Core Data Model

| Entity | Purpose |
|--------|---------|
| `Client` | Politician/organization being monitored |
| `Mention` | Ingested social/web content with AI analysis |
| `Individual` | Digital profile of political actors (scored) |
| `Alert` | Threat/opportunity notifications with AI briefs |
| `ResponseAsset` | AI-generated communication assets (10+ types) |

### Ingestion Sources (12)

- Twitter/X — Search API & user timelines
- Facebook/Instagram — Meta Graph API
- YouTube — Data API v3
- LinkedIn — Search scrape
- Telegram — Bot API
- Reddit — Public JSON API (no auth required)
- Hindi news portals — Cheerio scraping (Aaj Tak, NDTV, etc.)
- English news portals — Cheerio scraping
- WhatsApp — Manual text/file upload
- Web — Generic Cheerio scraper

### Claude AI Integration Points

1. **`analyzeMention()`** — Political sentiment + tone + topics + named entities + threat level (0–10) + bilingual summaries
2. **`scoreIndividual()`** — Influence/Risk/Stance scoring across three dimensions
3. **`generateResponseAsset()`** — 11 asset types (counter-brief, tweet, press kit, WhatsApp forward, etc.)
4. **`generateAlertBrief()`** — Command-grade intelligence briefs from mention clusters

---

## Quick Start

### Prerequisites
- Docker + Docker Compose
- Node.js 20+
- Anthropic API key

### 1. Clone & Configure

```bash
cp .env.example .env
# Edit .env — minimum required: ANTHROPIC_API_KEY, JWT_SECRET, JWT_REFRESH_SECRET
```

### 2. Start Infrastructure

```bash
docker-compose up postgres redis -d
```

### 3. Database Setup

```bash
cd packages/backend
npm install
npm run db:generate   # generate Prisma client
npm run db:migrate    # run migrations
npm run db:seed       # create demo user + client
```

### 4. Run Backend

```bash
npm run dev
```

### 5. Run Frontend

```bash
cd packages/frontend
npm install
npm run dev
```

### 6. Login

- URL: `http://localhost:5173`
- Admin: `admin@nazar.ai` / `Admin@Nazar2024!`
- Analyst: `analyst@nazar.ai` / `Analyst@Demo2024!`

### Docker (Full Stack)

```bash
docker-compose up --build
```

---

## API Reference

### Authentication
```
POST /api/auth/login          { email, password }
POST /api/auth/refresh        { refreshToken }
POST /api/auth/logout
GET  /api/auth/me
```

### Clients
```
GET    /api/clients
POST   /api/clients
GET    /api/clients/:id
PATCH  /api/clients/:id
DELETE /api/clients/:id
GET    /api/clients/:id/dashboard
```

### Mentions
```
GET  /api/mentions?clientId=&source=&sentiment=&topic=&from=&to=
GET  /api/mentions/:id
POST /api/mentions/:id/reanalyze
POST /api/mentions/upload/whatsapp
```

### Alerts
```
GET   /api/alerts?clientId=&status=&severity=&type=
GET   /api/alerts/:id
PATCH /api/alerts/:id/status
```

### Individuals
```
GET   /api/individuals?clientId=&stance=&type=&minRisk=
POST  /api/individuals
GET   /api/individuals/:id
POST  /api/individuals/:id/rescore
PATCH /api/individuals/:id/stance
```

### Response Assets
```
GET  /api/assets?clientId=&type=
POST /api/assets/generate
GET  /api/assets/:id
PATCH /api/assets/:id/status
```

### Analytics
```
GET /api/analytics/sentiment-trend?clientId=&days=
GET /api/analytics/source-breakdown?clientId=&days=
GET /api/analytics/topic-cloud?clientId=&days=
GET /api/analytics/threat-radar?clientId=
GET /api/analytics/snapshots?clientId=&period=
```

### Ingestion
```
GET    /api/ingestion?clientId=
POST   /api/ingestion
POST   /api/ingestion/:id/trigger
PATCH  /api/ingestion/:id
DELETE /api/ingestion/:id
```

---

## Individual Scoring Algorithm

Each individual is scored on three dimensions on every significant mention event:

**Influence Score (0–100)**
- Weighted follower reach across platforms
- Engagement rate vs. follower count
- Media amplification history
- Viral content production rate

**Risk Score (0–100)**
- Stance hostility toward client
- Content tone analysis (inflammatory, threatening)
- Coordination signals (posting patterns)
- Historical accuracy of claims

**Stance Classification**
| Class | Description |
|-------|-------------|
| ALLY | Consistently positive/supportive; score > 0.5 |
| THREAT | Actively hostile; high risk + negative stance |
| WATCHLIST | Neutral or shifting; requires monitoring |
| NEUTRAL | No significant engagement pattern |

Stance can be manually overridden per-client (same individual may be ALLY to one client, THREAT to another).

---

## Alert Engine Triggers

| Alert Type | Trigger Condition |
|-----------|-------------------|
| `VIRAL_NEGATIVE` | 2+ mentions with threatLevel ≥ 7 AND engagement > 500 |
| `DISINFORMATION` | Any mention classified as disinformation |
| `COORDINATED_ATTACK` | 5+ mentions with INFLAMMATORY or THREATENING tone in short window |
| `SENTIMENT_SHIFT` | Aggregate sentiment drops > 0.3 points vs. 24h baseline (min 10 recent, 20 historic) |

All alerts include Claude-generated intelligence briefs and recommended actions. Deduplication prevents re-creation within 1-hour windows.

---

## Response Asset Types (11)

| Type | Use Case |
|------|----------|
| `COUNTER_BRIEF` | Internal intelligence brief for campaign team |
| `RAPID_RESPONSE_TWEET` | 280-char Twitter/X response |
| `PRESS_STATEMENT` | Formal statement for media distribution |
| `PRESS_KIT` | Comprehensive media package |
| `WHATSAPP_FORWARD` | Grassroots sharing content |
| `SOCIAL_CAPTION` | Instagram/Facebook post caption |
| `TALKING_POINTS` | Spokesperson interview preparation |
| `FACT_CHECK` | Evidence-based rebuttal document |
| `NARRATIVE_MEMO` | Internal strategic reframing memo |
| `MEDIA_PITCH` | Journalist outreach email |
| `CRISIS_STATEMENT` | Crisis communication statement |

All assets are generated in both English and Hindi (Devanagari script).

---

## Security

- All passwords hashed with bcrypt (12 rounds)
- JWT access tokens (15m TTL) + refresh token rotation (7d TTL)
- Parameterized queries only via Prisma (no raw SQL injection vectors)
- Helmet.js security headers on all responses
- Rate limiting: 500 req/15min globally, tighter per-route
- No API keys or secrets in code — all via environment variables
- CORS restricted to configured frontend URL

---

## Environment Variables

See `.env.example` for all required and optional variables.

Minimum required for operation:
```
DATABASE_URL
REDIS_URL
JWT_SECRET            (≥32 chars)
JWT_REFRESH_SECRET    (≥32 chars, different from JWT_SECRET)
ANTHROPIC_API_KEY
```

Social platform keys are optional — the platform operates with reduced ingestion coverage without them.
