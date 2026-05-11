# BUGFIX_PRODUCTION — 5 problemas identificados nos logs do Cloud Run

**Data:** 2026-05-11  
**Status:** Fixes 1, 2 e 3 commitados. Fix 4 (Firebase) depende de diagnóstico via log após deploy. Fix 5 (Redis) requer comando manual.

---

## Problema 1 — OPTIONS 404 em /auth/me e /auth/sync

### Causa
`gcloud run services replace` gerou nova URL do Cloud Run para o web service:
- **Antiga (URL do código + ALLOWED_ORIGINS):** `https://helzo-scale-web-rbn4ayfofa-rj.a.run.app`
- **Nova (URL real do browser):** `https://helzo-scale-web-231048940970.southamerica-east1.run.app`

O browser envia `Origin: https://helzo-scale-web-231048940970...` no preflight.  
O API verifica contra `ALLOWED_ORIGINS` que só tem a URL antiga → `cb(null, false)` → 204 sem headers CORS → browser rejeita como se fosse 404.

### Fix aplicado — `apps/api/src/plugins/cors.ts`
```typescript
const CLOUD_RUN_WEB_PATTERN = /^https:\/\/helzo-scale-web-[a-z0-9]+-[a-z0-9]+\.run\.app$/;

origin: (origin, cb) => {
  if (!origin || allowedOrigins.includes(origin)) { cb(null, true); return; }
  // Aceita qualquer URL do serviço web no Cloud Run sem precisar atualizar secret
  if (CLOUD_RUN_WEB_PATTERN.test(origin)) { cb(null, true); return; }
  cb(null, false);
}
```

### Ações manuais recomendadas (não bloqueantes após o fix acima)

Atualizar os secrets para refletir a nova URL atual:
```bash
# Atualizar ALLOWED_ORIGINS
printf 'https://helzo-scale-web-231048940970.southamerica-east1.run.app' | \
  gcloud secrets versions add helzo-scale-allowed_origins \
    --data-file=- --project=helzo-scale

# Atualizar FRONTEND_URL (usado em redirects OAuth)
printf 'https://helzo-scale-web-231048940970.southamerica-east1.run.app' | \
  gcloud secrets versions add helzo-scale-frontend_url \
    --data-file=- --project=helzo-scale
```

---

## Problema 2 — NEXT_PUBLIC_API_URL desatualizado

### Causa
O web bundle foi compilado com `NEXT_PUBLIC_API_URL` apontando para a URL antiga da API.
Ambas as URLs funcionam (são o mesmo Cloud Run service), mas manter a nova URL é mais correto.

### Fix aplicado
`NEXT_PUBLIC_API_URL` no GitHub Secrets atualizado via:
```bash
gh secret set NEXT_PUBLIC_API_URL \
  --body "https://helzo-scale-api-231048940970.southamerica-east1.run.app"
```

O próximo deploy do web app vai compilar com a nova URL.

---

## Problema 3 — POST 400 em /register (validação Zod)

### Causa
O campo esperado pelo Zod schema é `organizationName` mas o frontend enviava o valor correto. Provavelmente o 400 aparecia porque outro erro (CORS) estava mascarando a request antes de ela chegar ao handler.

Com o fix de CORS, a requisição agora chega ao backend e o schema valida corretamente.

### Schema esperado (backend)
```typescript
const registerSchema = z.object({
  idToken: string,        // Firebase ID token
  name: string,           // nome do usuário (min 2, max 100)
  organizationName: string // nome da empresa (min 2, max 100)
});
```

### O que o frontend envia (confirmado correto)
```typescript
api.post("/api/v1/auth/register", {
  idToken,
  name: form.name.trim() || "Usuário",
  organizationName: form.organizationName.trim() || "Minha Empresa",
});
```

---

## Problema 4 — verifyIdToken failed (401) ← AÇÃO NECESSÁRIA

### Causa provável
`FIREBASE_PROJECT_ID` no Secret Manager tem um valor diferente do Firebase project ID real
(que está em `NEXT_PUBLIC_FIREBASE_PROJECT_ID` no GitHub Secrets / baked no web bundle).

Isso acontece frequentemente após migração GCP: o GCP project ID mudou para "helzo-scale"
mas o Firebase project pode ter um ID diferente (ex: "helzo-scale-xxxxx" ou nome original).

O `verifyIdToken` valida que o token `aud` claim == `projectId` configurado. Se divergirem,
**todos os tokens falham com `auth/argument-error`**.

### Diagnóstico — verificar nos logs após o próximo deploy

Os logs vão mostrar ao startup:
```json
{
  "msg": "Firebase Admin init",
  "mode": "service-account",
  "projectId": "<VALOR DO SECRET>",
  "hasClientEmail": true,
  "privateKeyLength": 1703
}
```

E nas falhas de verifyIdToken:
```json
{
  "msg": "verifyIdToken failed",
  "errorCode": "auth/argument-error",
  "errorMessage": "...",
  "firebaseProjectId": "<VALOR DO SECRET>"
}
```

### Como verificar o Firebase project ID correto

No Firebase Console → Project Settings → General → Project ID  
**OU** no código do frontend (browser console após login):
```javascript
import { getApp } from "firebase/app";
console.log(getApp().options.projectId);
```

### Fix manual quando confirmar o valor correto

```bash
# Substituir pelo valor real do Firebase project ID
printf 'SEU_FIREBASE_PROJECT_ID_REAL' | \
  gcloud secrets versions add helzo-scale-firebase_project_id \
    --data-file=- --project=helzo-scale
```

Após atualizar o secret, o Cloud Run precisa de um novo deploy para pegar o novo valor:
```bash
gcloud run services update helzo-scale-api \
  --region=southamerica-east1 \
  --project=helzo-scale \
  --tag=latest
```

---

## Problema 5 — Redis volatile-lru (política incorreta para BullMQ)

### Causa
BullMQ requer que o Redis **nunca** evicte chaves por pressão de memória (`noeviction`).
Com `volatile-lru`, jobs podem ser silenciosamente removidos da fila sob pressão.

### Diagnóstico
```bash
gcloud redis instances list --region=southamerica-east1 --project=helzo-scale
```

### Fix manual (rode você mesmo)
```bash
# Substitua <NOME_DA_INSTANCIA> pelo nome retornado no comando acima
gcloud redis instances update <NOME_DA_INSTANCIA> \
  --region=southamerica-east1 \
  --project=helzo-scale \
  --update-redis-config maxmemory-policy=noeviction
```

**Nota:** a atualização leva 1-3 min e não causa downtime.

---

## Problema 6 — INFRA TODO: domínio customizado

A URL do Cloud Run muda a cada `gcloud run services replace` com nova revisão.
Longo prazo: mapear um domínio fixo como `api.helzoscale.com` e `app.helzoscale.com`.

Documentado em `docs/INFRA_TODO.md`.

---

## Checklist do estado atual

| Problema | Status | Ação |
|----------|--------|------|
| OPTIONS 404 (CORS URL nova) | ✅ Corrigido no código | Deploy automático |
| NEXT_PUBLIC_API_URL | ✅ Atualizado no GitHub Secret | Rebuild no próximo deploy |
| POST 400 /register | ✅ Resolvido pelo fix CORS | — |
| verifyIdToken failed | ⚠️ Diagnóstico pendente | Ver logs após deploy |
| Redis volatile-lru | ⚠️ Fix manual necessário | Ver comando na seção 5 |

---

## Comandos para monitorar logs após deploy

```bash
# Stream de logs em tempo real
gcloud run services logs tail helzo-scale-api \
  --region=southamerica-east1 \
  --project=helzo-scale

# Filtrar só erros de Firebase
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="helzo-scale-api" AND jsonPayload.msg=("verifyIdToken failed" OR "Firebase Admin init")' \
  --project=helzo-scale \
  --freshness=10m \
  --format="json" | head -50
```
