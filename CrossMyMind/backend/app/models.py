from typing import List, Optional
from pydantic import BaseModel, Field


class PuzzleRequest(BaseModel):
    subject: str = Field(..., min_length=1, max_length=100)


class WordClue(BaseModel):
    word: str
    clue: str


class Cell(BaseModel):
    filled: bool
    solution: Optional[str] = None
    number: Optional[int] = None


class ClueEntry(BaseModel):
    number: int
    clue: str
    answer_length: int
    row: int
    col: int


class Clues(BaseModel):
    across: List[ClueEntry]
    down: List[ClueEntry]


class PuzzleResponse(BaseModel):
    subject: str
    rows: int
    cols: int
    grid: List[List[Cell]]
    clues: Clues
