# Atualização das dependências do PrawURL

## Problem

O projeto ficou sem manutenção de dependências. O pedido do usuário é: “atualizar tudo sem quebrar nada”, usando as últimas versões e provas automatizadas com Vitest, Playwright e verificações independentes. Não foi fornecido um incidente de produção.

Diagnóstico em 02/10/2026, base `ad2de29`: Node 24.18.0 e npm 12.2.0; tipos e build passam; existem somente quatro testes Vitest de políticas e uma especificação Playwright executada em desktop e mobile, ambas aprovadas. O npm audit registra 18 pacotes vulneráveis: 1 crítico, 11 altos, 4 moderados e 2 baixos. As verificações iniciais não provam os fluxos completos da API, persistência, autorização ou CRUD.

O resultado desejado é a mesma aplicação e os mesmos contratos, com dependências atuais, instalação reproduzível e regressões importantes cobertas por testes. “Nada quebrar” será avaliado pelas obrigações abaixo e pelo relatório independente; integrações externas simuladas terão essa limitação identificada, sem alegar garantia absoluta.

## Flow

Reutilizar os scripts npm, as políticas, os serviços, os Workers e os componentes atuais, ampliando suas provas.

1. `package.json` e `package-lock.json` (exists) recebem as versões verificadas no registro npm; a instalação entrega a árvore reproduzível de dependências — AC 1–4.
2. `vite.config.ts`, `tailwind.config.ts` e `src/app/styles.css` (exists) recebem as migrações exigidas pelas bibliotecas; `postcss.config.js` (exists) é removido porque o plugin Vite substitui essa integração, entregando o mesmo frontend — AC 5–7, 19–26.
3. `src/shared/validation.ts`, `src/domain`, `src/application` e `src/infrastructure` (exists) continuam validando e processando links; Vitest prova as regras observáveis — AC 8–14.
4. `src/workers/api/index.ts`, `src/workers/redirect/index.ts`, `migrations` e configurações Wrangler (exists) executam com D1/KV locais isolados; testes Vitest enviam requisições ao runtime local do Wrangler/Miniflare usando `createTestHarness`, com ambos os Workers e bindings no mesmo runtime — AC 15–18, 27.
5. `playwright.config.ts`, `tests/layout.spec.ts` e telas `src/app/presentation` (exists) exercitam o frontend em desktop e mobile e comparam o layout com a base — AC 19–26.
6. `.github/workflows/deploy.yml`, `.github/workflows/deploy-staging.yml` e `README.md` (exists) recebem as ferramentas e comandos atualizados; as provas executam antes das etapas de publicação — AC 28.

## Impact

| Front | What changes |
| --- | --- |
| domain | Os termos link, alias, usuário, sessão, bloqueio, senha, expiração e clique mantêm o significado atual. |
| frontend | Migração de Tailwind 3 para 4 e tailwind-merge 2 para 3, preservando tokens, temas, responsividade e interações Radix. |
| validation | Migração de Zod 3 para 4, preservando entradas aceitas, rejeições, normalizações e campos opcionais/nulos. |
| toolchain | Atualizar Vite, plugin React, TypeScript, Vitest, Playwright, Wrangler e tipos; adaptar configurações de APIs removidas. |
| test runtime | Remover `@cloudflare/vitest-pool-workers`, instalado mas não utilizado. Sua versão 0.22.0 exige Vitest ^4.1.0, incompatível com Vitest 5.0.3. Testar Workers através do Wrangler local, que já utiliza Miniflare, mantendo Vitest atual e evitando uma segunda versão do runner. |
| stored data | Nenhuma migração nova ou alteração de schema. Aplicar as migrações existentes somente em bases de teste locais descartáveis. |
| CI | Atualizar as ações externas de checkout/setup-node às versões estáveis verificadas e incluir as provas automatizadas nos dois ambientes. |

Inventário inicial das atualizações diretas identificadas pelo registro npm:

| Package | Installed | Target observed |
| --- | --- | --- |
| react / react-dom | 19.2.5 | 19.3.0 |
| @types/react | 19.2.14 | 19.3.0 |
| @types/react-dom | 19.2.3 | 19.3.0 |
| @vitejs/plugin-react | 5.2.0 | 6.1.1 |
| vite | 6.4.2 | 8.3.2 |
| typescript | 5.9.3 | 7.0.2 |
| vitest | 2.1.9 | 5.0.3 |
| @playwright/test | 1.59.1 | 1.63.0 |
| tailwindcss | 3.4.19 | 4.3.3 |
| tailwind-merge | 2.6.1 | 3.7.0 |
| zod | 3.25.76 | 4.6.5 |
| lucide-react | 0.468.0 | 1.50.0 |
| radix-ui | 1.4.3 | 1.6.7 |
| wrangler | 4.85.0 | 4.147.0 |
| @cloudflare/workers-types | 4.20260425.1 | 5.20261002.1 |
| @types/node | 22.19.17 | 26.6.4 |
| postcss | 8.5.10 | 8.5.28 se ainda necessário |
| autoprefixer | 10.5.0 | 10.6.1 se ainda necessário |

`class-variance-authority`, `clsx`, `qrcode` e `@types/qrcode` não aparecem como desatualizados no diagnóstico. Todas as versões serão consultadas novamente e registradas ao iniciar a implementação. Dependências transitivas serão atualizadas às versões compatíveis com os pacotes atuais; incompatibilidades não serão ocultadas por `--force` ou `--legacy-peer-deps`.

## Relations

None - nenhuma alteração da estrutura de dados armazenados ou de cardinalidades.

## Surface

None - nenhuma rota nova ou assinatura de contrato público alterada. As rotas existentes serão protegidas por critérios de regressão, sem redefinir seu comportamento.

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| Integração atual de Tailwind no build | `@tailwindcss/vite` na última versão estável compatível com `tailwindcss`, integrado a `vite.config.ts`; preservar tokens e variantes atuais no CSS | Continuar com `tailwindcss` como plugin PostCSS: a API de Tailwind 4 exige uma integração diferente; o plugin Vite é recomendado na documentação oficial. |
| Testes de Workers sem conflito entre runners | Vitest 5 + `wrangler dev --local` com dados temporários; remover `@cloudflare/vitest-pool-workers` de `devDependencies` | Instalar o pool 0.22.0 junto de Vitest 5 ou forçar os peers: viola sua faixa declarada. Fixar Vitest 4: não atende à atualização para a versão atual. |

Implementação da porta de testes: o Wrangler atual oferece `createTestHarness`, API recomendada para HTTP integrado. Ele executa os Workers localmente e compartilha D1/KV no mesmo runtime descartável; três processos locais abrindo o mesmo SQLite produziram contenção nos testes preliminares. Não há nova dependência ou alteração do contrato aprovado. [API oficial](https://developers.cloudflare.com/workers/wrangler/api/).

Nada mais nesta mudança exige uma decisão difícil de reverter. Se uma nova dependência ou contrato for necessário, registrar sua decisão antes de introduzi-lo.

## Criteria

### S1: Dependências atuais e instalação reproduzível (P1)

**Acceptance Criteria**

1. WHEN forem consultadas as versões durante a implementação THEN o projeto SHALL registrar e usar a última versão estável publicada de cada dependência direta mantida.
2. WHEN `npm ci` instalar o lockfile atualizado THEN o comando SHALL terminar com código 0 sem forçar conflitos de peer dependencies.
3. WHEN a árvore atualizada for inspecionada THEN o projeto SHALL apresentar zero dependências marcadas como inválidas por `npm ls`.
4. WHEN o npm audit consultar a árvore atualizada THEN o relatório SHALL apresentar zero vulnerabilidades altas e críticas; as demais ocorrências e eventuais correções indisponíveis serão documentadas.
5. WHEN a verificação de tipos executar THEN o comando SHALL terminar com código 0 para frontend, ferramentas e Workers.
6. WHEN o build de produção executar THEN o comando SHALL terminar com código 0 e gerar `dist/index.html` e seus assets.
7. WHEN ambos os Workers forem empacotados em dry-run THEN cada empacotamento SHALL terminar com código 0.

**Independent test:** instalação limpa a partir do lockfile, inspeção de versões e execução dos scripts de tipos, build, audit e dry-run.

### S2: Regras de links e persistência preservadas (P1)

**Acceptance Criteria**

8. WHEN uma URL HTTP/HTTPS ou um domínio sem protocolo for validado THEN a política SHALL retornar a URL normalizada, mantendo os exemplos aceitos da base.
9. IF o destino for autorreferente ou estiver bloqueado THEN a política SHALL rejeitá-lo com o código de erro correspondente da base.
10. IF um alias estiver fora dos limites de 2–48 caracteres ou contiver caracteres inválidos THEN a validação SHALL rejeitá-lo.
11. IF um alias for reservado ou já estiver ocupado THEN o serviço SHALL rejeitar sua criação com `ALIAS_RESERVED` ou `ALIAS_TAKEN`, respectivamente.
12. WHEN forem validadas opções de link THEN os schemas SHALL preservar os limites de senha 4–128, tags até 10, países até 20, lotes de 1–100 ids e inteiros positivos até 1000000, bem como ausência e null nos campos que hoje os permitem.
13. WHEN um proprietário criar, editar, desativar, reativar ou excluir um link THEN a leitura seguinte SHALL refletir a operação nos dados e no cache local conforme o contrato existente.
14. IF outro usuário tentar editar ou excluir o link sem privilégio administrativo THEN o serviço SHALL impedir a alteração e manter os dados do proprietário.

**Independent test:** fixtures de contratos existentes, testes de políticas/schemas/serviços e testes com D1/KV locais reais; sem usar recursos remotos.

### S3: API, sessão e redirecionamento preservados (P1)

**Acceptance Criteria**

15. WHEN os endpoints de saúde e sessão sem cookie forem consultados THEN a API SHALL retornar HTTP 200 com `ok: true` na saúde e `session: null` na sessão.
16. IF uma requisição privada não tiver sessão válida THEN a API SHALL retornar HTTP 401 com `error: "UNAUTHENTICATED"`.
17. IF um usuário comum acessar uma rota administrativa ou um usuário bloqueado acessar uma rota privada THEN a API SHALL retornar HTTP 403 com `FORBIDDEN` ou `USER_BLOCKED`, respectivamente.
18. WHEN um link ativo sem restrições for acessado THEN o redirect Worker SHALL responder com o código 301 ou 302 configurado e o cabeçalho Location igual à URL persistida, registrando um clique.

**Independent test:** requisições HTTP aos dois Workers locais, fixtures de sessão em D1 e dados de links isolados por teste.

### S4: Interface e jornadas preservadas (P1)

**Acceptance Criteria**

19. WHEN a suíte de layout original executar em desktop 1440×1100 e mobile Pixel 5 THEN todos os seus testes SHALL passar mantendo as tolerâncias originais de 1px, sem skips ou enfraquecimento.
20. WHEN as telas pública, login, Links, Analytics, Admin, Auditoria e Status forem abertas THEN o frontend SHALL apresentar seus elementos centrais sem overflow horizontal global acima de 1px em desktop e mobile.
21. WHEN o tema for alternado e a página recarregada THEN o frontend SHALL conservar a preferência escolhida.
22. WHEN um link for criado e editado pela interface THEN a listagem SHALL exibir os valores enviados e a ação de exclusão confirmada SHALL remover o link da listagem.
23. WHEN uma ação em lote ou exportação CSV for executada pela interface THEN o resultado SHALL corresponder aos ids selecionados.
24. WHILE uma listagem estiver vazia ou carregando THEN a interface SHALL apresentar o estado correspondente existente sem perder a navegação.
25. IF a API responder com erro ou ficar indisponível durante uma operação de link THEN a interface SHALL apresentar a mensagem de falha existente e permitir uma nova tentativa.
26. WHEN o QR Code for aberto THEN a interface SHALL exibir uma imagem codificando a URL pública do link selecionado.

**Independent test:** Playwright com estados controlados de API e banco local; capturas antes/depois das telas e estados críticos, comparadas pelo verificador. A suíte em mock continua útil para layout, mas não será a única prova de operações persistidas.

### S5: Proteções e execução contínua (P1)

**Acceptance Criteria**

27. IF um link estiver desativado, bloqueado, expirado, fora da região permitida, além do limite de cliques ou protegido sem autorização válida THEN a resolução SHALL retornar o estado de bloqueio/senha existente, sem fornecer um redirecionamento utilizável.
28. WHEN os workflows de staging e produção validarem uma revisão THEN todos os testes Vitest e Playwright SHALL ser executados como condições anteriores às etapas existentes de publicação.

**Independent test:** casos parametrizados de resolução, sessão/senha e falhas locais, mais inspeção dos dois workflows e execução local das mesmas provas.

## Out of scope

| Excluded | Why |
| --- | --- |
| Novas funções do produto, redesenho ou alteração deliberada dos contratos | O objetivo é atualização sem regressão. |
| Mudança de provedor de hosting, banco ou autenticação | Não é necessária à atualização das dependências. |
| Migrações novas de dados e mudanças de domínio/recursos Cloudflare | Preservar a aplicação existente e seus dados. |
| Corrigir defeitos preexistentes alheios à atualização | Registrar os achados; se impedirem uma obrigação, apresentar a evidência e resolver o escopo antes de alterar o comportamento. |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Perfil da skill | `standard`, orçamento 150k; aprovado pelo usuário em 02/10/2026 | O padrão do projeto é light por ausência de declaração; a atualização ampla pede cobertura recomputada e falhas injetadas além da execução de provas. |
| Significado de últimas versões | Últimas versões estáveis; registrar a versão e a data da consulta e justificar pacotes removidos por substituição ou desuso | Não adicionar diretamente versões alpha/beta apenas porque um dist-tag aponta para elas. |
| Dependências transitivas | Últimas versões permitidas pela árvore nova; overrides somente com evidência de compatibilidade e testes | Forçar toda dependência transitiva a um major arbitrário pode quebrar o pacote que a consome. |
| Runtime Node | Preservar inicialmente a linha 24 já usada localmente e no CI, verificando engines dos pacotes | Atualizar o Node global da máquina não faz parte da manutenção do repositório. |
| Browsers | Validar Chromium desktop/mobile; registrar limites de compatibilidade da migração Tailwind 4 | O projeto não declara browsers legados; Tailwind 4 requer Safari 16.4+, Chrome 111+ e Firefox 128+. |
| Serviços externos | Simular Google/GitHub, Turnstile e falhas externas em testes; usar somente D1/KV locais para mutações | As provas locais não representam login real de produção nem estado dos serviços externos. |
| Publicação | Entrega local com commits Conventional Commits em português; push e deploy aguardam pedido explícito | A skill autoriza commits locais após aprovação e exige autorização específica para publicação. |
| Playwright persistente | Manter testes reutilizáveis no repositório; scripts descartáveis da skill ficam em `/tmp` | O usuário pediu testes automatizados para o projeto; esse pedido prevalece sobre a regra de scripts temporários da skill. |
| Revisões independentes | Verificador novo de capacidade intermediária/alta e uma checagem mecânica separada com modelo econômico | Pedido explícito do usuário; o verificador obrigatório não será o autor e contabilizará todas as obrigações. |

**Open questions:** none - decisões técnicas têm defaults acima. A revisão humana do plano e do perfil proposto precede a derivação dos checks e a implementação, conforme a skill explicitamente invocada.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| Telas pública/login/dashboard/status | Conteúdo central e arranjo desktop/mobile | AC 19–20; comparação de capturas na revisão independente. |
| Listagem de links | Estados vazio/carregando | AC 24 |
| Criação/edição de links | Falha de API e recuperação | AC 25 |
| Dashboard sem sessão | Estado não autorizado | AC 20, 16 |
| Listagens e menus | Densidade, ordem e viewport | AC 19–20; existing - preservar filtros e ordenação atuais. |
| Exclusão e ações em lote | Confirmação de operação destrutiva | AC 22–23; existing - preservar os diálogos atuais. |
| API privada/admin | Resposta, formato de erro e autorização | AC 15–17 |
| Resolver público/redirect Worker | Status, Location e restrições | AC 18, 27 |
| API existente | Versionamento e rate limits | n/a - nenhuma rota ou política nova; preservar o contrato atual. |
| Comandos npm | Saída, flags, defaults e falhas | AC 2–7, 28; existing - manter códigos de saída e falha interrompendo CI. |
| README | Comandos atuais de instalar/testar/buildar | existing - atualizar a documentação para reproduzir as provas incluídas. |
| Coleções organizadas | Critério de agrupamento, nomes, duplicados e exceções | n/a - nenhuma reorganização de coleção nesta atualização. |

As nove dimensões foram percorridas para a derivação posterior: validação/limites (AC 8–12); falha/parcial (AC 25 e falhas simuladas de persistência); idempotência/duplicatas (AC 11); autorização (AC 14, 16–17); concorrência/ordenação (limite de cliques em AC 27, operações simultâneas locais); ciclo dos dados (AC 13, 27, migrações locais existentes); dependências externas (AC 25, simulações sem chamadas de produção); transições (AC 13, 22–23); observabilidade (AC 18, clique persistido e captura de erros de browser/testes). Cada dimensão receberá seu destino individual em `checks.md`, sem inventar uma nova política do produto.

## Sources

- Pedido do usuário nesta conversa: versões atuais, Vitest/Playwright, validação independente e preservação do funcionamento.
- `README.md`, `docs/napkin.md`, contratos e suítes existentes no commit `ad2de29`: comportamento e convenções da aplicação.
- Registro npm consultado em 02/10/2026: versões, engines e peer dependencies; diagnóstico completo de audit salvo em `/tmp/prawurl-audit-before.json` durante o levantamento.
- [Guia oficial de migração Tailwind](https://tailwindcss.com/docs/upgrade-guide), [migração Vite](https://vite.dev/guide/migration), [migração Vitest](https://vitest.dev/guide/migration/) e [migração Zod](https://zod.dev/v4/changelog): requisitos de adaptação.
- [Documentação Cloudflare sobre Miniflare](https://developers.cloudflare.com/workers/testing/miniflare/): runtime local para provas com bindings.
