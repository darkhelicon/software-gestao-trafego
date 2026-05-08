#!/bin/bash
# Provisiona todos os secrets do Helzo Scale no GCP Secret Manager.
# Execute: bash infra/setup-secrets.sh
# Pré-requisito: gcloud autenticado + PROJECT_ID definido.

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?GCP_PROJECT_ID is required}"
ENV_FILE="${ENV_FILE:-.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found. Copy .env.example to .env and fill in the values."
  exit 1
fi

echo "Provisioning secrets from $ENV_FILE to project $PROJECT_ID..."

# List of secrets to create. Keys must match the variable names in .env.
API_SECRETS=(
  DATABASE_URL
  REDIS_URL
  FIREBASE_PROJECT_ID
  FIREBASE_CLIENT_EMAIL
  FIREBASE_PRIVATE_KEY
  JWT_SECRET
  JWT_REFRESH_SECRET
  ENCRYPTION_KEY
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  STRIPE_PRICE_START
  STRIPE_PRICE_GROWTH
  STRIPE_PRICE_SCALE
  STRIPE_PRICE_ENTERPRISE
  TIKTOK_APP_ID
  TIKTOK_APP_SECRET
  TIKTOK_REDIRECT_URI
  META_APP_ID
  META_APP_SECRET
  META_REDIRECT_URI
  GCP_PROJECT_ID
  GCP_BUCKET_NAME
  SENTRY_DSN
  ALLOWED_ORIGINS
  FRONTEND_URL
)

WEB_SECRETS=(
  NEXT_PUBLIC_API_URL
  NEXT_PUBLIC_FIREBASE_API_KEY
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  NEXT_PUBLIC_FIREBASE_PROJECT_ID
  NEXT_PUBLIC_FIREBASE_APP_ID
)

# Helper: read value from .env file
get_env_value() {
  local key=$1
  # Strips surrounding quotes, handles KEY="value" and KEY=value
  grep -E "^${key}=" "$ENV_FILE" | head -1 | sed 's/^[^=]*=//' | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\(.*\)'$/\1/"
}

# Helper: create or update a secret
upsert_secret() {
  local secret_name=$1
  local secret_value=$2

  if [[ -z "$secret_value" ]]; then
    echo "  SKIP $secret_name (empty value)"
    return
  fi

  # Check if secret exists
  if gcloud secrets describe "$secret_name" --project="$PROJECT_ID" &>/dev/null; then
    echo "  UPDATE $secret_name"
    echo -n "$secret_value" | gcloud secrets versions add "$secret_name" \
      --project="$PROJECT_ID" \
      --data-file=- \
      --quiet
  else
    echo "  CREATE $secret_name"
    echo -n "$secret_value" | gcloud secrets create "$secret_name" \
      --project="$PROJECT_ID" \
      --replication-policy="automatic" \
      --data-file=- \
      --quiet
  fi
}

echo ""
echo "=== API Secrets ==="
for key in "${API_SECRETS[@]}"; do
  value=$(get_env_value "$key")
  upsert_secret "helzo-scale-${key,,}" "$value"   # lowercase key as secret name
done

echo ""
echo "=== Web Secrets ==="
for key in "${WEB_SECRETS[@]}"; do
  value=$(get_env_value "$key")
  upsert_secret "helzo-scale-${key,,}" "$value"
done

echo ""
echo "=== Granting Secret Accessor to Service Accounts ==="

API_SA="helzo-scale-api-sa@${PROJECT_ID}.iam.gserviceaccount.com"
WORKER_SA="helzo-scale-worker-sa@${PROJECT_ID}.iam.gserviceaccount.com"
WEB_SA="helzo-scale-web-sa@${PROJECT_ID}.iam.gserviceaccount.com"

for sa in "$API_SA" "$WORKER_SA" "$WEB_SA"; do
  echo "  Granting secretAccessor to $sa"
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$sa" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet 2>/dev/null || true
done

echo ""
echo "Done! All secrets provisioned."
echo ""
echo "Next: Mount secrets in Cloud Run services via 'valueFrom.secretKeyRef' (see infra/cloud-run/*.yaml)"
