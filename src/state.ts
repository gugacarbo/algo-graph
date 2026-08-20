import { useCallback, useEffect, useRef, useState } from "react";
import type { Graph, GraphEdge, GraphNode, LabelSettings, Vec3 } from "./types";
import { uid } from "./types";
import { DEFAULT_GRAPH } from "./data/defaultGraph";

const STORAGE_KEY = "archigraph:v1";

interface Persisted {
  graph: Graph;
  labelSettings: LabelSettings;
}

function loadPersisted(): Persisted | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Persisted;
    if (!data?.graph?.nodes?.length || !Array.isArray(data.graph.edges)) return null;
    return data;
  } catch {
    return null;
  }
}

export function isValidGraph(g: unknown): g is Graph {
  if (!g || typeof g !== "object") return false;
  const graph = g as Graph;
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return false;
  const ids = new Set(graph.nodes.map((n) => n?.id));
  if (ids.size !== graph.nodes.length) return false;
  for (const n of graph.nodes) {
    if (!n.id || !n.label || !n.position) return false;
  }
  for (const e of graph.edges) {
    if (!e.id || !ids.has(e.source) || !ids.has(e.target)) return false;
    if (typeof e.weight !== "number") e.weight = 1;
  }
  return true;
}

export interface GraphEditor {
  graph: Graph;
  labelSettings: LabelSettings;
  setLabelSettings: (s: LabelSettings) => void;
  addNode: (partial?: Partial<GraphNode>) => string;
  updateNode: (id: string, patch: Partial<GraphNode>) => void;
  moveNode: (id: string, position: Vec3) => void;
  setPositions: (positions: Map<string, Vec3>) => void;
  removeNode: (id: string) => void;
  addEdge: (partial: Partial<GraphEdge> & { source: string; target: string }) => string;
  updateEdge: (id: string, patch: Partial<GraphEdge>) => void;
  removeEdge: (id: string) => void;
  replaceGraph: (g: Graph) => void;
  resetToDefault: () => void;
}

export function useGraphEditor(): GraphEditor {
  const initial = useRef<Persisted | null | undefined>(undefined);
  if (initial.current === undefined) initial.current = loadPersisted();

  const [graph, setGraph] = useState<Graph>(initial.current?.graph ?? DEFAULT_GRAPH);
  const [labelSettings, setLabelSettings] = useState<LabelSettings>(
    initial.current?.labelSettings ?? { name: true, weight: true, distance: false },
  );

  // Debounced persistence.
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ graph, labelSettings }));
      } catch {
        /* storage full / private mode — ignore */
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [graph, labelSettings]);

  const addNode = useCallback((partial?: Partial<GraphNode>) => {
    const id = uid("n");
    setGraph((g) => ({
      ...g,
      nodes: [
        ...g.nodes,
        {
          id,
          label: partial?.label ?? `Node ${g.nodes.length + 1}`,
          kind: partial?.kind ?? "service",
          position: partial?.position ?? {
            x: Math.round((Math.random() * 12 - 6) * 10) / 10,
            y: Math.round((Math.random() * 8 - 4) * 10) / 10,
            z: Math.round((Math.random() * 12 - 6) * 10) / 10,
          },
          color: partial?.color,
          size: partial?.size ?? 1,
          metadata: partial?.metadata,
        },
      ],
    }));
    return id;
  }, []);

  const updateNode = useCallback((id: string, patch: Partial<GraphNode>) => {
    setGraph((g) => ({
      ...g,
      nodes: g.nodes.map((n) => (n.id === id ? { ...n, ...patch, id } : n)),
    }));
  }, []);

  const moveNode = useCallback((id: string, position: Vec3) => {
    setGraph((g) => ({
      ...g,
      nodes: g.nodes.map((n) => (n.id === id ? { ...n, position } : n)),
    }));
  }, []);

  const setPositions = useCallback((positions: Map<string, Vec3>) => {
    setGraph((g) => ({
      ...g,
      nodes: g.nodes.map((n) => {
        const p = positions.get(n.id);
        return p ? { ...n, position: p } : n;
      }),
    }));
  }, []);

  const removeNode = useCallback((id: string) => {
    setGraph((g) => ({
      nodes: g.nodes.filter((n) => n.id !== id),
      edges: g.edges.filter((e) => e.source !== id && e.target !== id),
    }));
  }, []);

  const addEdge = useCallback(
    (partial: Partial<GraphEdge> & { source: string; target: string }) => {
      const id = uid("e");
      setGraph((g) => ({
        ...g,
        edges: [
          ...g.edges,
          {
            id,
            source: partial.source,
            target: partial.target,
            label: partial.label,
            directed: partial.directed ?? true,
            color: partial.color,
            weight: partial.weight ?? 3,
            width: partial.width ?? 2,
            metadata: partial.metadata,
          },
        ],
      }));
      return id;
    },
    [],
  );

  const updateEdge = useCallback((id: string, patch: Partial<GraphEdge>) => {
    setGraph((g) => ({
      ...g,
      edges: g.edges.map((e) => (e.id === id ? { ...e, ...patch, id } : e)),
    }));
  }, []);

  const removeEdge = useCallback((id: string) => {
    setGraph((g) => ({ ...g, edges: g.edges.filter((e) => e.id !== id) }));
  }, []);

  const replaceGraph = useCallback((g2: Graph) => setGraph(g2), []);
  const resetToDefault = useCallback(() => setGraph(DEFAULT_GRAPH), []);

  return {
    graph,
    labelSettings,
    setLabelSettings,
    addNode,
    updateNode,
    moveNode,
    setPositions,
    removeNode,
    addEdge,
    updateEdge,
    removeEdge,
    replaceGraph,
    resetToDefault,
  };
}
