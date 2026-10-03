FROM python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir "numpy>=1.26,<2"

COPY app ./app
COPY api_pro.py .
COPY scripts ./scripts
COPY models ./models

ENV ENV=production \
    FACE_DEBUG=false \
    FACE_HOST=0.0.0.0 \
    FACE_PORT=9000 \
    PYTHONUNBUFFERED=1

EXPOSE 9000

# InsightFace weights: mount volume or run scripts/download_models.py at build/runtime
CMD ["gunicorn", "-b", "0.0.0.0:9000", "-w", "1", "-t", "120", "--factory", "app.main:create_app"]
