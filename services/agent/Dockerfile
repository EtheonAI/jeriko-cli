FROM python:3.11-slim AS base

WORKDIR /app

# Install uv for faster package installation
RUN pip install uv

# Copy project files
COPY services/agent/pyproject.toml ./
COPY services/agent/src ./src

# Install dependencies
RUN uv pip install --system -e .

# Production image
FROM python:3.11-slim AS runner

WORKDIR /app

# Copy installed packages and source
COPY --from=base /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=base /app/src ./src

ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=production

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
