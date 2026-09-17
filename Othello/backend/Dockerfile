# --- Stage 1: build dependencies ---
FROM python:3.12-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create a virtual environment to isolate dependencies cleanly
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY othello/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- Stage 2: runtime image ---
FROM python:3.12-slim

WORKDIR /app

# Copy the venv from builder
COPY --from=builder /opt/venv /opt/venv

# Create a non-root user for security
RUN useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser

# Copy application source code
COPY --chown=appuser:appuser othello/backend/api ./api
COPY --chown=appuser:appuser othello/backend/gameengine ./gameengine

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

EXPOSE 8000

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]