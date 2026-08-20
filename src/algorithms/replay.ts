import type { AlgorithmStep, EdgeAlgoState, NodeAlgoState } from "./types";

/**
 * Immutable snapshot produced by replaying steps[0..upTo].
 * The animation controller recomputes this on every tick change —
 * cheap (few hundred steps at most) and immune to drift bugs.
 */
export interface RunSnapshot {
  nodeStates: Map<string, NodeAlgoState>;
  edgeStates: Map<string, EdgeAlgoState>;

  /** Node currently being expanded. */
  current: string | null;
  /** Accumulated cost/depth of the current node (weighted algos). */
  currentDistance: number | null;

  visitedOrder: string[];
  /** Open frontier: nodeId → best known distance (insertion order). */
  frontier: Map<string, number | null>;

  pathNodeIds: string[] | null;
  pathEdgeIds: string[] | null;
  totalWeight: number | null;

  found: boolean | null;
  finished: boolean;
}

export function replaySteps(steps: AlgorithmStep[], upTo: number): RunSnapshot {
  const nodeStates = new Map<string, NodeAlgoState>();
  const edgeStates = new Map<string, EdgeAlgoState>();
  const frontier = new Map<string, number | null>();
  const traversing: string[] = [];
  const visitedOrder: string[] = [];

  let current: string | null = null;
  let currentDistance: number | null = null;
  let pathNodeIds: string[] | null = null;
  let pathEdgeIds: string[] | null = null;
  let totalWeight: number | null = null;
  let found: boolean | null = null;

  const flushTraversing = () => {
    for (const e of traversing) {
      if (edgeStates.get(e) === "traversing") edgeStates.set(e, "visited");
    }
    traversing.length = 0;
  };

  const last = Math.min(upTo, steps.length - 1);
  for (let i = 0; i <= last; i++) {
    const s = steps[i];
    switch (s.type) {
      case "discover-node": {
        const prev = nodeStates.get(s.nodeId);
        if (prev === undefined || prev === "frontier") nodeStates.set(s.nodeId, "frontier");
        frontier.set(s.nodeId, s.distance ?? null);
        break;
      }
      case "update-distance":
        frontier.set(s.nodeId, s.distance);
        break;
      case "visit-node":
        flushTraversing();
        nodeStates.set(s.nodeId, "visiting");
        frontier.delete(s.nodeId);
        if (!visitedOrder.includes(s.nodeId)) visitedOrder.push(s.nodeId);
        current = s.nodeId;
        currentDistance = s.distance ?? null;
        break;
      case "traverse-edge":
        edgeStates.set(s.edgeId, "traversing");
        traversing.push(s.edgeId);
        break;
      case "finish-node":
        nodeStates.set(s.nodeId, "visited");
        break;
      case "path-found":
        flushTraversing();
        for (const n of s.nodeIds) nodeStates.set(n, "path");
        for (const e of s.edgeIds) edgeStates.set(e, "path");
        pathNodeIds = s.nodeIds;
        pathEdgeIds = s.edgeIds;
        totalWeight = s.totalWeight;
        found = true;
        break;
      case "no-path":
        flushTraversing();
        found = false;
        break;
      case "done":
        break;
    }
  }

  return {
    nodeStates,
    edgeStates,
    current,
    currentDistance,
    visitedOrder,
    frontier,
    pathNodeIds,
    pathEdgeIds,
    totalWeight,
    found,
    finished: steps.length > 0 && upTo >= steps.length - 1,
  };
}
