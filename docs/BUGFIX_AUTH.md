# BUGFIX_AUTH — Rotas de autenticação retornando 404/500 no Cloud Run

**Status:** ✅ Corrigido e em produção (commit `10738e5`)  
**Data:** 2026-05-11  
**Ambiente afetado:** `https://helzo-scale-api-rbn4ayfofa-rj.a.run.app`

---

## 1. Causa Raiz

### Sintoma
OPTIONS `/api/v1/auth/me` e `/api/v1/auth/register` retornavam 404 ou 500 sem headers CORS, bloqueando qualquer requisição cross-origin do frontend.

### Diagnóstico

O plugin `@fastify/cors` v10 expõe um callback `origin(origin, cb)`. Quando a origem não é permitida, a implementação original chamava:

```typescript
// ❌ ANTES — comportamento incorreto
cb(new Error("Not allowed by CORS"), false);
```

O `@fastify/cors` v10 trata `cb(error, ...)` com `error !== null` como um erro de aplicação, propagando-o para o `setErrorHandler` global do Fastify. Isso:

1. Gerava um erro 500 para requisições de origens não listadas
2. Para origens listadas em produção, um erro de configuração no `ALLOWED_ORIGINS` causava o callback a percorrer o array de forma incorreta, fazendo com que **origens válidas fossem rejeitadas** com erro 500
3. O Cloud Run não retornava os headers CORS corretos quando o handler de erro interceptava a resposta, então o browser recebia `404 Not Found` (CORS blocked → net::ERR_FAILED)

### Código corrigido (`apps/api/src/plugins/cors.ts`)

```typescript
// ✅ DEPOIS — comportamento correto
cb(null, false); // rejeita sem lançar erro — o @fastify/cors responde normalmente com 204 vazio
```

**Por que funciona:** `cb(null, false)` instrui o `@fastify/cors` a responder o preflight sem os headers `Access-Control-Allow-Origin`, devolvendo 204. O browser bloqueia a requisição no lado cliente sem gerar 500 no servidor.

---

## 2. Evidência — Fix em produção

```bash
# Verificado em 2026-05-11
curl -si -X OPTIONS \
  "https://helzo-scale-api-rbn4ayfofa-rj.a.run.app/api/v1/auth/register" \
  -H "Origin: https://helzo-scale-web-rbn4ayfofa-rj.a.run.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization"

# → HTTP/1.1 204 No Content
# → access-control-allow-origin: https://helzo-scale-web-rbn4ayfofa-rj.a.run.app
# → access-control-allow-methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
# → access-control-allow-headers: Content-Type, Authorization, X-Organization-Id, X-Request-Id
# → access-control-max-age: 86400
# → vary: Origin

curl -s "https://helzo-scale-api-rbn4ayfofa-rj.a.run.app/api/v1/health"
# → {"status":"ok","database":"ok","redis":"ok"}
```

---

## 3. Variáveis de Ambiente Necessárias no Cloud Run

Todas as variáveis abaixo devem estar montadas como secrets no serviço `helzo-scale-api`.

### Obrigatórias — Infraestrutura

| Variável | Fonte | Descrição |
|---|---|---|
| `DATABASE_URL` | Secret Manager: `helzo-scale-database_url` | Connection string PostgreSQL (Cloud SQL) |
| `REDIS_URL` | Secret Manager: `helzo-scale-redis_url` | URL do Redis (Memorystore) |
| `ENCRYPTION_KEY` | Secret Manager: `helzo-scale-encryption_key` | 32-byte hex para AES-256-GCM |

### Obrigatórias — Firebase Admin

| Variável | Fonte | Descrição |
|---|---|---|
| `FIREBASE_PROJECT_ID` | Secret Manager: `helzo-scale-firebase_project_id` | ID do projeto Firebase |
| `FIREBASE_CLIENT_EMAIL` | Secret Manager: `helzo-scale-firebase_client_email` | Service account email |
| `FIREBASE_PRIVATE_KEY` | Secret Manager: `helzo-scale-firebase_private_key` | RSA private key (com `\n` reais) |

### Obrigatórias — CORS / Frontend

| Variável | Fonte | Descrição |
|---|---|---|
| `ALLOWED_ORIGINS` | Secret Manager: `helzo-scale-allowed_origins` | `https://helzo-scale-web-rbn4ayfofa-rj.a.run.app` |
| `FRONTEND_URL` | Secret Manager: `helzo-scale-frontend_url` | Mesmo valor que ALLOWED_ORIGINS |

### Obrigatórias — Stripe

| Variável | Fonte | Descrição |
|---|---|---|
| `STRIPE_SECRET_KEY` | Secret Manager: `helzo-scale-stripe_secret_key` | `sk_live_...` ou `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Secret Manager: `helzo-scale-stripe_webhook_secret` | `whsec_...` |

### Obrigatórias — TikTok OAuth

| Variável | Fonte | Descrição |
|---|---|---|
| `TIKTOK_APP_ID` | Secret Manager: `helzo-scale-tiktok_app_id` | App ID do TikTok Business |
| `TIKTOK_APP_SECRET` | Secret Manager: `helzo-scale-tiktok_app_secret` | App Secret do TikTok Business |
| `TIKTOK_REDIRECT_URI` | Secret Manager: `helzo-scale-tiktok_redirect_uri` | `https://<api-url>/api/v1/oauth/tiktok/callback` |

### Obrigatórias — Meta OAuth

| Variável | Fonte | Descrição |
|---|---|---|
| `META_APP_ID` | Secret Manager: `helzo-scale-meta_app_id` | App ID do Meta Business |
| `META_APP_SECRET` | Secret Manager: `helzo-scale-meta_app_secret` | App Secret do Meta Business |
| `META_REDIRECT_URI` | Secret Manager: `helzo-scale-meta_redirect_uri` | `https://<api-url>/api/v1/oauth/meta/callback` |

### Opcionais

| Variável | Fonte | Descrição |
|---|---|---|
| `SENTRY_DSN` | Secret Manager: `helzo-scale-sentry_dsn` | DSN do Sentry para erros 5xx |
| `NODE_ENV` | Env var direta | `production` |

---

## 4. Comando — Redeploy Manual

```bash
# Forçar nova revisão com a imagem mais recente (sem alterar config)
gcloud run services update helzo-scale-api \
  --region=southamerica-east1 \
  --project=helzo-scale \
  --tag=latest \
  --no-traffic

# Após validar, migrar 100% do tráfego para a nova revisão
gcloud run services update-traffic helzo-scale-api \
  --region=southamerica-east1 \
  --project=helzo-scale \
  --to-latest
```

Ou, se quiser forçar um redeploy completo via GitHub Actions:

```bash
# Disparar o workflow manualmente (se configurado com workflow_dispatch)
gh workflow run deploy.yml --repo seu-usuario/helzo-scale
```

---

## 5. Comando — Logs em Tempo Real

```bash
# Stream de logs do serviço API (últimas 10 min, ao vivo)
gcloud run services logs tail helzo-scale-api \
  --region=southamerica-east1 \
  --project=helzo-scale

# Ou via gcloud logging (mais controle de filtro):
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="helzo-scale-api"' \
  --project=helzo-scale \
  --freshness=10m \
  --format="value(timestamp, textPayload, jsonPayload.msg)" \
  --order=asc

# Para acompanhar ao vivo com grep (erros apenas):
watch -n 5 'gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=helzo-scale-api AND severity>=ERROR" \
  --project=helzo-scale --freshness=5m --format="table(timestamp,jsonPayload.msg,jsonPayload.err)"'
```

---

## 6. Rotas Registradas — API Completa

Todas registradas com prefixo `/api/v1`:

### Auth
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `OPTIONS` | `/api/v1/auth/*` | — | Preflight CORS (automático) |
| `POST` | `/api/v1/auth/register` | Firebase token | Cria user + org + trial subscription |
| `GET` | `/api/v1/auth/me` | Bearer token | Retorna user + orgs + subscription |

### Health
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/api/v1/health` | — | Health check (DB + Redis + queues) |

### Billing
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/api/v1/billing/plans` | Bearer | Lista planos disponíveis |
| `POST` | `/api/v1/billing/checkout` | Bearer + org | Cria sessão Stripe Checkout |
| `GET` | `/api/v1/billing/portal` | Bearer + org | Abre portal Stripe |
| `POST` | `/api/v1/billing/webhook` | Stripe-Signature | Webhook de eventos Stripe |

### Organizations
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/api/v1/organizations` | Bearer | Lista orgs do user |
| `GET` | `/api/v1/organizations/:id` | Bearer + org | Detalhe da org |
| `PATCH` | `/api/v1/organizations/:id` | Bearer + org + ADMIN | Atualiza org |
| `GET` | `/api/v1/organizations/:id/members` | Bearer + org | Lista membros |
| `POST` | `/api/v1/organizations/:id/members` | Bearer + org + ADMIN | Convida membro |
| `DELETE` | `/api/v1/organizations/:id/members/:userId` | Bearer + org + ADMIN | Remove membro |
| `GET` | `/api/v1/organizations/:id/usage` | Bearer + org | Uso atual do plano |

### TikTok
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/api/v1/oauth/tiktok/connect` | Bearer + org | Inicia OAuth TikTok |
| `GET` | `/api/v1/oauth/tiktok/callback` | — | Callback OAuth TikTok |
| `GET` | `/api/v1/tiktok/connections` | Bearer + org | Lista conexões TikTok |
| `DELETE` | `/api/v1/tiktok/connections/:id` | Bearer + org | Remove conexão |
| `GET` | `/api/v1/tiktok/accounts` | Bearer + org | Lista contas anunciantes |
| `POST` | `/api/v1/tiktok/accounts` | Bearer + org | Adiciona conta |
| `DELETE` | `/api/v1/tiktok/accounts/:id` | Bearer + org | Remove conta |
| `GET` | `/api/v1/tiktok/campaigns` | Bearer + org | Lista campanhas TikTok |
| `POST` | `/api/v1/tiktok/campaigns` | Bearer + org + quota | Cria campanha (via fila) |
| `PATCH` | `/api/v1/tiktok/campaigns/:id/status` | Bearer + org | Pausa/retoma campanha |

### Meta
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/api/v1/oauth/meta/connect` | Bearer + org | Inicia OAuth Meta |
| `GET` | `/api/v1/oauth/meta/callback` | — | Callback OAuth Meta |
| `GET` | `/api/v1/meta/connections` | Bearer + org | Lista conexões Meta |
| `DELETE` | `/api/v1/meta/connections/:id` | Bearer + org | Remove conexão |
| `GET` | `/api/v1/meta/accounts` | Bearer + org | Lista ad accounts |
| `POST` | `/api/v1/meta/accounts` | Bearer + org | Adiciona conta |
| `DELETE` | `/api/v1/meta/accounts/:id` | Bearer + org | Remove conta |
| `GET` | `/api/v1/meta/campaigns` | Bearer + org | Lista campanhas Meta |
| `POST` | `/api/v1/meta/campaigns` | Bearer + org + quota | Cria campanha (via fila) |
| `PATCH` | `/api/v1/meta/campaigns/:id/status` | Bearer + org | Pausa/retoma campanha |

### Reports
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/api/v1/reports` | Bearer + org | Relatório diário agregado |
| `GET` | `/api/v1/reports/summary` | Bearer + org | Resumo do período |

### Templates
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/api/v1/templates` | Bearer + org | Lista templates de campanha |
| `POST` | `/api/v1/templates` | Bearer + org | Cria template |
| `PATCH` | `/api/v1/templates/:id` | Bearer + org | Atualiza template |
| `DELETE` | `/api/v1/templates/:id` | Bearer + org | Remove template |

### Automation
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/api/v1/automation/rules` | Bearer + org | Lista regras de automação |
| `POST` | `/api/v1/automation/rules` | Bearer + org | Cria regra |
| `PATCH` | `/api/v1/automation/rules/:id` | Bearer + org | Atualiza regra |
| `DELETE` | `/api/v1/automation/rules/:id` | Bearer + org | Remove regra |
| `PATCH` | `/api/v1/automation/rules/:id/toggle` | Bearer + org | Ativa/desativa regra |
| `GET` | `/api/v1/automation/config` | Bearer + org | Config global de automação |
| `PUT` | `/api/v1/automation/config` | Bearer + org | Atualiza config |

### Notifications
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/api/v1/notifications` | Bearer + org | Lista notificações |
| `PATCH` | `/api/v1/notifications/:id/read` | Bearer + org | Marca como lida |
| `POST` | `/api/v1/notifications/read-all` | Bearer + org | Marca todas como lidas |

---

## 7. Nota sobre Cache do Browser

O preflight CORS tem `Access-Control-Max-Age: 86400` (24 horas). Se o browser cacheou uma resposta de erro anterior, pode continuar usando o resultado antigo. Para limpar:

1. Abra DevTools → Application → Clear Storage → Clear site data
2. Ou use uma janela anônima (não compartilha cache de preflight)
3. Ou teste via `curl -si -X OPTIONS ...` para verificar o servidor diretamente

---

## 8. Commits Relacionados

| Hash | Mensagem |
|---|---|
| `10738e5` | `fix(api): resolve CORS preflight 500 — use cb(null,false) on rejected origin` |
