import json
import os
import re
from typing import List

import httpx

from .models import WordClue

DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"
DEFAULT_MODEL = "deepseek-v4-flash"
MAX_WORD_LENGTH = 15
CANDIDATE_COUNT = 28


class DeepSeekError(Exception):
    """Raised when the DeepSeek API call fails or returns unusable data."""


def _build_prompt(subject: str) -> str:
    return (
        f"Generate {CANDIDATE_COUNT} crossword candidate words related to the "
        f'subject "{subject}".\n\n'
        "Rules:\n"
        f"- Each word must be a single word, {MAX_WORD_LENGTH} letters or fewer, "
        "letters only (no spaces, hyphens, apostrophes, or numbers).\n"
        "- Each word needs a short, clear crossword-style clue.\n"
        "- Vary word lengths so a grid-placement algorithm has room to work "
        "(include some short 3-5 letter words and some longer ones).\n"
        "- Do not repeat words.\n\n"
        'Respond with ONLY a JSON object of the form: {"words": '
        '[{"word": "EXAMPLE", "clue": "A clue for the word"}, ...]}. '
        "No commentary, no markdown fences."
    )


def _extract_json(content: str) -> dict:
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", content, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    raise DeepSeekError("DeepSeek response was not valid JSON")


async def generate_words(subject: str) -> List[WordClue]:
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise DeepSeekError(
            "DEEPSEEK_API_KEY is not set. Add it to backend/.env (see .env.example)."
        )
    model = os.environ.get("DEEPSEEK_MODEL", DEFAULT_MODEL)

    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You generate crossword word/clue lists and respond with "
                    "strict JSON only."
                ),
            },
            {"role": "user", "content": _build_prompt(subject)},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.7,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=55.0) as client:
            resp = await client.post(DEEPSEEK_API_URL, json=payload, headers=headers)
    except httpx.RequestError as exc:
        raise DeepSeekError(f"Could not reach DeepSeek API: {exc}") from exc

    if resp.status_code != 200:
        raise DeepSeekError(
            f"DeepSeek API returned {resp.status_code}: {resp.text[:300]}"
        )

    try:
        body = resp.json()
        content = body["choices"][0]["message"]["content"]
    except (KeyError, IndexError, json.JSONDecodeError) as exc:
        raise DeepSeekError(f"Unexpected DeepSeek response shape: {exc}") from exc

    data = _extract_json(content)
    raw_words = data.get("words")
    if not isinstance(raw_words, list):
        raise DeepSeekError("DeepSeek response JSON had no 'words' array")

    words: List[WordClue] = []
    seen = set()
    for item in raw_words:
        try:
            word = str(item["word"]).strip().upper()
            clue = str(item["clue"]).strip()
        except (KeyError, TypeError):
            continue
        if not word.isalpha():
            continue
        if not (2 <= len(word) <= MAX_WORD_LENGTH):
            continue
        if not clue or word in seen:
            continue
        seen.add(word)
        words.append(WordClue(word=word, clue=clue))

    if len(words) < 5:
        raise DeepSeekError(
            f"DeepSeek only returned {len(words)} usable words for "
            f'"{subject}"; try a different subject.'
        )

    return words
