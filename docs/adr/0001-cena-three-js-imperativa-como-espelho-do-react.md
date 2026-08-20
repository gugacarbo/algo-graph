---
status: accepted
date: 2026-08-19
builds-on: [ADR-0005]
superseded-by: null
deciders: [Gustavo Carbonera]
---

<!-- id é DERIVADO do filename (docs/adr/NNNN-titulo-kebab.md → ADR-NNNN);
     title é DERIVADO do H1 abaixo. Não existem no frontmatter de propósito.

     ⚠️ Bloco VERDADE ATUAL — obrigatório quando este ADR for superado.
     Única edição substantiva permitida em ADR aceito. Máximo 3 linhas:

> ⚠️ VERDADE ATUAL: <o que ainda vale; o que foi revogado; ADR fonte atual>
-->

# Cena three.js imperativa como espelho do React

## Contexto e problema
O editor precisa renderizar um grafo 3D interativo em cena WebGL contínua: nós com
geometria por tipo, arestas com largura de tela constante (fat lines), labels sempre
virados para a câmera, órbita de câmera, drag de nós e picking de nós/arestas — tudo
sincronizado com dados que vivem no React. A cena tem movimento por frame (pulsos de
nó, traço fluindo nas arestas ativas, tween de foco), então há um loop de renderização
permanente independente de qualquer re-render do React.

## Direcionadores da decisão
- Requisito: editor 3D navegável (REQUIREMENTS.md — cena, não wireframe 2D).
- Fonte única de verdade: o grafo pertence ao React (estado e mutações no `useGraphEditor`).
- O render loop roda a 60fps com animações contínuas; empurrar isso por reconciliation do React seria desperdício e acoplamento.
- Escopo do grafo: dezenas de nós, não dezenas de milhares — sem necessidade de WebGL avançado ou instancing.

## Opções consideradas

### Opção 1 — React Three Fiber (declarativo)
**Prós:**
- Cena declarativa em JSX; hooks React disponíveis nos objetos 3D.
- Ecossistema e exemplos abundantes.
**Contras:**
- Re-renders do React no caminho da animação contínua; o loop 60fps fica mediado pelo reconciler.
- Abstração extra para uma cena que na prática é um espelho imperativo de dados.
- Dependência pesativa (R3F + drei) para o que usamos do three.

### Opção 2 — three.js imperativo com camada fina React
**Prós:**
- `GraphScene` (classe) controla o loop `requestAnimationFrame` direto; React só empurra dados e recebe intenção do usuário via callbacks.
- Reconciliação própria por diff (create/update/delete em `Map` por id); geometria só reconstruída quando a assinatura `kind:size` muda.
- Zero acoplamento: o renderer não conhece React, o React não conhece three (exceto o ref).
**Contras:**
- Código imperativo "sem React" — quem lê precisa internalizar o contrato de espelho.
- Labels via textura de canvas 2D (sprite) são um híbrido que exige redraw controlado (cache `labelKey`).

### Opção 3 — SVG/DOM
**Prós:**
- Acessível de graça, simples, sem WebGL.
**Contras:**
- Sem 3D nem órbita — viola o requisito central.
- Degenera em performance com dezenas de nós + animações por frame.

## Decisão
A cena é uma classe three.js imperativa (`src/engine/GraphScene.ts`) que **espelha** o
grafo mantido pelo React; o React nunca é fonte de verdade da cena e a cena nunca muta
dados. O contrato está documentado no docblock da classe ("React owns the data; this
class only mirrors it into WebGL and reports user intent back through callbacks").
Interações voltam como callbacks (`onSelect`, `onNodeDrag`, `onAddNodeAt`,
`onConnectPick`); o `Viewport` monta a cena uma única vez e empurra mudanças via
`setGraph`/`setAlgoStates`.

## Consequências
- Positivas: fonte única de verdade no React; animações 60fps sem passar pelo reconciler; cena testável/montável isolada do React.
- Negativas: dois mundos para coordenar (React ↔ cena) — qualquer dado novo que afete a visualização precisa de um ponto de sincronização explícito.
- Obrigatório: novo `NodeKind` exige `case` em `makeKindGeometry` + entrada em `KIND_META`; novo estado visual de algoritmo exige entrada na tabela de cores da cena.
- Proibido: manter estado de grafo dentro da cena (a cena é derivada, nunca fonte).

## Confirmação

```bash
grep -n "React owns the data" src/engine/GraphScene.ts   # contrato no docblock
bun run typecheck                                          # callbacks GraphSceneCallbacks tipados
```

## Notas
Picking de arestas usa raycaster com threshold em pixels (`Line2.threshold: 12`) —
ajuste muda a experiência de clique; é parâmetro, não decisão.
