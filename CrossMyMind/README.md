# CrossMyMind

A full-stack crossword puzzle generator. Give it a subject and it builds a 10x10
crossword grid with clues, using DeepSeek to generate the word/clue list and a
local grid-placement algorithm (no LLM involved) to lay them out.

## Architecture

- **Frontend:** React + Vite (`frontend/`)
- **Backend:** Python + FastAPI (`backend/`)
- **LLM:** DeepSeek API, called only from the backend — the frontend never sees the API key.

## Setup

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
copy .env.example .env       # Windows; use `cp` on macOS/Linux
```

Edit `backend/.env` and set `DEEPSEEK_API_KEY` to your DeepSeek API key
(get one at https://platform.deepseek.com). Optionally override
`DEEPSEEK_MODEL` (defaults to `deepseek-v4-flash` — check DeepSeek's current
model list and adjust if that slug has changed) and `FRONTEND_ORIGIN`.

Run the API:

```bash
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

This starts Vite on `http://localhost:5173` and proxies `/api/*` requests to
the backend on `http://localhost:8000` (see `frontend/vite.config.js`).

Open `http://localhost:5173`, enter a subject, and click **Generate Puzzle**.

## Deploying to Vercel

The repo root is `CrossMyMind/vercel.json` + `CrossMyMind/api/index.py` (a
thin wrapper that imports the existing FastAPI `app` from `backend/` without
changing it — local `uvicorn app.main:app` keeps working exactly as above).

Since this lives inside the larger `gameserver` monorepo:

1. In the Vercel dashboard, import the `gameserver` GitHub repo, then set the
   project's **Root Directory** to `CrossMyMind`. Framework preset: Other
   (the build/output settings come from `vercel.json`).
2. Add the environment variable `DEEPSEEK_API_KEY` (Project Settings →
   Environment Variables) — this is the same secret as `backend/.env`, just
   set through Vercel instead of a local file. Optionally add
   `DEEPSEEK_MODEL` too.
3. Deploy. Frontend and API end up on the same domain, so the frontend's
   `/api/*` calls are same-origin — no CORS setup needed in production.
4. To use your own domain: add it under Project Settings → Domains, then at
   your registrar (e.g. GoDaddy) point DNS at Vercel as it instructs — either
   an A record at the apex to Vercel's IP, or a CNAME on a subdomain like
   `www` to `cname.vercel-dns.com`. Vercel provisions HTTPS automatically
   once DNS resolves.

## How it works

1. Frontend posts `{ subject }` to `POST /api/puzzle`.
2. Backend asks DeepSeek for ~18 candidate `{ word, clue }` pairs related to the subject.
3. Backend's grid-placement algorithm (`backend/app/grid_generator.py`) places
   as many of those words as it can on a 10x10 grid, longest-first, finding
   valid intersections and rejecting words that don't fit or that would create
   invalid adjacent letters. Words that don't fit are dropped.
4. Backend returns the grid (fill pattern + solution letters + cell numbers)
   and the across/down clue lists as JSON.
5. Frontend renders an interactive, keyboard-navigable grid and clue list.

## Accessibility

The grid and clue list are built with standard web accessibility in mind:
semantic table/grid markup, full arrow-key navigation between cells, ARIA
labels announcing each cell's row/column and across/down clue numbers, visible
focus outlines, an `aria-live` region announcing the active clue, and
`aria-live`/`role="alert"` regions for loading and error states. Dotpad
(tactile display) integration is a planned future phase and is not part of
this build.
