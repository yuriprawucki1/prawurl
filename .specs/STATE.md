# State

## Decisions

| ID | Status | Decision | Source |
| --- | --- | --- | --- |
| AD-001 | active | Atualização usa perfil standard, budget 150k, com provas de regressão e verificador independente. | Usuário aprovou plano em 02/10/2026. |
| AD-002 | active | Vitest atual e Workers testados no Wrangler local; não usar pool com peers incompatíveis. | dependency-refresh/plan.md Landing 2 |
| AD-003 | active | Tailwind 4 usa plugin Vite, preservando tokens/temas/layout. | dependency-refresh/plan.md Landing 1 |

## Handoff

Feature: dependency-refresh; base ad2de29; branch codex/dependency-refresh.
Plano aprovado e checks derivados. Rodada independente 1 encontrou lacuna C12 em limites de edição; testes ampliados e falha histórica preservada. Corrigida também a prioridade de bordas no Tailwind 4, com nova asserção antes vermelha e agora verde. Provas do autor: 75 Vitest, 2 layouts e 2 jornadas de lote verdes; aguarda rodada independente 2 com todas as provas e reinjeção das superfícies alteradas. Publicação externa requer instrução específica.
Estado preexistente preservado: diretório `.agents/` não rastreado do usuário.
