import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import deepseek_client
from .grid_generator import GridGenerationError, generate_grid
from .models import PuzzleRequest, PuzzleResponse

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

app = FastAPI(title="Crossword Puzzle API")

allowed_origins = os.environ.get(
    "FRONTEND_ORIGIN", "http://localhost:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/puzzle", response_model=PuzzleResponse)
async def create_puzzle(request: PuzzleRequest):
    subject = request.subject.strip()
    if not subject:
        raise HTTPException(status_code=422, detail="Subject must not be empty.")

    try:
        word_clues = await deepseek_client.generate_words(subject)
    except deepseek_client.DeepSeekError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    try:
        return generate_grid(word_clues, subject)
    except GridGenerationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
