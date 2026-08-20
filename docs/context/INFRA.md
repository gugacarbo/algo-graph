# Infra & ambientes

## Ambientes
- **Remote + CI**: git remote `origin` → `github.com/gugacarbo/algo-graph` (público); CI/deploy em GitHub Actions publicando em GitHub Pages (ADR-0009).
- Sem backend, sem banco de dados, sem Docker. O app roda 100% no navegador; a única persistência é `localStorage` sob a chave `archigraph:v1` (payload `{ graph, labelSettings }`, escrita debounced 350ms, erros de storage engolidos).
- Nunca introduzir backend ou banco sem ADR. CI existe desde ADR-0009 — qualquer mudança no pipeline (novo host, novo gate) também exige ADR.

## Stack (versões do package.json)
- Vite 7.3 · React 19.2 · three 0.185 · Tailwind 4.1 · TypeScript 5.9
- Package manager: **bun** (nunca npm/npx — ADR-0007).
- Qualidade: biome (tabs), `tsc -b` strict, vitest 4, knip.

## Comandos
```bash
bun install                                        # instalar deps
bun run dev                                        # dev server (Vite)
bun run build                                      # → dist/index.html single-file (ADR-0007)
bun run typecheck && bun run lint && bun run test  # DoD de código (vitest)
python3 scripts/docs-check                         # gate de docs (rode também antes de commit)
```

## Build & deploy
- `bun run build` gera **um único arquivo** auto-contido, `dist/index.html` (vite-plugin-singlefile). `dist/` nunca é commitado.
- Deploy: `.github/workflows/deploy.yml` — em push para `main` (ou manual) roda o DoD (typecheck, lint, test, docs-check), faz o build e publica `dist/` no GitHub Pages: `https://gugacarbo.github.io/algo-graph/` (ADR-0009).
- Distribuição offline continua sendo: copiar `dist/index.html` (abre direto, inclusive via `file://`).
- Única dependência externa em runtime: Google Fonts (preconnect em `index.html`); sem rede, as fallback stacks do CSS assumem.
- Actions pinadas pelas majors oficiais mais recentes: `actions/checkout@v7`, `oven-sh/setup-bun@v2` (bun 1.3.14), `actions/upload-pages-artifact@v5`, `actions/deploy-pages@v5`.

## Git & hooks
- Branch `main`, trabalho direto nela — com remote `origin` (GitHub) e sem PRs; push em `main` dispara o workflow e publica no Pages (ADR-0009).
- Hooks husky: **pre-commit** → lint + typecheck + `scripts/docs-check`; **pre-push** → test.
- Bypass do gate só com `git commit --no-verify` deliberado — e a decisão segue sem trilha.
- Numeração de docs reserva-se com `scripts/docs-reserve` (ledger `docs/BACKLOG.md`).

## Ferramentas que NUNCA usar
- `npm` / `npx` / `yarn` / `pnpm` — o package manager é bun (ADR-0007).
- React Three Fiber ou SVG/DOM para renderizar o grafo — a cena é three.js imperativo (ADR-0001).
- Supabase CLI ou qualquer tooling de backend/DB — não existe backend (não há como usá-lo).
