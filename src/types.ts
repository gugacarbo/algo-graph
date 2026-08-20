/* ------------------------------------------------------------------ */
/* Core graph model                                                    */
/* ------------------------------------------------------------------ */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const NODE_KINDS = ["client", "gateway", "service", "database", "cache", "queue"] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export interface GraphNode {
  id: string;
  label: string;
  kind: NodeKind;
  position: Vec3;
  color?: string;
  size?: number;
  metadata?: Record<string, string>;
}

export interface GraphEdge {
  id: string;

  source: string;
  target: string;

  label?: string;

  directed?: boolean;
  color?: string;

  /**
   * Logical weight used by algorithms (cost, latency, distance,
   * priority, hops, money…). Defined by the user, independent of
   * the geometric 3D distance between the nodes.
   */
  weight: number;

  /** Visual thickness of the line (px). Purely visual — NOT the weight. */
  width?: number;

  metadata?: Record<string, string>;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type Selection = { type: "node" | "edge"; id: string } | null;

export interface LabelSettings {
  name: boolean;
  weight: boolean;
  distance: boolean;
}

/* ------------------------------------------------------------------ */
/* Visual vocabulary                                                   */
/* ------------------------------------------------------------------ */

export const KIND_META: Record<NodeKind, { label: string; color: string }> = {
  client: { label: "Client", color: "#5cb4ff" },
  gateway: { label: "Gateway", color: "#ffb224" },
  service: { label: "Service", color: "#45d8d0" },
  database: { label: "Database", color: "#7ee081" },
  cache: { label: "Cache", color: "#ff8a5c" },
  queue: { label: "Queue", color: "#c7d3e0" },
};

export const STATE_COLORS = {
  frontier: "#4ea1ff",
  visiting: "#ffb224",
  visited: "#3ec5ce",
  path: "#ff6b4a",
} as const;

export const DEFAULT_EDGE_COLOR = "#5e7a96";

export function nodeColor(n: GraphNode): string {
  return n.color ?? KIND_META[n.kind]?.color ?? "#5cb4ff";
}

export function edgeColor(e: GraphEdge): string {
  return e.color ?? DEFAULT_EDGE_COLOR;
}

export function nodeRadius(n: GraphNode): number {
  return 1.25 * (n.size ?? 1);
}

let seq = 0;
export function uid(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}
