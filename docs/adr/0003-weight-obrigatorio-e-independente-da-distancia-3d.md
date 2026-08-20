---
status: accepted
date: 2026-08-19
builds-on: []
superseded-by: null
deciders: [Gustavo Carbonera]
---

<!-- id é DERIVADO do filename (docs/adr/NNNN-titulo-kebab.md → ADR-NNNN);
     title é DERIVADO do H1 abaixo. Não existem no frontmatter de propósito.

     ⚠️ Bloco VERDADE ATUAL — obrigatório quando este ADR for superado.
     Única edição substantiva permitida em ADR aceito. Máximo 3 linhas:

> ⚠️ VERDADE ATUAL: <o que ainda vale; o que foi revogado; ADR fonte atual>
-->

# Weight obrigatório e independente da distância 3D

## Contexto e problema
O REQUIREMENTS exige que cada aresta tenha `weight` **definido pelo usuário** (custo,
latência, prioridade) e uma **distância geométrica 3D derivada das posições dos nós**,
ambos exibidos e distinguíveis na UI ("Weight: 12 / 3D Distance: 6.42"). Exige ainda
que a espessura visual (`width`) seja independente do peso — "aresta grossa ≠ peso
maior". A decisão é como modelar as três grandezas (weight, distância, width) e onde
aplicar defaults.

## Direcionadores da decisão
- Clareza pedagógica: o app existe para mostrar que peso lógico ≠ distância geométrica.
- Distância é derivada de posições — persisti-la criaria dessincronização a cada drag de nó.
- Dijkstra/A* exigem pesos válidos: o REQUIREMENTS manda impedir execução com peso inválido/negativo e avisar.
- Tipos: preferir campo obrigatório no modelo a fallbacks espalhados pelo código.

## Opções consideradas

### Opção 1 — `weight` opcional com fallback `?? 1` espalhado nos algoritmos
**Prós:**
- Importe de grafo "quebrado" nunca trava a UI.
**Contras:**
- Default silencioso mascara dado ausente; cada algoritmo repete o fallback (inconsistência: 1 em um lugar, 3 em outro).
- Modelo TypeScript não reflete a garantia ("weight sempre existe").

### Opção 2 — `weight` obrigatório + defaults nas fronteiras (escolhida)
**Prós:**
- `GraphEdge.weight: number` obrigatório (`src/types.ts`): o contrato está no tipo, e o doc do campo documenta "independent of the geometric 3D distance".
- Defaults vivem onde os dados **entram**: criação (`addEdge` → `partial.weight ?? 3`) e import/validação (normalização → `weight = 1` se ausente/não-numérico).
- Distância 3D nunca é armazenada — sempre derivada das posições atuais (recalcula automaticamente ao mover nós, como o REQUIREMENTS pede).
**Contras:**
- Import de arquivo com peso ausente muda o valor para o default (1) — decisão explícita, mas silenciosa.

### Opção 3 — Armazenar `distance` no estado junto com o `weight`
**Prós:**
- UI não precisa calcular.
**Contras:**
- Dessincroniza a cada drag de nó; estado duplicado de dado derivado — exatamente o que o REQUIREMENTS descarta ("Não é obrigatório armazenar").

## Decisão
`weight` é **obrigatório** no modelo e definido pelo usuário; `width` é campo
separado, documentado como "Purely visual — NOT the weight"; a distância 3D é sempre
derivada (métrica euclidiana entre posições) e exibida como somente-leitura ao lado
do weight editável no inspector. Defaults de peso existem **apenas nas fronteiras de
entrada de dados** (criação: `?? 3`; import: `?? 1`).

## Consequências
- Positivas: um único lugar para raciocinar sobre peso; UI reforça a lição (bloco read-only "Metrics" do inspector mostra weight × 3D distance lado a lado).
- Negativas: o default de import (1) pode divergir do default de criação (3) — intencional, mas confuso; documentado aqui para não ser "corrigido" sem ADR.
- Obrigatório: Dijkstra e A* passam por `validateWeightedRun` (rejeita peso negativo/não-finito com erro visível, conforme REQUIREMENTS); BFS/DFS nunca leem `weight`.
- Proibido: armazenar distância derivada em estado; fallback de peso dentro de algoritmo.

## Confirmação

```bash
grep -n "independent of" src/types.ts                   # contrato no doc do campo weight
grep -n "validateWeightedRun" src/algorithms/dijkstra.ts src/algorithms/astar.ts
grep -n "export function edgeDistance" src/algorithms/graphUtils.ts   # distância sempre derivada, nunca persistida
```

## Notas
O grafo de exemplo foi desenhado para a lição: o caminho mais barato
Frontend → PostgreSQL tem MAIS hops que o de menor salto (rota "legacy" direta, peso 8),
então Dijkstra visivelmente diverge de BFS/DFS.
