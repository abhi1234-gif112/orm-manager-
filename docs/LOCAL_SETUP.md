# LOCAL_SETUP — Running SAPTANGA Newsroom on your own machine

## 0. First, make sure you actually have the right code

This repository contains **two unrelated applications** (see `ARCHITECTURE.md` §0):

| Application | Lives in | What it is |
|---|---|---|
| **SAPTANGA Newsroom** | `backend/`, `frontend/` | The newsroom this guide sets up (Python/FastAPI + Next.js) |
| NAZAR | `packages/` | A separate, pre-existing platform (Node/Express/Prisma). Not covered here. |

**If you downloaded a ZIP from GitHub, check this before anything else.** GitHub's
"Download ZIP" gives you whichever branch you were viewing. The SAPTANGA Newsroom code lives on
the branch `claude/saptanga-newsroom-v1-arch-cz7izf`, not on the default branch.

Unzip, then look inside the folder:

```bash
ls
```

- If you see a **`backend/`** folder and a **`frontend/`** folder → you have the right code, continue to step 1.
- If you only see `packages/`, `README.md`, `package.json` → you downloaded the wrong branch. Go back to GitHub, switch to the `claude/saptanga-newsroom-v1-arch-cz7izf` branch first, *then* Code → Download ZIP. (Or clone instead: `git clone -b claude/saptanga-newsroom-v1-arch-cz7izf <repo-url>`.)

---

## 1. What you need installed

| Requirement | Notes |
|---|---|
| **Python 3.11 or newer** | `python3 --version` |
| **PostgreSQL 16** | Must also have the **pgvector** and **pg_trgm** extensions available |
| **Node.js 20 or newer** | Only needed for the web interfaces; `node --version` |

**Option A (Docker) is far easier** if you have Docker installed, because it provides the correct
Postgres with pgvector already built in. **Option B** is a manual install.

---

## Option A — Docker (recommended, fewest moving parts)

From the project folder:

```bash
cp .env.saptanga.example .env.saptanga
```

Open `.env.saptanga` in a text editor and set at minimum:

```
SAPTANGA_POSTGRES_PASSWORD=any-password-you-like
SUPABASE_JWT_SECRET=any-random-string-at-least-32-characters-long
```

Everything else can stay as-is for a first run (the AI keys are not needed until Phase 3, and the
Instagram/X keys not until Phase 6).

Then start it:

```bash
docker compose -f docker-compose.saptanga.yml up --build
```

This starts Postgres (with pgvector), runs the database migrations automatically, and starts the
API plus both web interfaces:

- API: <http://localhost:8000> — interactive API docs at <http://localhost:8000/docs>
- Public website: <http://localhost:3000>
- Editor Desk: <http://localhost:3001>

To stop: `Ctrl+C`, then `docker compose -f docker-compose.saptanga.yml down`.

> **Honest caveat:** the compose file is syntactically validated but the full Docker build has not
> been executed end-to-end (no Docker daemon was available in the environment where this was
> built). Option B below *has* been run start-to-finish and verified. If Docker gives you trouble,
> use Option B.

---

## Option B — Manual setup (verified working end-to-end)

### B1. Start PostgreSQL and install pgvector

**macOS (Homebrew):**
```bash
brew install postgresql@16 pgvector
brew services start postgresql@16
```

**Ubuntu / Debian:**
```bash
sudo apt-get install -y postgresql-16 postgresql-16-pgvector
sudo service postgresql start
```

**Windows:** use Option A (Docker), or run these steps inside WSL2.

### B2. Create the database

```bash
sudo -u postgres psql -c "CREATE USER saptanga WITH PASSWORD 'saptanga' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE saptanga_newsroom OWNER saptanga;"
sudo -u postgres psql -d saptanga_newsroom -c "CREATE EXTENSION IF NOT EXISTS vector;"
sudo -u postgres psql -d saptanga_newsroom -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
```

(On macOS/Homebrew, drop the `sudo -u postgres` and just use `psql`.)

The last two lines create the extensions as a superuser. The migrations will also try to create
them automatically if your database user has permission — if it does not, you will get a clear
message telling you to run exactly these commands.

### B3. Install the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
```

### B4. Configure the backend

```bash
cp .env.example .env
```

Open `backend/.env` and set these two lines (the rest can stay as-is for now):

```
DATABASE_URL=postgresql+psycopg://saptanga:saptanga@localhost:5432/saptanga_newsroom
SUPABASE_JWT_SECRET=any-random-string-at-least-32-characters-long
```

### B5. Create the database tables

```bash
alembic upgrade head
```

You should see two `Running upgrade` lines and no errors. This creates all 18 tables.

### B6. Start the API

```bash
uvicorn app.main:app --reload
```

Check it in a browser: <http://localhost:8000/docs> — you should see the interactive API
documentation. Leave this running.

### B7. Start the web interfaces (optional, in new terminals)

```bash
cd frontend/newsroom      # the Editor Desk
npm install
npm run dev -- --port 3001
```

```bash
cd frontend/website       # the public site
npm install
npm run dev -- --port 3000
```

---

## 2. Logging in / trying the API

**Important:** the Editor Desk login screen authenticates against **Supabase Auth**, which is an
external service. Until you create a free Supabase project and put its URL and keys in your `.env`
files, **the login form will not work** — this is expected, not a bug.

You do *not* need Supabase to try the backend. Use the included helper to create a local editor
account and print a working token:

```bash
cd backend
source .venv/bin/activate
python ../scripts/make_dev_token.py
```

It prints a long token. Copy it, then use it:

```bash
TOKEN="paste-the-token-here"

# Confirm who you are
curl http://localhost:8000/api/v1/auth/me -H "Authorization: Bearer $TOKEN"

# Register a news source
curl -X POST http://localhost:8000/api/v1/sources \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Example Feed","url":"https://hnrss.org/frontpage","source_type":"rss","ingestion_method":"rss_poll","language":"en"}'

# Pull articles from it right now (returns how many were stored)
curl -X POST http://localhost:8000/api/v1/sources/<paste-source-id-here>/ingest \
  -H "Authorization: Bearer $TOKEN"

# See what was ingested
curl "http://localhost:8000/api/v1/articles?limit=5" -H "Authorization: Bearer $TOKEN"
```

You can also paste the token into the **Authorize** button at <http://localhost:8000/docs> and
click through the API from the browser instead of using curl.

---

## 3. Running the tests

The tests need their **own** database, because they drop tables and delete rows between tests:

```bash
sudo -u postgres psql -c "CREATE DATABASE saptanga_newsroom_test OWNER saptanga;"
sudo -u postgres psql -d saptanga_newsroom_test -c "CREATE EXTENSION IF NOT EXISTS vector;"
sudo -u postgres psql -d saptanga_newsroom_test -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"

cd backend
source .venv/bin/activate
python -m pytest tests/ -v
```

All 27 should pass. No test makes a live network or AI call.

**Your normal `DATABASE_URL` cannot affect the tests.** The suite deliberately ignores it and
always uses `saptanga_newsroom_test`, so having `DATABASE_URL` exported in your shell (which is
normal while developing) can never cause pytest to wipe your working database. To point the tests
somewhere else, set `TEST_DATABASE_URL` — and the suite will refuse to start unless that database's
name contains `test`.

---

## 4. What actually works right now

The project is built in phases (`ROADMAP.md`). Phases 0–2 are complete:

**Working:**
- Registering, listing, updating, and deactivating news sources
- Automatic scheduled ingestion from RSS/Atom feeds and simple web sources
- `robots.txt` is respected before every fetch
- Duplicate suppression (identical articles are not stored twice)
- Viewing ingested articles through the API
- Every change is written to an audit log

**Not built yet (Phases 3–8):**
- Any AI features — no story clustering, scoring, analysis, or content generation
- The editorial review dashboard (the Editor Desk currently only manages sources)
- Publishing to Instagram, X, or the website
- Analytics

So: ingestion works and stores real articles, but nothing is analyzed or published yet.

---

## 5. Common problems

| Symptom | Cause and fix |
|---|---|
| `type "vector" does not exist` | pgvector is not installed in that database. Run the `CREATE EXTENSION` commands in step B2. |
| `permission denied to create extension` | Your database user is not a superuser. Run the `CREATE EXTENSION` commands in step B2 as the `postgres` superuser. |
| `connection refused` on port 5432 | PostgreSQL is not running. `sudo service postgresql start` (Linux) or `brew services start postgresql@16` (macOS). |
| Login screen does nothing | Expected — Supabase is not configured. Use `scripts/make_dev_token.py` instead (section 2). |
| `ModuleNotFoundError: app` | You are not in the `backend/` folder, or the virtualenv is not active (`source .venv/bin/activate`). |
| Ingest returns `"failed": true` with a network error | The feed URL is unreachable from your machine, or blocked by `robots.txt`. Try a different feed. |
| Port already in use | Something else is on 8000/3000/3001. Use a different one, e.g. `uvicorn app.main:app --port 8080`. |
