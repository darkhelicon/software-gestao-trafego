# BUGFIX_AUTH_FLOW — Registro → Assinatura: 3 bugs encadeados

**Status:** ✅ Corrigido (2026-05-11)

---

## Fluxo correto após os fixes

```
[Register Page]
  ├─ createUserWithEmailAndPassword() ─────────→ Firebase ✅
  ├─ credential.user.getIdToken()
  └─ POST /api/v1/auth/register { idToken, name, orgName }
       ├─ verifyIdToken(idToken)         ← sem checkRevoked
       ├─ prisma.$transaction(user + org + subscription)
       └─ 201 Created
           └─ window.location.href = "/billing"

[Billing Page]
  ├─ onAuthStateChanged fires → /auth/me → currentOrg set ✅
  ├─ PlanCard: currentOrg.id exists → POST /api/v1/billing/checkout
  └─ Stripe Checkout → webhook → subscription ACTIVE → /dashboard
```

---

## Bug 1 — POST /register → 401 Unauthorized

### Causa

`/register` chamava `firebaseAuth.verifyIdToken(idToken, true)` com `checkRevoked: true`.

O segundo parâmetro `true` instrui o Firebase Admin SDK a fazer uma chamada HTTP extra ao Google para verificar se o refresh token foi revogado. Para contas **recém-criadas** (`createUserWithEmailAndPassword` < 2s antes), essa verificação de revogação pode falhar por dois motivos:

1. **Propagação**: o sistema de revogação do Firebase ainda não indexou o novo usuário
2. **Permissão ADC**: o service account no Cloud Run pode não ter `Firebase Authentication Admin` para fazer o lookup de revogação

O authenticate middleware também usa `checkRevoked: true`, mas para ele, quando o token passa na verificação, o erro retornado ao cliente é **"User not found"** (user não está no DB), não "Invalid token" — ambos geram 401, mas por causas diferentes.

### Fix aplicado

`apps/api/src/routes/auth/index.ts` linha ~38:

```typescript
// ANTES
decoded = await firebaseAuth.verifyIdToken(idToken, true);

// DEPOIS
decoded = await firebaseAuth.verifyIdToken(idToken);
// checkRevoked omitido — recém-criados falham por timing; revogação já é
// enforçada pelo authenticate middleware em todas as rotas protegidas.
```

---

## Bug 2 — Usuários Fantasma (Firebase ✅, Postgres ❌)

### Causa

Quando o registro falha (Bug 1), o usuário existe no Firebase mas não no Postgres. No próximo login:

1. `onAuthStateChanged` → `/auth/me` com token válido
2. `authenticate` middleware: `verifyIdToken` OK → `user.findUnique({ firebaseUid })` → `null`
3. Retorna 401 `"User not found"`
4. `providers.tsx`: retenta após 1s → ainda 401 → `setCurrentOrg(null)`
5. `isInitialized = true`, `firebaseUser` definido, `currentOrg = null`
6. App-layout: `!hasSubscription` → redirect `/billing`

### Fix aplicado

**`apps/api/src/routes/auth/index.ts`** — novo endpoint `POST /auth/sync`:
- Valida o Firebase token via `Authorization: Bearer`
- Se user existe no DB: retorna dados (`needsOnboarding: false`)
- Se user NÃO existe (ghost): cria user + org + trial subscription com defaults do Firebase → retorna (`needsOnboarding: true`)

**`apps/web/src/components/providers.tsx`**:
```typescript
// Quando /auth/me falha duas vezes com 401 → chama /auth/sync
try {
  const sync = await api.post<SyncData>("/api/v1/auth/sync", {});
  // extrai org do sync response e seta currentOrg
} catch {
  setCurrentOrg(null);
}
```

---

## Bug 3 — Loop /billing → /register → /billing

### Causa

Com `currentOrg = null` (porque o user não está no DB), clicar "Assinar agora" no `plan-card.tsx` redirecionava para `/register`:

```typescript
if (!currentOrg?.id) {
  if (firebaseUser) {
    window.location.href = "/register"; // ← redireciona aqui
  }
}
```

Na página `/register`, o `useEffect` só detectava sessão Google, não email/senha. O ghost user com conta email/senha via via o formulário completo (com campo de email/senha), tentava criar outra conta com o mesmo email → `auth/email-already-in-use` → erro → loop.

### Fix aplicado

**`apps/web/src/app/(auth)/register/page.tsx`**:
```typescript
// ANTES: só detectava Google
const isGoogle = auth.currentUser.providerData.some(p => p.providerId === "google.com");
if (isGoogle) { setGoogleSession(true); ... }

// DEPOIS: detecta qualquer sessão Firebase ativa
if (!auth?.currentUser) return;
setGoogleSession(true); // formulário simplificado: só nome + empresa
```

O formulário simplificado usa `handleCompleteGoogleRegistration` que chama `auth.currentUser.getIdToken()` — funciona para qualquer provider (Google, email/senha, etc.).

---

## Diagrama completo do fluxo (pós-fix)

```
REGISTRO NOVO USUÁRIO:
  /register → Firebase create → /api/auth/register (sem checkRevoked) → DB ✅ → /billing → checkout ✅

GHOST USER (Firebase ✅, DB ❌):
  login → /auth/me 401 → retry 1s → /auth/me 401 → /auth/sync → cria no DB → currentOrg set → /billing → checkout ✅

GHOST USER CLICA "ASSINAR AGORA":
  /billing → currentOrg null → /register (simplified form detecta Firebase session) → /auth/register → DB ✅ → /billing → checkout ✅
```

---

## Como testar localmente

```bash
# 1. Suba o stack local
pnpm dev

# 2. Teste registro novo (deve retornar 201)
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"idToken":"<firebase_id_token>","name":"João","organizationName":"Minha Agência"}'

# 3. Teste sync de ghost user (deve criar user e retornar 201 com needsOnboarding: true)
curl -X POST http://localhost:3001/api/v1/auth/sync \
  -H "Authorization: Bearer <firebase_id_token>"

# 4. Segundo sync do mesmo user (deve retornar 200 com needsOnboarding: false)
curl -X POST http://localhost:3001/api/v1/auth/sync \
  -H "Authorization: Bearer <firebase_id_token>"
```

### Obter Firebase ID token para testes

```javascript
// No console do browser, após autenticar:
import { getAuth } from "firebase/auth";
const token = await getAuth().currentUser.getIdToken();
console.log(token);
```
