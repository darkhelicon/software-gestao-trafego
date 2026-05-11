# Diagnóstico de Estado de Produção — 2026-05-11

Gerado por análise real de GCP, Cloud Run logs e bundles JS. Nada inventado.

---

## A) Estado do Deploy

### helzo-scale-api

| Campo | Valor |
|-------|-------|
| URL primária (gcloud) | `https://helzo-scale-api-rbn4ayfofa-rj.a.run.app` |
| URL alternativa (project-number) | `https://helzo-scale-api-231048940970.southamerica-east1.run.app` |
| Revisão ativa | `helzo-scale-api-00011-42d` |
| Imagem (SHA) | `web:99d6c806e2758126e0b9fd9a211104b40056d6ab` |
| Commit | `99d6c80` — "fix(api): CORS accepts Cloud Run URL pattern + Firebase startup logging" |
| Status | ✅ Saudável — health, DB e Redis retornam OK |
| Inicializado em | ~10:04:22 UTC (uptime 929s às 10:19:51) |
| Cloud SQL | `ads-saas-prod:southamerica-east1:adflow-postgres` |
| GCP Project real | `ads-saas-prod` (não `helzo-scale` — esse nome só existe em código) |

### helzo-scale-web

| Campo | Valor |
|-------|-------|
| URL primária (gcloud) | `https://helzo-scale-web-rbn4ayfofa-rj.a.run.app` |
| URL alternativa (project-number) | `https://helzo-scale-web-231048940970.southamerica-east1.run.app` |
| Revisão ativa | `helzo-scale-web-00011-nwt` |
| Imagem (SHA) | `web:99d6c806e2758126e0b9fd9a211104b40056d6ab` |
| Status | ✅ Saudável |
| `NEXT_PUBLIC_API_URL` baked no bundle | `https://helzo-scale-api-231048940970.southamerica-east1.run.app` |
| Env vars em runtime | Só `NODE_ENV` e `NEXT_TELEMETRY_DISABLED` (correto — Next.js bake em build time) |

**Observação**: O secret GCP `helzo-scale-next_public_api_url` tem valor `https://adflow-api-rbn4ayfofa-rj.a.run.app` (ERRADO — aponta pro API antigo). Porém esse secret NÃO é injetado no Cloud Run web — o valor real foi passado via `--build-arg` do GitHub Actions. O bundle tem a URL correta da helzo-scale-api.

O secret do GitHub Actions `NEXT_PUBLIC_API_URL` (usado no build) tem o valor correto: `https://helzo-scale-api-231048940970.southamerica-east1.run.app`.

---

## B) Firebase Config

### Secrets no GCP Secret Manager (prefixo helzo-scale-)

| Secret | Valor / Status |
|--------|---------------|
| `helzo-scale-firebase_project_id` | `ads-saas-prod` ✅ |
| `helzo-scale-firebase_client_email` | Presente ✅ |
| `helzo-scale-firebase_private_key` | ⚠️ **CORROMPIDO** — tem `\r\r\r\n` (3 CRs extras) em cada linha |

### Config do Firebase SDK no frontend (baked no bundle)

| Campo | Valor |
|-------|-------|
| `apiKey` | `AIzaSyCEgL2yO4TWe_EKrQm6rNfN6JrJ-Zkv7HI` |
| `authDomain` | `ads-saas-prod.firebaseapp.com` |
| `projectId` | `ads-saas-prod` |
| `appId` | `1:231048940970:web:a4f025c8ea7e552f13afd3` |

---

## C) Banco de Dados

| Campo | Status |
|-------|--------|
| Conexão | ✅ `database: ok` no health check |
| Planos seeded | ✅ START, GROWTH, SCALE, ENTERPRISE (todos com Stripe price IDs reais) |
| Migrations | ✅ rodaram no último deploy |

---

## D) Stripe

| Campo | Valor / Status |
|-------|---------------|
| `STRIPE_SECRET_KEY` | `sk_test_51TUfgA83Nyrr...` (modo teste) ✅ |
| `STRIPE_WEBHOOK_SECRET` | `whsec_I7STPL5yKJC1peD2gWlaHFXNwYch72Bg` — presente |
| Webhook URL que DEVE estar no Stripe | `https://helzo-scale-api-231048940970.southamerica-east1.run.app/api/v1/billing/webhook` |
| Verificação manual necessária | ❓ Não foi possível verificar via API — precisa checar no dashboard Stripe |

---

## E) Bugs Encontrados (por prioridade)

### 🔴 BUG #1 — CAUSA RAIZ: CORS rejeita URL no formato project-number

**Impacto**: 100% dos requests do browser falham silenciosamente. Nenhum cadastro, login ou assinatura funciona.

**O que acontece**:
1. Usuário acessa o web via `https://helzo-scale-web-231048940970.southamerica-east1.run.app/`
2. Browser faz CORS preflight: `OPTIONS /api/v1/auth/register` com `Origin: https://helzo-scale-web-231048940970.southamerica-east1.run.app`
3. CORS plugin verifica:
   - `allowedOrigins.includes(origin)` → ❌ NÃO (allowedOrigins = `https://helzo-scale-web-rbn4ayfofa-rj.a.run.app`)
   - `CLOUD_RUN_WEB_PATTERN.test(origin)` → ❌ NÃO (regex só aceita formato `hash-rj.a.run.app`, não formato `231048940970.southamerica-east1.run.app`)
4. CORS rejeita → Fastify não encontra rota OPTIONS → retorna **404**
5. Browser recebe 404 no preflight → bloqueia o POST/GET real → **erro de rede no frontend**

**Evidência nos logs**:
```
10:06:17 OPTIONS /api/v1/auth/register → 404 (Origin: helzo-scale-web-231048940970...)
10:06:17 OPTIONS /api/v1/auth/me      → 404 (Origin: helzo-scale-web-231048940970...)
10:02:31 OPTIONS /api/v1/auth/register → 404
10:02:31 OPTIONS /api/v1/auth/me      → 404
```

**O que funciona** (porque é chamada sem Origin ou a rota existe sem CORS):
```
10:06:51 GET /api/v1/billing/plans → 200 ✅ (chamada sem preflight — é GET simples)
```

**Fix**: Atualizar `ALLOWED_ORIGINS` secret e corrigir regex no código.

### 🟡 BUG #2 — Firebase private key corrompida (`\r\r\r\n`)

**Impacto**: Baixo no momento. `verifyIdToken` usa chaves públicas do Google, não a private key. A private key só é necessária para `createCustomToken()` — não usado no fluxo crítico.

**Evidência**:
```bash
gcloud secrets versions access latest --secret="helzo-scale-firebase_private_key" | xxd | head -2
00000010: 5445 204b 4559 2d2d 2d2d 2d0d 0d0d 0a4d  TE KEY-----....M
#                                      ^^^^^^^^^^
#                              3x \r (0x0d) antes do \n (0x0a)
```

**Fix**: Regenerar o secret sem `\r`.

### 🟡 BUG #3 — Secret `helzo-scale-next_public_api_url` com valor errado

**Impacto**: Zero no momento (esse secret não é injetado no Cloud Run). Mas pode causar confusão no futuro.

**Valor atual**: `https://adflow-api-rbn4ayfofa-rj.a.run.app` (URL do API antigo)  
**Valor correto**: `https://helzo-scale-api-231048940970.southamerica-east1.run.app`

### ❓ BUG #4 — Webhook Stripe não verificado

**Status**: O webhook secret está configurado no GCP (`whsec_I7STPL5yKJC1peD2gWlaHFXNwYch72Bg`), mas não foi possível confirmar via API se o endpoint está cadastrado corretamente no Stripe Dashboard apontando para a URL do helzo-scale-api.

**URL correta do webhook**: `https://helzo-scale-api-231048940970.southamerica-east1.run.app/api/v1/billing/webhook`

---

## F) Plano de Correção

### Fix imediato (sem rebuild — ~2 minutos)

1. Atualizar secret `helzo-scale-allowed_origins` para incluir AMBAS as URLs:
   ```
   https://helzo-scale-web-rbn4ayfofa-rj.a.run.app,https://helzo-scale-web-231048940970.southamerica-east1.run.app
   ```
2. Forçar nova revisão do Cloud Run para ler o novo secret.

### Fix de código (requer rebuild — ~10 minutos)

3. Corrigir regex CORS em `apps/api/src/plugins/cors.ts` para aceitar ambos os formatos.
4. Corrigir tratamento da Firebase private key em `firebase-admin.ts` para remover `\r`.
5. Corrigir valor do secret `helzo-scale-next_public_api_url`.

### Verificações manuais necessárias (ação do usuário)

6. Verificar no Stripe Dashboard que o webhook aponta para `https://helzo-scale-api-231048940970.southamerica-east1.run.app/api/v1/billing/webhook`.
7. Testar o fluxo completo: Cadastro → Login → /billing → Stripe Checkout → /dashboard.
