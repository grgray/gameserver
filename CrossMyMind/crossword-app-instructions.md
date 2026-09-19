# Crossword Puzzle App — Build Instructions

## Overview
Build a full-stack crossword puzzle app. The user specifies a subject (e.g. "chess", "space exploration"), and the app generates a 10x10 crossword grid with clues related to that subject.

This is an MVP — full Dotpad (tactile display) accessibility integration is a planned future phase and is **out of scope** for this build. However, the frontend itself must be built to be accessible now (standard web accessibility, not Dotpad-specific):

- Semantic HTML throughout (proper landmarks, headings, form labels).
- Full keyboard navigation of the crossword grid (arrow keys to move between cells, tab order that makes sense, no keyboard traps).
- ARIA labels/roles on the grid cells, clue list, and form controls (e.g. cell position and associated clue announced to screen readers on focus).
- Visible focus indicators on all interactive elements.
- Sufficient color contrast (grid lines, filled vs. empty cells, active clue highlighting).
- Announce loading/error states to assistive tech (e.g. `aria-live` regions) rather than relying on visual-only spinners/messages.

## Architecture

- **Frontend:** React + Vite
- **Backend:** Python, FastAPI
- **LLM provider:** DeepSeek (V4-Flash model) for clue/word generation
- **Critical rule:** The frontend must NEVER call the DeepSeek API directly. All LLM calls go through the FastAPI backend. The frontend only talks to our own backend API and receives structured JSON.

## Backend (FastAPI)

Responsibilities:
1. Expose an endpoint (e.g. `POST /api/puzzle`) that accepts a `subject` string from the frontend.
2. Call the DeepSeek API, prompting it to generate a list of words + clues related to the subject.
   - Request enough candidate words (e.g. 15-20) to give the grid-placement step room to work, since not all will fit.
   - Include word-length constraints in the prompt where possible, since the grid is fixed at 10x10 (words must be ≤10 letters).
   - Request structured output: a JSON array of `{ "word": "...", "clue": "..." }` objects.
3. Pass the candidate word/clue list to a separate grid-placement algorithm (NOT the LLM) that:
   - Builds a 10x10 grid.
   - Places words so they intersect correctly across and down.
   - Marks blank/blocked cells.
   - Drops words that don't fit rather than forcing a bad layout.
   - Use an existing Python crossword-generation library if a suitable one exists; otherwise implement a straightforward placement algorithm (e.g. try longest words first, find valid intersections, backtrack on failure).
4. Return the final grid + clue list (with numbering, across/down, start positions) as JSON to the frontend.
5. Store the DeepSeek API key in an environment variable (`.env`, loaded via `python-dotenv` or FastAPI settings) — never hardcode it or expose it to the frontend.
6. Add basic error handling: DeepSeek API failures, subjects that don't yield enough placeable words, etc.

Suggested structure:
```
backend/
  app/
    main.py            # FastAPI app + routes
    deepseek_client.py # DeepSeek API calls, prompt building
    grid_generator.py  # Grid placement algorithm
    models.py          # Pydantic request/response models
  .env.example
  requirements.txt
```

## Frontend (React + Vite)

Responsibilities:
1. Simple UI: a text input for the subject, a "Generate Puzzle" button.
2. Call the backend's `/api/puzzle` endpoint and render the returned grid.
3. Render a standard crossword grid (10x10) with numbered cells, editable letter inputs, and a clue list split into "Across" and "Down".
4. Handle loading and error states (e.g. while waiting on generation, or if generation fails).
5. Keep API calls isolated in a small service/client module (e.g. `src/api/puzzleClient.js`) rather than scattered inline fetches.
6. Build the grid and clue components to meet the accessibility requirements above (keyboard nav, ARIA, focus states, live regions) — this isn't an afterthought polish step, treat it as a core requirement of `CrosswordGrid.jsx` and `ClueList.jsx` from the start.

Suggested structure:
```
frontend/
  src/
    api/puzzleClient.js
    components/
      CrosswordGrid.jsx
      ClueList.jsx
      SubjectForm.jsx
    App.jsx
    main.jsx
  vite.config.js
  package.json
```

## Environment / setup

- Backend and frontend should be runnable independently in dev (`uvicorn` for backend, `vite dev` for frontend), with the frontend proxying `/api` calls to the backend during development.
- Include a root-level `README.md` with setup steps for both services, plus how to set the `DEEPSEEK_API_KEY` environment variable.

## Suggested build order for Claude Code

1. Scaffold backend FastAPI app with a stubbed `/api/puzzle` endpoint returning mock data.
2. Implement DeepSeek client + prompt for word/clue generation.
3. Implement the grid-placement algorithm against real or mock word lists.
4. Wire the endpoint end-to-end (subject in → grid+clues out).
5. Scaffold frontend with Vite, build the subject form and grid/clue components against the real API.
6. Polish: loading/error states, basic styling, README.
