import type { AlgorithmId, AlgorithmInput, AlgorithmRun } from "./types";
import { bfs } from "./bfs";
import { dfs } from "./dfs";
import { dijkstra } from "./dijkstra";
import { astar } from "./astar";

export * from "./types";
export * from "./graphUtils";

/**
 * Single entry point used by the UI. Returns the full list of steps
 * up-front; playback timing is the animation controller's job.
 */
export function runAlgorithm(input: AlgorithmInput, algo: AlgorithmId): AlgorithmRun {
  switch (algo) {
    case "bfs":
      return bfs(input);
    case "dfs":
      return dfs(input);
    case "dijkstra":
      return dijkstra(input);
    case "astar":
      return astar(input);
    default:
      return { steps: [], error: `Unknown algorithm: ${algo}` };
  }
}
