"""Vercel serverless entry point.

Purely additive — it does not modify the FastAPI app at all, just makes
the existing backend/app package importable and re-exports its `app`
object, which Vercel's Python runtime detects and serves as an ASGI
function. `uvicorn app.main:app` from backend/ (local dev) is unaffected.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.main import app  # noqa: E402
