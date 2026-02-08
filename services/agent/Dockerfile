FROM python:3.12-slim AS base

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# Install uv for fast dependency resolution
RUN pip install --no-cache-dir uv

FROM base AS builder

COPY services/agent/pyproject.toml ./

# Install dependencies (cached layer — only re-runs when pyproject.toml changes)
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --system .

COPY services/agent/src ./src

FROM python:3.12-slim AS runner

RUN groupadd -g 1001 rubic && useradd -u 1001 -g rubic -s /bin/sh -m rubic

WORKDIR /app

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --from=builder /app/src ./src

USER rubic

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    ENVIRONMENT=production

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["python", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
