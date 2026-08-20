# Infra & ambientes

## Ambientes
- **Só desenvolvimento local**: sem git remote, sem CI, sem backend, sem banco de dados, sem Docker.
- O app roda 100% no navegador; a única persistência é `localStorage` sob a chave `archigraph:v1` (payload `{ graph, labelSettings }`, escrita debounced 350ms, erros de storage engolidos).
- Nunca introduzir backend, banco ou CI sem ADR que supersede ADR-0005/0007.

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

## Build & distribuição
- `bun run build` gera **um único arquivo** auto-contido, `dist/index.html` (vite-plugin-singlefile). `dist/` nunca é commitado.
- Não existe pipeline de deploy: distribuir = copiar `dist/index.html` (abre direto, inclusive via `file://`).
- Única dependência externa em runtime: Google Fonts (preconnect em `index.html`); sem rede, as fallback stacks do CSS assumem.

## Git & hooks
- Branch `main`, trabalho direto nela (sem remote, sem PRs).
- Hooks husky: **pre-commit** → lint + typecheck + `scripts/docs-check`; **pre-push** → test.
- Bypass do gate só com `git commit --no-verify` deliberado — e a decisão segue sem trilha.
- Numeração de docs reserva-se com `scripts/docs-reserve` (ledger `docs/BACKLOG.md`).

## Ferramentas que NUNCA usar
- `npm` / `npx` / `yarn` / `pnpm` — o package manager é bun (ADR-0007).
- React Three Fiber ou SVG/DOM para renderizar o grafo — a cena é three.js imperativo (ADR-0001).
- Supabase CLI ou qualquer tooling de backend/DB — não existe backend (não há como usá-lo).
