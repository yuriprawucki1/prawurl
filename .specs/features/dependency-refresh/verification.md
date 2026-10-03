# Atualização de dependências — verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: ad2de29..8b6c8b8ae60209c2759d719158b41b3f40d05782
**Round**: 2 - scoped
**Verifier**: independent sub-agent `/root/verifier` (author `root` != verifier)

Verified at `8b6c8b8ae60209c2759d719158b41b3f40d05782`. Fix diff: `e6c444b6f66eb166de3b5e536e835a820c3b52b5..8b6c8b8ae60209c2759d719158b41b3f40d05782`; a faixa acima continua sendo a feature inteira. Todas as provas foram reexecutadas neste HEAD, sem confiar em evidência do autor. **28/28 checks provados; 75 Vitest, 2 layouts, 14 E2E; 2 faults nesta rodada, ambos killed; zero gaps pendentes.**

O escopo independente foi o diff de validação/CSS/jornada e todos os verdicts não PASS da rodada 1. C12, o refinamento de tags update, sua Test policy e F1 foram reavaliados. A remoção do reset CSS universal fora de layer cria uma superfície adicional: preenchimento e borda do checkbox selecionado, contra o token primary do contrato da base. A nova assertion foi feita falhar no scratch. Claims e Test policy aprovados permanecem iguais. Seções/linhas não afetadas abaixo identificam explicitamente o resultado anterior carried from `e6c444b6f66eb166de3b5e536e835a820c3b52b5`, arquivado em `verification-round-1.md`; **nenhuma execução de prova foi carregada**.

## Gaps resolved

C12 agora parametriza create e update separadamente em `src/shared/validation.test.ts:20`–`:33`, incluindo o valor 11 inválido para tags em ambos. O mutante update max11 falhou em `:33`, enquanto antes passava. O non-PASS de schemas e o membro sem prova do Coverage foram resolvidos com evidência própria. Não há ranked gap aberto.

## Sources opened

Carried from `e6c444b6f66eb166de3b5e536e835a820c3b52b5`: fontes e comparações de contratos/migrações não alterados. Verified at `8b6c8b8ae60209c2759d719158b41b3f40d05782`: diff inteiro e fix diff abertos, `plan.md`/`checks.md`/`verify.md`, testes modificados, schema de autoridade e CSS relidos; checkbox da base aberto para confirmar `data-[state=checked]:border-primary` e `bg-primary`.

Perfil standard: não há uma etapa de auditoria integral de design `ui`. A comparação antes/depois exigida por AC19–20 foi executada e está registrada abaixo.

| Source | Leitura própria e uso |
| --- | --- |
| `plan.md`, `checks.md`, `references/verify.md` | Lidos integralmente; 28 checks, 18 sets aprovadas, 4 Test policy rows, perfil standard. |
| `README.md`, `docs/napkin.md` em `ad2de29` e HEAD | Lidos por `git show` e leitura local; rotas públicas/app/status, mock para layout, Radix existente, convenções desktop/mobile e comandos npm. |
| Contratos/suítes da base | `git show ad2de29:src/shared/validation.ts`, testes de alias/URL; `src/shared/contracts.ts` e políticas/serviços atuais, inalterados nos contratos. Autoridade de limites e comportamentos preservados. |
| Snapshot npm e registro | Snapshot lido; consulta própria `npm view <package> dist-tags.latest` para cada uma das 22 entradas. Todas coincidem; resultado em `/tmp/prawurl-verifier-registry.json`. |
| [Tailwind upgrade guide](https://tailwindcss.com/docs/upgrade-guide) | Aberto: plugin Vite, import CSS, remoção autoprefixer e compatibilidade de browsers; a integração do HEAD corresponde ao guia. |
| [Vite migration](https://vite.dev/guide/migration) | Aberto: migração para Rolldown; configuração real em `vite.config.ts:9`. |
| [Vitest migration](https://vitest.dev/guide/migration/) | Aberto: guia 5.0 e entrypoints; testes usam `vitest`, runtime local independente do pool antigo. |
| [Zod migration](https://zod.dev/v4/changelog) | Aberto: inteiros seguros e mudanças de API; intervalo aprovado 1–1000000 fica dentro do intervalo seguro. |
| [Wrangler API](https://developers.cloudflare.com/workers/wrangler/api/) | Aberto: `createTestHarness` suporta testes de integração com vários Workers a partir das configurações; montagem local corresponde à API. |

## Proof executions

Verified at `8b6c8b8ae60209c2759d719158b41b3f40d05782`. Todas as execuções principais ocorreram no checkout real em HEAD, com fontes estáveis. Navegadores headed e suítes de navegador sequenciais. Build executado antes de Vitest. Nenhum force/legacy-peer-deps, skip de teste, alteração de tolerância, segredo real, push ou deploy.

| Comando executado | Exit / contagem | Evidência própria |
| --- | --- | --- |
| `npm ci --cache /tmp/prawurl-verifier-npm-cache` | 0; 207 pacotes instalados, audit 208 | `/tmp/prawurl-verifier-r2-ci.log`; npm bloqueou scripts opcionais de instalação de esbuild/fsevents/workerd por sua política allowScripts. Bundles e runtime posteriormente funcionaram. |
| `npm ls --all` | 0; nenhuma dependência invalid | `/tmp/prawurl-verifier-r2-ls.log`; UNMET OPTIONAL das plataformas ausentes é opcional, sem invalid/peer error. |
| `npm audit --audit-level=high` | 0; zero vulnerabilidades totais, portanto high=0/critical=0 | `/tmp/prawurl-verifier-r2-audit.log` |
| `node scripts/check-dependencies.mjs` | 0; 22 versões correspondentes | Saída própria `PASS: all 22 maintained direct dependencies match the registry snapshot (2026-10-02)` |
| `npm run lint` | 0 | `tsc -b --noEmit` sobre as 4 referências de `tsconfig.json` |
| `npm run build` | 0; index.html, CSS e JS produzidos | `/tmp/prawurl-verifier-r2-build.log`; Vite 8.3.2, 2148 módulos, 5 assets JS/CSS listados |
| `npm test -- --reporter=verbose` | 0; 9 arquivos, 75 testes passed, 0 failed, 0 skipped | `/tmp/prawurl-verifier-r2-vitest.log`; cada caso aparece individualmente |
| `npm run build:workers` | 0; API e redirect dry-run | `/tmp/prawurl-verifier-r2-bundles.log`; dois `--dry-run: exiting now`, nenhum upload real |
| `npm run test:visual` | 0; 2 passed, 0 failed, 0 skipped | `/tmp/prawurl-verifier-r2-layout.log`; original desktop/mobile |
| `npm run test:e2e` | 0; 14 passed, 0 failed, 0 skipped | `/tmp/prawurl-verifier-r2-e2e.log`; 7 jornadas × 2 projetos |

### Named tests: existence and execution

Verified at `8b6c8b8ae60209c2759d719158b41b3f40d05782`: nomes presentes individualmente nos logs completos; busca novamente nos dois arquivos tocados. Localizações/declaracões dos arquivos intocados carried from `e6c444b6f66eb166de3b5e536e835a820c3b52b5`. Uma pesquisa `rg -n -A 10 -B 2` por declarações/assertions foi feita por arquivo. Todos os nomes abaixo aparecem tanto nas declarações citadas quanto na saída da execução completa. Os novos arquivos de prova abaixo estão no diff; a exceção intencional é a suíte original de layout, exigida por C19. Não foi usada correspondência vazia para provar check algum.

| Check | Nome encontrado e rodado | Declaração / casos executados |
| --- | --- | --- |
| C6 C28 | `production assets exist`; `CI gates precede deployment deploy.yml`, `deploy-staging.yml` | `src/tooling/toolchain.test.ts:5`, `:15`; 3 passed |
| C8 C10 C12 | `normalizes destination` ×3; `alias boundaries`; `create options > option boundaries` e `update options > option boundaries`, cada um password/tags/countryAllowlist/countryBlocklist/clickLimit/inactiveExpiresAfterMinutes; `option boundaries batch ids and redirect codes`; `optional and nullable contracts` | `src/shared/validation.test.ts:9`, `:13`, `:20`–`:31`, `:37`, `:50`; 18 passed (6×2 schemas +6 outros) |
| C9 C11 C17 | `rejects forbidden destinations`; `reserved aliases`; `admin and active guards` | `src/domain/policies.test.ts:9`, `:18`, `:25`; 3 passed |
| C11 C13 C14 C25 | `duplicate alias`; `cache lifecycle`; `cache lifecycle restricted` ×6; `ownership guards`; `persistence failure propagates` | `src/application/link-service.test.ts:26`, `:34`, `:59`, `:67`, `:78`; 10 passed |
| C27 | `access decisions` active/disabled/blocked/expired/inactivity/inactivity-bound/allowlist/allowlist-accepted/blocklist/blocklist-accepted/click-limit/click-below-limit/password; `access decisions missing country and missing link`; `access decisions concurrent quota rejection and stale cache`; `unlock authorization` | `src/application/redirect-service.test.ts:34`, `:42`, `:50`, `:60`; 16 passed |
| C11 C13–18 C27 | `health and anonymous session`; `unauthenticated requests return 401`; `authorization returns 403`; `duplicate alias returns 409`; `persists CRUD and cache lifecycle`; `ownership guards preserve data`; `redirect codes and persisted clicks 301`, `302`; `public restrictions`; `concurrent click limit`; `password unlock` | `src/workers/workers.integration.test.ts:23`, `:32`, `:40`, `:49`, `:60`, `:79`, `:89`, `:98`, `:124`, `:132`; 11 passed |
| C19 C20 | `estados principais permanecem alinhados em desktop e mobile` em desktop e mobile | `tests/layout.spec.ts:60`; 2 passed; diff deste arquivo = vazio |
| C20–26 | `screens and responsive bounds`; `theme persists after reload`; `creates edits and deletes persisted links`; `bulk actions and CSV selection`; `empty and loading states`; `operation failures allow retry`; `QR encodes selected public URL` | `tests/e2e/journeys.spec.ts:29`, `:54`, `:63`, `:83`, `:125`, `:141`, `:160`; cada nome rodou uma vez desktop e uma mobile =14 passed |

Os 14 testes Vitest restantes também rodaram: 4 políticas da base e 10 casos de OAuth/Turnstile (`external-services.test.ts`). Somados aos 61 acima =75. Serviços externos continuam simulados; essas provas não certificam disponibilidade/login real dos provedores.

## Checks

Verified at `8b6c8b8ae60209c2759d719158b41b3f40d05782`: resultados de todas as linhas. Julgamento de assertions dos arquivos intocados carried from `e6c444b6f66eb166de3b5e536e835a820c3b52b5`; citações/assertions dos arquivos tocados foram relidas e atualizadas. `V` = execução própria `npm test -- --reporter=verbose` (75 passed); `L` = `npm run test:visual` (2 passed); `E` = `npm run test:e2e` (14 passed). As declarações/nome dos testes estão na tabela anterior; cada linha contém uma assertion ou configuração localizada que fundamenta sua conclusão.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | 22 diretas estáveis, portas Tailwind/Workers | checker exit 0 neste HEAD + consulta registro 22/22 carried from e6c444b6f66eb166de3b5e536e835a820c3b52b5 | `scripts/check-dependencies.mjs:13` — ``assert.equal(direct[name], `^${expected.version}`, `${name}: manifest differs from registry snapshot`)``; `:14` versão do lock; `:16` removidos ausentes; `vite.config.ts:6` — `plugins: [react(), tailwindcss()]`; `tests/helpers/local-workers.mjs:36` monta os 2 Workers via harness | PASS |
| C2 | instalação reproduzível sem flags de contorno | npm ci exit 0 | `package-lock.json:4` — lockfileVersion 3; `package.json:33` e `:44` manifest; comando real `npm ci --cache ...`, sem force/legacy peers | PASS |
| C3 | árvore sem invalid | npm ls --all exit 0 | `package.json:33`/`:44` são as 22 dependências inspecionadas; inspeção completa da árvore instalada em `/tmp/prawurl-verifier-r2-ls.log`, sem invalid | PASS |
| C4 | zero high/critical, restante registrado | audit exit 0 | `package-lock.json:4` fundamenta árvore auditada; `/tmp/prawurl-verifier-r2-audit.log` — `found 0 vulnerabilities`, total=0 | PASS |
| C5 | tipos frontend/tooling/Workers | lint exit 0 | `package.json:11` — `tsc -b --noEmit`; `tsconfig.json:3` referências app/worker/node/test; `tsconfig.node.json:16` inclui ambas configs Playwright e Vite/Vitest | PASS |
| C6 | build e assets existentes | build exit 0; V | `package.json:9` — `tsc -b && vite build`; `src/tooling/toolchain.test.ts:6` — `expect(existsSync("dist/index.html")).toBe(true)`; `:10` cada asset referenciado existe | PASS |
| C7 | dois bundles dry-run | build:workers exit 0 | `package.json:30` — duas chamadas Wrangler `deploy --dry-run --env ""`, configs API/redirect; `wrangler.api.jsonc:5` e `wrangler.redirect.jsonc:5` apontam os entrypoints reais | PASS |
| C8 | HTTP/HTTPS/domínio normalizados | V | `src/shared/validation.test.ts:10` — `expect(destinationUrlSchema.parse(input)).toBe(expected)`; tabela `:6`–`:8` explicita as 3 URLs esperadas no mesmo arquivo | PASS |
| C9 | próprio/subdomínio/bloqueado rejeitados | V | `src/domain/policies.test.ts:13` — `rejects.toThrow("DESTINATION_SELF_REFERENTIAL")`; `:14` — `rejects.toThrow("DESTINATION_BLOCKED")` | PASS |
| C10 | alias bordas 1/2/48/49 e charset | V | `src/shared/validation.test.ts:14` — valid 2/48/charset aceito `.success.toBe(true)`; `:16` — 1/49 e inválidos `.success.toBe(false)` | PASS |
| C11 | reservado/duplicado códigos exatos | V | `src/domain/policies.test.ts:21` — `rejects.toThrow("ALIAS_RESERVED")`; `src/application/link-service.test.ts:29` — `ALIAS_TAKEN`; `src/workers/workers.integration.test.ts:52`/`:53` — 409 e `{error:"ALIAS_TAKEN"}`; `:55`/`:56` reservado 409 | PASS |
| C12 | limites/normalização/omitido/null dos schemas | V; F1 killed | `src/shared/validation.test.ts:33` — `expect(schema.safeParse({ ...base, [field]: value }).success).toBe(false)`, valid values `.toBe(true)` em `:32`; schemas create/update no mesmo arquivo `:21`/`:22`; `:40` ids inválidos rejeitados; `:45` password trimmed/país PT ambos; `:47` BR; `:51`/`:52` omitido; `:54`/`:55` null permitido ambos, title null `:57`; `:61` null rejeitado nos 6 campos ambos. Fault max11 morreu em `:33`. | PASS |
| C13 | 5 transições e cache/persistência | V | `src/application/link-service.test.ts:37` cache create, `:41` update, `:45` delete cache disabled, `:49` reactivate, `:52` delete; `src/workers/workers.integration.test.ts:62` destino D1 exato, `:71` disabled no D1, `:75` exclusão null; polls `:63`, `:67`, `:70`, `:73`, `:76` KV | PASS |
| C14 | propriedade bloqueia edit/delete sem efeitos | V | `src/application/link-service.test.ts:70`/`:71` — ambos `LINK_NOT_FOUND`; `src/workers/workers.integration.test.ts:83` — 404 para PATCH/DELETE; `:86` destino original ainda `https://example.com/first` | PASS |
| C15 | saúde/sessão anônima 200 e shape | V | `src/workers/workers.integration.test.ts:25` — 200; `:26` `{ok:true,service:"prawurl-api"}`; `:28` — 200; `:29` — `toEqual({session:null})` | PASS |
| C16 | cookie ausente/expirado/revogado 401 | V | `src/workers/workers.integration.test.ts:33` lista os 3 tokens; `:35` — `expect(response.status).toBe(401)`; `:36` — `{error:"UNAUTHENTICATED"}` | PASS |
| C17 | não-admin/bloqueado 403 e código | V | `src/domain/policies.test.ts:27`/`:29` guards; `src/workers/workers.integration.test.ts:42`/`:43` — 403/FORBIDDEN; `:45`/`:46` — 403/USER_BLOCKED | PASS |
| C18 | 301/302, Location e clique persistido | V | `src/workers/workers.integration.test.ts:89` tabela 301/302; `:92` — status código configurado; `:93` — Location `https://example.com/first`; `:94`/`:95` — click_count e evento iguais a 1 | PASS |
| C19 | original layout e tolerâncias intactos | L | `tests/layout.spec.ts:10` — overflow `<=client+1`; `:26`/`:27` viewport +1; `:79` deslocamento `<=1`; `git diff ad2de29..HEAD -- tests/layout.spec.ts` vazio; 13 pares abertos novamente; checkbox checked fill/border token primary em ambos projetos e fault CSS killed | PASS |
| C20 | 7 telas ×2 viewports, overflow <=1 | E + L | `tests/e2e/journeys.spec.ts:31` pública, `:36`/`:37` login, `:44` headings Links/Analytics/Admin/Auditoria, `:49`/`:50` Status; `:7` — `.toBeLessThanOrEqual(width.viewport + 1)` chamado nas 7 telas | PASS |
| C21 | tema persiste após reload | E | `tests/e2e/journeys.spec.ts:60` — após `page.reload()`, `.toBe(!previous)` sobre classe dark | PASS |
| C22 | CRUD UI/banco e confirmação | E | `tests/e2e/journeys.spec.ts:69` — title D1 `Created in browser`; `:75` destino editado exato; `:77` heading `Excluir link?`; `:79` listagem count0; `:80` D1 null | PASS |
| C23 | lote e CSV somente selecionados | E | `tests/e2e/journeys.spec.ts:110` — `expect(csv).toContain("bulk-selected")`; `:111` — `.not.toContain("bulk-other")`; `:113`/`:114` disabled/active; `:121`/`:122` active/disabled. Adicional CSS de preservação: `:101`/`:102` — `await expect(select).toHaveCSS("background-color", primaryColor)` e `await expect(select).toHaveCSS("border-color", primaryColor)`, expected construído no mesmo arquivo `:93`–`:100` de `hsl(var(--primary))`; ambos viewports passaram. | PASS |
| C24 | vazio/carregando e navegação | E | `tests/e2e/journeys.spec.ts:132` skeleton visível; `:133` Novo link visível; `:135` skeleton count0; `:136` links count0; `:137` heading Links visível | PASS |
| C25 | HTTP/conexão com mensagem e retry | E + V | `tests/e2e/journeys.spec.ts:153` — `.toBeVisible()` sobre TEST_UNAVAILABLE / mensagem exata de conexão, dois modes `:145`; `:157` Retry link visível após reenvio; `src/application/link-service.test.ts:81` — D1_UNAVAILABLE propagado | PASS |
| C26 | imagem QR da URL pública selecionada | E | `tests/e2e/journeys.spec.ts:166` imagem visível; `:167` expected módulos de `${baseURL}/qr-link`; `:183` — `expect(actual).toEqual(Array.from(expected.data))`, módulos obtidos dos pixels | PASS |
| C27 | 8 restrições, unlock inválido, concorrência | V | `src/application/redirect-service.test.ts:37`/`:39` kind e ausência destino/clique; `:79`/`:80` tokens inválidos false/password_required; `src/workers/workers.integration.test.ts:119`/`:120` estados e destino ausente nas 8 restrições; `:128` — `["blocked","redirect"]`; `:129` quota D1=1; `:135` senha errada password_required | PASS |
| C28 | gates antes de publicar nos 2 workflows | V | `src/tooling/toolchain.test.ts:15` ambas configs; `:21` comando existe; `:22` — `expect(offset,command).toBeLessThan(firstPublish)`; `.github/workflows/deploy.yml:43`, `:52`, `:55` precedem publicação `:58`; staging mesma ordem | PASS |

## Coverage

Verified at `8b6c8b8ae60209c2759d719158b41b3f40d05782`: limites e schemas C12 foram recomputados pela autoridade da base e schema real, não pela nova tabela de testes. Telas/viewports/estados foram reavaliados por causa do CSS global, que afeta todas as telas; a autoridade continua o plano/contrato da base. Demais sets/caracterizações de autoridade, inalterados no fix diff, carried from `e6c444b6f66eb166de3b5e536e835a820c3b52b5`. Seus consumidores/provas foram todos reexecutados. A tabela mantém todas as **18 sets aprovadas**, mais os refinamentos tags e cor do checkbox. Unlock mantém seus 5 modos reais.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| Dependências diretas mantidas (22) | `package.json:33`/`:44`, manifest da base, registro npm próprio | @cloudflare/workers-types, @playwright/test, @tailwindcss/vite, @types/node, @types/qrcode, @types/react, @types/react-dom, @vitejs/plugin-react, class-variance-authority, clsx, lucide-react, qrcode, radix-ui, react, react-dom, tailwind-merge, tailwindcss, typescript, vite, vitest, wrangler, zod → C1 checker `:13`/`:14` e consulta de cada pacote | - |
| Landing (2) | duas decisões do plano; montagem real aberta | Tailwind plugin `vite.config.ts:6` → C1/C6; Wrangler sem pool `tests/helpers/local-workers.mjs:13`, `:36` → C1/C15 e script remove pool | - |
| Tooling assemblies (4; 2 configs browser) | leitura direta `vite.config.ts:5`, `vitest.config.ts:3`, `playwright.config.ts:3`/`playwright.e2e.config.ts:4`, `wrangler.api.jsonc:5`/`wrangler.redirect.jsonc:5` e `tsconfig.json:3` | frontend C5/C6; Vitest C5/V; Playwright **mock e E2E separadamente** C5/L/E; Workers **API e redirect separadamente** C7/C15/C18; harness abre cada config em `local-workers.mjs:19` | - |
| URL normalizada (3) | base `normalizeDestinationUrlInput`, `validation.ts:9`/`:14` | http/https/bare-domain → C8 tabela `validation.test.ts:6`–`:10` | - |
| URL proibida (3) | base `url-policy.ts:12`, `:16` | próprio/subdomínio → C9 `policies.test.ts:12`/`:13`; bloqueado → `:14` | - |
| Alias (7 grupos) | base `validation.ts:27`–`:29`, alias-policy, link-service | 1/2/48/49/charset → C10 `validation.test.ts:14`–`:16`; reservado → C11 `policies.test.ts:21`; duplicado → C11 `link-service.test.ts:29` e HTTP `workers.integration.test.ts:52`/`:53` | - |
| Limites de opções (6 grupos) | base e HEAD `validation.ts:49`, `:51`, `:55`, `:74`–`:83`, `:89`–`:99`, `:103`, `:108` | senha4/128 e3/129; tags0/10/11 e elemento1/32/0/33; allowlist/blocklist0/20/21 e charset; ids1/100/0/101/empty nos dois schemas de lote; inteiros1/1000000/0/-1/1000001/fracionário; omitido/null → C12 `validation.test.ts:20`–`:61`. Bordas de opções duplicadas executadas create **e** update; normalização ambos `:45`; null permitido em expiresAt/password/clickLimit/inactivity ambos, title somente update; null proibido alias/title create e destination/tags/países/favorite/pinned ambos. | - |
| Schemas com limite próprio de tags (2; refinamento C12) | base/HEAD `validation.ts:74` **e** `:89` | create/update → dois casos nomeados `validation.test.ts:20`–`:33`; ambos aceitam10 e rejeitam11 e bordas de comprimento; F1 update max11 killed em `:33` | - |
| Transições de link (5) | contratos base Create/Update/status/delete, LinkService e plano AC13 | create/update/deactivate/reactivate/delete → C13 `link-service.test.ts:37`, `:41`, `:45`, `:49`, `:52`; D1/KV HTTP `workers.integration.test.ts:62`–`:76`; UI C22/C23 | - |
| Saúde/sessão (2) | contrato API existente e AC15 | saúde200/ok e sessão200/null → C15 HTTP `:25`–`:29` | - |
| Auth ausente/inválida (3) | session repository validade/revogação, `api/index.ts:424` | sem-cookie/expirada/revogada → C16 HTTP `workers.integration.test.ts:33`–`:36` | - |
| Autorização (3 grupos) | ownership service, AdminPolicy e AC14/17 | propriedade → C14 HTTP+serviço; não-admin403/bloqueado403 → C17 `policies.test.ts:27`/`:29` e HTTP `:42`–`:46` | - |
| Redirect HTTP (2) | base `contracts.ts:29`, `validation.ts:76` e AC18 | 301/302 → C18 `workers.integration.test.ts:89`–`:95`, ambos casos listados no log | - |
| Telas (7) | **plano AC20**, rotas README/base e dashboard | pública/login/Links/Analytics/Admin/Auditoria/Status → C20 `journeys.spec.ts:31`, `:36`, `:42`–`:44`, `:49`; Admin/Auditoria também L | - |
| Viewports (2) | **plano AC19–20** | desktop1440×1100/mobilePixel5 → C19/C20; configs reais `playwright.config.ts:28`/`:32` e `playwright.e2e.config.ts:20`/`:21`, ambos consumidores rodaram | - |
| Estados listagem/operação (4) | plano AC24–25 e UI base | vazio/carregando → C24 `journeys.spec.ts:132`–`:137`; erro-http/conexão → C25 dois modes `:145`, mensagens `:153`, retry `:157`; rodaram ambos projetos | - |
| Restrições (8) | `redirect-service.ts` evaluateAccess e helpers; base contrato | disabled/blocked/expirado/inatividade/allowlist/blocklist/limite/senha → C27 own-layer tabela `redirect-service.test.ts:22`–`:33`, HTTP tabela `workers.integration.test.ts:100`–`:107`; assertions `:119`/`:120`; quota concorrente `:128`/`:129` | - |
| Unlock inválido (5; refinamento dos 4 grupos originais) | `link-security.ts` assinatura/expiração e `redirect-service.ts` passwordVersion/linkId; senha | senha-incorreta → C27 `redirect-service.test.ts:64` e HTTP `workers.integration.test.ts:135`; assinatura/expiração/versão/**linkId diferente** → `redirect-service.test.ts:72`–`:80`; token válido `:71` | - |
| Workflows (2) | arquivos existentes `.github/workflows/deploy.yml`, `deploy-staging.yml`, plano AC28 | staging/produção → C28 `toolchain.test.ts:15`–`:28`; inspecionados ambos, sem continue-on-error/condição que ignore gates | - |
| Cor do checkbox selecionado (2 atributos ×2 viewports; refinamento CSS) | base `src/app/components/ui/checkbox.tsx:15` classes checked border-primary/bg-primary; token `styles.css:39` e `:71`, reset `:18` dentro de layer base | fill/border → assertions `journeys.spec.ts:101`/`:102`, primary da swatch `:93`–`:100`; desktop/mobile rodaram. Reset unlayered reinjetado killed na borda. | - |

Sweep adicional carried from `e6c444b6f66eb166de3b5e536e835a820c3b52b5`: Surface/Relations None; Landing/Impact/Criteria/claims/Test policy enumeram as sets acima. Verified at `8b6c8b8ae60209c2759d719158b41b3f40d05782`: o diff não cria entidade/rota/status; subdivisão de schemas create/update recebeu prova própria de cada limite; a superfície nova de cor recebeu expected legível no mesmo arquivo e fault próprio. Zero membro sem prova.

## Test policy rows

Verified at `8b6c8b8ae60209c2759d719158b41b3f40d05782`: schemas e jornadas/global CSS re-julgados. Serviços e infraestrutura carried from `e6c444b6f66eb166de3b5e536e835a820c3b52b5` quanto ao julgamento de nível; provas completas novamente em HEAD.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Schemas e políticas de entrada/autorização | `src/shared/validation.ts`, `src/domain/alias-policy.ts`, `url-policy.ts`, `admin-policy.ts` | Vitest no próprio nível; C8–12/C17 com bordas/alternativas/omitido/null | yes — políticas preservadas; todos os limites enumerados, null/omissão e normalização exercitam ambos schemas quando aplicável em `validation.test.ts:20`–`:61`; F1 killed |
| Serviços que decidem CRUD/cache e acesso | `src/application/link-service.ts`, `redirect-service.ts` e segurança consumida | próprio nível e HTTP; 5 transições, 8 restrições, persistência/status | yes — C13/C14/C27 own-layer e Workers D1/KV; C18 HTTP e clique. Os modos de token inválido são exercitados diretamente pelo serviço; senha inválida e token válido cruzam HTTP. Não se alega disponibilidade externa. |
| Jornadas/componentes de bibliotecas atualizadas | `src/app/components/ui/*`, `styles.css`, `dashboard-app.tsx`, `dashboard-views.tsx`, `api.ts` e jornadas | cada tela/viewport/estado C19–26; CRUD/lote observados no banco | yes — 2 layouts +14 E2E; 7 telas em ambos, conteúdo/bounds, CRUD/lote D1, retry, pixels QR e reload do tema; 13 pares abertos novamente; checkbox checked fill/border token primary em ambos projetos e fault CSS killed |
| Configs/pass-through infraestrutura | package/lock, Vite/Vitest/TS/Playwright/Wrangler, harness, workflows | consumidores e comandos reais | yes — C1–7/C15/C28, todos consumidores reais abertos e executados; dry-runs e runtime local, sem deploy |

Níveis: valores de status/response/Location em C11/C14–18 têm assertions no HTTP real; C27 restrições atravessam HTTP e quota observa D1 real. A amostragem de um clique por código e dois concorrentes coincide com os valores aprovados. C12 agora tem prova por schema; a duplicação textual deixou de substituir sua cobertura. Nenhuma assertion expected depende de um helper remoto ilegível.

## Visual comparisons

Verified at `8b6c8b8ae60209c2759d719158b41b3f40d05782`: CSS global levou a reabrir todos os pares, sem herdar o julgamento visual.

Abri os **13 pares**, baseline à esquerda e HEAD à direita, através de `view_image`. Imagens baseline: `/tmp/prawurl-baseline-layout/`; HEAD: `test-results/layout-*.png`. As composições auxiliares `/tmp/prawurl-r2-compare-layout-*.png` preservam os pixels de ambas, lado a lado. O julgamento abaixo é visual de composição/conteúdo, não um cálculo raster.

| Par aberto | Julgamento independente |
| --- | --- |
| desktop-links | Sidebar e região de conteúdo; heading, toolbar/filtros e tabela com mesmos campos/ordem. Sem mudança de composição. |
| desktop-bulk-actions | Tabela no mesmo lugar e barra flutuante com contagem/ações; mesmo conteúdo. |
| desktop-admin | 4 métricas, tabs e Links globais/tabela na mesma hierarquia; valores 1/1/42/2 preservados. |
| desktop-admin-actions | Menu ao lado da coluna Ações, ordem Editar/Desfavoritar/Desafixar/QR Code/Excluir preservada. |
| desktop-audit | Mesma tabela/colunas e evento link.create; apenas horário da fixture difere. |
| desktop-editor-datepicker | Modal com seções e calendário/popover na mesma região; datas/horários correntes variam; nenhuma perda de conteúdo. |
| desktop-editor-password-countries | Modal de edição, destino/título/tags, proteção/regras e países nas duas colunas; mesmos chips/valores e ações. |
| mobile-links | Card com URL/título/destino/status/cliques/senha/sinais e ações; ordem e arranjo preservados. |
| mobile-bulk-actions | Card preservado e barra inferior com contagem e 5 ações; borda/fill verde do checkbox selecionado compatíveis com baseline; sem deslocamento do conteúdo. |
| mobile-admin | 4 métricas empilhadas, tabs e card global; mesma hierarquia/conteúdo. |
| mobile-audit | Card do evento com severidade, entidade/autor/metadados/data; apenas timestamp varia. |
| mobile-editor-datepicker | Região rolada do sheet, regras/expiração/calendário inline preservados; horário corrente difere. |
| mobile-editor-password-countries | Região rolada do sheet, tags/proteção/regras/segmentação e chips preservados; mesma composição. |

Diferenças observadas: traços de alguns ícones Lucide, pequenos offsets dos chips, estado visual do trigger de data e timestamps das fixtures. Não alteram composição nem conteúdo central. A suíte original mantém todos os limites de 1px; ela não foi editada. Pública/login/Analytics/Status não possuem par baseline entre as 13 imagens: sua evidência é E2E nas duas dimensões, sem alegação de comparação histórica dessas telas.

O log da suíte original contém warnings React por keys repetidas `Q`/`S` no calendário. Os dias da semana usam labels repetidos na implementação preexistente; essa superfície não mudou no diff. Registrado como observação preexistente, sem crash ou falha de prova. A fixture E2E anexa console/page errors e exige ausência de pageerror (`tests/e2e/fixtures.ts:19`); consoleErrors são anexados, não afirmados como vazios.

## Swept existing

Verified at `8b6c8b8ae60209c2759d719158b41b3f40d05782`: validation/state transitions reavaliados nas superfícies do fix. Demais constraints e julgamentos, não alterados no diff de correção, carried from `e6c444b6f66eb166de3b5e536e835a820c3b52b5`; respectivos checks reexecutados integralmente.

| Obrigação/decisão relida | Constraint no código / julgamento |
| --- | --- |
| validation | Schemas da base idênticos aos do HEAD; C8–12. As bordas de opções agora são afirmadas independentemente para create/update; null e normalização em ambos. F1 comprova proteção do limite tags update. |
| failure modes | `link-service.test.ts:81` propaga falha D1 sem cache/audit; `api.ts:86` e UI preservam mensagens/retry C25. Sem alegação de rollback atômico. |
| idempotency | `link-service.ts` consulta alias antes de create e HTTP duplicado409/C11; nenhuma chave nova exigida. |
| authorization | guards e serviço preservados; C14/C16/C17 exercitam proprietário, sem-cookie/inválidos, blocked e admin. |
| concurrency | `d1-repositories.ts:318` — incremento condicionado a `click_count < click_limit`; C27 duas requisições, um redirect e click_count1. |
| data lifecycle | C13/C22 e `local-workers.mjs:41` aplicam somente migrações existentes; `fixtures.ts:14` limpeza dos dados locais entre testes. |
| dependency failure | C25 força HTTP503 e abort de rede; OAuth/Turnstile são stubados, sem tráfego de produção. |
| state transitions | C13/C23/C27 cobrem 5 transições, lote e restrições; C23 também mantém cor selecionada segundo o token da base. Sem status novo. |
| observability | C18 afirma click_count e evento; browser screenshots/traces/erros anexados. |
| Existing: filtros/ordenação/densidade | `dashboard-views.tsx:266` usa filtros na leitura, `:366`/`:369` barras desktop/mobile; `api.ts:121`–`:128` serialize filtros; `d1-repositories.ts:618` pinned/favorite/updated_at DESC. Constraints existem e suas assinaturas não mudaram. |
| Existing: confirmação de exclusão | `dashboard-views.tsx:440` ConfirmDeleteDialog e `:448` executa onConfirm; C22 abre e confirma o alertdialog. As ações activate/deactivate não são exclusões; seu comportamento anterior foi preservado. |
| Existing: comandos npm interrompem falha / README | `package.json:9` build com && e `:30` dois dry-runs com &&; workflows sequenciais sem continue-on-error; `README.md:71`–`:94` documenta todos comandos e build antes das provas. |
| n/a versionamento/rate limits, coleções | Decisões explícitas aprovadas no plano; nenhuma rota/política ou reorganização nova. Não transformadas em requisitos novos. |

## Faults injected

Verified at `8b6c8b8ae60209c2759d719158b41b3f40d05782`: **2 injected, 2 killed, 0 survived** nesta rodada; superfícies distintas. Baseline real antes: `/tmp/prawurl-verifier-r2-status-before.txt`, somente `?? .agents/`. Worktree isolado criado por `git worktree add --detach /tmp/prawurl-verifier-r2-faults 8b6c8b8ae60209c2759d719158b41b3f40d05782`; node_modules linkado e dist copiado. Nenhuma mutação real, stash ou enfraquecimento de teste. As suítes de navegador foram sequenciais, sem edição durante Vite aberto.

| Mutation | Location | Narrow proof / evidência | Killed |
| --- | --- | --- | --- |
| F1 reinjetado: edição aceita 11 tags, update max10→max11 | scratch `src/shared/validation.ts:89` | `npm test -- src/shared/validation.test.ts -t 'update options.*option boundaries tags' --reporter=verbose`, exit1, 1failed. Teste nomeado `validation contracts > update options > option boundaries tags`; `validation.test.ts:33:98` esperava false e recebeu true. Log `/tmp/prawurl-verifier-r2-fault-tags.log`. | yes |
| F6 novo: restaura universal border-color fora de @layer, sobrepondo border-primary | scratch `src/app/styles.css:95` inserção do reset antigo removido | `npm run test:e2e -- --project=desktop -g 'bulk actions and CSV selection'`, exit1, 1failed. `journeys.spec.ts:102:24` border esperava rgb(12,125,103), recebeu rgb(206,213,222); background em `:101` passou. Log `/tmp/prawurl-verifier-r2-fault-css.log`. | yes |

Faults intocados **carried from `e6c444b6f66eb166de3b5e536e835a820c3b52b5`**, não contados como reinjetados nesta rodada: F2 cache create put→delete killed em `link-service.test.ts:37`; F3 Location incorreto killed em `workers.integration.test.ts:93`; F4 efeito de tema sem dependência theme killed em `journeys.spec.ts:60`; F5 produção sem gate E2E killed em `toolchain.test.ts:21`. Comandos/logs/resultados históricos íntegros em `verification-round-1.md`, seção Faults injected. F1 sobreviveu historicamente, agora foi reinjetado e morto; nenhuma sobrevivência pendente foi carregada como PASS.

F1 revertido antes de F6; scratch descartado após F6 com `git worktree remove --force /tmp/prawurl-verifier-r2-faults`, exit0. Real após: `/tmp/prawurl-verifier-r2-status-after.txt`; **cmp before after exit0**, ambos somente `?? .agents/`; HEAD ainda `8b6c8b8ae60209c2759d719158b41b3f40d05782`. Igualdade conferida **antes** de escrever este relatório. As 17 provas não selecionadas no runner estreito F1 são filtros de experimento, não skips de código; todas as 91 provas completas em HEAD rodaram com zero skips.

## Gate

Verified at `8b6c8b8ae60209c2759d719158b41b3f40d05782`. Comando: `python3 .codex/skills/tlc-spec-lean/scripts/validate_verification.py dependency-refresh --root /Users/yuriprawucki/Documents/Projetos/prawurl`.

Resultado efetivamente executado: **exit0, 0 errors, 0 warnings across [dependency-refresh]**; log final `/tmp/prawurl-verifier-r2-gate.log`. A primeira leitura do gate identificou a palavra portuguesa “no” em “diretamente no serviço” como o marcador inglês negativo; reformulei para “diretamente pelo serviço”, preservando a evidência/julgamento. O gate foi então reexecutado e passou. Nenhuma implementação ou prova foi alterada para obter esse resultado. Contabilidade: **28/28 checks provados; 18 sets aprovadas accounted (recompute do escopo +carry explícito) e 2 refinamentos, 0 membros sem prova; 4 policy rows met; 2 faults desta rodada killed/0 survived; 91 testes completos passed/0 failed/0 skipped**. Carried judgments identificados, proofs full no novo HEAD. Nenhuma lição nova em PASS; falha anterior já destilada pelo root, arquivo histórico preservado.
