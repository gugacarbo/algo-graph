# Convenções

Convenções compartilhadas deste repo. Estado atual, imperativo: "faça X", "nunca Y".
Decisão datada e justificativa vivem em `docs/adr/` — cite o ADR, não copie o corpo.

## Toolchain & estilo
- O package manager é **bun** (`bun.lock` é a fonte de verdade). Nunca `npm`, `npx`, `yarn` ou `pnpm` (ADR-0007).
- Estilo é imposto pelo **biome** (indentação em tab, preset `recommended`); rode `bun run format` após edições manuais de formato.
- TypeScript strict (`tsc -b`); alias `@/*` → `src/*`.
- UI sem biblioteca de componentes externa: as primitivas vivem em `src/components/ui.tsx` (`FieldRow`, `Select`, `SectionTitle`, `Dot`, `Range`); styling via classes Tailwind 4.

## Modelo de dados (grafo)
- `weight` em aresta é **obrigatório** e definido pelo usuário; independente da distância geométrica 3D (ADR-0003). Defaults existem **apenas nas fronteiras** de entrada de dados: criação (`addEdge` → `?? 3`) e import (normalização → `1`).
- Distância 3D é sempre derivada das posições atuais — nunca armazenar em estado.
- `width` da aresta é só visual; nunca derivar de `weight` nem vice-versa.
- Mutação de grafo é sempre imutável pelos callbacks do `useGraphEditor` (`setGraph` com spread). Nunca mutar o objeto em mão.
- Novo `NodeKind` exige `case` em `makeKindGeometry` (`GraphScene.ts`) + entrada em `KIND_META` (`src/types.ts`).

## Algoritmos
- Novo algoritmo = função pura `(input) → AlgorithmRun` em `src/algorithms/<nome>.ts`, reutilizando `graphUtils.ts` (`buildAdjacency`, `reconstructPath`, `pathTotalWeight`, `validateWeightedRun`).
- Registro exige 3 pontos (não existe plugin map, ADR-0002): union `AlgorithmId` em `types.ts`, meta no array `ALGORITHMS` (`requiresTarget`, `usesWeights`), `case` em `runAlgorithm` em `index.ts`.
- Vocabulário de passos (`AlgorithmStep`, 8 eventos) é contrato: novo tipo de passo exige `case` em `replaySteps` e, se afetar a visualização, cor na tabela de estados da cena.
- Algoritmo ponderado **deve** passar por `validateWeightedRun` (rejeita peso negativo/não-finito com erro visível).
- Estados visuais: nó `idle|frontier|visiting|visited|path`; aresta `idle|traversing|visited|path` — cores na tabela de `GraphScene` (`STATE_COLORS` em `src/types.ts`).
- Algoritmo nunca side-efeteia (timer, DOM, mutação); o player (`useAlgorithmRunner`) nunca contém regra de grafo.

## Testes
- vitest via `bun run test` (nunca `bun test` — runner diferente); testes co-localados como `src/**/*.test.ts`.
- Bug reproduzido vira teste de regressão **antes** do fix.
- A suíte pode estar vazia (`--passWithNoTests`), nunca vermelha: `bun run test` faz parte do DoD.

## Docs
- ADR aceita é **imutável**: só frontmatter e o bloco VERDADE ATUAL mudam; qualquer mudança de corpo (mesmo typo) → ADR novo que supersede (STANDARD §8, ADR-0008).
- Numeração via `python3 scripts/docs-reserve adr|spec "título"` — o ledger é `docs/BACKLOG.md`; nunca reutilizar número liberado.
- Referências `builds-on`/`superseded-by` usam o id completo: `ADR-0005` (nunca `0005`).
- Estado atual → `docs/context/` (imperativo, atemporal); decisão datada → `docs/adr/`. Não misturar os dois papéis num mesmo arquivo.
- Aponte capítulos novos no Mapa de contexto do `AGENTS.md`.
- Após criar/regenerar docs: `python3 scripts/docs-check --emit-index`.

## Comandos canônicos (DoD)
```bash
bun run typecheck           # exit 0
bun run lint                # exit 0
bun run test                # exit 0 (vitest)
python3 scripts/docs-check  # exit 0
```
