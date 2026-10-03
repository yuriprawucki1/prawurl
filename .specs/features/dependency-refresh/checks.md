# Atualização de dependências — checks

Profile: standard
Plan: `.specs/features/dependency-refresh/plan.md`
Author: root
Base: `ad2de29`
Approved: usuário respondeu “ok” ao plano e perfil standard em 02/10/2026.

28 checks em 5 slices · 2 one-way doors · 0 questões abertas.

## Checks

### S1 - Instalação, segurança e ferramentas

**C1** - Cada dependência direta mantida usa a versão estável registrada na consulta npm; o pool Cloudflare não utilizado foi substituído por Wrangler local, e o CSS usa o plugin Vite de Tailwind 4 (AC 1; Landing 1–2).
Proof: `node scripts/check-dependencies.mjs`

**C2** - O lockfile pode ser instalado com `npm ci`, código 0, sem force/legacy-peer-deps (AC 2).
Proof: `npm ci`

**C3** - A árvore instalada não tem dependências inválidas, código 0 (AC 3).
Proof: `npm ls --all`

**C4** - O audit tem zero vulnerabilidades high/critical e registra o total restante (AC 4).
Proof: `npm audit --audit-level=high`

**C5** - A compilação de tipos do frontend, tooling e Workers termina com código 0 (AC 5).
Proof: `npm run lint`

**C6** - O build termina com código 0 e produz index.html e assets (AC 6).
Proof: `npm run build`
Proof: `npm test -- src/tooling/toolchain.test.ts -t 'production assets exist'`

**C7** - Os bundles locais da API e redirect são gerados em dry-run com código 0 (AC 7).
Proof: `npm run build:workers`

### S2 - Validação e serviços

**C8** - HTTP, HTTPS e domínio sem protocolo retornam as URLs normalizadas esperadas (AC 8).
Proof: `npm test -- src/shared/validation.test.ts -t 'normalizes destination'`

**C9** - Destinos próprios/subdomínios e domínios bloqueados retornam os erros da base (AC 9).
Proof: `npm test -- src/domain/policies.test.ts -t 'rejects forbidden destinations'`

**C10** - Alias aceita limites 2/48 e rejeita 1/49 e caracteres fora da expressão atual (AC 10).
Proof: `npm test -- src/shared/validation.test.ts -t 'alias boundaries'`

**C11** - Alias reservado retorna ALIAS_RESERVED; criação duplicada retorna ALIAS_TAKEN (AC 11).
Proof: `npm test -- src/domain/policies.test.ts -t 'reserved aliases'`
Proof: `npm test -- src/application/link-service.test.ts -t 'duplicate alias'`
Proof: `npm test -- src/workers/workers.integration.test.ts -t 'duplicate alias returns 409'`

**C12** - Os schemas mantêm limites de senha, tags, países, lotes e inteiros, normalização de países e semântica omitido/null (AC 12).
Proof: `npm test -- src/shared/validation.test.ts -t 'option boundaries|optional and nullable'`

**C13** - CRUD e desativar/reativar persistem valores e atualizam/invalida o cache segundo o contrato (AC 13).
Proof: `npm test -- src/application/link-service.test.ts -t 'cache lifecycle'`
Proof: `npm test -- src/workers/workers.integration.test.ts -t 'persists CRUD and cache lifecycle'`

**C14** - Outro proprietário não consegue editar/excluir nem altera os dados do link (AC 14).
Proof: `npm test -- src/application/link-service.test.ts -t 'ownership guards'`
Proof: `npm test -- src/workers/workers.integration.test.ts -t 'ownership guards preserve data'`

### S3 - Limites HTTP reais

**C15** - Saúde e sessão anônima retornam 200 com ok:true e session:null (AC 15).
Proof: `npm test -- src/workers/workers.integration.test.ts -t 'health and anonymous session'`

**C16** - Sessão ausente/expirada/revogada retorna 401 UNAUTHENTICATED em rota privada (AC 16).
Proof: `npm test -- src/workers/workers.integration.test.ts -t 'unauthenticated requests return 401'`

**C17** - Admin com usuário comum retorna 403 FORBIDDEN; rota privada com bloqueado retorna 403 USER_BLOCKED (AC 17).
Proof: `npm test -- src/domain/policies.test.ts -t 'admin and active guards'`
Proof: `npm test -- src/workers/workers.integration.test.ts -t 'authorization returns 403'`

**C18** - Links simples devolvem 301/302 e Location exatos, com um clique persistido por acesso (AC 18).
Proof: `npm test -- src/workers/workers.integration.test.ts -t 'redirect codes and persisted clicks'`

### S4 - Navegador desktop e mobile

**C19** - A especificação original de layout passa nos dois projetos sem modificar suas tolerâncias (AC 19).
Proof: `npm run test:visual -- tests/layout.spec.ts -g 'estados principais permanecem alinhados em desktop e mobile'`

**C20** - As sete telas nomeadas no plano têm seus elementos centrais visíveis e overflow horizontal <= 1px (AC 20).
Proof: `npm run test:e2e -- -g 'screens and responsive bounds'`
Proof: `npm run test:visual -- tests/layout.spec.ts -g 'estados principais permanecem alinhados em desktop e mobile'`

**C21** - Alternar o tema e recarregar preserva a preferência (AC 21).
Proof: `npm run test:e2e -- -g 'theme persists after reload'`

**C22** - CRUD no navegador altera a listagem e o banco local, com confirmação de exclusão (AC 22).
Proof: `npm run test:e2e -- -g 'creates edits and deletes persisted links'`

**C23** - Desativar/reativar em lote e CSV correspondem somente aos ids selecionados (AC 23).
Proof: `npm run test:e2e -- -g 'bulk actions and CSV selection'`

**C24** - Listagem vazia e carregamento apresentam o estado existente com navegação disponível (AC 24).
Proof: `npm run test:e2e -- -g 'empty and loading states'`

**C25** - Erro HTTP e falha de conexão em operação de link apresentam mensagem e permitem nova tentativa (AC 25).
Proof: `npm run test:e2e -- -g 'operation failures allow retry'`
Proof: `npm test -- src/application/link-service.test.ts -t 'persistence failure propagates'`

**C26** - QR Code é imagem válida que codifica a URL pública do link selecionado (AC 26).
Proof: `npm run test:e2e -- -g 'QR encodes selected public URL'`

### S5 - Proteções e CI

**C27** - Resolução preserva bloqueio/senha para disabled, blocked, expirado, inatividade, allowlist, blocklist, limite e autorização inválida; pedidos concorrentes respeitam o limite (AC 27).
Proof: `npm test -- src/application/redirect-service.test.ts -t 'access decisions|unlock authorization'`
Proof: `npm test -- src/workers/workers.integration.test.ts -t 'public restrictions|concurrent click limit|password unlock'`

**C28** - Ambos os workflows executam Vitest/Playwright antes de qualquer publicação (AC 28).
Proof: `npm test -- src/tooling/toolchain.test.ts -t 'CI gates precede deployment'`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| Dependências diretas mantidas (22) | C1, table-driven sobre todas as 22 entradas do manifest e snapshot npm; removidas documentadas | - |
| Landing (2) | Tailwind plugin C1 · Wrangler runtime sem pool C1 | - |
| Tooling assemblies (4) | frontend C5 C6 · Vitest C5 · Playwright C5 C19 C22 · Workers C5 C7 C15 | - |
| URL normalizada (3) | http C8 · https C8 · bare-domain C8 | - |
| URL proibida (3) | próprio C9 · subdomínio C9 · bloqueado C9 | - |
| Alias (7) | 1 C10 · 2 C10 · 48 C10 · 49 C10 · charset C10 · reservado C11 · duplicado C11 | - |
| Limites de opções (6) | senha C12 · tags C12 · países C12 · ids C12 · inteiros C12 · omitido-null C12 | - |
| Transições de link (5) | create C13 C22 · update C13 C22 · deactivate C13 C23 · reactivate C13 C23 · delete C13 C22 | - |
| Saúde/sessão (2) | saúde200 C15 · sessão200null C15 | - |
| Auth ausente/inválida (3) | sem-cookie C16 · expirada C16 · revogada C16 | - |
| Autorização (3) | proprietário C14 · não-admin403 C17 · bloqueado403 C17 | - |
| Redirect HTTP (2) | 301 C18 · 302 C18 | - |
| Telas (7) | pública C20 · login C20 · Links C20 · Analytics C20 · Admin C19 C20 · Auditoria C19 C20 · Status C20 | - |
| Viewports (2) | desktop C19 C20 · mobile C19 C20 | - |
| Estados de listagem/operação (4) | vazio C24 · carregando C24 · erro-http C25 · conexão C25 | - |
| Restrições (8) | disabled C27 · blocked C27 · expirado C27 · inatividade C27 · allowlist C27 · blocklist C27 · limite C27 · senha C27 | - |
| Unlock inválido (4) | senha-incorreta C27 · assinatura C27 · expiração C27 · versão C27 | - |
| Workflows (2) | staging C28 · produção C28 | - |

Surface e Relations: nenhuma assinatura ou estrutura nova, conforme o plano. Claims HTTP C11, C14–18, C27 são afirmadas no limite HTTP além das provas próprias das políticas/serviços que decidem os resultados.

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Schemas e políticas de entrada/autorização | Vitest no próprio nível | As bordas e alternativas enumeradas em C8–12 e C17, incluindo ausência/null e normalização. |
| Serviços que decidem CRUD/cache e acesso | Vitest no próprio nível e no limite HTTP | Cada transição de C13–14 e cada estado/restrição de C27 no serviço; persistência e status/contratos no Worker real. |
| Jornadas e componentes que dependem das bibliotecas atualizadas | Playwright no limite da interface | Cada tela/viewport e estado enumerado em C19–26; CRUD e lote também observados no banco local. |
| Configurações e pass-throughs de infraestrutura | Provas dos consumidores e comandos reais | Instalação, compilação, bundles e HTTP com D1/KV locais; não repetir o framework em testes espelhados. |

Evidence: `validation.ts` contém 6 grupos de limites enumerados; `alias-policy.ts` decide reservado/formato e `url-policy.ts` decide protocolo/autorref/bloqueio; `admin-policy.ts` tem 2 guards. `link-service.ts` decide 5 operações e 2 guards de propriedade; `redirect-service.ts` tem os 8 grupos de restrição e 4 autorizações inválidas acima. Analogia existente: `url-policy.test.ts` e `alias-policy.test.ts` já testam políticas no próprio nível. Os testes novos ampliam esse padrão e adicionam provas HTTP/navegador. Cost: aproximadamente 60 casos parametrizados mais jornadas em 2 viewports, sem impor normas novas ao restante do repositório.

## Swept

- validation: C8–12
- failure modes: C25; não alegar rollback atômico que o projeto não implementa
- idempotency: C11; impedir duplicidade de alias, sem introduzir chave de idempotência nova
- authorization: C14 C16 C17
- concurrency: C27; cliques concorrentes no mesmo link com limite
- data lifecycle: C13 C22 C27; fixtures descartáveis e migrações existentes aplicadas localmente
- dependency failure: C25; respostas externas controladas, sem acesso aos dados de produção
- state transitions: C13 C23 C27
- observability: C18; clique persistido e capturas/erros de navegador anexados às provas

## Handoff

Uma implementação por root. Arquivos existentes potencialmente modificados medidos com `wc -c`: 497985 bytes (manifest/lockfile, configs, CSS, componentes, view, crypto, workflows e README). Reservar 65000 bytes para novos testes/helpers/scripts: (497985 + 65000) / 4 = 140747 tokens, abaixo do orçamento 150000. Tipos gerados, já com ~1 MB, não precisam ser regenerados porque os bindings/configs permanecem os mesmos. Um builder, sem divisão de implementação. Revisões independentes depois do último commit.

Status do autor: C1–C28 com provas locais verdes. `npm ci`, árvore, audit, tipos, build e dry-run passaram; 69 casos Vitest, 14 jornadas E2E e os 2 projetos da suíte original passaram. Depois dos últimos refinamentos, repetidos os 69 casos, os 2 layouts e os 2 casos de lote modificados. O Verifier executará todas as provas novamente no HEAD final. Provas agrupadas mostram todos os testes nomeados; filtros individuais permanecem disponíveis.

Notas de harness: seletores dos testes novos distinguem as versões mobile/desktop ocultas; QR compara os módulos efetivamente desenhados, não os bytes de compressão PNG. Workers usam `createTestHarness` para compartilhar D1/KV no mesmo runtime, evitando abertura concorrente do SQLite por três processos. Nenhuma asserção da suíte original foi editada, reduzida ou desabilitada. Um ensaio E2E foi invalidado por recarregamento do Vite durante edição de package.json e repetido com arquivos estáveis.

Evidência detalhada do autor: `evidence.md`. O encerramento depende de `verification.md` independente e do completion gate, ainda pendentes.
