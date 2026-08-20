import type { Graph, Selection } from "../../types";
import { KIND_META, edgeColor, nodeColor } from "../../types";
import { Dot, SectionTitle } from "../ui";
import { IconArrowRight, IconBidi, IconFocus } from "../icons";

interface GraphPanelProps {
  graph: Graph;
  selection: Selection;
  onSelect: (sel: Selection) => void;
  onFocusNode: (id: string) => void;
}

export function GraphPanel({ graph, selection, onSelect, onFocusNode }: GraphPanelProps) {
  const labelOf = (id: string) => graph.nodes.find((n) => n.id === id)?.label ?? id;

  return (
    <div className="flex h-full flex-col overflow-y-auto p-3">
      <SectionTitle
        right={<span className="chip">{graph.nodes.length} total</span>}
      >
        Nodes
      </SectionTitle>
      <div className="flex flex-col gap-1">
        {graph.nodes.map((n) => {
          const active = selection?.type === "node" && selection.id === n.id;
          return (
            <button
              type="button"
              key={n.id}
              aria-pressed={active}
              className="row-hover group flex w-full cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-left"
              style={{
                borderColor: active ? "rgba(var(--amber-rgb),0.55)" : "transparent",
                background: active ? "rgba(var(--amber-rgb),0.07)" : undefined,
              }}
              onClick={() => onSelect({ type: "node", id: n.id })}
            >
              <Dot color={nodeColor(n)} />
              <span className="flex-1 truncate text-[12px] font-medium">{n.label}</span>
              <span className="chip">{KIND_META[n.kind]?.label ?? n.kind}</span>
              <button
                type="button"
                className="btn icon-btn hidden h-5 w-5 group-hover:inline-flex"
                title="Focus camera"
                onClick={(e) => {
                  e.stopPropagation();
                  onFocusNode(n.id);
                }}
              >
                <IconFocus size={10} />
              </button>
            </button>
          );
        })}
        {graph.nodes.length === 0 && (
          <div className="font-mono2 text-[11px]" style={{ color: "var(--faint)" }}>
            Empty graph — add a node to begin.
          </div>
        )}
      </div>

      <SectionTitle right={<span className="chip">{graph.edges.length} total</span>}>
        Edges
      </SectionTitle>
      <div className="flex flex-col gap-1 pb-6">
        {graph.edges.map((e) => {
          const active = selection?.type === "edge" && selection.id === e.id;
          return (
            <button
              type="button"
              key={e.id}
              aria-pressed={active}
              className="row-hover flex w-full cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-left"
              style={{
                borderColor: active ? "rgba(var(--cyan-rgb),0.55)" : "transparent",
                background: active ? "rgba(var(--cyan-rgb),0.07)" : undefined,
              }}
              onClick={() => onSelect({ type: "edge", id: e.id })}
              title={e.label || undefined}
            >
              <span style={{ color: edgeColor(e) }}>
                {e.directed ? <IconArrowRight size={12} /> : <IconBidi size={12} />}
              </span>
              <span className="flex-1 truncate font-mono2 text-[11px]">
                {labelOf(e.source)}
                <span style={{ color: "var(--faint)" }}> {e.directed ? "→" : "↔"} </span>
                {labelOf(e.target)}
              </span>
              <span className="chip" style={{ color: "var(--amber-soft)", borderColor: "rgba(var(--amber-rgb),0.3)" }}>
                w:{e.weight}
              </span>
            </button>
          );
        })}
        {graph.edges.length === 0 && (
          <div className="font-mono2 text-[11px]" style={{ color: "var(--faint)" }}>
            No connections yet.
          </div>
        )}
      </div>
    </div>
  );
}
