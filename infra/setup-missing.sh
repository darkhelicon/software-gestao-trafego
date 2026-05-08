#!/bin/bash
# Completa o setup do GCP que setup-gcp.sh não cobre.
# Execute APÓS setup-gcp.sh e ANTES do primeiro deploy.
#
# Uso:
#   export GCP_PROJECT_ID=seu-project-id
#   export GCP_REGION=us-central1          # default
#   export SQL_PASSWORD=sua-senha-forte
#   bash infra/setup-missing.sh

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?GCP_PROJECT_ID is required}"
REGION="${GCP_REGION:-us-central1}"
SQL_PASSWORD="${SQL_PASSWORD:?SQL_PASSWORD is required (ex: export SQL_PASSWORD=SenhaForte123!)}"
APP_NAME="helzo-scale"

gcloud config set project "$PROJECT_ID"

# ── 1. Memorystore Redis ──────────────────────────────────────────────────────
echo "=== 1. Criando Memorystore Redis ==="
gcloud redis instances create "${APP_NAME}-redis" \
  --size=1 \
  --region="$REGION" \
  --redis-version=redis_7_0 \
  --network=default \
  --quiet 2>/dev/null || echo "  (já existe, continuando)"

REDIS_IP=$(gcloud redis instances describe "${APP_NAME}-redis" \
  --region="$REGION" \
  --format="value(host)")
REDIS_URL="redis://${REDIS_IP}:6379"
echo "  Redis IP: ${REDIS_IP}"

# ── 2. Cloud SQL — senha do postgres ─────────────────────────────────────────
echo ""
echo "=== 2. Configurando senha do Cloud SQL ==="
gcloud sql users set-password postgres \
  --instance="${APP_NAME}-postgres" \
  --password="$SQL_PASSWORD" \
  --quiet
echo "  ✓ Senha definida para usuário postgres"

CONN_NAME="${PROJECT_ID}:${REGION}:${APP_NAME}-postgres"
DB_SOCKET_URL="postgresql://postgres:${SQL_PASSWORD}@localhost/helzoscale?host=/cloudsql/${CONN_NAME}"
DB_PROXY_URL="postgresql://postgres:${SQL_PASSWORD}@localhost:5432/helzoscale"

# ── 3. Secret Manager: DATABASE_URL e REDIS_URL ───────────────────────────────
echo ""
echo "=== 3. Populando DATABASE_URL e REDIS_URL no Secret Manager ==="

upsert_secret() {
  local name=$1 value=$2
  if gcloud secrets describe "$name" --project="$PROJECT_ID" &>/dev/null; then
    echo -n "$value" | gcloud secrets versions add "$name" --project="$PROJECT_ID" --data-file=- --quiet
  else
    echo -n "$value" | gcloud secrets create "$name" --project="$PROJECT_ID" --replication-policy=automatic --data-file=- --quiet
  fi
  echo "  ✓ $name"
}

upsert_secret "helzo-scale-database_url" "$DB_SOCKET_URL"
upsert_secret "helzo-scale-redis_url"    "$REDIS_URL"

# ── 4. Gerar ENCRYPTION_KEY se ainda não existir ─────────────────────────────
echo ""
echo "=== 4. Gerando ENCRYPTION_KEY (AES-256) ==="
if ! gcloud secrets versions access latest --secret="helzo-scale-encryption_key" --project="$PROJECT_ID" &>/dev/null; then
  ENC_KEY=$(openssl rand -hex 32)
  upsert_secret "helzo-scale-encryption_key" "$ENC_KEY"
  echo "  Chave gerada: ${ENC_KEY}"
  echo "  GUARDE ESTA CHAVE — ela criptografa os tokens OAuth"
else
  echo "  ✓ helzo-scale-encryption_key já existe"
fi

# ── 5. Placeholders para TikTok/Meta (serão substituídos depois) ──────────────
echo ""
echo "=== 5. Placeholders para TikTok e Meta ==="
for secret in helzo-scale-tiktok_app_id helzo-scale-tiktok_app_secret helzo-scale-meta_app_id helzo-scale-meta_app_secret; do
  if ! gcloud secrets versions access latest --secret="$secret" --project="$PROJECT_ID" &>/dev/null; then
    upsert_secret "$secret" "PLACEHOLDER_UPDATE_AFTER_APPROVAL"
  else
    echo "  (${secret} já existe)"
  fi
done
for uri_secret in helzo-scale-tiktok_redirect_uri helzo-scale-meta_redirect_uri; do
  if ! gcloud secrets versions access latest --secret="$uri_secret" --project="$PROJECT_ID" &>/dev/null; then
    upsert_secret "$uri_secret" "https://PLACEHOLDER/oauth/callback"
  else
    echo "  (${uri_secret} já existe)"
  fi
done

# ── 6. SENTRY_DSN placeholder ─────────────────────────────────────────────────
if ! gcloud secrets versions access latest --secret="helzo-scale-sentry_dsn" --project="$PROJECT_ID" &>/dev/null; then
  upsert_secret "helzo-scale-sentry_dsn" ""
fi

# ── 7. GCP Project ID e Bucket ────────────────────────────────────────────────
echo ""
echo "=== 6. GCP_PROJECT_ID e GCP_BUCKET_NAME ==="
BUCKET_NAME="${PROJECT_ID}-${APP_NAME}-assets"
upsert_secret "helzo-scale-gcp_project_id"  "$PROJECT_ID"
upsert_secret "helzo-scale-gcp_bucket_name" "$BUCKET_NAME"

# ── Saída: próximos passos ────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"
echo " CONCLUÍDO. Próximos passos:"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "1. Configure o Firebase Admin SDK:"
echo "   bash infra/setup-firebase.sh /caminho/para/firebase-key.json"
echo ""
echo "2. Configure as chaves Stripe:"
echo "   bash infra/setup-stripe.sh sk_test_XXX whsec_XXX price_XXX price_XXX price_XXX price_XXX"
echo ""
echo "3. Atualize os GitHub Secrets com os valores abaixo:"
echo ""
echo "   MIGRATION_DATABASE_URL       = ${DB_PROXY_URL}"
echo "   CLOUD_SQL_INSTANCE_CONNECTION_NAME = ${CONN_NAME}"
echo ""
echo "   Comandos para atualizar via GitHub CLI (gh):"
echo "   gh secret set MIGRATION_DATABASE_URL --body '${DB_PROXY_URL}' --repo OWNER/REPO"
echo "   gh secret set CLOUD_SQL_INSTANCE_CONNECTION_NAME --body '${CONN_NAME}' --repo OWNER/REPO"
echo ""
echo "4. Faça push para main → deploy automático pelo GitHub Actions"
echo ""
echo "5. Após o deploy, rode:"
echo "   bash infra/make-public.sh"
echo "   (torna API e Web acessíveis publicamente)"
echo ""
echo "6. Pegue as URLs dos serviços e atualize:"
echo "   gcloud run services describe helzo-scale-api --region=${REGION} --format='value(status.url)'"
echo "   gcloud run services describe helzo-scale-web --region=${REGION} --format='value(status.url)'"
echo "   Depois execute: bash infra/update-urls.sh <API_URL> <WEB_URL>"
echo ""
