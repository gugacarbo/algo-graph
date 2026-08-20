---
status: accepted
date: 2026-08-19
builds-on: [ADR-0003]
superseded-by: null
deciders: [Gustavo Carbonera]
---

<!-- id é DERIVADO do filename (docs/adr/NNNN-titulo-kebab.md → ADR-NNNN);
     title é DERIVADO do H1 abaixo. Não existem no frontmatter de propósito.

     ⚠️ Bloco VERDADE ATUAL — obrigatório quando este ADR for superado.
     Única edição substantiva permitida em ADR aceito. Máximo 3 linhas:

> ⚠️ VERDADE ATUAL: <o que ainda vale; o que foi revogado; ADR fonte atual>
-->

# Force layout 3D determinístico sob demanda, agnóstico de peso

## Contexto e problema
O usuário pode querer reorganizar o grafo sem arrastar nó a nó (botão "Auto Layout"
no TopBar). Pergunta forçada: quando o layout roda, o que ele pode tocar, e o peso
das arestas influencia a disposição?

## Direcionadores da decisão
- Posição é **apenas visual** — ids, conexões, pesos, direcionamento e metadata nunca mudam (documento o comentário de `src/layout.ts`).
- Reprodutibilidade: mesmo grafo de entrada → mesma disposição (sem seed aleatória), para não "quebrar" a cena de forma imprevisível.
- Peso ≠ distância é a tese do app (ADR-0003): usar peso nas molas do layout contradiria a mensagem (aresta "barata" encurtando a vizinhança física).
- Escala: dezenas de nós — iterações fixas no main thread bastam.

## Opções consideradas

### Opção 1 — Layout automático no load (sempre reorganizar)
**Prós:**
- Grafo sempre "arrumado" ao abrir.
**Contras:**
- Destroí posição do usuário a cada reload; conflito com persistência de posições.

### Opção 2 — Force-directed 3D determinístico, sob demanda (escolhida)
**Prós:**
- `computeForceLayout` (`src/layout.ts`) roda só quando o usuário pede (botão); constantes fixas (REPULSION 520, REST_LEN 13, SPRING 0.03, GRAVITY 0.0035, 320 iterações, passo máx 1.7, saída clampada a ±30) → determinístico.
- Molas ignoram peso — layout é 100% topológico/visual.
**Contras:**
- Resultado substitui as posições atuais sem backup (o usuário que arrastou perde o arranjo manual).
- 320 iterações são "boas o suficiente", não convergidas — disposição pode variar com o tamanho do grafo.

### Opção 3 — Layout 2D de bibliotecas (dagre/elk)
**Prós:**
- Hierarquias bonitas para grafos direcionados.
**Contras:**
- Mata a dimensão Z (o app é 3D); dependência extra para um botão.

## Decisão
Auto Layout = `computeForceLayout` determinístico executado **sob demanda**: o
`App.tsx` anima a aplicação interpolando posições por 750ms (easeOutCubic) via
`setPositions`, e o layout não lê `weight` — molas só dependem da topologia.

## Consequências
- Positivas: reproducible; separação nítida entre semântica (grafo) e apresentação (posições).
- Negativas: posições manuais são sobrescritas sem undo (interage com a ausência de history — ADR-0005).
- Obrigatório: qualquer mudança nos constantes de `layout.ts` muda o layout gerado; se o layout passar a usar peso, supersede esta ADR.
- Proibido: layout alterar campo não-posicional do grafo.

## Confirmação

```bash
grep -n "Works ONLY on visual positions" src/layout.ts   # contrato no comentário
grep -n "weight" src/layout.ts                            # (devem sair só menções de "ignora")
```

## Notas
O botão de Auto Layout existe no TopBar; a interpolação de 750ms é parâmetro de UX,
não decisão de arquitetura.
