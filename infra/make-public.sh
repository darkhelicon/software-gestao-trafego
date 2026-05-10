#!/bin/bash
# Torna os serviços API e Web do Cloud Run acessíveis publicamente.
# Execute UMA VEZ após o primeiro deploy bem-sucedido.
#
# Uso: GCP_REGION=us-central1 bash infra/make-public.sh

set -euo pipefail

REGION="${GCP_REGION:-us-central1}"

echo "Concedendo acesso público (allUsers) aos serviços Cloud Run..."

for service in helzo-scale-api helzo-scale-web; do
  gcloud run services add-iam-policy-binding "$service" \
    --region="$REGION" \
    --member="allUsers" \
    --role="roles/run.invoker" \
    --quiet
  echo "  ✓ $service agora é público"
done

echo ""
echo "URLs dos serviços:"
API_URL=$(gcloud run services describe helzo-scale-api --region="$REGION" --format="value(status.url)")
WEB_URL=$(gcloud run services describe helzo-scale-web --region="$REGION" --format="value(status.url)")

echo "  API: ${API_URL}"
echo "  Web: ${WEB_URL}"
echo ""
echo "Próximo passo: atualize as URLs no Secret Manager e GitHub:"
echo "  bash infra/update-urls.sh '${API_URL}' '${WEB_URL}'"
