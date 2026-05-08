#!/bin/bash
# Script de setup inicial do GCP para o projeto Helzo Scale
# Execute: bash infra/setup-gcp.sh
# Pré-requisito: GCP_PROJECT_ID, GCP_REGION, GITHUB_REPO (format: org/repo) definidos

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?GCP_PROJECT_ID is required}"
REGION="${GCP_REGION:-us-central1}"
GITHUB_REPO="${GITHUB_REPO:?GITHUB_REPO is required (format: org/repo)}"
APP_NAME="helzo-scale"

echo "Setting up GCP project: $PROJECT_ID in $REGION"

# Definir projeto ativo
gcloud config set project "$PROJECT_ID"

# Habilitar APIs necessárias
echo "Enabling APIs..."
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  iamcredentials.googleapis.com \
  vpcaccess.googleapis.com

# Artifact Registry
echo "Creating Artifact Registry..."
gcloud artifacts repositories create "$APP_NAME" \
  --repository-format=docker \
  --location="$REGION" \
  --description="Helzo Scale container images" \
  --quiet || true

# Cloud SQL PostgreSQL
echo "Creating Cloud SQL instance..."
gcloud sql instances create "${APP_NAME}-postgres" \
  --database-version=POSTGRES_16 \
  --tier=db-g1-small \
  --region="$REGION" \
  --storage-size=20GB \
  --storage-auto-increase \
  --backup-start-time=02:00 \
  --maintenance-window-day=SUN \
  --maintenance-window-hour=3 \
  --deletion-protection \
  --quiet || true

gcloud sql databases create "$APP_NAME" \
  --instance="${APP_NAME}-postgres" \
  --quiet || true

# Cloud Storage bucket para criativos
echo "Creating GCS bucket..."
gcloud storage buckets create "gs://${PROJECT_ID}-${APP_NAME}-assets" \
  --location="$REGION" \
  --uniform-bucket-level-access \
  --quiet || true

# ── Service accounts ──────────────────────────────────────────────────────────
echo "Creating service accounts..."
gcloud iam service-accounts create "${APP_NAME}-api-sa" \
  --display-name="Helzo Scale API Service Account" --quiet || true

gcloud iam service-accounts create "${APP_NAME}-worker-sa" \
  --display-name="Helzo Scale Worker Service Account" --quiet || true

gcloud iam service-accounts create "${APP_NAME}-web-sa" \
  --display-name="Helzo Scale Web Service Account" --quiet || true

gcloud iam service-accounts create "${APP_NAME}-github-sa" \
  --display-name="Helzo Scale GitHub Actions Service Account" --quiet || true

# ── IAM bindings: API SA ──────────────────────────────────────────────────────
API_SA="${APP_NAME}-api-sa@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$API_SA" \
  --role="roles/cloudsql.client" --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$API_SA" \
  --role="roles/secretmanager.secretAccessor" --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$API_SA" \
  --role="roles/storage.objectAdmin" --quiet

# ── IAM bindings: Worker SA ───────────────────────────────────────────────────
WORKER_SA="${APP_NAME}-worker-sa@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$WORKER_SA" \
  --role="roles/cloudsql.client" --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$WORKER_SA" \
  --role="roles/secretmanager.secretAccessor" --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$WORKER_SA" \
  --role="roles/storage.objectAdmin" --quiet

# ── IAM bindings: Web SA ──────────────────────────────────────────────────────
# Web container has no runtime secrets (NEXT_PUBLIC_ are baked at build time)
WEB_SA="${APP_NAME}-web-sa@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$WEB_SA" \
  --role="roles/run.invoker" --quiet

# ── IAM bindings: GitHub Actions SA ──────────────────────────────────────────
GITHUB_SA="${APP_NAME}-github-sa@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$GITHUB_SA" \
  --role="roles/run.admin" --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$GITHUB_SA" \
  --role="roles/artifactregistry.writer" --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$GITHUB_SA" \
  --role="roles/cloudsql.admin" --quiet

# Allows GitHub SA to deploy Cloud Run services that run as specific SAs
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$GITHUB_SA" \
  --role="roles/iam.serviceAccountUser" --quiet

# ── Workload Identity Federation for GitHub Actions ───────────────────────────
echo "Setting up Workload Identity for GitHub Actions..."
gcloud iam workload-identity-pools create "github-actions" \
  --location=global \
  --display-name="GitHub Actions" --quiet || true

gcloud iam workload-identity-pools providers create-oidc "github" \
  --location=global \
  --workload-identity-pool="github-actions" \
  --display-name="GitHub" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com" --quiet || true

# Bind the WIF principal (specific repo) to the GitHub SA
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
gcloud iam service-accounts add-iam-policy-binding "$GITHUB_SA" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-actions/attribute.repository/${GITHUB_REPO}" \
  --quiet

echo ""
echo "GCP setup complete!"
echo ""
echo "GitHub Actions secrets to configure:"
echo "  GCP_PROJECT_ID              = $PROJECT_ID"
echo "  GCP_REGION                  = $REGION"
echo "  GCP_SERVICE_ACCOUNT         = $GITHUB_SA"
echo "  GCP_WORKLOAD_IDENTITY_PROVIDER = projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-actions/providers/github"
echo "  CLOUD_SQL_INSTANCE_CONNECTION_NAME = ${PROJECT_ID}:${REGION}:${APP_NAME}-postgres"
echo "  MIGRATION_DATABASE_URL      = postgresql://helzoscale:<password>@localhost:5432/helzoscale (used by Cloud SQL Auth Proxy)"
echo ""
echo "Next steps:"
echo "1. Run: bash infra/setup-secrets.sh"
echo "2. Configure the GitHub Actions secrets listed above"
echo "3. Push to main to trigger the first deployment"
