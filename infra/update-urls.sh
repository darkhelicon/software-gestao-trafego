#!/bin/bash
# Atualiza NEXT_PUBLIC_API_URL, ALLOWED_ORIGINS e FRONTEND_URL após o primeiro deploy.
# Isso resolve o problema chicken-and-egg das URLs.
#
# Uso:
#   GCP_PROJECT_ID=xxx GCP_REGION=us-central1 \
#   bash infra/update-urls.sh https://helzo-scale-api-HASH-uc.a.run.app https://helzo-scale-web-HASH-uc.a.run.app
#
# Após rodar este script, faça push para main para rebuild o Web com a API URL correta.

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?GCP_PROJECT_ID is required}"
REGION="${GCP_REGION:-us-central1}"
API_URL="${1:?Arg 1: API_URL (ex: https://helzo-scale-api-XXX-uc.a.run.app)}"
WEB_URL="${2:?Arg 2: WEB_URL (ex: https://helzo-scale-web-XXX-uc.a.run.app)}"

upsert_secret() {
  local name=$1 value=$2
  if gcloud secrets describe "$name" --project="$PROJECT_ID" &>/dev/null; then
    echo -n "$value" | gcloud secrets versions add "$name" --project="$PROJECT_ID" --data-file=- --quiet
  else
    echo -n "$value" | gcloud secrets create "$name" --project="$PROJECT_ID" --replication-policy=automatic --data-file=- --quiet
  fi
  echo "  ✓ $name = $value"
}

echo "Atualizando URLs nos secrets..."

# Secret Manager (para ALLOWED_ORIGINS e FRONTEND_URL injetados na API em runtime)
upsert_secret "helzo-scale-allowed_origins" "$WEB_URL"
upsert_secret "helzo-scale-frontend_url"    "$WEB_URL"

# Secret Manager para web (NEXT_PUBLIC_API_URL é baked no build do Next.js)
upsert_secret "helzo-scale-next_public_api_url" "$API_URL"

echo ""
echo "Atualize o GitHub Secret NEXT_PUBLIC_API_URL para que o próximo build do Web use a URL real:"
echo ""
echo "  gh secret set NEXT_PUBLIC_API_URL --body '${API_URL}' --repo OWNER/REPO"
echo ""
echo "Em seguida, faça push para main (qualquer mudança mínima) para acionar o rebuild."
echo "O build do Web usará NEXT_PUBLIC_API_URL=${API_URL} corretamente."
echo ""
echo "Depois de re-deploy, os serviços estarão 100% funcionais."
