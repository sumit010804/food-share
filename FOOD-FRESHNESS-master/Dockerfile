# Multi-stage to reduce final image size
FROM python:3.10-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libglib2.0-0 libsm6 libxext6 libxrender1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code and model placeholder
COPY fastapi_service.py ./
COPY model.keras ./

EXPOSE 8080
CMD ["uvicorn", "fastapi_service:app", "--host", "0.0.0.0", "--port", "8080"]
