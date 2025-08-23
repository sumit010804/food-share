## FastAPI microservice (production-ready)

This directory contains a minimal FastAPI service exposing `/predict` used by Next.js in production.

### Build and run with Docker

1. Build the image:
   docker build -t food-freshness-svc .
2. Run the service:
   docker run -p 8080:8080 -e FOOD_FRESHNESS_MODEL_URL=<public_url_to_model> food-freshness-svc

Alternatively, run locally without Docker:

pip install -r requirements.txt
FOOD_FRESHNESS_MODEL=<path_to_model> uvicorn fastapi_service:app --host 0.0.0.0 --port 8080

### Next.js configuration

Set the environment variable in your deployment:

FRESHNESS_API_URL=https://<your-svc-host>/

`/api/freshness` will forward images to the service. If not set, it defaults to a heuristic fallback.
