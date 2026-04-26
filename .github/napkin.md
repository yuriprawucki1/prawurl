# Napkin

## Preferências do usuário

- Usar Conventional Commits em todos os commits.
- Escrever a mensagem do commit em português do Brasil, com acentos.
- Tratar `staging` e `main` como ambientes separados, sem assumir produção por padrão.

## Correções

- 2026-04-26 | self | Assumi que a branch `main` era o lugar certo para publicar o fluxo de staging | Criar uma branch própria (`staging`), publicar nela e abrir PR para `main`.
- 2026-04-26 | self | A API de staging em `api.staging.prawurl.com` ficou indisponível enquanto o SSL do custom hostname provisionava | Para validar o staging da API, usar o endpoint HTTPS do `workers.dev` até o hostname customizado estabilizar.
- 2026-04-26 | user | Pediu para guardar a preferência de commits em memória do projeto | Sempre usar Conventional Commits em português do Brasil, com acentos.

## Padrões que funcionam

- Separar a UI em módulos pequenos quando `presentation/app.tsx` começa a concentrar roteamento, shell e views.
- Centralizar origens e nomes de ambiente em uma camada única para remover hardcodes espalhados.
- Para staging de Workers, `workers.dev` pode servir como endpoint HTTPS funcional antes do hostname customizado terminar de provisionar.
- Promover código de staging para produção por merge de `staging` em `main`, mantendo `main` como a branch que publica produção.

## Notas do projeto

- O staging usa recursos Cloudflare próprios: API Worker, Redirect Worker, Pages, D1, KV e Queue separados da produção.
- A saúde do staging da API depende de um endpoint HTTPS válido; o custom hostname pode atrasar, então `workers.dev` é o fallback confiável.
- O workflow de staging usa secrets próprios do ambiente para a aplicação, e compartilha apenas o token do Cloudflare no GitHub Actions.
