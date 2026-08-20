import type { Graph } from "../types";
import type { AlgorithmInput, AlgorithmRun, AlgorithmStep } from "./types";
import {
  buildAdjacency,
  euclideanDistance,
  getNode,
  pathTotalWeight,
  reconstructPath,
  validateWeightedRun,
  type ParentLink,
} from "./graphUtils";

/**
 * A* as a pure step generator.
 *
 *   g(n) = accumulated edge.weight from the start
 *   h(n) = euclidean 3D distance between node positions and the target
 *   f(n) = g(n) + h(n)
 *
 * The heuristic is the live geometric distance — note this is generally
 * not admissible for arbitrary weights, which is exactly the point of
 * showing weight ≠ distance in the editor.
 */
export function astar(input: AlgorithmInput): AlgorithmRun {
  const { graph, startId, targetId } = input;

  if (!targetId) {
    return { steps: [], error: "A* needs a target node to compute its heuristic." };
  }
  const validationError = validateWeightedRun(graph, "A*");
  if (validationError) return { steps: [], error: validationError };

  const targetNode = getNode(graph as Graph, targetId);
  if (!targetNode) return { steps: [], error: "Target node not found in graph." };

  const adj = buildAdjacency(graph);
  const steps: AlgorithmStep[] = [];
  if (!adj.has(startId)) return { steps: [], error: "Start node not found in graph." };

  const h = (nodeId: string): number => {
    const n = getNode(graph, nodeId);
    return n ? euclideanDistance(n.position, targetNode.position) : 0;
  };

  const g = new Map<string, number>();
  const settled = new Set<string>();
  const parents = new Map<string, ParentLink>();
  const open: string[] = [startId];

  g.set(startId, 0);
  steps.push({ type: "discover-node", nodeId: startId, distance: 0 });

  let found = false;

  while (open.length > 0) {
    // Pick the open node with the smallest f(n) = g(n) + h(n).
    let bestIdx = 0;
    let bestF = Infinity;
    for (let i = 0; i < open.length; i++) {
      const f = (g.get(open[i]) ?? Infinity) + h(open[i]);
      if (f < bestF) {
        bestF = f;
        bestIdx = i;
      }
    }
    const u = open.splice(bestIdx, 1)[0];
    if (settled.has(u)) continue;

    settled.add(u);
    const gu = g.get(u) ?? 0;
    steps.push({ type: "visit-node", nodeId: u, distance: gu });

    if (u === targetId) {
      found = true;
      steps.push({ type: "finish-node", nodeId: u });
      break;
    }

    for (const { edge, to } of adj.get(u) ?? []) {
      const alt = gu + edge.weight;
      const currentG = g.get(to);

      steps.push({ type: "traverse-edge", edgeId: edge.id });

      if (settled.has(to)) continue;

      if (currentG === undefined) {
        g.set(to, alt);
        parents.set(to, { node: u, edge: edge.id });
        steps.push({ type: "discover-node", nodeId: to, distance: alt });
        open.push(to);
      } else if (alt < currentG) {
        g.set(to, alt);
        parents.set(to, { node: u, edge: edge.id });
        steps.push({ type: "update-distance", nodeId: to, distance: alt });
      }
    }
    steps.push({ type: "finish-node", nodeId: u });
  }

  if (found) {
    const { nodeIds, edgeIds } = reconstructPath(parents, startId, targetId);
    steps.push({
      type: "path-found",
      nodeIds,
      edgeIds,
      totalWeight: pathTotalWeight(graph, edgeIds),
    });
  } else {
    steps.push({ type: "no-path" });
  }

  steps.push({ type: "done" });
  return { steps };
}
