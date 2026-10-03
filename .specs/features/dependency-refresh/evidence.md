# Evidências do autor

Estas execuções orientam o Verifier; não substituem sua avaliação independente no commit final.

Data: 02/10/2026 (America/Sao_Paulo). Ambiente: macOS, Node 24.18.0, npm 12.2.0.

| Prova | Base ad2de29 | Atualização |
| --- | --- | --- |
| npm audit | 18 total: 1 critical, 11 high, 4 moderate, 2 low | 0 em todas as categorias |
| Dependências diretas | 24 entradas, incluindo pool Cloudflare/PostCSS/autoprefixer | 22 versões estáveis, snapshot npm; removidas 3 e adicionado plugin Tailwind |
| npm ci | lock anterior existente | exit 0, sem force/legacy-peer-deps |
| npm ls --all | diagnóstico anterior | exit 0, sem pacotes inválidos |
| npm outdated --json | diversos majors pendentes | `{}`, exit 0 |
| npm run lint | exit 0 | exit 0; frontend, Workers e tooling, incluindo testes |
| npm run build | exit 0 | exit 0; index.html e assets CSS/JS |
| npm run build:workers | não havia script conjunto | API e redirect exit 0, dry-run, ambiente raiz explícito |
| Vitest | 4 casos existentes verdes | 75 casos em 9 arquivos, 0 falhas |
| Playwright original | desktop e mobile verdes | 2 projetos verdes; arquivo layout.spec.ts idêntico à base |
| Playwright jornadas novas | ausentes | 14 casos verdes, 7 jornadas em cada viewport |

Depois de reforçar edição ativa e reativação exclusiva da seleção, repetidos os 69 casos Vitest, os 2 layouts e as 2 jornadas de lote, todos verdes. O Verifier repetirá o conjunto inteiro em HEAD, incluindo instalação e navegador.

## Correções após a primeira revisão

A rodada independente 1 (e6c444b) encontrou C12 sem prova do limite de tags na edição: um mutante que aceitava 11 tags sobreviveu. Os testes agora exercitam limites e normalização separadamente em criação e edição, sem alterar os schemas nem reduzir as asserções anteriores. A falha e a lição foram preservadas em `verification-round-1.md` e `.specs/LESSONS.md`.

Um teste adicional exige preenchimento e borda do checkbox selecionado na cor do token primary da base. Antes da correção ele falhou: borda cinza `rgb(206, 213, 222)` em vez de verde `rgb(12, 125, 103)`. Removido o reset universal duplicado fora de `@layer`; o reset em `@layer base` continua presente e as utilities voltam a ter prioridade. A espera do Playwright observa o fim da transição CSS existente.

Após estas correções, lint/build, 75 casos Vitest, os 2 layouts originais e as 2 jornadas de lote passaram. A rodada 2 repetirá todas as provas em seu commit e reinjetará falhas nas superfícies alteradas.

## Migrações relevantes

- Tailwind 4 com plugin Vite; removido PostCSS redundante. Tokens, temas, bordas, sombras, outline, altura de linhas e hover ao toque mantêm o comportamento da base. `rounded-sm` conserva a configuração customizada de raio, não o default descrito no guia de migração.
- Vite 8 com `rolldownOptions` e função de divisão do chunk React.
- TypeScript 7: JSON desconhecido recebe tipo no consumidor; bytes criptográficos declaram ArrayBuffer compatível com BufferSource.
- Vitest 5: pool Cloudflare antigo não utilizado foi removido por peers incompatíveis. `createTestHarness` atual do Wrangler executa os dois Workers e seus bindings no mesmo runtime local, aplicando as migrações existentes em estado descartável.
- Ambos os workflows instalam Chromium e executam layout/E2E com Xvfb antes de migrações remotas e publicações.

## Capturas da base

13 pares de PNGs da suíte original: desktop Links, lote, datepicker, Admin, ações Admin, proteção/países e Auditoria; mobile Links, lote, datepicker, Admin, proteção/países e Auditoria.

Base: `/tmp/prawurl-baseline-layout/`. Atual: `test-results/layout-*.png`, ignorado no Git conforme docs/napkin.md. Todas as dimensões foram preservadas. Comparação RGB preliminar, tolerância 16 por canal, mostrou até 0,12% de pixels diferentes após corrigir altura de linhas, hover e blur no mobile. Os timestamps são dinâmicos; diferenças raster pequenas não são por si uma garantia de composição. O Verifier deve abrir os pares e julgar as telas.

## Limites e avisos

- Google/GitHub e Turnstile são exercitados com fixtures de respostas externas e credenciais fictícias. Não houve login real, deploy ou acesso a dados remotos de produção.
- Chromium desktop e Pixel 5 emulados foram exercitados. Outros motores e browsers legados não foram executados. Tailwind 4 requer Safari 16.4+, Chrome 111+ e Firefox 128+.
- O npm 12 local bloqueia postinstall de esbuild/workerd/fsevents pela política de install-scripts. Os binários distribuídos como pacotes opcionais funcionaram após npm ci: builds e Workers reais passaram. Nenhuma aprovação global de script foi alterada.
- React registra chaves de dias da semana repetidas Q/S no calendário existente; a mesma estrutura existe na base e ficou fora do escopo de defeitos preexistentes. As jornadas novas capturam pageerrors e console, e exigem ausência de exceções de página.
- Uma execução foi interrompida ao editar package.json com Vite aberto. O trace mostrou nova conexão/boot da página; a suíte foi repetida sem alterações concorrentes e os 14 casos passaram. Não foi adicionado retry para ocultar essa falha.
