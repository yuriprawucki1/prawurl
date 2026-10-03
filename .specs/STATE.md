# State

## Decisions

| ID | Status | Decision | Source |
| --- | --- | --- | --- |
| AD-001 | active | Atualização usa perfil standard, budget 150k, com provas de regressão e verificador independente. | Usuário aprovou plano em 02/10/2026. |
| AD-002 | active | Vitest atual e Workers testados no Wrangler local; não usar pool com peers incompatíveis. | dependency-refresh/plan.md Landing 2 |
| AD-003 | active | Tailwind 4 usa plugin Vite, preservando tokens/temas/layout. | dependency-refresh/plan.md Landing 1 |

## Handoff

Feature: dependency-refresh; base ad2de29; branch codex/dependency-refresh.
Plano aprovado e checks derivados. Implementação e provas do autor concluídas; aguarda Verifier independente sobre todos os 28 checks após o commit. Publicação externa requer instrução específica.
Estado preexistente preservado: diretório `.agents/` não rastreado do usuário.
