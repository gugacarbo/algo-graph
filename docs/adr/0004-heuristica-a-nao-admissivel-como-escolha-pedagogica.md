---
status: accepted
date: 2026-08-19
builds-on: [ADR-0002, ADR-0003]
superseded-by: null
deciders: [Gustavo Carbonera]
---

<!-- id é DERIVADO do filename (docs/adr/NNNN-titulo-kebab.md → ADR-NNNN);
     title é DERIVADO do H1 abaixo. Não existem no frontmatter de propósito.

     ⚠️ Bloco VERDADE ATUAL — obrigatório quando este ADR for superado.
     Única edição substantiva permitida em ADR aceito. Máximo 3 linhas:

> ⚠️ VERDADE ATUAL: <o que ainda vale; o que foi revogado; ADR fonte atual>
-->

# Heurística A* não-admissível como escolha pedagógica

## Contexto e problema
O REQUIREMENTS lista A* como algoritmo adicional desejável e manda usar a distância
geométrica 3D entre nós como heurística (`heuristic(node, target) =
euclideanDistance(node.position, target.position)`), mantendo a correção com pesos.
Com pesos arbitrários, essa heurística **não é admissível** — pode superestimar o
custo restante e o caminho retornado não é o ótimo em geral. A decisão: aceitar essa
não-admissibilidade ou corrigi-la.

## Direcionadores da decisão
- O propósito do app é **mostrar** weight ≠ distância geométrica (ADR-0003); uma heurística que use a distância bruta é a demonstração viva disso.
- "Se A* comprometer a estabilidade do MVP, BFS/DFS/Dijkstra têm prioridade" (REQUIREMENTS) — A* precisa continuar simples.
- A* requer target (meta `requiresTarget: true`).

## Opções consideradas

### Opção 1 — Heurística admissível (ex.: distância 3D × peso mínimo da aresta)
**Prós:**
- Garante caminho ótimo; A* se comporta "correto" por definição.
**Contras:**
- Exige passar/propagar a escala dos pesos; mais código para uma ferramenta de demonstração.
- Apaga a mensagem pedagógica: o aluno não vê mais o conflito peso × distância.

### Opção 2 — Distância euclidiana 3D bruta, não-admissível (escolhida)
**Prós:**
- Exatamente o que o REQUIREMENTS descreve; uma linha.
- O conflito aparece na tela: A* pode escolher caminho diferente (e mais caro) que Dijkstra no mesmo grafo — demonstração visual do que heurística faz.
**Contras:**
- Caminho não-ótimo possível; quem lê a implementação precisa saber que é intencional (código documenta no comentário de `astar.ts`).

## Decisão
A heurística de A* é a distância euclidiana 3D **ao vivo** entre o nó e o target
(`src/algorithms/astar.ts`, `f = g + h`), sem normalização por pesos — não-admissível
para pesos arbitrários, **deliberadamente**, e documentada como tal no comentário do
código ("not admissible for arbitrary weights, which is exactly the point of showing
weight ≠ distance in the editor").

## Consequências
- Positivas: A* continua um passo à frente do Dijkstra didaticamente (mostra a fronteira guiada por `f`); zero custo extra no modelo.
- Negativas: resultados de A* não devem ser citados como "caminho ótimo" em materiais derivados do app.
- Obrigatório: o comentário de não-admissibilidade em `astar.ts` permanece enquanto a heurística for a bruta; removê-lo exige ADR.
- A* continua respeitando pesos (`g` acumula `edge.weight`) e a validação de `validateWeightedRun`.

## Confirmação

```bash
grep -n "not admissible" src/algorithms/astar.ts   # decisão documentada no código
bun run typecheck
```

## Notas
Se um dia a heurística passar a ser admissível (ou o app precisar de otimalidade),
supersede esta ADR — a mudança de corpo aqui é proibida pela imutabilidade (STANDARD §8).
