#!/bin/bash
# Configura os secrets do Firebase Admin SDK no GCP Secret Manager.
# Uso: GCP_PROJECT_ID=xxx bash infra/setup-firebase.sh path/to/firebase-adminsdk.json
#
# O JSON é gerado em:
#   Firebase Console → Configurações → Contas de serviço → Gerar nova chave privada

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?GCP_PROJECT_ID is required}"
KEY_FILE="${1:?Uso: $0 path/to/firebase-adminsdk.json}"

if [[ ! -f "$KEY_FILE" ]]; then
  echo "ERRO: arquivo $KEY_FILE não encontrado."
  exit 1
fi

command -v jq &>/dev/null || { echo "ERRO: jq não instalado. Instale com: apt install jq (Linux) ou brew install jq (Mac)"; exit 1; }

CLIENT_EMAIL=$(jq -r '.client_email'  "$KEY_FILE")
PRIVATE_KEY=$(jq -r  '.private_key'   "$KEY_FILE")
FB_PROJECT=$(jq -r   '.project_id'    "$KEY_FILE")

echo "Configurando Firebase Admin para projeto: ${FB_PROJECT}"

upsert_secret() {
  local name=$1 value=$2
  if gcloud secrets describe "$name" --project="$PROJECT_ID" &>/dev/null; then
    echo -n "$value" | gcloud secrets versions add "$name" --project="$PROJECT_ID" --data-file=- --quiet
  else
    echo -n "$value" | gcloud secrets create "$name" --project="$PROJECT_ID" --replication-policy=automatic --data-file=- --quiet
  fi
  echo "  ✓ $name"
}

upsert_secret "adflow-firebase_project_id"   "$FB_PROJECT"
upsert_secret "adflow-firebase_client_email" "$CLIENT_EMAIL"
upsert_secret "adflow-firebase_private_key"  "$PRIVATE_KEY"

echo ""
echo "Firebase Admin secrets configurados com sucesso."
