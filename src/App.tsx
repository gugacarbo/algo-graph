import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Viewport } from "./components/Viewport";
import { TopBar } from "./components/TopBar";
import { GraphPanel } from "./components/panels/GraphPanel";
import { InspectorPanel } from "./components/panels/InspectorPanel";
import { AlgorithmsPanel } from "./components/panels/AlgorithmsPanel";
import { isValidGraph, useGraphEditor } from "./state";
import { useAlgorithmRunner } from "./hooks/useAlgorithmRunner";
import { computeForceLayout } from "./layout";
import type { GraphScene } from "./engine/GraphScene";
import type { Graph, GraphEdge, GraphNode, Selection, Vec3 } from "./types";
import { STATE_COLORS } from "./types";
import type { EdgeAlgoState, NodeAlgoState } from "./algorithms/types";
import { edgeDistance } from "./algorithms/graphUtils";
import { IconLink, IconLock, IconX } from "./components/icons";

type Tab = "graph" | "inspector" | "algorithms";

interface Toast {
  id: number;
  kind: "info" | "success" | "warn";
  msg: string;
}

const EMPTY_NODE_STATES = new Map<string, NodeAlgoState>();
const EMPTY_EDGE_STATES = new Map<string, EdgeAlgoState>();

export default function App() {
  const editor = useGraphEditor();
  const runner = useAlgorithmRunner();
  const sceneRef = useRef<GraphScene | null>(null);

  const [selection, setSelection] = useState<Selection>(null);
  const [tab, setTab] = useState<Tab>("algorithms");
  const [connect, setConnect] = useState<{ active: boolean; sourceId: string | null }>({
    active: false,
    sourceId: null,
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [layingOut, setLayingOut] = useState(false);

  const toastSeq = useRef(0);
  const layoutRaf = useRef(0);

  const toast = useCallback((kind: Toast["kind"], msg: string) => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t.slice(-2), { id, kind, msg }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const locked = runner.status === "running" || runner.status === "paused";

  /**
   * Structural mutations (delete, connect, retarget, import) are blocked
   * while a search is running/paused. After a finished run they are
   * allowed again — the stale highlights are cleared first.
   */
  const structuralGuard = useCallback(
    (fn: () => void) => {
      if (locked) {
        toast("warn", "Editing is locked while a search is running — Pause or Reset first.");
        return;
      }
      if (runner.status === "finished") runner.reset();
      fn();
    },
    [locked, runner, toast],
  );

  // Drop selection when the selected element disappears.
  useEffect(() => {
    if (!selection) return;
    const exists =
      selection.type === "node"
        ? editor.graph.nodes.some((n) => n.id === selection.id)
        : editor.graph.edges.some((e) => e.id === selection.id);
    if (!exists) setSelection(null);
  }, [editor.graph, selection]);

  // Esc cancels connect mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConnect({ active: false, sourceId: null });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ----------------------------- handlers ----------------------------- */

  const labelOf = useCallback(
    (id: string) => editor.graph.nodes.find((n) => n.id === id)?.label ?? id,
    [editor.graph],
  );

  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  const handleSelect = useCallback((sel: Selection) => {
    setSelection(sel);
    if (sel && !lockedRef.current) setTab("inspector");
  }, []);

  const handleNodeDrag = useCallback(
    (id: string, pos: Vec3) => editor.moveNode(id, pos),
    [editor],
  );

  const handleAddNodeAt = useCallback(
    (pos: Vec3) => {
      if (locked) {
        toast("warn", "Editing is locked while a search is running — Pause or Reset first.");
        return;
      }
      if (runner.status === "finished") runner.reset();
      const id = editor.addNode({ position: pos });
      setSelection({ type: "node", id });
    },
    [editor, locked, runner, toast],
  );

  const handleToggleConnect = useCallback(() => {
    if (locked) {
      toast("warn", "Editing is locked while a search is running — Pause or Reset first.");
      return;
    }
    setConnect((c) => ({ active: !c.active, sourceId: null }));
  }, [locked, toast]);

  const handleConnectPick = useCallback(
    (nodeId: string) => {
      if (locked) return;
      if (runner.status === "finished") runner.reset();
      const sourceId = connect.sourceId;
      if (!sourceId) {
        toast("info", `Source: ${labelOf(nodeId)} — now click the target node.`);
        setConnect({ active: true, sourceId: nodeId });
        return;
      }
      if (sourceId === nodeId) {
        setConnect({ active: true, sourceId: null });
        return;
      }
      const duplicate = editor.graph.edges.find(
        (e) => e.source === sourceId && e.target === nodeId && e.directed,
      );
      if (duplicate) {
        toast("info", "That directed connection already exists — it is now selected.");
        setSelection({ type: "edge", id: duplicate.id });
      } else {
        const id = editor.addEdge({ source: sourceId, target: nodeId, directed: true, weight: 3, width: 2 });
        setSelection({ type: "edge", id });
        toast("success", `Connected ${labelOf(sourceId)} → ${labelOf(nodeId)}.`);
      }
      setConnect({ active: false, sourceId: null });
    },
    [connect.sourceId, editor, labelOf, locked, runner, toast],
  );

  const handleConnectFrom = useCallback(
    (nodeId: string) => {
      if (locked) {
        toast("warn", "Editing is locked while a search is running — Pause or Reset first.");
        return;
      }
      setConnect({ active: true, sourceId: nodeId });
      toast("info", `Source: ${labelOf(nodeId)} — now click the target node.`);
    },
    [labelOf, locked, toast],
  );

  const handleUpdateNode = useCallback(
    (id: string, patch: Partial<GraphNode>) => editor.updateNode(id, patch),
    [editor],
  );

  const handleRemoveNode = useCallback(
    (id: string) =>
      structuralGuard(() => {
        editor.removeNode(id);
        setSelection(null);
        setConnect({ active: false, sourceId: null });
        toast("info", `Node "${labelOf(id)}" deleted.`);
      }),
    [editor, labelOf, structuralGuard, toast],
  );

  const handleUpdateEdge = useCallback(
    (id: string, patch: Partial<GraphEdge>) => {
      const structural =
        patch.source !== undefined || patch.target !== undefined || patch.directed !== undefined;
      if (structural) structuralGuard(() => editor.updateEdge(id, patch));
      else editor.updateEdge(id, patch);
    },
    [editor, structuralGuard],
  );

  const handleRemoveEdge = useCallback(
    (id: string) =>
      structuralGuard(() => {
        editor.removeEdge(id);
        setSelection(null);
        toast("info", "Edge deleted.");
      }),
    [editor, structuralGuard, toast],
  );

  const handleAutoLayout = useCallback(() => {
    if (locked) {
      toast("warn", "Auto Layout is locked while a search is running — Pause or Reset first.");
      return;
    }
    if (editor.graph.nodes.length === 0) return;
    const targets = computeForceLayout(editor.graph);
    const starts = new Map(editor.graph.nodes.map((n) => [n.id, { ...n.position }]));
    const t0 = performance.now();
    const DURATION = 750;
    cancelAnimationFrame(layoutRaf.current);
    setLayingOut(true);
    const frame = (now: number) => {
      const k = Math.min((now - t0) / DURATION, 1);
      const ease = 1 - (1 - k) ** 3;
      const next = new Map<string, Vec3>();
      for (const [id, target] of targets) {
        const s = starts.get(id);
        if (!s) continue;
        next.set(id, {
          x: s.x + (target.x - s.x) * ease,
          y: s.y + (target.y - s.y) * ease,
          z: s.z + (target.z - s.z) * ease,
        });
      }
      editor.setPositions(next);
      if (k < 1) layoutRaf.current = requestAnimationFrame(frame);
      else {
        setLayingOut(false);
        toast("info", "Layout applied — positions only. Weights and connections untouched.");
      }
    };
    layoutRaf.current = requestAnimationFrame(frame);
  }, [editor, locked, toast]);

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(editor.graph, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "archigraph.json";
    a.click();
    URL.revokeObjectURL(url);
    toast("success", "Graph exported as JSON.");
  }, [editor.graph, toast]);

  const handleImport = useCallback(
    (file: File) => {
      if (locked) {
        toast("warn", "Import is locked while a search is running — Pause or Reset first.");
        return;
      }
      file
        .text()
        .then((text) => {
          const data = JSON.parse(text);
          if (!isValidGraph(data)) {
            toast("warn", "Invalid graph file — expected { nodes: [...], edges: [...] }.");
            return;
          }
          const normalized: Graph = {
            nodes: data.nodes.map((n) => ({
              ...n,
              size: n.size ?? 1,
              position: { x: +n.position.x || 0, y: +n.position.y || 0, z: +n.position.z || 0 },
            })),
            edges: data.edges.map((e) => ({
              ...e,
              directed: e.directed ?? true,
              width: e.width ?? 2,
              weight: typeof e.weight === "number" ? e.weight : 1,
            })),
          };
          structuralGuard(() => {
            editor.replaceGraph(normalized);
            setSelection(null);
            toast("success", `Imported ${normalized.nodes.length} nodes and ${normalized.edges.length} edges.`);
            requestAnimationFrame(() => sceneRef.current?.fitToView());
          });
        })
        .catch(() => toast("warn", "Could not parse that file as JSON."));
    },
    [editor, locked, structuralGuard, toast],
  );

  const handleLoadSample = useCallback(() => {
    structuralGuard(() => {
      editor.resetToDefault();
      setSelection(null);
      toast("info", "Sample architecture restored.");
      requestAnimationFrame(() => sceneRef.current?.fitToView());
    });
  }, [editor, structuralGuard, toast]);

  /* ------------------------------ derived ----------------------------- */

  const nodeStates = runner.snapshot?.nodeStates ?? EMPTY_NODE_STATES;
  const edgeStates = runner.snapshot?.edgeStates ?? EMPTY_EDGE_STATES;

  const selectedEdge = useMemo(
    () =>
      selection?.type === "edge" ? (editor.graph.edges.find((e) => e.id === selection.id) ?? null) : null,
    [selection, editor.graph],
  );
  const selectedDist = selectedEdge ? edgeDistance(editor.graph, selectedEdge) : null;

  const statusHint = connect.active
    ? connect.sourceId
      ? `Connect: source "${labelOf(connect.sourceId)}" — click a target node`
      : "Connect: click a source node"
    : locked
      ? "Search running — orbit, zoom, Pause / Step / Reset remain available"
      : "Drag nodes · double-click space to add · click an edge for weight & 3D distance";

  /* ------------------------------- render ----------------------------- */

  return (
    <div className="flex h-full flex-col">
      <TopBar
        locked={locked || layingOut}
        connectActive={connect.active}
        labelSettings={editor.labelSettings}
        onAddNode={() =>
          structuralGuard(() => {
            const id = editor.addNode();
            setSelection({ type: "node", id });
          })
        }
        onToggleConnect={handleToggleConnect}
        onAutoLayout={handleAutoLayout}
        onFit={() => sceneRef.current?.fitToView()}
        onExport={handleExport}
        onImport={handleImport}
        onLabelSettings={editor.setLabelSettings}
        onLoadSample={handleLoadSample}
      />

      <div className="flex min-h-0 flex-1">
        {/* viewport */}
        <main className="relative min-w-0 flex-1">
          <Viewport
            graph={editor.graph}
            selection={selection}
            labelSettings={editor.labelSettings}
            connectActive={connect.active}
            connectSource={connect.sourceId}
            nodeStates={nodeStates}
            edgeStates={edgeStates}
            sceneRef={sceneRef}
            onSelect={handleSelect}
            onNodeDrag={handleNodeDrag}
            onAddNodeAt={handleAddNodeAt}
            onConnectPick={handleConnectPick}
          />

          {/* state legend */}
          {runner.status !== "idle" && (
            <div
              className="panel rise-in absolute bottom-3 left-3 z-10 rounded-lg px-3 py-2"
              style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.45)" }}
            >
              <div className="panel-title mb-1.5">Search states</div>
              <div className="flex flex-col gap-1">
                <LegendRow color="#55677d" label="Unvisited" dim />
                <LegendRow color={STATE_COLORS.frontier} label="Frontier / discovered" />
                <LegendRow color={STATE_COLORS.visiting} label="Visiting" />
                <LegendRow color={STATE_COLORS.visited} label="Visited" />
                <LegendRow color={STATE_COLORS.path} label="Final path" />
              </div>
            </div>
          )}

          {/* lock / progress badge */}
          {locked && (
            <div
              className="rise-in absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1.5"
              style={{
                borderColor: "rgba(255,178,36,0.45)",
                background: "rgba(13,18,26,0.88)",
                boxShadow: "0 6px 24px rgba(0,0,0,0.4)",
              }}
            >
              <span style={{ color: "var(--amber)" }}>
                <IconLock size={12} />
              </span>
              <span className="font-mono2 text-[10.5px]" style={{ color: "var(--amber-soft)" }}>
                editing locked · step {Math.max(runner.index + 1, 0)}/{runner.total}
              </span>
              <button type="button" className="btn h-5 px-2 text-[10px]" onClick={runner.pause}>
                Pause
              </button>
              <button type="button" className="btn h-5 px-2 text-[10px]" onClick={runner.reset}>
                Reset
              </button>
            </div>
          )}

          {/* connect mode hint */}
          {connect.active && (
            <div
              className="rise-in absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1.5"
              style={{
                borderColor: "rgba(62,197,206,0.5)",
                background: "rgba(13,18,26,0.88)",
              }}
            >
              <span style={{ color: "var(--cyan)" }}>
                <IconLink size={12} />
              </span>
              <span className="font-mono2 text-[10.5px]" style={{ color: "var(--text)" }}>
                {connect.sourceId
                  ? `source: ${labelOf(connect.sourceId)} — click the target node`
                  : "click a source node to connect"}
              </span>
              <button
                type="button"
                className="ml-1"
                style={{ color: "var(--faint)" }}
                onClick={() => setConnect({ active: false, sourceId: null })}
              >
                <IconX size={11} />
              </button>
            </div>
          )}

          {/* toasts */}
          <div className="absolute right-3 top-3 z-20 flex w-72 flex-col gap-1.5">
            {toasts.map((t) => (
              <div
                key={t.id}
                className="toast-in panel rounded-md border-l-2 px-3 py-2 text-[11.5px] leading-snug"
                style={{
                  borderLeftColor:
                    t.kind === "warn" ? "var(--red)" : t.kind === "success" ? "var(--green)" : "var(--cyan)",
                  boxShadow: "0 8px 26px rgba(0,0,0,0.45)",
                }}
              >
                {t.msg}
              </div>
            ))}
          </div>
        </main>

        {/* sidebar */}
        <aside
          className="z-10 flex w-[330px] flex-none flex-col border-l"
          style={{ borderColor: "var(--line)", background: "var(--panel2)" }}
        >
          <div className="flex flex-none border-b" style={{ borderColor: "var(--line)" }}>
            {(
              [
                ["graph", "Graph"],
                ["inspector", "Inspector"],
                ["algorithms", "Algorithms"],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className="font-display h-9 flex-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors"
                style={{
                  color: tab === id ? "var(--amber)" : "var(--muted)",
                  background: tab === id ? "rgba(255,178,36,0.06)" : "transparent",
                  boxShadow: tab === id ? "inset 0 -2px 0 var(--amber)" : "none",
                }}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            {tab === "graph" && (
              <GraphPanel
                graph={editor.graph}
                selection={selection}
                onSelect={handleSelect}
                onFocusNode={(id) => sceneRef.current?.focusNode(id)}
              />
            )}
            {tab === "inspector" && (
              <InspectorPanel
                graph={editor.graph}
                selection={selection}
                locked={locked}
                onUpdateNode={handleUpdateNode}
                onRemoveNode={handleRemoveNode}
                onUpdateEdge={handleUpdateEdge}
                onRemoveEdge={handleRemoveEdge}
                onConnectFrom={handleConnectFrom}
                onFocusNode={(id) => sceneRef.current?.focusNode(id)}
              />
            )}
            {tab === "algorithms" && <AlgorithmsPanel graph={editor.graph} runner={runner} />}
          </div>
        </aside>
      </div>

      {/* status bar */}
      <footer
        className="flex h-7 flex-none items-center gap-3 border-t px-3"
        style={{ borderColor: "var(--line)", background: "#0c1219" }}
      >
        <span className="font-mono2 truncate text-[10.5px]" style={{ color: "var(--faint)" }}>
          {statusHint}
        </span>
        <span className="flex-1" />
        {selectedEdge && (
          <span className="chip" style={{ color: "var(--cyan)", borderColor: "rgba(62,197,206,0.35)" }}>
            w:{selectedEdge.weight} · d:{selectedDist === null ? "—" : selectedDist.toFixed(2)}
          </span>
        )}
        <span className="chip">{editor.graph.nodes.length} nodes</span>
        <span className="chip">{editor.graph.edges.length} edges</span>
        {runner.status !== "idle" && (
          <span className="chip" style={{ color: "var(--amber)", borderColor: "rgba(255,178,36,0.35)" }}>
            {runner.status === "finished" ? "search finished — Reset clears highlights" : `search: ${runner.status}`}
          </span>
        )}
      </footer>
    </div>
  );
}

function LegendRow({ color, label, dim }: { color: string; label: string; dim?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-2.5 w-2.5 flex-none rounded-sm"
        style={{
          background: dim ? "transparent" : color,
          border: dim ? "1px dashed #55677d" : "none",
          boxShadow: dim ? "none" : `0 0 8px ${color}66`,
          opacity: dim ? 0.8 : 1,
        }}
      />
      <span className="font-mono2 text-[10.5px]" style={{ color: dim ? "var(--faint)" : "var(--muted)" }}>
        {label}
      </span>
    </div>
  );
}
