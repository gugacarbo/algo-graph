import { useEffect, useState } from "react";
import type { Graph } from "../../types";
import { ALGORITHMS, runAlgorithm, type AlgorithmId } from "../../algorithms";
import type { AlgorithmRunner } from "../../hooks/useAlgorithmRunner";
import { FieldRow, Select, SectionTitle } from "../ui";
import { IconPause, IconPlay, IconReset, IconStep } from "../icons";

const SPEEDS = [0.25, 0.5, 1, 2, 4];

interface AlgorithmsPanelProps {
  graph: Graph;
  runner: AlgorithmRunner;
}

export function AlgorithmsPanel({ graph, runner }: AlgorithmsPanelProps) {
  const [algoId, setAlgoId] = useState<AlgorithmId>("dijkstra");
  const [startId, setStartId] = useState<string>(() =>
    graph.nodes.some((n) => n.id === "frontend") ? "frontend" : (graph.nodes[0]?.id ?? ""),
  );
  const [targetId, setTargetId] = useState<string>(() =>
    graph.nodes.some((n) => n.id === "postgres") ? "postgres" : "",
  );
  const [warn, setWarn] = useState<string | null>(null);

  const meta = ALGORITHMS.find((a) => a.id === algoId) ?? ALGORITHMS[0];
  const { status, snapshot } = runner;

  // Keep node picks valid when the graph changes.
  useEffect(() => {
    if (!graph.nodes.some((n) => n.id === startId)) setStartId(graph.nodes[0]?.id ?? "");
    if (targetId && !graph.nodes.some((n) => n.id === targetId)) setTargetId("");
  }, [graph, startId, targetId]);

  const labelOf = (id: string | null | undefined) =>
    id ? (graph.nodes.find((n) => n.id === id)?.label ?? id) : "—";

  const needsTarget = meta.requiresTarget;
  const canRun = startId !== "" && (!needsTarget || targetId !== "");

  const handleRun = () => {
    // Resume a paused/ready run instead of recomputing.
    if (status === "paused" || status === "ready") {
      runner.play();
      return;
    }
    const res = runAlgorithm(
      { graph, startId, targetId: targetId || undefined },
      algoId,
    );
    if (res.error) {
      setWarn(res.error);
      return;
    }
    setWarn(null);
    runner.begin(res.steps, { algo: algoId, startId, targetId: targetId || undefined });
  };

  const hasRun = status !== "idle";
  const progress = runner.total > 0 ? Math.max(runner.index + 1, 0) / runner.total : 0;

  const frontierRows = snapshot
    ? Array.from(snapshot.frontier.entries()).sort(
        (a, b) => (a[1] ?? Infinity) - (b[1] ?? Infinity),
      )
    : [];

  const statusChip = (() => {
    switch (status) {
      case "running":
        return { text: "RUNNING", color: "var(--amber)", pulse: true };
      case "paused":
        return { text: "PAUSED", color: "var(--blue)", pulse: false };
      case "ready":
        return { text: "READY", color: "var(--blue)", pulse: false };
      case "finished":
        return {
          text: snapshot?.found ? "PATH FOUND" : snapshot?.found === false ? "NO PATH" : "DONE",
          color: snapshot?.found ? "var(--green)" : snapshot?.found === false ? "var(--coral)" : "var(--cyan)",
          pulse: false,
        };
      default:
        return { text: "IDLE", color: "var(--faint)", pulse: false };
    }
  })();

  return (
    <div className="flex h-full flex-col overflow-y-auto p-3">
      <SectionTitle
        right={
          <span
            className={`chip ${statusChip.pulse ? "pulse-dot" : ""}`}
            style={{ color: statusChip.color, borderColor: statusChip.color }}
          >
            {statusChip.text}
          </span>
        }
      >
        Algorithms
      </SectionTitle>

      <FieldRow label="Algorithm">
        <Select value={algoId} onChange={(e) => setAlgoId(e.target.value as AlgorithmId)}>
          {ALGORITHMS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </FieldRow>
      <p className="font-mono2 -mt-1 mb-2.5 text-[10px] leading-relaxed" style={{ color: "var(--faint)" }}>
        {meta.tagline}
      </p>

      <div className="grid grid-cols-2 gap-1.5">
        <FieldRow label="Start node">
          <Select value={startId} onChange={(e) => setStartId(e.target.value)}>
            {graph.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label="Target node" hint={needsTarget ? "required" : "optional"}>
          <Select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
            <option value="">— none —</option>
            {graph.nodes
              .filter((n) => n.id !== startId)
              .map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
          </Select>
        </FieldRow>
      </div>

      {warn && (
        <div
          className="rise-in mb-2 rounded-md border px-2.5 py-2 text-[11px] leading-snug"
          style={{
            borderColor: "rgba(255,93,93,0.5)",
            background: "rgba(255,93,93,0.08)",
            color: "#ffb4b4",
          }}
        >
          {warn}
        </div>
      )}

      {/* transport */}
      <div className="mb-2 grid grid-cols-4 gap-1.5">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleRun}
          disabled={!canRun}
          title={needsTarget && !targetId ? "A* requires a target node" : "Run search"}
        >
          <IconPlay size={11} /> {status === "paused" || status === "ready" ? "Resume" : "Run"}
        </button>
        <button type="button" className="btn" onClick={runner.pause} disabled={status !== "running"} title="Pause">
          <IconPause size={11} />
        </button>
        <button
          type="button"
          className="btn"
          onClick={runner.step}
          disabled={!hasRun || status === "finished"}
          title="Advance exactly one logical step"
        >
          <IconStep size={11} />
        </button>
        <button type="button" className="btn" onClick={runner.reset} disabled={!hasRun} title="Reset Algorithm">
          <IconReset size={11} />
        </button>
      </div>

      {/* speed */}
      <div className="mb-3 flex items-center gap-2">
        <span className="panel-title" style={{ fontSize: 10 }}>
          Speed
        </span>
        <div className="flex flex-1 overflow-hidden rounded-md border" style={{ borderColor: "var(--line2)" }}>
          {SPEEDS.map((s) => (
            <button
              type="button"
              key={s}
              className="font-mono2 h-6 flex-1 text-[10.5px] transition-colors"
              style={{
                background: runner.speed === s ? "rgba(255,178,36,0.16)" : "transparent",
                color: runner.speed === s ? "var(--amber)" : "var(--muted)",
              }}
              onClick={() => runner.setSpeed(s)}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {/* execution state */}
      <SectionTitle
        right={
          hasRun ? (
            <span className="chip">
              step {Math.max(runner.index + 1, 0)} / {runner.total}
            </span>
          ) : undefined
        }
      >
        Execution
      </SectionTitle>

      <div
        className="rounded-lg border p-2.5"
        style={{ borderColor: "var(--line)", background: "rgba(10,15,22,0.6)" }}
      >
        {/* progress bar */}
        <div className="mb-2 h-1 overflow-hidden rounded-full" style={{ background: "var(--line)" }}>
          <div
            className="h-full rounded-full transition-all duration-200"
            style={{ width: `${progress * 100}%`, background: "var(--amber)" }}
          />
        </div>

        {!hasRun && (
          <p className="font-mono2 text-[10.5px] leading-relaxed" style={{ color: "var(--faint)" }}>
            Configure a search above and press Run. The traversal is animated step by step on
            the 3D graph — try Dijkstra from Frontend to PostgreSQL.
          </p>
        )}

        {hasRun && snapshot && (
          <div className="font-mono2 text-[11px] leading-[1.7]">
            <div className="flex justify-between">
              <span style={{ color: "var(--faint)" }}>Algorithm</span>
              <span>{ALGORITHMS.find((a) => a.id === runner.meta?.algo)?.name}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: "var(--faint)" }}>Current</span>
              <span style={{ color: "var(--amber)" }}>{labelOf(snapshot.current)}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: "var(--faint)" }}>Visited</span>
              <span>
                {snapshot.visitedOrder.length} / {graph.nodes.length}
              </span>
            </div>
            {snapshot.currentDistance !== null && (
              <div className="flex justify-between">
                <span style={{ color: "var(--faint)" }}>Current distance</span>
                <span style={{ color: "var(--amber-soft)" }}>{round(snapshot.currentDistance)}</span>
              </div>
            )}

            {!snapshot.finished && (
              <div className="mt-1.5">
                <div style={{ color: "var(--faint)" }}>Frontier:</div>
                {frontierRows.length === 0 && <div style={{ color: "var(--faint)" }}>— empty —</div>}
                <div className="max-h-24 overflow-y-auto pr-1">
                  {frontierRows.map(([id, d]) => (
                    <div key={id} className="flex justify-between" style={{ color: "var(--blue)" }}>
                      <span>- {labelOf(id)}</span>
                      <span>{d === null ? "" : `: ${round(d)}`}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {snapshot.finished && snapshot.found && snapshot.pathNodeIds && (
              <div className="rise-in mt-2 border-t pt-2" style={{ borderColor: "var(--line)" }}>
                <div className="font-display text-[12px] font-semibold" style={{ color: "var(--green)" }}>
                  Path found
                </div>
                <div className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--text)" }}>
                  {snapshot.pathNodeIds.map((id) => labelOf(id)).join(" → ")}
                </div>
                <div className="mt-1 flex justify-between">
                  <span style={{ color: "var(--faint)" }}>Total weight</span>
                  <span style={{ color: "var(--amber)" }}>{round(snapshot.totalWeight ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--faint)" }}>Visited nodes</span>
                  <span>{snapshot.visitedOrder.length}</span>
                </div>
              </div>
            )}

            {snapshot.finished && snapshot.found === false && (
              <div className="rise-in mt-2 border-t pt-2" style={{ borderColor: "var(--line)" }}>
                <div className="font-display text-[12px] font-semibold" style={{ color: "var(--coral)" }}>
                  No path found
                </div>
                <div className="mt-1 text-[10.5px] leading-relaxed" style={{ color: "var(--faint)" }}>
                  {labelOf(runner.meta?.startId)} cannot reach {labelOf(runner.meta?.targetId)} — the
                  search finished normally. Directed edges only allow source → target traversal.
                </div>
              </div>
            )}

            {snapshot.finished && snapshot.found === null && (
              <div className="rise-in mt-2 border-t pt-2" style={{ borderColor: "var(--line)" }}>
                <div className="font-display text-[12px] font-semibold" style={{ color: "var(--cyan)" }}>
                  Traversal complete
                </div>
                <div className="mt-1 flex justify-between">
                  <span style={{ color: "var(--faint)" }}>Visited nodes</span>
                  <span>{snapshot.visitedOrder.length}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="font-mono2 mt-3 pb-4 text-[9.5px] leading-relaxed" style={{ color: "var(--faint)" }}>
        Edges are traversed respecting <span style={{ color: "var(--muted)" }}>directed</span>: a
        directed edge only allows source → target. BFS/DFS ignore weights; Dijkstra minimizes
        accumulated weight; A* adds the live 3D geometric distance to the target as heuristic —
        geometric distance ≠ edge weight.
      </p>
    </div>
  );
}

function round(v: number): string {
  return Math.round(v * 100) / 100 % 1 === 0 ? String(Math.round(v)) : (Math.round(v * 100) / 100).toFixed(2);
}
