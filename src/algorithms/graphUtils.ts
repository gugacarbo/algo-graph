import type { Graph, GraphEdge, GraphNode, Vec3 } from "../types";

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

/** Euclidean distance between two 3D positions. Derived, never stored. */
export function euclideanDistance(a: Vec3, b: Vec3): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2);
}

export function getNode(graph: Graph, id: string): GraphNode | undefined {
  return graph.nodes.find((n) => n.id === id);
}

/**
 * Live geometric length of an edge, derived from the current node
 * positions. Moving a node changes this — the logical weight stays put.
 */
export function edgeDistance(graph: Graph, edge: GraphEdge): number | null {
  const s = getNode(graph, edge.source);
  const t = getNode(graph, edge.target);
  if (!s || !t) return null;
  return euclideanDistance(s.position, t.position);
}

/* ------------------------------------------------------------------ */
/* Traversal helpers                                                   */
/* ------------------------------------------------------------------ */

export interface AdjEntry {
  edge: GraphEdge;
  /** Neighbor node reachable through `edge`. */
  to: string;
}

/**
 * Builds the adjacency map respecting `directed`:
 *   directed === true  → edge can only be walked source → target
 *   directed === false → edge can be walked both ways
 * Centralized here so BFS/DFS/Dijkstra/A* never duplicate this rule.
 */
export function buildAdjacency(graph: Graph): Map<string, AdjEntry[]> {
  const adj = new Map<string, AdjEntry[]>();
  for (const n of graph.nodes) adj.set(n.id, []);
  for (const e of graph.edges) {
    if (!adj.has(e.source) || !adj.has(e.target)) continue;
    adj.get(e.source)?.push({ edge: e, to: e.target });
    if (!e.directed) adj.get(e.target)?.push({ edge: e, to: e.source });
  }
  return adj;
}

export interface ParentLink {
  node: string;
  edge: string;
}

/** Walks the parent map backwards from the target and returns the full path. */
export function reconstructPath(
  parents: Map<string, ParentLink>,
  startId: string,
  targetId: string,
): { nodeIds: string[]; edgeIds: string[] } {
  const nodeIds: string[] = [targetId];
  const edgeIds: string[] = [];
  let cur = targetId;
  let guard = 0;
  while (cur !== startId && guard++ < 100000) {
    const link = parents.get(cur);
    if (!link) break;
    edgeIds.push(link.edge);
    nodeIds.push(link.node);
    cur = link.node;
  }
  nodeIds.reverse();
  edgeIds.reverse();
  return { nodeIds, edgeIds };
}

/** Total logical weight of a path — the number algorithms actually optimize. */
export function pathTotalWeight(graph: Graph, edgeIds: string[]): number {
  let total = 0;
  for (const id of edgeIds) {
    const e = graph.edges.find((ed) => ed.id === id);
    if (e) total += e.weight;
  }
  return total;
}

/**
 * Dijkstra / A* refuse to run over edges with negative or non-finite
 * weights. Returns the first offending edge, if any.
 */
function findInvalidWeightEdge(graph: Graph): GraphEdge | undefined {
  return graph.edges.find((e) => !Number.isFinite(e.weight) || e.weight < 0);
}

/**
 * Validates that a weighted run is possible. Shared by Dijkstra and A*.
 */
export function validateWeightedRun(graph: Graph, algoName: string): string | null {
  const bad = findInvalidWeightEdge(graph);
  if (bad) {
    const name = bad.label || `${bad.source} → ${bad.target}`;
    return `${algoName} requires non-negative finite weights. Edge "${name}" has weight ${bad.weight}. Fix the weight or use BFS/DFS.`;
  }
  return null;
}
