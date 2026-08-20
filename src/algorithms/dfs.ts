import type { AlgorithmInput, AlgorithmRun, AlgorithmStep } from "./types";
import {
  buildAdjacency,
  pathTotalWeight,
  reconstructPath,
  type ParentLink,
} from "./graphUtils";

/**
 * Depth-First Search (iterative, explicit stack) as a pure step generator.
 * Ignores edge weights; dives as deep as possible before backtracking.
 * Stops early when the target (if any) is visited.
 */
export function dfs(input: AlgorithmInput): AlgorithmRun {
  const { graph, startId, targetId } = input;
  const adj = buildAdjacency(graph);
  const steps: AlgorithmStep[] = [];

  if (!adj.has(startId)) return { steps: [], error: "Start node not found in graph." };

  const visited = new Set<string>();
  const parents = new Map<string, ParentLink>();
  const stack: string[] = [startId];
  let found = false;

  steps.push({ type: "discover-node", nodeId: startId });

  while (stack.length > 0) {
    const u = stack.pop();
    if (u === undefined) continue;
    if (visited.has(u)) continue;

    visited.add(u);
    steps.push({ type: "visit-node", nodeId: u });

    if (u === targetId) {
      found = true;
      steps.push({ type: "finish-node", nodeId: u });
      break;
    }

    const neighbors = adj.get(u) ?? [];
    // Iterate in reverse so the first-declared edge is explored first
    // (stack is LIFO) — produces a natural reading order.
    for (let i = neighbors.length - 1; i >= 0; i--) {
      const { edge, to } = neighbors[i];
      steps.push({ type: "traverse-edge", edgeId: edge.id });
      if (visited.has(to)) continue;
      if (!parents.has(to) || to === targetId) parents.set(to, { node: u, edge: edge.id });
      steps.push({ type: "discover-node", nodeId: to });
      stack.push(to);
    }
    steps.push({ type: "finish-node", nodeId: u });
  }

  if (found && targetId) {
    const { nodeIds, edgeIds } = reconstructPath(parents, startId, targetId);
    steps.push({
      type: "path-found",
      nodeIds,
      edgeIds,
      totalWeight: pathTotalWeight(graph, edgeIds),
    });
  } else if (targetId) {
    steps.push({ type: "no-path" });
  }

  steps.push({ type: "done" });
  return { steps };
}
