Quero criar um SaaS completo de gestão de TikTok Ads e Meta Ads, parecido com plataformas como Attrion, porém mais completo, escalável e seguro.

O sistema deve utilizar exclusivamente:
- Google Cloud Platform (GCP)
- TikTok Business API oficial
- Meta Marketing API oficial

Toda a arquitetura deve ser construída pensando em:
- Alta escalabilidade
- Segurança enterprise
- Multi-tenant SaaS
- Automação de campanhas
- Alta disponibilidade
- Processamento assíncrono
- Milhares de campanhas simultaneamente
- Milhões de requisições
- Operação totalmente cloud-native usando Google Cloud

========================
STACK OBRIGATÓRIA
========================

Frontend:
- Next.js 15
- React
- TypeScript
- TailwindCSS
- Shadcn/UI
- React Query
- Zustand

Backend:
- Node.js
- TypeScript
- Fastify
- Prisma ORM
- Zod
- JWT
- BullMQ

Banco de dados:
- PostgreSQL (Google Cloud SQL)

Infraestrutura:
- Docker
- Google Cloud Run
- Google Artifact Registry
- Google Cloud Load Balancer
- Cloud Armor

Filas:
- Redis + BullMQ
- Google Memorystore Redis

Storage:
- Google Cloud Storage

Autenticação:
- Firebase Authentication
- JWT
- Refresh Tokens
- OAuth TikTok
- OAuth Meta

Monitoramento:
- Google Cloud Logging
- Google Cloud Monitoring
- Sentry

CI/CD:
- GitHub Actions
- Google Cloud Build

Segredos:
- Google Secret Manager

========================
ARQUITETURA
========================

Arquitetura obrigatoriamente modular e escalável.

Fluxo:

Frontend Next.js
↓
Load Balancer
↓
Cloud Run API
↓
Redis Queue / BullMQ
↓
Workers Cloud Run
↓
TikTok API / Meta API

Banco:
Cloud SQL PostgreSQL

Arquivos:
Cloud Storage

Logs:
Cloud Logging

Segurança:
Cloud Armor + IAM + Secret Manager

========================
OBJETIVO DO SISTEMA
========================

Criar uma plataforma onde usuários consigam:

- Conectar contas TikTok Ads
- Conectar contas Meta Ads
- Gerenciar múltiplos Business Centers
- Gerenciar múltiplos Business Managers
- Criar campanhas em massa
- Automatizar regras
- Gerenciar criativos
- Monitorar métricas
- Escalar campanhas automaticamente
- Receber alertas
- Operar tudo em um painel único

========================
SISTEMA DE ASSINATURA OBRIGATÓRIO
========================

O sistema deve possuir BILLING GATE obrigatório.

Fluxo obrigatório:

1. Usuário cria conta
2. Usuário faz login
3. Se NÃO possuir assinatura ativa:
   - bloquear acesso total à plataforma
   - redirecionar automaticamente para página de assinatura
   - impedir acesso a dashboard, campanhas, contas e APIs
4. Apenas usuários com assinatura ativa podem acessar funcionalidades
5. Middleware global deve validar assinatura em todas rotas privadas
6. Stripe webhooks devem ativar/desativar acesso automaticamente
7. Se assinatura expirar:
   - bloquear acesso novamente
   - manter apenas página de billing acessível

Implementar:
- Trial opcional
- Cancelamento
- Upgrade/Downgrade
- Troca automática de limites por plano
- Controle de quotas por plano
- Sistema de feature flags
- Controle de uso por assinatura
- Bloqueio automático por inadimplência

========================
PLANOS OFICIAIS
========================

1. START
Preço:
R$ 197/mês

Descrição:
Entrada para quem está começando a operar campanhas.

Benefícios:
- 3 Business Centers fixos
- 20 campanhas/dia
- 60 anúncios/dia
- Apelação em massa
- Dashboard básico
- Suporte padrão

2. GROWTH
Preço:
R$ 497/mês

Descrição:
Para quem já possui operação com maior volume.

Benefícios:
- Tudo do Start
- 6 Business Centers simultâneos
- 40 campanhas/dia
- 120 anúncios/dia
- Templates de campanha
- Fila de criação em massa
- Relatórios por conta

3. SCALE
Preço:
R$ 697/mês

Descrição:
Para operações de alta performance.

Badge:
Mais popular

Benefícios:
- Tudo do Growth
- 12 Business Centers simultâneos
- 80 campanhas/dia
- 240 anúncios/dia
- Automações de regras
- Alertas de performance
- Sincronização avançada de métricas

4. ENTERPRISE
Preço:
R$ 1.397/mês

Descrição:
Para agências e operações grandes.

Benefícios:
- Tudo do Scale
- Contas advertiser ilimitadas
- Business Centers ilimitados
- Campanhas ilimitadas
- Anúncios ilimitados
- Apelação em massa
- Suporte prioritário
- Limites personalizados
- Webhooks e integrações avançadas

========================
MÓDULOS
========================

1. AUTENTICAÇÃO
- Cadastro/login
- Firebase Auth
- OAuth TikTok
- OAuth Meta
- 2FA
- Sessões
- JWT
- Refresh tokens
- Device management
- Rate limit
- Anti brute force

2. MULTI-TENANT
- Organizações
- Usuários
- Equipes
- Permissões
- RBAC:
  - Admin
  - Manager
  - Operator
  - Viewer

3. TIKTOK ADS
Implementar:
- OAuth TikTok
- Conectar Business Center
- Listar advertiser accounts
- Criar campanhas
- Criar ad groups
- Criar anúncios
- Upload criativos
- Métricas
- Duplicação
- Pausar campanhas
- Reativar campanhas

4. META ADS
Implementar:
- OAuth Meta
- Conectar Business Manager
- Listar contas
- Criar campanhas
- Criar conjuntos
- Criar anúncios
- Upload criativos
- Métricas
- Duplicação
- Pausar campanhas
- Reativar campanhas

5. CRIADOR DE CAMPANHAS EM MASSA
- Templates reutilizáveis
- Criação em lote
- Processamento assíncrono
- Retry automático
- Status em tempo real
- Controle de erro individual

6. DASHBOARD
- CPA
- ROAS
- CTR
- CPC
- CPM
- Conversões
- Gastos
- Receita
- Lucro
- Performance por plataforma
- Performance por campanha
- Performance por conta

7. AUTOMAÇÕES
Criar engine de regras:
- Pausar campanha com CPA alto
- Escalar orçamento automaticamente
- Reduzir orçamento
- Alertar rejeições
- Alertar saldo baixo
- Alertar queda de ROAS
- Duplicar campanhas vencedoras

8. ALERTAS
Enviar notificações:
- WhatsApp
- Telegram
- Discord
- Email
- Webhooks

9. BILLING
Implementar:
- Stripe
- Assinaturas
- Planos
- Limites por plano
- Controle de uso
- Upgrade/Downgrade
- Trials
- Bloqueio automático
- Webhooks Stripe
- Feature flags
- Controle de quotas

========================
FILAS E ESCALABILIDADE
========================

Toda criação de campanha deve funcionar via fila.

Implementar:
- BullMQ
- Redis
- Workers paralelos
- Retry automático
- Dead letter queue
- Controle de rate limit
- Idempotência
- Processamento distribuído
- Escalabilidade horizontal
- Auto scaling

========================
SEGURANÇA ENTERPRISE
========================

Implementar:
- Cloud Armor WAF
- IAM
- Secret Manager
- AES Encryption
- Tokens criptografados
- Auditoria completa
- Proteção XSS
- Proteção CSRF
- Proteção SQL Injection
- Proteção SSRF
- Rate limiting
- Isolamento entre tenants
- Secure cookies
- CSP headers
- JWT rotation

========================
BANCO DE DADOS
========================

Criar modelagem Prisma completa para:

- users
- organizations
- organization_users
- integrations
- tiktok_connections
- meta_connections
- advertiser_accounts
- campaign_templates
- campaigns
- adgroups
- ads
- creatives
- automation_rules
- automation_logs
- campaign_jobs
- campaign_job_items
- reports_daily
- notifications
- subscriptions
- plans
- plan_features
- usage_tracking
- billing_events
- feature_flags
- quota_limits
- usage_limits
- audit_logs

========================
GOOGLE CLOUD
========================

Toda infraestrutura deve usar Google Cloud.

Usar:
- Cloud Run
- Cloud SQL PostgreSQL
- Cloud Storage
- Memorystore Redis
- Cloud Logging
- Cloud Monitoring
- Secret Manager
- Cloud Armor
- Artifact Registry
- Cloud Build
- IAM
- Load Balancer

========================
BACKEND RULES
========================

Implementar sistema centralizado de permissões baseado em plano.

Validar:
- campanhas por dia
- anúncios por dia
- quantidade de Business Centers
- quantidade de contas advertiser
- funcionalidades premium
- automações
- relatórios
- webhooks
- APIs avançadas

Toda validação deve ocorrer no backend via middleware.

========================
ENTREGAR
========================

Quero:

1. Arquitetura completa
2. Estrutura monorepo
3. Backend Fastify
4. Frontend Next.js
5. Banco Prisma/PostgreSQL
6. Workers BullMQ
7. Dockerfiles
8. docker-compose
9. Configuração Cloud Run
10. Configuração Redis
11. OAuth TikTok
12. OAuth Meta
13. Sistema RBAC
14. Dashboard
15. Sistema de filas
16. Estratégia de cache
17. Estratégia de deploy
18. Estratégia de segurança
19. Estratégia de monitoramento
20. MVP inicial
21. Roadmap completo
22. Estrutura enterprise
23. Fluxo de automações
24. Estratégia anti-falhas
25. GitHub Actions
26. Configuração completa Google Cloud
27. Billing gate
28. Middleware de assinatura
29. Controle de quotas
30. Sistema de planos
31. Webhooks Stripe
32. Sistema de feature flags

Quero tudo extremamente profissional, modular, seguro, escalável e pronto para produção enterprise usando Node.js + TypeScript no Google Cloud.