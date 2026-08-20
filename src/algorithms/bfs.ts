import type { AlgorithmInput, AlgorithmRun, AlgorithmStep } from "./types";
import {
  buildAdjacency,
  pathTotalWeight,
  reconstructPath,
  type ParentLink,
} from "./graphUtils";

/**
 * Breadth-First Search as a pure step generator.
 * Ignores edge weights; explores the graph level by level.
 * Stops early when the target (if any) is discovered.
 */
export function bfs(input: AlgorithmInput): AlgorithmRun {
  const { graph, startId, targetId } = input;
  const adj = buildAdjacency(graph);
  const steps: AlgorithmStep[] = [];

  if (!adj.has(startId)) return { steps: [], error: "Start node not found in graph." };

  const seen = new Set<string>([startId]);
  const parents = new Map<string, ParentLink>();
  const depth = new Map<string, number>([[startId, 0]]);
  const queue: string[] = [startId];
  let found = false;

  steps.push({ type: "discover-node", nodeId: startId, distance: 0 });

  outer: while (queue.length > 0) {
    const u = queue.shift();
    if (u === undefined) break;
    const du = depth.get(u) ?? 0;
    steps.push({ type: "visit-node", nodeId: u, distance: du });

    for (const { edge, to } of adj.get(u) ?? []) {
      steps.push({ type: "traverse-edge", edgeId: edge.id });
      if (seen.has(to)) continue;
      seen.add(to);
      depth.set(to, du + 1);
      parents.set(to, { node: u, edge: edge.id });

      if (to === targetId) {
        steps.push({ type: "discover-node", nodeId: to, distance: du + 1 });
        found = true;
        break outer;
      }
      steps.push({ type: "discover-node", nodeId: to, distance: du + 1 });
      queue.push(to);
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
