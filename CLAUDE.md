# LexBuild — Regras + SECURITY GATE Completo
## Comandos
npm run dev  npm run build  npm run test  npm run lint
## Estilo OBRIGATÓRIO
"aspas duplas"  2 espaços  ; final  Arrow functions
Console.log só dev  NUNCA classes/any/pastas aleatórias
## Estrutura
backend/src/agents/ routes/ services/ config/ middleware/ templates/ docgen/
frontend/src/pages/ components/ services/ lib/
## SECURITY GATE (SEMPRE antes commit/push/deploy)
Bloqueia se QUALQUER:
C1. Endpoint sem auth/IDOR
C2. SQL concatenação/injection
C3. Segredos repo/logs
C4. BD sem TLS/privileges amplos
C5. Rate limit ausente (login/signup)
C6. Upload sem validação
C7. CRM/Business Logic
User A vê User B | Role frontend | Bulk infinito (1000+)
Stripe amount client | Workflow skip | API key exposta
Tenant isolation | Role server | Stripe DB amount
Bulk máx 100 | Rate 10/min automação
Fluxo: Change Map → Lint/Test/Build → Audit C1-C7 → Fix → VERDICT: APPROVED
