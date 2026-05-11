# TODO_FIXES — Fila de Correções Helzo Scale

> Gerado em: 2026-05-11
> Status: em execução autônoma

## PRIORIDADE ALTA — Funcionais (afetam operação)

- [✅] **FIX-001**: Revenue/ROAS sempre 0 em metrics-sync
  - Arquivos: packages/integrations/src/tiktok.ts, packages/integrations/src/meta.ts, apps/worker/src/processors/metrics-sync.ts
  - TikTok: adicionar `total_purchase_value` às métricas do relatório diário
  - Meta: extrair `action_values` para revenue
  - Calcular roas = revenue / spend

- [✅] **FIX-002**: BALANCE_BELOW condition retorna sempre false
  - Arquivos: packages/integrations/src/tiktok.ts, packages/integrations/src/meta.ts, apps/worker/src/processors/automation-evaluate.ts
  - Implementar `tiktokGetAdvertiserBalance` + `metaGetAdAccountBalance`
  - Adicionar `evaluateBalanceBelow` no automation processor

- [✅] **FIX-003**: REJECTED condition retorna sempre false
  - Arquivos: packages/integrations/src/tiktok.ts, packages/integrations/src/meta.ts, apps/worker/src/processors/automation-evaluate.ts
  - Implementar `tiktokGetRejectedCampaigns` + `metaGetRejectedCampaigns`
  - Adicionar `evaluateRejected` no automation processor

- [✅] **FIX-004**: DUPLICATE_CAMPAIGN action retorna sempre false
  - Arquivo: apps/worker/src/processors/automation-evaluate.ts
  - Implementar: ler config da campanha original → criar novo Campaign no DB → criar CampaignJob + CampaignJobItem → enqueue

## PRIORIDADE MÉDIA — Infraestrutura

- [⏳] **FIX-005**: Email como canal de alerta não implementado
  - Requer: credencial SMTP/SendGrid (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS ou SENDGRID_API_KEY)
  - **PARAR e solicitar credencial ao usuário**

- [⏳] **FIX-006**: WhatsApp como canal de alerta não implementado
  - Requer: Twilio Account SID + Auth Token + WhatsApp number
  - **PARAR e solicitar credencial ao usuário**

## PRIORIDADE BAIXA — Nice to have

- [ ] **FIX-007**: 2FA opcional
  - Firebase Phone Auth ou TOTP (Google Authenticator)
  - Requer decisão de produto + Firebase Phone Auth habilitado no console

- [ ] **FIX-008**: Device management (sessões por device)
  - Tabela de sessions no DB + API para revogar devices

- [ ] **FIX-009**: Cloud Armor WAF
  - Configuração via Terraform/gcloud — fora do escopo do código-fonte

- [ ] **FIX-010**: Rollback automático em falha de health check no CI/CD
  - Requer lógica de verificação pós-deploy no workflow

## LEGENDA

- ✅ Corrigido nesta execução
- ⏳ Bloqueado por credencial/decisão externa
- [ ] Pendente — baixa prioridade
