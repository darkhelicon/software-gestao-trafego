# ENV_REQUIRED — Variáveis de ambiente obrigatórias

Todas as variáveis abaixo devem estar configuradas no serviço Cloud Run `helzo-scale-api`
(via Secret Manager ou env var direta). O serviço `helzo-scale-web` usa apenas as variáveis `NEXT_PUBLIC_*`.

---

## API — `helzo-scale-api` (Cloud Run)

### Infraestrutura

| Variável | Tipo | Valor esperado |
|----------|------|---------------|
| `DATABASE_URL` | Secret | `postgresql://...` (Cloud SQL via Unix socket ou TCP) |
| `REDIS_URL` | Secret | `redis://...` (Memorystore) |
| `ENCRYPTION_KEY` | Secret | 32 bytes hex (AES-256-GCM para tokens OAuth) |
| `NODE_ENV` | Env var | `production` |

### Firebase Admin SDK

| Variável | Tipo | Valor esperado |
|----------|------|---------------|
| `FIREBASE_PROJECT_ID` | Secret | ID do projeto Firebase |
| `FIREBASE_CLIENT_EMAIL` | Secret | Email do service account |
| `FIREBASE_PRIVATE_KEY` | Secret | RSA private key com `\n` reais (não escaped) |

> **Atenção**: o private key precisa ter newlines reais, não `\n` literais.
> O código já faz `.replace(/\\n/g, "\n")` mas o Secret Manager deve armazenar com `\n` real quando possível.

### CORS

| Variável | Tipo | Valor esperado |
|----------|------|---------------|
| `ALLOWED_ORIGINS` | Secret | `https://helzo-scale-web-rbn4ayfofa-rj.a.run.app` |
| `FRONTEND_URL` | Secret | `https://helzo-scale-web-rbn4ayfofa-rj.a.run.app` |

### Stripe

| Variável | Tipo | Valor esperado |
|----------|------|---------------|
| `STRIPE_SECRET_KEY` | Secret | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Secret | `whsec_...` |
| `STRIPE_PRICE_START` | Env var | `price_1TUfrF83NyrrcWaOaKvYwDFu` |
| `STRIPE_PRICE_GROWTH` | Env var | `price_1TUfre83NyrrcWaOb94oUgdf` |
| `STRIPE_PRICE_SCALE` | Env var | `price_1TUfru83NyrrcWaOZiEkMLFW` |
| `STRIPE_PRICE_ENTERPRISE` | Env var | `price_1TUfsD83NyrrcWaO9giDMTJr` |

### TikTok OAuth

| Variável | Tipo | Valor esperado |
|----------|------|---------------|
| `TIKTOK_APP_ID` | Secret | App ID do TikTok Business |
| `TIKTOK_APP_SECRET` | Secret | App Secret do TikTok Business |
| `TIKTOK_REDIRECT_URI` | Secret | `https://helzo-scale-api-rbn4ayfofa-rj.a.run.app/api/v1/oauth/tiktok/callback` |

### Meta OAuth

| Variável | Tipo | Valor esperado |
|----------|------|---------------|
| `META_APP_ID` | Secret | App ID do Meta Business |
| `META_APP_SECRET` | Secret | App Secret do Meta Business |
| `META_REDIRECT_URI` | Secret | `https://helzo-scale-api-rbn4ayfofa-rj.a.run.app/api/v1/oauth/meta/callback` |

### Opcional

| Variável | Tipo | Valor esperado |
|----------|------|---------------|
| `SENTRY_DSN` | Secret | DSN do Sentry (opcional, desativa se ausente) |

---

## Web — `helzo-scale-web` (Cloud Run)

Variáveis `NEXT_PUBLIC_*` são **baked em build time** — alterar no Cloud Run NÃO tem efeito
sem rebuild da imagem Docker. Configure no GitHub Secrets e rebuildize.

| Variável | GitHub Secret | Valor |
|----------|--------------|-------|
| `NEXT_PUBLIC_API_URL` | `NEXT_PUBLIC_API_URL` | `https://helzo-scale-api-rbn4ayfofa-rj.a.run.app` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `NEXT_PUBLIC_FIREBASE_API_KEY` | API key do Firebase |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `<project>.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ID do projeto Firebase |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `NEXT_PUBLIC_FIREBASE_APP_ID` | App ID do Firebase |

---

## Comandos — verificar configuração atual

```bash
# Ver env vars e secrets montados no API
gcloud run services describe helzo-scale-api \
  --region=southamerica-east1 \
  --project=helzo-scale \
  --format="yaml(spec.template.spec.containers[0].env,spec.template.spec.containers[0].volumeMounts)"

# Listar secrets existentes
gcloud secrets list --project=helzo-scale

# Ver valor de um secret (cuidado — não logar em produção)
gcloud secrets versions access latest \
  --secret=helzo-scale-stripe_secret_key \
  --project=helzo-scale
```

---

## Comando — atualizar env vars no Cloud Run

```bash
# Atualizar múltiplas env vars de uma vez
gcloud run services update helzo-scale-api \
  --region=southamerica-east1 \
  --project=helzo-scale \
  --set-env-vars="STRIPE_PRICE_START=price_xxx,STRIPE_PRICE_GROWTH=price_yyy,NODE_ENV=production"

# Montar secret como env var
gcloud run services update helzo-scale-api \
  --region=southamerica-east1 \
  --project=helzo-scale \
  --set-secrets="STRIPE_SECRET_KEY=helzo-scale-stripe_secret_key:latest"
```
