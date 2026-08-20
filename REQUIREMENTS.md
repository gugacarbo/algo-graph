Adicione ao escopo existente do **3D Architecture Graph Editor** os recursos abaixo.

# Dimensões, peso e métricas das arestas

As arestas não devem representar apenas uma conexão visual entre dois nós.

Cada aresta deve possuir informações mensuráveis.

Atualize o modelo para algo semelhante a:

```ts
export interface GraphEdge {
  id: string;

  source: string;
  target: string;

  label?: string;

  directed?: boolean;
  color?: string;

  /**
   * Peso lógico usado pelos algoritmos.
   * Pode representar custo, latência, distância,
   * prioridade ou qualquer outra métrica.
   */
  weight: number;

  metadata?: Record<string, string>;
}
```

Além do `weight`, calcule automaticamente a **distância geométrica 3D** entre os nós conectados.

Exemplo:

```ts
distance = Math.sqrt(
  Math.pow(target.x - source.x, 2) +
  Math.pow(target.y - source.y, 2) +
  Math.pow(target.z - source.z, 2)
);
```

Não é obrigatório armazenar essa distância no estado, pois ela pode ser derivada das posições.

A interface deve distinguir claramente:

```text
Weight: 12
3D Distance: 6.42
```

Onde:

* `weight` é definido pelo usuário;
* `3D Distance` depende da posição atual dos nós.

Quando um nó for movido, a distância geométrica da aresta deve ser recalculada automaticamente.

---

# Visualização das dimensões das arestas

Quando apropriado, exiba próximo da conexão:

```text
API → Database
weight: 5
distance: 8.3
```

Evite poluir demais o canvas.

Pode haver uma configuração simples para controlar a informação exibida:

```text
Edge labels:

[x] Name
[x] Weight
[ ] 3D distance
```

Como alternativa mais simples para o MVP, mostre essas informações quando:

* a aresta estiver selecionada;
* o usuário passar o mouse sobre ela;
* ou no painel de propriedades.

---

# Espessura visual da aresta

Permita opcionalmente que propriedades da aresta influenciem sua representação.

Por exemplo:

```ts
width?: number;
```

O usuário deve poder editar a espessura visual da aresta.

Essa propriedade é independente do `weight`.

Não assuma que:

```text
aresta grossa = peso maior
```

A espessura é principalmente uma propriedade visual.

O peso é uma propriedade utilizada pelos algoritmos.

---

# Painel de propriedades da aresta

Quando uma aresta estiver selecionada, permitir editar:

* label;
* source;
* target;
* directed;
* color;
* weight;
* width;
* metadata.

Também mostrar como informação somente leitura:

* distância geométrica atual;
* nó de origem;
* nó de destino.

---

# Modo Algorithms

Adicione uma pequena área da interface dedicada a algoritmos de grafos.

Pode ser um painel ou seção chamada:

```text
Algorithms
```

ou:

```text
Graph Search
```

Esse painel deve permitir executar algoritmos sobre o grafo atual.

---

# Algoritmos obrigatórios

Implemente pelo menos:

## Breadth-First Search

```text
BFS
```

Busca em largura.

---

## Depth-First Search

```text
DFS
```

Busca em profundidade.

---

## Dijkstra

```text
Dijkstra
```

Deve utilizar:

```ts
edge.weight
```

como custo da conexão.

Se houver arestas com peso inválido ou negativo, impeça a execução do Dijkstra e mostre um aviso simples.

---

# Algoritmo adicional desejável

Se a implementação permanecer simples, implemente também:

```text
A*
```

Para o A*, utilize a distância geométrica 3D entre os nós como heurística.

Por exemplo:

```ts
heuristic(node, target) =
  euclideanDistance(node.position, target.position);
```

A implementação deve continuar funcionando corretamente com os pesos das arestas.

Se A* comprometer a estabilidade do MVP, BFS, DFS e Dijkstra têm prioridade.

---

# Seleção da busca

O usuário deve conseguir escolher:

```text
Algorithm
[ BFS      ▼ ]

Start node
[ Frontend ▼ ]

Target node
[ Database ▼ ]

[ Run ]
```

Para DFS e BFS, o target pode ser opcional.

Quando houver target, interrompa a busca quando o destino for encontrado.

---

# Animação dos algoritmos

A execução não deve mostrar apenas o resultado final.

Ela deve ser **animada passo a passo no próprio grafo 3D**.

Os estados visuais devem distinguir pelo menos:

```text
não visitado
visitando
visitado
caminho final
```

Por exemplo:

```text
normal
   ↓
frontier / descoberto
   ↓
visitando
   ↓
visitado
```

Quando o destino for encontrado:

```text
Frontend
   ↓
Gateway
   ↓
Backend
   ↓
Database
```

o caminho final deve ficar claramente destacado.

---

# Animação das arestas

Não anime apenas os nós.

As arestas utilizadas pela busca também devem participar da animação.

Quando o algoritmo percorre:

```text
A → B
```

a aresta correspondente deve ser destacada temporariamente.

Uma possibilidade é:

```text
aresta normal
     ↓
aresta sendo percorrida
     ↓
aresta visitada
```

O caminho final deve possuir um destaque mais forte que as arestas apenas exploradas.

---

# Fluxo visual de busca

Exemplo de BFS:

```text
Frontend
    │
    ▼
Gateway
  ↙     ↘
Auth    API
        │
        ▼
      Backend
      ↙     ↘
   Redis   Database
```

Uma execução poderia visualizar:

```text
1. Frontend

2. Frontend
      ↓
   Gateway

3. Gateway
    ↙    ↘
 Auth    API

4. API
     ↓
 Backend

5. Backend
    ↙    ↘
 Redis  Database

6. Target found

Frontend
   ↓
Gateway
   ↓
API
   ↓
Backend
   ↓
Database
```

Não precisa utilizar exatamente essa ordem visual se o algoritmo justificar outra.

---

# Controles da animação

Forneça:

```text
[ Run ]
[ Pause ]
[ Step ]
[ Reset ]
```

Também inclua controle de velocidade.

Por exemplo:

```text
Speed

0.25x
0.5x
1x
2x
4x
```

ou um slider equivalente.

---

# Step mode

O botão:

```text
Step
```

deve avançar exatamente uma etapa lógica do algoritmo.

Isso é importante porque o editor também deve funcionar como uma ferramenta didática para visualizar algoritmos em grafos.

---

# Estado da execução

Mostre informações simples durante o algoritmo.

Por exemplo:

```text
Algorithm: Dijkstra

Current: Backend
Visited: 5 / 9

Frontier:
- Redis: 10
- Database: 15
- Storage: 18
```

Para Dijkstra, mostre quando possível:

```text
Current distance: 12
```

Ao terminar:

```text
Path found

Frontend → Gateway → API → Backend → Database

Total weight: 23
Visited nodes: 7
```

---

# Busca sem destino encontrado

Se não existir caminho entre origem e destino, termine normalmente e mostre:

```text
No path found
```

Não trate isso como erro da aplicação.

---

# Arquitetura dos algoritmos

Não coloque a lógica de BFS, DFS ou Dijkstra dentro dos componentes React.

Crie uma camada separada.

Estrutura sugerida:

```text
src/
├── algorithms/
│   ├── types.ts
│   ├── bfs.ts
│   ├── dfs.ts
│   ├── dijkstra.ts
│   ├── astar.ts
│   └── graphUtils.ts
```

---

# Algoritmos como geradores de etapas

Prefira implementar os algoritmos de forma que produzam uma sequência de eventos.

Por exemplo:

```ts
export type AlgorithmStep =
  | {
      type: "discover-node";
      nodeId: string;
    }
  | {
      type: "visit-node";
      nodeId: string;
    }
  | {
      type: "traverse-edge";
      edgeId: string;
    }
  | {
      type: "finish-node";
      nodeId: string;
    }
  | {
      type: "path-found";
      nodeIds: string[];
      edgeIds: string[];
    };
```

Assim:

```text
algoritmo
   ↓
AlgorithmStep[]
   ↓
animation controller
   ↓
Three.js
```

A lógica matemática deve permanecer separada da animação.

---

# Animation Controller

Crie um controlador separado para reproduzir os passos.

Algo semelhante a:

```text
algorithm
    │
    ▼
steps[]
    │
    ▼
AnimationController
    │
    ├── play
    ├── pause
    ├── step
    ├── reset
    └── speed
```

Evite implementar BFS/DFS/Dijkstra utilizando diretamente `setTimeout()` dentro do algoritmo.

O algoritmo deve produzir os passos.

A interface decide como e quando reproduzi-los.

---

# Bloqueio durante execução

Enquanto uma animação estiver rodando, evite alterações estruturais no grafo que invalidem a busca.

Por exemplo, desabilite temporariamente:

* excluir nó;
* excluir aresta;
* criar conexão;
* executar Auto Layout;
* importar grafo.

O usuário ainda pode:

* orbitar;
* dar zoom;
* usar pan;
* pausar;
* avançar um passo;
* resetar a execução.

Depois do reset ou término, a edição normal volta a funcionar.

---

# Direção das arestas nos algoritmos

Os algoritmos devem respeitar:

```ts
directed
```

Se:

```ts
directed === true
```

a conexão só pode ser percorrida:

```text
source → target
```

Se:

```ts
directed === false
```

pode ser percorrida nos dois sentidos:

```text
source ↔ target
```

Centralize essa lógica em um helper para não duplicá-la entre BFS, DFS e Dijkstra.

---

# Peso das arestas

BFS e DFS devem ignorar o peso para decidir sua ordem padrão de exploração.

Dijkstra deve obrigatoriamente utilizar:

```ts
edge.weight
```

A* deve utilizar:

```text
g(n) = custo acumulado pelas arestas

h(n) = distância geométrica 3D até o destino

f(n) = g(n) + h(n)
```

---

# Distância versus peso

Mantenha explicitamente a distinção:

```text
Geometric distance
≠
Edge weight
```

Exemplo:

```text
Frontend -------- API

3D distance: 8.2
weight: 40
```

Isso é válido.

O peso poderia representar, por exemplo:

* latência;
* custo;
* tempo;
* distância lógica;
* prioridade;
* quantidade de hops;
* custo monetário.

---

# Caminho resultante

Quando um algoritmo encontrar um caminho, destaque simultaneamente:

* nós do caminho;
* arestas do caminho.

O usuário deve conseguir visualizar claramente:

```text
START
  │
  ▼
NODE
  │
  ▼
NODE
  │
  ▼
TARGET
```

A câmera não precisa se mover automaticamente durante a execução.

---

# Reset

O botão:

```text
Reset Algorithm
```

deve:

* interromper execução;
* limpar estados de animação;
* restaurar cores normais;
* limpar frontier;
* limpar caminho destacado;
* manter o grafo intacto.

---

# Auto-layout e algoritmos

O `Auto Layout` deve trabalhar apenas sobre a posição visual dos nós.

Ele não deve alterar:

* IDs;
* conexões;
* pesos;
* direção das arestas;
* metadata.

Depois de executar Auto Layout, as distâncias geométricas serão naturalmente recalculadas.

Os pesos permanecem inalterados.

---

# Exemplo inicial

Faça o grafo inicial demonstrar também os algoritmos.

Exemplo:

```text
Frontend
   │ 2
   ▼
Gateway
   │ 1
   ▼
Backend
  /     \
 3       5
↓         ↓
Redis   PostgreSQL
```

Os números podem representar `weight`.

Assim que a aplicação abrir, deve ser possível selecionar:

```text
Dijkstra

Start: Frontend
Target: PostgreSQL
```

e visualizar a execução animada.

---

# Novos critérios de aceite

Além dos critérios anteriores, considere o projeto concluído somente se for possível:

1. selecionar uma aresta;
2. alterar seu peso;
3. visualizar sua distância geométrica;
4. mover um nó;
5. observar a distância geométrica mudar;
6. confirmar que o peso lógico continua igual;
7. escolher BFS;
8. definir um nó inicial;
9. executar BFS com animação;
10. pausar a animação;
11. avançar com `Step`;
12. resetar a animação;
13. executar DFS;
14. executar Dijkstra;
15. verificar que Dijkstra considera os pesos;
16. visualizar nós sendo explorados;
17. visualizar arestas sendo percorridas;
18. visualizar o caminho final;
19. visualizar o peso total do caminho;
20. executar uma busca cujo destino não seja alcançável;
21. receber `No path found` sem erro;
22. verificar que arestas direcionadas são respeitadas;
23. alterar a velocidade da animação;
24. continuar orbitando e navegando no espaço 3D durante a animação.

Priorize uma implementação simples e funcional.

Os algoritmos e a animação devem ser desacoplados para que novos algoritmos possam ser adicionados posteriormente sem reescrever o renderer 3D.
