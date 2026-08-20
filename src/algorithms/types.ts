import type { Graph } from "../types";

export type AlgorithmId = "bfs" | "dfs" | "dijkstra" | "astar";

/**
 * Visual state of a node during a search animation.
 *
 *   idle (unvisited) → frontier (discovered) → visiting → visited
 *   and finally, nodes on the solution become "path".
 */
export type NodeAlgoState = "idle" | "frontier" | "visiting" | "visited" | "path";

/** Visual state of an edge: normal → being traversed → traversed → final path. */
export type EdgeAlgoState = "idle" | "traversing" | "visited" | "path";

/**
 * A single logical step produced by an algorithm.
 * Algorithms are pure step generators: no timers, no rendering —
 * the animation controller decides when and how to play them.
 */
export type AlgorithmStep =
  | { type: "discover-node"; nodeId: string; distance?: number }
  | { type: "update-distance"; nodeId: string; distance: number }
  | { type: "visit-node"; nodeId: string; distance?: number }
  | { type: "traverse-edge"; edgeId: string }
  | { type: "finish-node"; nodeId: string }
  | { type: "path-found"; nodeIds: string[]; edgeIds: string[]; totalWeight: number }
  | { type: "no-path" }
  | { type: "done" };

export interface AlgorithmInput {
  graph: Graph;
  startId: string;
  /** Optional for BFS/DFS. Required for A* (heuristic needs a goal). */
  targetId?: string;
}

export interface AlgorithmRun {
  steps: AlgorithmStep[];
  /** Human readable error (e.g. negative weights for Dijkstra). Empty steps when set. */
  error?: string;
}

export interface AlgorithmMeta {
  id: AlgorithmId;
  name: string;
  tagline: string;
  requiresTarget: boolean;
  usesWeights: boolean;
}

export const ALGORITHMS: AlgorithmMeta[] = [
  {
    id: "bfs",
    name: "BFS",
    tagline: "Breadth-first search. Explores level by level, ignores weights.",
    requiresTarget: false,
    usesWeights: false,
  },
  {
    id: "dfs",
    name: "DFS",
    tagline: "Depth-first search. Dives deep before backtracking, ignores weights.",
    requiresTarget: false,
    usesWeights: false,
  },
  {
    id: "dijkstra",
    name: "Dijkstra",
    tagline: "Cheapest path by accumulated edge.weight. Requires weights ≥ 0.",
    requiresTarget: false,
    usesWeights: true,
  },
  {
    id: "astar",
    name: "A*",
    tagline: "g(n) = accumulated weight, h(n) = 3D euclidean distance to target.",
    requiresTarget: true,
    usesWeights: true,
  },
];
