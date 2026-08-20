# AGENTS.md

```yaml
casa-repo-id: algo-graph   # usado em referências cross-repo (repo:ADR-0001)
casa-tier: T1                            # T0 (leve) | T1 (padrão) — STANDARD §3
casa-version: 1.8                        # versão do contrato CASA adotado (promessa do repo, ADR-0010)
casa-standard-ref: 7cdb964                 # versão do casa-standard de origem — o casa-init carimba
```

> Padrão: https://github.com/atplus-digital/casa-standard (STANDARD.md)
> ROUTER (CASA §4): carga sempre, teto ~150 linhas. Só alto-ROI transversal.
> Estourou o teto → conteúdo desce para docs/context/, fica o ponteiro.
> ⚠️ NÃO usar @import para colar capítulos: @import expande tudo no launch.
> Regras de um pacote específico → <subdir>/AGENTS.md (lazy nativo, nearest-wins).

## Contexto em 5 linhas
ArchiGraph: editor 3D de grafos de arquitetura (cena WebGL three.js) para desenhar grafos com `weight` ≠ distância 3D e animar passo a passo buscas (BFS, DFS, Dijkstra, A*).
Uso local/educacional: build single-file `dist/index.html` — sem backend, sem CI, sem remote.
Stack: Vite 7 + React 19 + three 0.185 + Tailwind 4; package manager **bun**.
Estado em hooks puros (`useGraphEditor`); a cena é espelho imperativo do React (ADR-0001).
Algoritmos = geradores puros de passos + replay integral (ADR-0002); weight obrigatório e independente da distância (ADR-0003).

## Infra & ambientes
Só desenvolvimento local: sem remote, sem CI, sem backend, sem banco. Persistência em `localStorage` (`archigraph:v1`).
NUNCA: `npm`/`npx` (usar bun) · R3F/SVG para o grafo (ADR-0001) · backend/DB/CI sem ADR.
Detalhe extenso: `docs/context/INFRA.md`.

## Como rodar localmente
```bash
bun install
bun run dev
```

## Como validar (DoD global do repo)
```bash
bun run typecheck           # exit 0
bun run lint                # sem erros
bun run test                # tudo verde (vitest — não é `bun test`)
python3 scripts/docs-check  # exit 0 (gate de docs — roda também no pre-commit)
```

## Como deployar
Sem pipeline: `bun run build` → `dist/index.html` único auto-contido (single-file, ADR-0007). Distribuir = copiar esse arquivo. NUNCA commitar `dist/`.

## Git & PRs
Branch `main`, trabalho direto nela — sem remote, sem PRs.
Hooks husky: pre-commit roda lint + typecheck + docs-check; pre-push roda test.
Bypass de gate só com `git commit --no-verify` deliberado (e a decisão fica sem trilha).

## Gotchas
<!-- Conhecimento NÃO-INFERÍVEL que já custou tentativas falhas. Todo gotcha
     descoberto pelo agente DEVE ser registrado aqui. -->

- `scripts/docs-reserve` slugifica o título: `*` e acentos somem — "Heurística A*…" vira `heuristica-a-nao-admissivel-…` no filename (o H1/título exibido mantém o original).
- O parser de frontmatter do `docs-check` aceita só YAML simples (escalar, lista inline `[...]`, lista em bloco) — sintaxe além disso é **erro**, nunca ignorado.
- `builds-on` exige o prefixo (`ADR-0005`, não `0005`) — número nu vira "doc inexistente".
- `bun test` (runner embutido do bun) ≠ `bun run test` (script do repo = vitest). Os gates e o DoD usam `bun run test`.
- `tsc -b` pode reexibir erro já corrigido a partir de `tsconfig.tsbuildinfo` antigo — limpar o arquivo se o erro não bater com o código.
- `biome.json` manda tab e `.editorconfig` manda 2 espaços: o biome vence; não "corrigir" o .editorconfig sem ADR.

## Mapa de contexto
<!-- Índice dos capítulos (docs/context/), cada um com QUANDO carregar.
     Capítulo = estado atual, imperativo, atemporal. Decisão datada = ADR. -->

| Capítulo | Quando carregar |
|---|---|
| `docs/context/CONVENTIONS.md` | ao alterar código, modelar dados, adicionar algoritmo ou testar |
| `docs/context/INFRA.md` | ao rodar, buildar, distribuir ou mexer na toolchain/git |

## Mapa de docs
- Decisões: `docs/adr/` · Comportamento: `docs/specs/` (READMEs GERADOS — não editar)
- Validar: `scripts/docs-check` · Regenerar índices: `scripts/docs-check --emit-index`
