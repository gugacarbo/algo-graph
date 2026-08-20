import type { AlgorithmInput, AlgorithmRun, AlgorithmStep } from "./types";
import {
  buildAdjacency,
  pathTotalWeight,
  reconstructPath,
  validateWeightedRun,
  type ParentLink,
} from "./graphUtils";

/**
 * Dijkstra as a pure step generator.
 *
 * Edge traversal order is driven exclusively by `edge.weight`
 * (accumulated cost), never by the geometric distance.
 * Refuses to run when any edge has a negative / non-finite weight.
 */
export function dijkstra(input: AlgorithmInput): AlgorithmRun {
  const { graph, startId, targetId } = input;

  const validationError = validateWeightedRun(graph, "Dijkstra");
  if (validationError) return { steps: [], error: validationError };

  const adj = buildAdjacency(graph);
  const steps: AlgorithmStep[] = [];
  if (!adj.has(startId)) return { steps: [], error: "Start node not found in graph." };

  const dist = new Map<string, number>();
  const settled = new Set<string>();
  const parents = new Map<string, ParentLink>();
  const open: string[] = [startId];

  dist.set(startId, 0);
  steps.push({ type: "discover-node", nodeId: startId, distance: 0 });

  let found = false;

  while (open.length > 0) {
    // Simple priority queue: pick the open node with smallest tentative cost.
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if ((dist.get(open[i]) ?? Infinity) < (dist.get(open[bestIdx]) ?? Infinity)) bestIdx = i;
    }
    const u = open.splice(bestIdx, 1)[0];
    if (settled.has(u)) continue;

    settled.add(u);
    const du = dist.get(u) ?? 0;
    steps.push({ type: "visit-node", nodeId: u, distance: du });

    if (u === targetId) {
      found = true;
      steps.push({ type: "finish-node", nodeId: u });
      break;
    }

    for (const { edge, to } of adj.get(u) ?? []) {
      const alt = du + edge.weight;
      const current = dist.get(to);

      steps.push({ type: "traverse-edge", edgeId: edge.id });

      if (settled.has(to)) continue;

      if (current === undefined) {
        dist.set(to, alt);
        parents.set(to, { node: u, edge: edge.id });
        steps.push({ type: "discover-node", nodeId: to, distance: alt });
        open.push(to);
      } else if (alt < current) {
        dist.set(to, alt);
        parents.set(to, { node: u, edge: edge.id });
        steps.push({ type: "update-distance", nodeId: to, distance: alt });
      }
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
