---
status: accepted
date: 2026-08-19
builds-on: [ADR-0001, ADR-0003]
superseded-by: null
deciders: [Gustavo Carbonera]
---

<!-- id é DERIVADO do filename (docs/adr/NNNN-titulo-kebab.md → ADR-NNNN);
     title é DERIVADO do H1 abaixo. Não existem no frontmatter de propósito.

     ⚠️ Bloco VERDADE ATUAL — obrigatório quando este ADR for superado.
     Única edição substantiva permitida em ADR aceito. Máximo 3 linhas:

> ⚠️ VERDADE ATUAL: <o que ainda vale; o que foi revogado; ADR fonte atual>
-->

# Algoritmos como geradores puros de passos com replay integral

## Contexto e problema
O REQUIREMENTS exige execução **animada passo a passo** dos algoritmos (BFS, DFS,
Dijkstra, A*) com Run / Pause / Step / Reset e velocidade 0.25x–4x. Isso força a
pergunta: quem avança a busca — o algoritmo em tempo real (com pause/step interrompendo
a execução) ou um gravador + player? E onde vive o estado visual (nós/arestas em
`frontier`/`visiting`/`visited`/`path`)?

## Direcionadores da decisão
- Pause/Step/Reset precisam ser exatos — estado visual deve ser função pura do progresso.
- Algoritmo e renderização devem continuar desacoplados (ver ADR-0001: a cena só recebe snapshots).
- Execução é curta: centenas de passos, milissegundos de CPU — nenhum motivo para worker.
- Os 4 algoritmos compartilham estrutura (adjacência, reconstrução de caminho, validação de pesos) — `src/algorithms/graphUtils.ts`.

## Opções consideradas

### Opção 1 — Streaming incremental (algoritmo avança sob demanda)
**Prós:**
- Natural para execuções muito longas (gera passo a passo).
**Contras:**
- A máquina de estado da busca fica acoplada ao player: pause/step interrompem a execução no meio.
- Seek/pular passo exige re-execução parcial ou snapshot intermediário — complexo e sujeito a drift.

### Opção 2 — Pré-computação completa + replay (escolhida)
**Prós:**
- O algoritmo é função pura `(input) → { steps[], error? }` — testável sem DOM, sem timer, sem renderer.
- `replaySteps(steps, upTo)` re-deriva o snapshot imutável a cada tick: impossível dessincronizar ("immune to drift bugs").
- O player (`useAlgorithmRunner`) só faz timing: um `setTimeout` de `BASE_DELAY_MS (680ms) / speed` por passo; pause = matar o timeout; step = incrementar índice; reset = índice -1.
**Contras:**
- O snapshot é reprocessado do zero a cada tick — custo O(passos) por frame de avanço (irrelevante na escala atual; limitaria execuções de milhares de passos).
- O vocabulário de passos vira contrato: algo que não é passo não pode ser animado.

### Opção 3 — Web Worker com mensagens
**Prós:**
- Execução fora do main thread.
**Contras:**
- Overkill: as buscas completam em ms; serialização de mensagens + complexidade sem ganho mensurável.

## Decisão
Cada algoritmo é uma função pura síncrona em `src/algorithms/<nome>.ts` que grava uma
lista completa de `AlgorithmStep` (union discriminada de 8 eventos: `discover-node`,
`update-distance`, `visit-node`, `traverse-edge`, `finish-node`, `path-found`,
`no-path`, `done`) ou devolve `error` com passos vazios. `replaySteps`
(`src/algorithms/replay.ts`) converte `steps[0..upTo]` em `RunSnapshot` (mapas de
estados de nó/aresta, fronteira com distâncias, caminho). O `useAlgorithmRunner`
(`src/hooks/useAlgorithmRunner.ts`) é o AnimationController: **nunca executa lógica de
grafo e nunca toca Three.js**. Status (`idle|ready|running|paused|finished`) é
derivado do índice, nunca armazenado.

## Consequências
- Positivas: algoritmos unit-testáveis isolados; determinismo total; pause/step/reset triviais.
- Negativas: novo tipo de passo exige `case` em `replaySteps` e, se afetar a visualização, cor/estilo na cena.
- Obrigatório: novos algoritmos reutilizam `graphUtils.ts` (`buildAdjacency`, `reconstructPath`, `pathTotalWeight`, `validateWeightedRun`) e se registram nos 3 pontos — union `AlgorithmId`, array `ALGORITHMS` (meta: `requiresTarget`, `usesWeights`) e `case` em `runAlgorithm`. Não existe plugin map: esses 3 pontos são o registro.
- Proibido: algoritmo que side-efeteia (timer, DOM, mutação do grafo) ou player que contenha regra de grafo.

## Confirmação

```bash
grep -n "AnimationController" src/hooks/useAlgorithmRunner.ts   # contrato do player
grep -c "type:" src/algorithms/types.ts                          # vocabulário AlgorithmStep
bun run typecheck && bun test
```

## Notas
BFS/DFS ignoram `weight` (meta `usesWeights: false`); Dijkstra usa fila em array
simples (escaneia o mínimo linearmente) — suficiente para a escala do grafo; o
`requiresTarget` do meta controla a UI (A* sem target não roda).
