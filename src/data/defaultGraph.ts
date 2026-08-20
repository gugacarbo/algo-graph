import type { Graph } from "../types";

/**
 * Initial sample graph.
 *
 * The main cluster demonstrates weighted routing: the cheapest path
 * Frontend → PostgreSQL is NOT the one with the fewest hops, so
 * Dijkstra visibly outperforms BFS/DFS.
 *
 * The Legacy ↔ Mainframe pair is an isolated undirected component,
 * useful to demo "No path found" without errors.
 */
export const DEFAULT_GRAPH: Graph = {
  nodes: [
    { id: "frontend", label: "Frontend", kind: "client", position: { x: -16, y: 3, z: 8 } },
    { id: "gateway", label: "Gateway", kind: "gateway", position: { x: -7, y: 0, z: 2 } },
    { id: "auth", label: "Auth", kind: "service", position: { x: -1, y: 8, z: -6 } },
    { id: "api", label: "API", kind: "service", position: { x: -1, y: -4, z: -3 } },
    { id: "backend", label: "Backend", kind: "service", position: { x: 7, y: 2, z: 3 } },
    { id: "redis", label: "Redis", kind: "cache", position: { x: 15, y: 8, z: -4 } },
    { id: "postgres", label: "PostgreSQL", kind: "database", position: { x: 16, y: -4, z: 6 } },
    { id: "storage", label: "Storage", kind: "database", position: { x: 8, y: -9, z: -7 } },
    { id: "legacy", label: "Legacy", kind: "service", position: { x: -15, y: -8, z: -15 } },
    { id: "mainframe", label: "Mainframe", kind: "database", position: { x: -6, y: -12, z: -19 } },
  ],
  edges: [
    { id: "e-fe-gw", source: "frontend", target: "gateway", label: "HTTPS", directed: true, weight: 2, width: 2.5 },
    { id: "e-gw-api", source: "gateway", target: "api", label: "REST", directed: true, weight: 1, width: 2 },
    { id: "e-gw-auth", source: "gateway", target: "auth", label: "gRPC", directed: true, weight: 3, width: 2 },
    { id: "e-gw-be", source: "gateway", target: "backend", label: "legacy route", directed: true, weight: 8, width: 2 },
    { id: "e-api-be", source: "api", target: "backend", label: "RPC", directed: true, weight: 2, width: 2 },
    { id: "e-auth-be", source: "auth", target: "backend", label: "tokens", directed: true, weight: 4, width: 2 },
    { id: "e-be-redis", source: "backend", target: "redis", label: "sessions", directed: true, weight: 3, width: 2 },
    { id: "e-be-pg", source: "backend", target: "postgres", label: "SQL", directed: true, weight: 5, width: 2.5 },
    { id: "e-api-pg", source: "api", target: "postgres", label: "direct SQL", directed: true, weight: 10, width: 1.5 },
    { id: "e-be-st", source: "backend", target: "storage", label: "blobs", directed: true, weight: 6, width: 2 },
    { id: "e-lg-mf", source: "legacy", target: "mainframe", label: "serial link", directed: false, weight: 7, width: 2 },
  ],
};
