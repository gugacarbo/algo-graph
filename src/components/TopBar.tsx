import { useRef, useState } from "react";
import type { LabelSettings } from "../types";
import { useTheme } from "../hooks/useTheme";
import {
  IconDownload,
  IconFrame,
  IconGear,
  IconLink,
  IconLock,
  IconLogo,
  IconMoon,
  IconPlus,
  IconSun,
  IconTag,
  IconUpload,
  IconWand,
} from "./icons";

interface TopBarProps {
  locked: boolean;
  connectActive: boolean;
  view2D: boolean;
  onView2D: (v: boolean) => void;
  labelSettings: LabelSettings;
  onAddNode: () => void;
  onToggleConnect: () => void;
  onAutoLayout: () => void;
  onFit: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onLabelSettings: (s: LabelSettings) => void;
  onLoadSample: () => void;
  onOpenSettings: () => void;
}

export function TopBar(p: TopBarProps) {
  const [labelsOpen, setLabelsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { theme, toggleTheme } = useTheme();

  const LabelToggle = ({ k, label }: { k: keyof LabelSettings; label: string }) => (
    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 row-hover">
      <input
        type="checkbox"
        className="cbx"
        checked={p.labelSettings[k]}
        onChange={(e) => p.onLabelSettings({ ...p.labelSettings, [k]: e.target.checked })}
      />
      <span className="text-[12px]">{label}</span>
    </label>
  );

  return (
    <header
      className="relative z-20 flex h-12 flex-none items-center gap-2 border-b px-3"
      style={{ borderColor: "var(--line)", background: "var(--header-bg)" }}
    >
      {/* brand */}
      <div className="mr-2 flex items-center gap-2.5">
        <span style={{ color: "var(--amber)" }}>
          <IconLogo size={22} />
        </span>
        <div className="leading-none">
          <div className="font-display text-[14px] font-bold tracking-[0.18em]">
            ARCHIGRAPH
          </div>
          <div className="font-mono2 mt-0.5 text-[9px] uppercase tracking-[0.14em]" style={{ color: "var(--faint)" }}>
            3D architecture graph editor
          </div>
        </div>
      </div>

      <div className="mx-1 h-6 w-px" style={{ background: "var(--line)" }} />

      <button type="button" className="btn" onClick={p.onAddNode} disabled={p.locked} title="Add node (or double-click empty space)">
        <IconPlus /> Node
      </button>
      <button
        type="button"
        className={`btn ${p.connectActive ? "btn-on" : ""}`}
        onClick={p.onToggleConnect}
        disabled={p.locked}
        title="Connect two nodes: click source, then target"
      >
        <IconLink /> Connect
      </button>
      <button type="button" className="btn" onClick={p.onAutoLayout} disabled={p.locked} title="Re-arrange node positions only — weights and connections are untouched">
        <IconWand /> Auto Layout
      </button>
      <button type="button" className="btn icon-btn" onClick={p.onFit} title="Frame graph">
        <IconFrame />
      </button>

      {/* 2D / 3D camera switch */}
      <div
        className="relative flex h-[26px] w-[84px] flex-none items-center rounded-md border border-border bg-muted/50 p-0.5"
        title="2D: front view, drag pans · 3D: orbit"
      >
        <span
          aria-hidden
          className={`absolute bottom-0.5 top-0.5 left-0.5 w-[calc(50%-2px)] rounded-[5px] bg-primary/15 ring-1 ring-inset ring-primary/55 transition-transform duration-180 ${
            p.view2D ? "translate-x-0" : "translate-x-full"
          }`}
        />
        {(["2D", "3D"] as const).map((mode) => {
          const active = (mode === "2D") === p.view2D;
          return (
            <button
              key={mode}
              type="button"
              className={`font-mono2 relative z-[1] w-1/2 text-center text-[10.5px] font-semibold tracking-[0.08em] transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
              onClick={() => p.onView2D(mode === "2D")}
            >
              {mode}
            </button>
          );
        })}
      </div>

      <div className="relative">
        <button type="button" className={`btn ${labelsOpen ? "btn-on" : ""}`} onClick={() => setLabelsOpen((v) => !v)} title="Edge label visibility">
          <IconTag /> Labels
        </button>
        {labelsOpen && (
          <>
            {/* click-catcher backdrop; Escape also closes */}
            <button
              type="button"
              className="fixed inset-0 z-30 cursor-default"
              tabIndex={-1}
              aria-hidden
              onClick={() => setLabelsOpen(false)}
            />
            <div
              className="panel rise-in absolute left-0 top-9 z-40 w-52 rounded-lg p-2 shadow-2xl"
              style={{ boxShadow: "0 14px 40px rgba(0,0,0,0.5)" }}
            >
              <div className="panel-title mb-1.5 px-2">Edge labels</div>
              <LabelToggle k="name" label="Name" />
              <LabelToggle k="weight" label="Weight" />
              <LabelToggle k="distance" label="3D distance" />
              <div className="font-mono2 mt-1.5 px-2 pb-1 text-[9.5px] leading-relaxed" style={{ color: "var(--faint)" }}>
                Hovering or selecting an edge always shows all three.
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex-1" />

      {p.locked && (
        <span className="chip" style={{ borderColor: "rgba(var(--amber-rgb),0.4)", color: "var(--amber)" }}>
          <IconLock size={11} /> editing locked during search
        </span>
      )}

      <button
        type="button"
        className="btn"
        onClick={() => fileRef.current?.click()}
        disabled={p.locked}
        title="Import graph JSON"
      >
        <IconUpload /> Import
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) p.onImport(f);
          e.target.value = "";
        }}
      />
      <button type="button" className="btn" onClick={p.onExport} title="Export graph JSON">
        <IconDownload /> Export
      </button>
      <button type="button" className="btn" onClick={p.onLoadSample} disabled={p.locked} title="Restore the sample architecture">
        Sample
      </button>
      <button
        type="button"
        className="btn icon-btn"
        onClick={toggleTheme}
        title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      >
        {theme === "dark" ? <IconSun /> : <IconMoon />}
      </button>
      <button type="button" className="btn icon-btn" onClick={p.onOpenSettings} title="Settings">
        <IconGear />
      </button>
    </header>
  );
}
