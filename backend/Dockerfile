# Stage 1: Build virtual environment
FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim AS builder

WORKDIR /app

# Install system dependencies needed to compile psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy uv dependency files
COPY pyproject.toml uv.lock ./

# Sync dependencies using uv (creates /app/.venv)
# Note: --no-dev excludes development dependencies
RUN uv sync --frozen --no-install-project --no-dev

# Stage 2: Final runtime image
FROM python:3.11-slim-bookworm

WORKDIR /app

# Install runtime PostgreSQL client library needed by psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder stage
COPY --from=builder /app/.venv /app/.venv

# Add virtual environment to PATH so we use the installed packages
ENV PATH="/app/.venv/bin:$PATH"

# Copy application source code
COPY . .

# Expose API port
EXPOSE 8081

# Command to run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8081"]
