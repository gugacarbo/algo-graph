import type { Graph, GraphEdge, GraphNode, Selection } from "../../types";
import { KIND_META, NODE_KINDS, edgeColor, nodeColor } from "../../types";
import { edgeDistance } from "../../algorithms/graphUtils";
import { FieldRow, Range, SectionTitle, Select } from "../ui";
import { IconFocus, IconLink, IconPlus, IconTrash, IconX } from "../icons";

const SWATCHES = ["#5e7a96", "#ffb224", "#3ec5ce", "#4ea1ff", "#ff6b4a", "#7ee081", "#ff8a5c", "#c7d3e0"];

interface InspectorProps {
  graph: Graph;
  selection: Selection;
  locked: boolean;
  onUpdateNode: (id: string, patch: Partial<GraphNode>) => void;
  onRemoveNode: (id: string) => void;
  onUpdateEdge: (id: string, patch: Partial<GraphEdge>) => void;
  onRemoveEdge: (id: string) => void;
  onConnectFrom: (id: string) => void;
  onFocusNode: (id: string) => void;
}

export function InspectorPanel(p: InspectorProps) {
  const sel = p.selection;
  if (sel?.type === "node") {
    const node = p.graph.nodes.find((n) => n.id === sel.id);
    if (node) return <NodeInspector key={node.id} node={node} {...p} />;
  }
  if (sel?.type === "edge") {
    const edge = p.graph.edges.find((e) => e.id === sel.id);
    if (edge) return <EdgeInspector key={edge.id} edge={edge} {...p} />;
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="1.4" aria-hidden="true">
        <circle cx="6" cy="6" r="2.4" />
        <circle cx="18" cy="8" r="2.4" />
        <circle cx="11" cy="18" r="2.4" />
        <path d="M8.2 6.8l7.4 1M7 8l3 7.6M16.8 10.1l-4.6 6.2" />
      </svg>
      <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>
        Select a node or an edge in the viewport
        <br />
        or in the Graph tab to edit its properties.
      </div>
      <div className="font-mono2 text-[10px] leading-relaxed" style={{ color: "var(--faint)" }}>
        drag nodes · scroll to zoom
        <br />
        right-drag to pan · double-click to add
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function MetadataEditor({
  value,
  onChange,
  disabled,
}: {
  value: Record<string, string> | undefined;
  onChange: (v: Record<string, string>) => void;
  disabled?: boolean;
}) {
  const entries = Object.entries(value ?? {});
  const updateAt = (i: number, k: string, v: string) => {
    const next: Record<string, string> = {};
    entries.forEach(([key, val], j) => {
      if (j === i) {
        if (k.trim() !== "" || v.trim() !== "") next[k] = v;
      } else {
        next[key] = val;
      }
    });
    onChange(next);
  };
  return (
    <div>
      {entries.map(([k, v], i) => (
        // Index key is intentional: keys are user-editable, and keying by `k`
        // would remount the row (and drop focus) on every keystroke while renaming.
        // biome-ignore lint/suspicious/noArrayIndexKey: stable identity for editable keys
        <div key={i} className="mb-1 flex items-center gap-1">
          <input
            className="field field-mono h-6 flex-[1.1] text-[11px]"
            value={k}
            placeholder="key"
            disabled={disabled}
            onChange={(e) => updateAt(i, e.target.value, v)}
          />
          <input
            className="field field-mono h-6 flex-1 text-[11px]"
            value={v}
            placeholder="value"
            disabled={disabled}
            onChange={(e) => updateAt(i, k, e.target.value)}
          />
          <button
            type="button"
            className="btn icon-btn h-6 w-6 flex-none"
            title="Remove entry"
            disabled={disabled}
            onClick={() => {
              const next = { ...(value ?? {}) };
              delete next[k];
              onChange(next);
            }}
          >
            <IconX size={10} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn mt-1 h-6 w-full text-[11px]"
        disabled={disabled}
        onClick={() => {
          let name = "key";
          let i = 1;
          const cur = value ?? {};
          while (name in cur) name = `key${i++}`;
          onChange({ ...cur, [name]: "" });
        }}
      >
        <IconPlus size={10} /> entry
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function NodeInspector({ node, ...p }: InspectorProps & { node: GraphNode }) {
  const degree = p.graph.edges.filter((e) => e.source === node.id || e.target === node.id).length;
  return (
    <div className="rise-in flex h-full flex-col overflow-y-auto p-3">
      <SectionTitle
        right={<span className="chip">{degree} edge{degree === 1 ? "" : "s"}</span>}
      >
        Node · {node.label}
      </SectionTitle>

      <FieldRow label="Label">
        <input
          className="field"
          value={node.label}
          onChange={(e) => p.onUpdateNode(node.id, { label: e.target.value })}
        />
      </FieldRow>

      <FieldRow label="Kind" hint="changes the 3D shape">
        <Select
          value={node.kind}
          onChange={(e) => {
            const kind = e.target.value as GraphNode["kind"];
            p.onUpdateNode(node.id, { kind, color: KIND_META[kind].color });
          }}
        >
          {NODE_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_META[k].label}
            </option>
          ))}
        </Select>
      </FieldRow>

      <FieldRow label="Color">
        <div className="flex items-center gap-1.5">
          {SWATCHES.map((c) => (
            <button
              type="button"
              key={c}
              className="h-5 w-5 flex-none rounded-full border transition-transform hover:scale-110"
              style={{
                background: c,
                borderColor: nodeColor(node) === c ? "#fff" : "rgba(255,255,255,0.15)",
              }}
              onClick={() => p.onUpdateNode(node.id, { color: c })}
            />
          ))}
          <input
            type="color"
            className="swatch-input ml-auto"
            value={nodeColor(node)}
            onChange={(e) => p.onUpdateNode(node.id, { color: e.target.value })}
          />
        </div>
      </FieldRow>

      <FieldRow label="Size" hint={(node.size ?? 1).toFixed(2)}>
        <Range
          min={0.6}
          max={2}
          step={0.05}
          value={node.size ?? 1}
          onChange={(v) => p.onUpdateNode(node.id, { size: v })}
        />
      </FieldRow>

      <FieldRow label="Position" hint="drag in 3D or type">
        <div className="flex gap-1">
          {(["x", "y", "z"] as const).map((axis) => (
            <input
              key={axis}
              type="number"
              step={0.5}
              className="field field-mono text-[11px]"
              value={Math.round(node.position[axis] * 100) / 100}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!Number.isNaN(v))
                  p.onUpdateNode(node.id, { position: { ...node.position, [axis]: v } });
              }}
            />
          ))}
        </div>
      </FieldRow>

      <FieldRow label="Metadata">
        <MetadataEditor
          value={node.metadata}
          onChange={(m) => p.onUpdateNode(node.id, { metadata: m })}
        />
      </FieldRow>

      <div className="mt-auto flex gap-1.5 pt-3">
        <button type="button" className="btn flex-1" onClick={() => p.onConnectFrom(node.id)} disabled={p.locked}>
          <IconLink /> Connect from here
        </button>
        <button type="button" className="btn icon-btn" title="Focus camera" onClick={() => p.onFocusNode(node.id)}>
          <IconFocus />
        </button>
        <button
          type="button"
          className="btn btn-danger icon-btn"
          title="Delete node"
          disabled={p.locked}
          onClick={() => p.onRemoveNode(node.id)}
        >
          <IconTrash />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function EdgeInspector({ edge, ...p }: InspectorProps & { edge: GraphEdge }) {
  const source = p.graph.nodes.find((n) => n.id === edge.source);
  const target = p.graph.nodes.find((n) => n.id === edge.target);
  const dist = edgeDistance(p.graph, edge);
  const color = edgeColor(edge);

  return (
    <div className="rise-in flex h-full flex-col overflow-y-auto p-3">
      <SectionTitle right={<span className="chip">{edge.directed ? "directed" : "undirected"}</span>}>
        Edge · {edge.label || "connection"}
      </SectionTitle>

      <FieldRow label="Label">
        <input
          className="field"
          placeholder="e.g. HTTPS, gRPC…"
          value={edge.label ?? ""}
          onChange={(e) => p.onUpdateEdge(edge.id, { label: e.target.value })}
        />
      </FieldRow>

      <div className="grid grid-cols-2 gap-1.5">
        <FieldRow label="Source">
          <Select
            value={edge.source}
            disabled={p.locked}
            onChange={(e) => p.onUpdateEdge(edge.id, { source: e.target.value })}
          >
            {p.graph.nodes
              .filter((n) => n.id !== edge.target)
              .map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
          </Select>
        </FieldRow>
        <FieldRow label="Target">
          <Select
            value={edge.target}
            disabled={p.locked}
            onChange={(e) => p.onUpdateEdge(edge.id, { target: e.target.value })}
          >
            {p.graph.nodes
              .filter((n) => n.id !== edge.source)
              .map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
          </Select>
        </FieldRow>
      </div>

      <div className="mb-2.5 flex items-center justify-between">
        <span className="panel-title" style={{ fontSize: 10 }}>
          Directed
        </span>
        <label className="flex cursor-pointer items-center gap-2">
          <span className="font-mono2 text-[10px]" style={{ color: "var(--faint)" }}>
            {edge.directed ? "source → target only" : "traversable both ways"}
          </span>
          <input
            type="checkbox"
            className="cbx"
            checked={edge.directed ?? false}
            disabled={p.locked}
            onChange={(e) => p.onUpdateEdge(edge.id, { directed: e.target.checked })}
          />
        </label>
      </div>

      <FieldRow label="Color">
        <div className="flex items-center gap-1.5">
          {SWATCHES.map((c) => (
            <button
              type="button"
              key={c}
              className="h-5 w-5 flex-none rounded-full border transition-transform hover:scale-110"
              style={{ background: c, borderColor: color === c ? "#fff" : "rgba(255,255,255,0.15)" }}
              onClick={() => p.onUpdateEdge(edge.id, { color: c })}
            />
          ))}
          <input
            type="color"
            className="swatch-input ml-auto"
            value={color}
            onChange={(e) => p.onUpdateEdge(edge.id, { color: e.target.value })}
          />
        </div>
      </FieldRow>

      <FieldRow label="Weight" hint="logical cost used by Dijkstra / A*">
        <input
          type="number"
          step={0.5}
          className="field field-mono"
          value={edge.weight}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v)) p.onUpdateEdge(edge.id, { weight: v });
          }}
        />
      </FieldRow>

      <FieldRow label="Line width" hint={`${(edge.width ?? 2).toFixed(1)} px · visual only`}>
        <Range
          min={1}
          max={8}
          step={0.5}
          value={edge.width ?? 2}
          onChange={(v) => p.onUpdateEdge(edge.id, { width: v })}
        />
      </FieldRow>

      <FieldRow label="Metadata">
        <MetadataEditor value={edge.metadata} onChange={(m) => p.onUpdateEdge(edge.id, { metadata: m })} />
      </FieldRow>

      {/* read-only metrics */}
      <SectionTitle>Metrics</SectionTitle>
      <div className="rounded-lg border p-2.5" style={{ borderColor: "var(--line)", background: "var(--card-bg)" }}>
        <div className="flex items-center justify-between py-0.5">
          <span className="font-mono2 text-[10.5px] uppercase" style={{ color: "var(--faint)" }}>
            Source node
          </span>
          <span className="font-mono2 text-[11.5px]">{source?.label ?? "—"}</span>
        </div>
        <div className="flex items-center justify-between py-0.5">
          <span className="font-mono2 text-[10.5px] uppercase" style={{ color: "var(--faint)" }}>
            Target node
          </span>
          <span className="font-mono2 text-[11.5px]">{target?.label ?? "—"}</span>
        </div>
        <div className="my-1.5 h-px" style={{ background: "var(--line)" }} />
        <div className="flex items-center justify-between py-0.5">
          <span className="font-mono2 text-[10.5px] uppercase" style={{ color: "var(--amber-soft)" }}>
            Weight
          </span>
          <span className="font-display text-[15px] font-semibold" style={{ color: "var(--amber)" }}>
            {edge.weight}
          </span>
        </div>
        <div className="flex items-center justify-between py-0.5">
          <span className="font-mono2 text-[10.5px] uppercase" style={{ color: "var(--cyan)" }}>
            3D distance
          </span>
          <span className="font-display text-[15px] font-semibold" style={{ color: "var(--cyan)" }}>
            {dist === null ? "—" : dist.toFixed(2)}
          </span>
        </div>
        <p className="font-mono2 mt-2 text-[9.5px] leading-relaxed" style={{ color: "var(--faint)" }}>
          weight ≠ distance. Weight is set by you and feeds the algorithms; 3D distance is
          derived from node positions — drag a node and watch it change while the weight
          stays exactly the same.
        </p>
      </div>

      <div className="mt-auto pt-3">
        <button
          type="button"
          className="btn btn-danger w-full"
          disabled={p.locked}
          onClick={() => p.onRemoveEdge(edge.id)}
        >
          <IconTrash /> Delete edge
        </button>
      </div>
    </div>
  );
}
