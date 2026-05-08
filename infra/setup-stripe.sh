#!/bin/bash
# Configura as chaves Stripe no GCP Secret Manager.
# Uso: GCP_PROJECT_ID=xxx bash infra/setup-stripe.sh \
#        sk_test_XXX whsec_XXX price_START price_GROWTH price_SCALE price_ENTERPRISE

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?GCP_PROJECT_ID is required}"
STRIPE_SECRET_KEY="${1:?Arg 1: STRIPE_SECRET_KEY (sk_test_... ou sk_live_...)}"
STRIPE_WEBHOOK_SECRET="${2:?Arg 2: STRIPE_WEBHOOK_SECRET (whsec_...)}"
STRIPE_PRICE_START="${3:?Arg 3: STRIPE_PRICE_START (price_...)}"
STRIPE_PRICE_GROWTH="${4:?Arg 4: STRIPE_PRICE_GROWTH (price_...)}"
STRIPE_PRICE_SCALE="${5:?Arg 5: STRIPE_PRICE_SCALE (price_...)}"
STRIPE_PRICE_ENTERPRISE="${6:?Arg 6: STRIPE_PRICE_ENTERPRISE (price_...)}"

upsert_secret() {
  local name=$1 value=$2
  if gcloud secrets describe "$name" --project="$PROJECT_ID" &>/dev/null; then
    echo -n "$value" | gcloud secrets versions add "$name" --project="$PROJECT_ID" --data-file=- --quiet
  else
    echo -n "$value" | gcloud secrets create "$name" --project="$PROJECT_ID" --replication-policy=automatic --data-file=- --quiet
  fi
  echo "  ✓ $name"
}

echo "Configurando secrets do Stripe..."
upsert_secret "adflow-stripe_secret_key"       "$STRIPE_SECRET_KEY"
upsert_secret "adflow-stripe_webhook_secret"   "$STRIPE_WEBHOOK_SECRET"
upsert_secret "adflow-stripe_price_start"      "$STRIPE_PRICE_START"
upsert_secret "adflow-stripe_price_growth"     "$STRIPE_PRICE_GROWTH"
upsert_secret "adflow-stripe_price_scale"      "$STRIPE_PRICE_SCALE"
upsert_secret "adflow-stripe_price_enterprise" "$STRIPE_PRICE_ENTERPRISE"

echo ""
echo "Stripe secrets configurados com sucesso."
