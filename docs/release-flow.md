# Fluxo de publicação

## Branches e ambientes

1. Desenvolva em uma branch `codex/*` ou outra branch de trabalho.
2. Abra PR para `staging`; `CI | Pull requests` executa qualidade e segurança.
3. Faça merge em `staging`; `CD | Staging` valida, publica e verifica API, site e dashboard.
4. Aguarde a execução inteira de staging passar e confira a aplicação.
5. Abra PR de `staging` para `main`. Faça **merge commit**, preservando o histórico das branches.
6. `CD | Produção` confirma a evidência de staging, valida com as origens de produção, publica e verifica os endpoints.

A promoção só terminou quando a execução de produção e seus health checks passaram. PR aberto, merge efetuado e publicação saudável são estados diferentes.

Antes de promover, se `main` tiver commits ausentes de staging, faça merge de `main` em staging, resolva os conflitos preservando as dependências atualizadas e espere uma nova publicação de staging passar. Isso evita um resultado de merge com código que não passou por staging. Não use squash/rebase para a promoção: o gate de produção também exige ancestralidade da versão publicada.

## Workflows

| Nome no GitHub Actions | Arquivo | Quando executa | Responsabilidade |
| --- | --- | --- | --- |
| CI · Pull requests | `ci.yml` | PR para staging ou main | Testar a alteração; PR para main exige evidência de staging |
| CD · Staging | `deploy-staging.yml` | Push em staging ou execução manual em staging | Validar → publicar staging → verificar saúde → recuperar em caso de falha |
| CD · Produção | `deploy.yml` | Push em main ou execução manual em main | Conferir staging → validar → publicar produção → verificar saúde → recuperar em caso de falha |
| Segurança · Auditoria semanal | `security-audit.yml` | Segunda-feira, 04:17 UTC (01:17 em São Paulo), ou manual | Reauditar dependências contra o banco de vulnerabilidades atualizado |
| Produção · Monitor e recuperação | `production-monitor.yml` | A cada 15 minutos ou manual em main | Monitorar endpoints e restaurar uma publicação anterior saudável |
| Validação compartilhada | `validate.yml` | Chamada por CI ou CD | Uma única definição dos critérios de qualidade e segurança |

Os nomes na UI usam `|` como separador. A validação compartilhada não inicia uma execução independente. Push de staging/main dispara somente o CD correspondente; a auditoria já faz parte da validação. PRs validam o resultado do merge, sem publicar.

Os nomes dos arquivos de deploy foram mantidos para preservar o histórico de execuções e as consultas do monitor.

## Validação e artefatos

`validate.yml` instala o lockfile sem scripts de terceiros e executa:

- Testes das regras de promoção e migração.
- Verificação de novas migrações e imutabilidade das migrações já versionadas.
- `npm audit --audit-level=low`, Syft e Grype com versões/checksums fixados.
- TypeScript, build do frontend, testes unitários e contratos HTTP com Workers/D1 locais.
- Bundles dos dois Workers em dry run.
- Playwright visual e jornadas com API/D1 locais, usando Xvfb no Linux.

O build acontece antes dos testes que dependem de `dist`. No CD, o frontend aprovado fica no artefato `frontend-<SHA>` da própria execução. O job de publicação baixa esse artefato e não reconstrói o frontend. Staging e produção têm builds distintos porque as origens são diferentes, mas seguem os mesmos critérios de validação.

A action `.github/actions/audit-dependencies` é compartilhada entre validação e auditoria semanal. O SBOM do lockfile e npm audit cobrem dependências npm, inclusive de desenvolvimento. O segundo SBOM cobre o código/configuração do projeto, excluindo `node_modules`, bundles e resultados de testes. Os executáveis de ferramentas de build não são parte desse segundo SBOM; esse recorte não equivale a auditar os binários do runner.

## Gate de promoção

`scripts/ci/verify-staging.mjs` exige:

- Para PR em main, a origem deve ser a branch staging deste repositório, no SHA atual.
- A árvore resultante do merge deve ser idêntica à árvore publicada em staging.
- A execução correspondente de `deploy-staging.yml` precisa estar concluída com sucesso, com publicação e health checks realmente executados.
- Em produção, o commit publicado em staging precisa ser ancestral de main e ter a mesma árvore de arquivos. A busca considera até 100 execuções recentes.

Se staging ainda estiver executando, aguarde e execute novamente o job de promoção do PR. Um check bloqueado enquanto a publicação está em andamento é esperado; não faça bypass. Se uma execução mais recente da mesma versão falhou, corrija ou reexecute staging antes de tentar promover.

## Publicação e recuperação

Staging e produção usam recursos Cloudflare separados. Os secrets `STAGING_*` continuam separados dos de produção; apenas `CLOUDFLARE_API_TOKEN` é compartilhado. A publicação verifica a presença de todos os secrets antes de modificar o ambiente.

As pipelines aplicam D1, publicam API/Redirect Workers, atualizam seus secrets e publicam Pages. Pages de produção usa explicitamente `--branch main`, inclusive quando um rollback faz checkout de um commit antigo em detached HEAD.

O rollback seleciona uma publicação anterior saudável do mesmo ambiente, cujo commit seja ancestral do atual, restaura o código e registra um commit de reversão na branch somente se ela ainda estiver no SHA esperado. Migrações D1 e alterações de secrets não são revertidas automaticamente. Por isso novas migrações precisam ser aditivas e compatíveis com a versão anterior; edições/exclusões de migrações versionadas e operações potencialmente destrutivas bloqueiam a validação. O intervalo analisado é o push inteiro ou o diff do PR, com histórico Git completo.

O monitor consulta as publicações saudáveis do workflow de produção. Monitoramento e CD de produção compartilham a mesma trava de concorrência para evitar recuperação durante uma publicação. Execuções manuais de deploy/monitor devem usar a branch do ambiente; em outra branch os jobs são pulados.

Comandos locais explicitamente identificados por ambiente continuam disponíveis (`deploy:staging`, `deploy:production`). Eles não oferecem os gates ou o histórico de evidências do GitHub Actions; use PRs e CD para o fluxo normal.

## Diagnóstico da promoção de dependency-refresh

A promoção no PR #19 travou por conflitos entre main e staging em `package.json`, `package-lock.json` e nos dois workflows de deploy. As verificações também divergiam:

- [CI falho](https://github.com/yuriprawucki1/prawurl/actions/runs/37087930633): testes executados antes de existir `dist`.
- [Auditoria falha](https://github.com/yuriprawucki1/prawurl/actions/runs/37087930636): binários Go de ferramentas em `node_modules` incluídos no SBOM da árvore.
- [CD staging aprovado](https://github.com/yuriprawucki1/prawurl/actions/runs/37087930691): tinha as correções de ordem, recorte do SBOM e Xvfb que as pipelines paralelas ainda não tinham.

O commit `bf58f1c` de dependency-refresh acrescentava dois arquivos de configuração de skills e ainda não estava em staging. A correção integra a branch inteira, sincroniza main em staging e substitui as validações divergentes por uma implementação compartilhada. As dependências, alterações da aplicação e evidências da atualização são preservadas.
