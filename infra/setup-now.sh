#!/bin/bash
# Configura todos os secrets que já temos dados suficientes para definir.
# Execute: bash infra/setup-now.sh
#
# Antes de rodar, defina:
#   export SQL_PASSWORD="sua-senha-do-cloud-sql"

set -euo pipefail

PROJECT_ID="ads-saas-prod"
REGION="southamerica-east1"
SQL_PASSWORD="${SQL_PASSWORD:?Defina: export SQL_PASSWORD='sua-senha'}"

echo "Projeto: $PROJECT_ID | Região: $REGION"
echo ""

upsert() {
  local name=$1 value=$2
  if [[ -z "$value" ]]; then echo "  SKIP $name (vazio)"; return; fi
  if gcloud secrets describe "$name" --project="$PROJECT_ID" &>/dev/null; then
    echo -n "$value" | gcloud secrets versions add "$name" --project="$PROJECT_ID" --data-file=- --quiet
  else
    echo -n "$value" | gcloud secrets create "$name" --project="$PROJECT_ID" --replication-policy=automatic --data-file=- --quiet
  fi
  echo "  ✓ $name"
}

# ── Redis ──────────────────────────────────────────────────────────────────────
echo "=== Redis ==="
upsert "adflow-redis_url" "redis://10.4.56.35:6379"

# ── Cloud SQL ──────────────────────────────────────────────────────────────────
echo ""
echo "=== Cloud SQL ==="
CONN_NAME="${PROJECT_ID}:${REGION}:adflow-postgres"

# URL para Cloud Run (via Unix socket do Cloud SQL sidecar)
DB_SOCKET="postgresql://postgres:${SQL_PASSWORD}@localhost/adflow?host=/cloudsql/${CONN_NAME}"
# URL para migration (via Cloud SQL Auth Proxy na porta 5432)
DB_PROXY="postgresql://postgres:${SQL_PASSWORD}@localhost:5432/adflow"

upsert "adflow-database_url" "$DB_SOCKET"

echo ""
echo "  MIGRATION_DATABASE_URL (para o GitHub Secret):"
echo "  $DB_PROXY"
echo "  CLOUD_SQL_INSTANCE_CONNECTION_NAME:"
echo "  $CONN_NAME"

# ── GCP infra ──────────────────────────────────────────────────────────────────
echo ""
echo "=== GCP info ==="
upsert "adflow-gcp_project_id"  "$PROJECT_ID"
upsert "adflow-gcp_bucket_name" "${PROJECT_ID}-adflow-assets"

# ── Gerar ENCRYPTION_KEY se não existe ────────────────────────────────────────
echo ""
echo "=== Encryption Key ==="
if gcloud secrets versions access latest --secret="adflow-encryption_key" --project="$PROJECT_ID" &>/dev/null 2>&1; then
  echo "  ✓ adflow-encryption_key já existe"
else
  ENC_KEY=$(openssl rand -hex 32)
  upsert "adflow-encryption_key" "$ENC_KEY"
  echo "  GUARDE: ENCRYPTION_KEY = $ENC_KEY"
fi

# ── Gerar JWT secrets se não existem ─────────────────────────────────────────
echo ""
echo "=== JWT Secrets ==="
if gcloud secrets versions access latest --secret="adflow-jwt_secret" --project="$PROJECT_ID" &>/dev/null 2>&1; then
  echo "  ✓ adflow-jwt_secret já existe"
else
  JWT_SECRET=$(openssl rand -base64 48)
  upsert "adflow-jwt_secret" "$JWT_SECRET"
fi
if gcloud secrets versions access latest --secret="adflow-jwt_refresh_secret" --project="$PROJECT_ID" &>/dev/null 2>&1; then
  echo "  ✓ adflow-jwt_refresh_secret já existe"
else
  JWT_REFRESH=$(openssl rand -base64 48)
  upsert "adflow-jwt_refresh_secret" "$JWT_REFRESH"
fi

# ── TikTok / Meta — placeholders (serão atualizados quando o site estiver no ar) ──
echo ""
echo "=== TikTok / Meta (placeholders) ==="
for s in adflow-tiktok_app_id adflow-tiktok_app_secret adflow-meta_app_id adflow-meta_app_secret; do
  if ! gcloud secrets versions access latest --secret="$s" --project="$PROJECT_ID" &>/dev/null 2>&1; then
    upsert "$s" "PLACEHOLDER_UPDATE_AFTER_APPROVAL"
  else
    echo "  ✓ $s já existe"
  fi
done
for s in adflow-tiktok_redirect_uri adflow-meta_redirect_uri; do
  if ! gcloud secrets versions access latest --secret="$s" --project="$PROJECT_ID" &>/dev/null 2>&1; then
    upsert "$s" "https://PLACEHOLDER/oauth/callback"
  else
    echo "  ✓ $s já existe"
  fi
done

# ── Sentry DSN placeholder ────────────────────────────────────────────────────
echo ""
echo "=== Sentry ==="
if ! gcloud secrets versions access latest --secret="adflow-sentry_dsn" --project="$PROJECT_ID" &>/dev/null 2>&1; then
  upsert "adflow-sentry_dsn" ""
else
  echo "  ✓ adflow-sentry_dsn já existe"
fi

# ── CORS placeholders (atualizar após deploy com infra/update-urls.sh) ─────────
echo ""
echo "=== CORS (placeholders iniciais) ==="
if ! gcloud secrets versions access latest --secret="adflow-allowed_origins" --project="$PROJECT_ID" &>/dev/null 2>&1; then
  upsert "adflow-allowed_origins" "https://PLACEHOLDER_WEB_URL"
else
  echo "  ✓ adflow-allowed_origins já existe"
fi
if ! gcloud secrets versions access latest --secret="adflow-frontend_url" --project="$PROJECT_ID" &>/dev/null 2>&1; then
  upsert "adflow-frontend_url" "https://PLACEHOLDER_WEB_URL"
else
  echo "  ✓ adflow-frontend_url já existe"
fi

# ── Resumo final ──────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"
echo " CONCLUÍDO. Atualize estes GitHub Secrets agora:"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "  GCP_REGION                         = southamerica-east1"
echo "  MIGRATION_DATABASE_URL             = $DB_PROXY"
echo "  CLOUD_SQL_INSTANCE_CONNECTION_NAME = $CONN_NAME"
echo ""
echo "Ainda falta:"
echo "  1. Firebase Admin SDK JSON:"
echo "     GCP_PROJECT_ID=$PROJECT_ID bash infra/setup-firebase.sh ~/firebase-key.json"
echo ""
echo "  2. Stripe (precisa de sk_test_... e price_... IDs, não prod_...):"
echo "     GCP_PROJECT_ID=$PROJECT_ID bash infra/setup-stripe.sh sk_test_XXX whsec_XXX price_XXX price_XXX price_XXX price_XXX"
echo ""
echo "  3. GitHub Secrets Firebase (NEXT_PUBLIC_FIREBASE_*):"
echo "     Verifique se estão configurados no repositório."
