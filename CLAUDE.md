Este projeto é um SaaS enterprise de gestão de TikTok Ads e Meta Ads.

Antes de implementar qualquer coisa, leia:
- docs/PROJECT_SCOPE.md

Regras obrigatórias:
- Não implementar o projeto inteiro de uma vez.
- Trabalhar sempre por fases pequenas.
- Não criar mocks falsos para integrações críticas.
- Usar Node.js + TypeScript no backend.
- Usar Fastify, Prisma, PostgreSQL, BullMQ e Redis.
- Usar Next.js 15, TailwindCSS e Shadcn/UI no frontend.
- Usar Google Cloud Platform como infraestrutura principal.
- Toda rota privada deve validar autenticação, organização, assinatura, plano, permissão e quota.
- Usuário sem assinatura ativa só pode acessar a área de billing.
- Billing gate é obrigatório.
- Toda criação de campanha deve passar por fila.
- Tokens OAuth devem ser criptografados.
- Multi-tenant e RBAC são obrigatórios.
- Segurança enterprise é prioridade.

Forma de trabalho:
- Primeiro planejar.
- Depois implementar por fase.
- Sempre explicar quais arquivos serão alterados antes de alterar.
- Sempre manter código production-ready.
- Não reescrever o escopo inteiro nas respostas.