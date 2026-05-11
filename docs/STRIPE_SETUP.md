# STRIPE_SETUP — Checklist de configuração do Stripe

Este documento lista tudo que precisa ser configurado no Stripe Dashboard e no Cloud Run
para o fluxo de checkout funcionar.

---

## Status atual

| Item | Status | Ação necessária |
|------|--------|----------------|
| Stripe Secret Key no Cloud Run | ⚠️ Verificar | Ver seção 1 |
| Stripe Webhook Secret no Cloud Run | ⚠️ Verificar | Ver seção 2 |
| 4 produtos + prices no Stripe | ⚠️ Verificar | Ver seção 3 |
| Webhook endpoint cadastrado | ⚠️ Verificar | Ver seção 4 |
| STRIPE_PRICE_* env vars no Cloud Run | ⚠️ Verificar | Ver seção 5 |

---

## 1. Stripe Secret Key

### Verificar se está configurada

```bash
gcloud secrets list --project=helzo-scale | grep stripe
```

### Se não existir, criar o secret

```bash
# Crie no Stripe Dashboard → Developers → API Keys → Secret key
echo -n "sk_live_..." | gcloud secrets create helzo-scale-stripe_secret_key \
  --data-file=- \
  --project=helzo-scale

# Depois monte no Cloud Run:
gcloud run services update helzo-scale-api \
  --region=southamerica-east1 \
  --project=helzo-scale \
  --set-secrets="STRIPE_SECRET_KEY=helzo-scale-stripe_secret_key:latest"
```

---

## 2. Stripe Webhook Secret

O webhook secret é gerado pelo Stripe quando você cadastra o endpoint (seção 4).

```bash
echo -n "whsec_..." | gcloud secrets create helzo-scale-stripe_webhook_secret \
  --data-file=- \
  --project=helzo-scale

gcloud run services update helzo-scale-api \
  --region=southamerica-east1 \
  --project=helzo-scale \
  --set-secrets="STRIPE_WEBHOOK_SECRET=helzo-scale-stripe_webhook_secret:latest"
```

---

## 3. Criar Produtos e Preços no Stripe Dashboard

> **Atenção**: Os Price IDs já estão hardcoded no seed (`packages/database/src/seed.ts`).
> Os IDs abaixo são os que estão no seed — confirme que existem no seu Stripe Dashboard.

| Plano | Preço | Price ID no seed |
|-------|-------|-----------------|
| Start | R$ 197/mês | `price_1TUfrF83NyrrcWaOaKvYwDFu` |
| Growth | R$ 497/mês | `price_1TUfre83NyrrcWaOb94oUgdf` |
| Scale | R$ 697/mês | `price_1TUfru83NyrrcWaOZiEkMLFW` |
| Enterprise | R$ 1.397/mês | `price_1TUfsD83NyrrcWaO9giDMTJr` |

### Como verificar se os prices existem

No Stripe Dashboard:
1. Vá em **Products** → selecione cada produto
2. Confirme que o Price ID listado existe e está ativo

### Se os prices NÃO existirem — criar via Stripe Dashboard

1. Acesse **Products → Add product**
2. Para cada plano:
   - **Nome**: Start / Growth / Scale / Enterprise
   - **Tipo**: Recurring
   - **Intervalo**: Monthly
   - **Moeda**: BRL
   - **Preço**: 197 / 497 / 697 / 1397

3. Após criar, copie os Price IDs gerados e:
   a. Atualize o seed em `packages/database/src/seed.ts`
   b. Configure as env vars no Cloud Run (seção 5)

---

## 4. Cadastrar o Webhook Endpoint

No Stripe Dashboard → **Developers → Webhooks → Add endpoint**:

- **URL**: `https://helzo-scale-api-rbn4ayfofa-rj.a.run.app/api/v1/billing/webhook`
- **Version**: Latest API version
- **Events to listen to**:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`

Após cadastrar, o Stripe vai gerar o **Signing secret** (`whsec_...`).
Configure-o no Cloud Run conforme a seção 2.

---

## 5. Configurar STRIPE_PRICE_* no Cloud Run

As env vars `STRIPE_PRICE_START`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_SCALE`, `STRIPE_PRICE_ENTERPRISE`
são lidas em `apps/api/src/lib/stripe.ts` para montar a sessão de checkout.

```bash
# Substitua pelos Price IDs reais do seu Stripe
gcloud run services update helzo-scale-api \
  --region=southamerica-east1 \
  --project=helzo-scale \
  --set-env-vars="STRIPE_PRICE_START=price_1TUfrF83NyrrcWaOaKvYwDFu,STRIPE_PRICE_GROWTH=price_1TUfre83NyrrcWaOb94oUgdf,STRIPE_PRICE_SCALE=price_1TUfru83NyrrcWaOZiEkMLFW,STRIPE_PRICE_ENTERPRISE=price_1TUfsD83NyrrcWaO9giDMTJr"
```

> **Nota**: Se preferir usar Secret Manager em vez de env vars diretas:
> ```bash
> echo -n "price_1TUfrF83NyrrcWaOaKvYwDFu" | gcloud secrets create helzo-scale-stripe_price_start --data-file=- --project=helzo-scale
> # Repetir para cada plano, depois montar com --set-secrets
> ```

---

## 6. Testar o Webhook localmente

```bash
# Instale o Stripe CLI
stripe listen --forward-to localhost:3001/api/v1/billing/webhook

# Em outro terminal, dispare um evento de teste
stripe trigger checkout.session.completed
```

---

## 7. Verificar configuração completa

```bash
# Verificar que o serviço tem todas as variáveis
gcloud run services describe helzo-scale-api \
  --region=southamerica-east1 \
  --project=helzo-scale \
  --format="yaml(spec.template.spec.containers[0].env)"
```

Todas estas variáveis devem aparecer:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_START`
- `STRIPE_PRICE_GROWTH`
- `STRIPE_PRICE_SCALE`
- `STRIPE_PRICE_ENTERPRISE`

---

## 8. Checklist final antes de testar checkout

- [ ] `STRIPE_SECRET_KEY` configurado e válido
- [ ] `STRIPE_WEBHOOK_SECRET` configurado
- [ ] 4 produtos/prices existem no Stripe Dashboard com os IDs corretos
- [ ] Webhook endpoint cadastrado no Stripe com os 6 eventos
- [ ] `STRIPE_PRICE_*` env vars configuradas no Cloud Run
- [ ] Seed rodado no DB: `pnpm db:seed` (plans precisam existir na tabela `Plan`)
