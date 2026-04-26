# PrawURL Napkin

## UI e layout

- Refinar sempre para computador e celular. Nenhuma tela deve depender apenas de uma largura feliz.
- Evitar quebras de layout, deslocamentos ao abrir menus/popovers, desalinhamentos, texto espremido e elementos colados nas bordas.
- Antes de finalizar mudanças visuais, validar os estados reais: dashboard, Admin, Auditoria, modal de link, menus de ações, popovers e estados mobile.
- Usar dimensoes estaveis em tabelas, colunas de acoes, toolbars, badges, botoes de icone, popovers e modais.
- Truncar texto longo de forma intencional e manter `min-w-0` nos containers flex/grid onde houver risco de overflow.

## Componentes

- Sempre preferir componentes shadcn/Radix existentes em `src/app/components/ui` em vez de controles default do browser ou componentes manuais feitos apenas com CSS.
- Quando faltar um controle, criar primeiro um wrapper consistente em `src/app/components/ui` e depois usar esse wrapper nas telas.
- Usar icones do `lucide-react` em botoes e acoes quando houver um icone adequado.
- Evitar CSS pontual que resolva apenas uma tela e deixe estados vizinhos inconsistentes.

## Debug visual

- Usar `npm run dev:mock` para reproduzir estados autenticados sem OAuth.
- Usar `npm run test:visual` para validar desktop e mobile com Playwright.
- Se o browser do Playwright ainda nao estiver instalado, rodar `npm run playwright:install`.
- Screenshots e artefatos de debug ficam em `test-results` e nao devem ser commitados.

## Commits

- Sempre commitar com Conventional Commits em portugues do Brasil.
- Exemplos:
  - `feat: adiciona auditoria visual do dashboard`
  - `fix: corrige alinhamento do modal de links`
  - `docs: atualiza napkin com convencoes de UI`
  - `test: adiciona verificacao visual com playwright`
