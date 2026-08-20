import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import type { CameraSettings, LabelSettings } from "../types";
import {
  IconCamera,
  IconDownload,
  IconFocus,
  IconGear,
  IconLogo,
  IconTag,
  IconUpload,
  IconWand,
  IconX,
} from "./icons";
import { Range, Switch } from "./ui";

type Section = "labels" | "scene" | "camera" | "graph" | "about";

const SECTIONS: { id: Section; label: string; icon: ComponentType<{ size?: number }> }[] = [
  { id: "labels", label: "Edge labels", icon: IconTag },
  { id: "scene", label: "Scene", icon: IconFocus },
  { id: "camera", label: "Camera", icon: IconCamera },
  { id: "graph", label: "Graph data", icon: IconWand },
  { id: "about", label: "About", icon: IconGear },
];

interface SettingsDialogProps {
  onClose: () => void;
  labelSettings: LabelSettings;
  onLabelSettings: (s: LabelSettings) => void;
  particles: boolean;
  onParticles: (v: boolean) => void;
  reflections: boolean;
  onReflections: (v: boolean) => void;
  cameraSettings: CameraSettings;
  onCameraSettings: (s: CameraSettings) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onLoadSample: () => void;
}

export function SettingsDialog(p: SettingsDialogProps) {
  const [section, setSection] = useState<Section>("labels");
  const fileRef = useRef<HTMLInputElement>(null);

  // Escape closes; backdrop click closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") p.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p.onClose]);

  const LabelToggle = ({ k, label, hint }: { k: keyof LabelSettings; label: string; hint: string }) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 row-hover" style={{ borderColor: "var(--line)" }}>
      <input
        type="checkbox"
        className="cbx mt-0.5"
        checked={p.labelSettings[k]}
        onChange={(e) => p.onLabelSettings({ ...p.labelSettings, [k]: e.target.checked })}
      />
      <span>
        <span className="block text-[13px]">{label}</span>
        <span className="mt-0.5 block text-[11px]" style={{ color: "var(--faint)" }}>{hint}</span>
      </span>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal>
      <button
        type="button"
        aria-label="Close settings"
        className="absolute inset-0 border-0 bg-transparent p-0 focus:outline-none"
        style={{ background: "rgba(4,7,11,0.72)", backdropFilter: "blur(3px)" }}
        onClick={p.onClose}
      />

      <div
        className="panel rise-in relative flex w-[min(880px,94vw)] flex-col overflow-hidden rounded-xl"
        style={{ boxShadow: "0 30px 90px rgba(0,0,0,0.6)" }}
      >
        {/* header */}
        <div
          className="flex h-12 flex-none items-center gap-2.5 border-b px-4"
          style={{ borderColor: "var(--line)", background: "var(--header-bg)" }}
        >
          <span style={{ color: "var(--amber)" }}>
            <IconGear size={16} />
          </span>
          <span className="font-display text-[12px] font-bold uppercase tracking-[0.18em]">Settings</span>
          <span className="flex-1" />
          <button type="button" className="btn icon-btn" onClick={p.onClose} title="Close (Esc)">
            <IconX />
          </button>
        </div>

        <div className="flex min-h-0" style={{ height: "min(560px, 80vh)" }}>
          {/* left menu */}
          <nav
            className="w-48 flex-none p-2"
            style={{ borderColor: "var(--line)", background: "var(--panel2)" }}
          >
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[12.5px] transition-colors"
                style={{
                  color: section === s.id ? "var(--amber)" : "var(--text-muted)",
                  background: section === s.id ? "rgba(var(--amber-rgb),0.08)" : "transparent",
                  boxShadow: section === s.id ? "inset 2px 0 0 var(--amber)" : "none",
                }}
                onClick={() => setSection(s.id)}
              >
                <s.icon size={14} />
                {s.label}
              </button>
            ))}
          </nav>

          {/* right pane */}
          <div className="min-w-0 flex-1 overflow-y-auto border-l p-4" style={{ borderColor: "var(--line)" }}>
            {section === "labels" && (
              <div>
                <h2 className="font-display text-[14px] font-semibold">Edge labels</h2>
                <p className="mt-1 mb-4 text-[12px]" style={{ color: "var(--text-muted)" }}>
                  Which labels are always shown on the edges of the graph.
                </p>
                <div className="flex max-w-md flex-col gap-2">
                  <LabelToggle k="name" label="Name" hint="Edge label text" />
                  <LabelToggle k="weight" label="Weight" hint="Logical weight used by algorithms" />
                  <LabelToggle k="distance" label="3D distance" hint="Geometric distance in the viewport" />
                </div>
                <p className="mt-4 font-mono2 text-[10.5px]" style={{ color: "var(--faint)" }}>
                  Hovering or selecting an edge always shows all three.
                </p>
              </div>
            )}

            {section === "scene" && (
              <div>
                <h2 className="font-display text-[14px] font-semibold">Scene</h2>
                <p className="mt-1 mb-4 text-[12px]" style={{ color: "var(--text-muted)" }}>
                  Visual effects in the 3D viewport.
                </p>
                <div className="flex max-w-md flex-col gap-2">
                  <div
                    className="flex items-center justify-between rounded-md border px-3 py-2.5"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <span>
                      <span className="block text-[13px]">Particles</span>
                      <span className="mt-0.5 block text-[11px]" style={{ color: "var(--faint)" }}>
                        Ambient dust floating around the graph
                      </span>
                    </span>
                    <Switch checked={p.particles} onChange={p.onParticles} />
                  </div>
                  <div
                    className="flex items-center justify-between rounded-md border px-3 py-2.5"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <span>
                      <span className="block text-[13px]">Reflections</span>
                      <span className="mt-0.5 block text-[11px]" style={{ color: "var(--faint)" }}>
                        Glossy specular sheen on nodes and arrows
                      </span>
                    </span>
                    <Switch checked={p.reflections} onChange={p.onReflections} />
                  </div>
                </div>
              </div>
            )}

            {section === "camera" && (
              <div>
                <h2 className="font-display text-[14px] font-semibold">Camera</h2>
                <p className="mt-1 mb-4 text-[12px]" style={{ color: "var(--text-muted)" }}>
                  Feel and framing of the viewport. The 3D field of view applies to orbit mode and
                  the 2D one to the flat front view.
                </p>
                <div className="flex max-w-md flex-col gap-2">
                  <div
                    className="flex items-center justify-between gap-4 rounded-md border px-3 py-2.5"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <span>
                      <span className="block text-[13px]">Field of view</span>
                      <span className="mt-0.5 block text-[11px]" style={{ color: "var(--faint)" }}>
                        Lower = flatter, telephoto look · higher = wide-angle perspective
                      </span>
                    </span>
                    <span className="flex w-44 flex-none items-center gap-2">
                      <Range
                        min={5}
                        max={60}
                        step={1}
                        value={p.cameraSettings.fov}
                        onChange={(v) => p.onCameraSettings({ ...p.cameraSettings, fov: v })}
                      />
                      <span className="font-mono2 w-9 text-right text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {p.cameraSettings.fov}°
                      </span>
                    </span>
                  </div>
                  <div
                    className="flex items-center justify-between gap-4 rounded-md border px-3 py-2.5"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <span>
                      <span className="block text-[13px]">2D field of view</span>
                      <span className="mt-0.5 block text-[11px]" style={{ color: "var(--faint)" }}>
                        How much of the graph the flat 2D view shows
                      </span>
                    </span>
                    <span className="flex w-44 flex-none items-center gap-2">
                      <Range
                        min={5}
                        max={60}
                        step={1}
                        value={p.cameraSettings.fov2D}
                        onChange={(v) => p.onCameraSettings({ ...p.cameraSettings, fov2D: v })}
                      />
                      <span className="font-mono2 w-9 text-right text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {p.cameraSettings.fov2D}°
                      </span>
                    </span>
                  </div>
                  <div
                    className="flex items-center justify-between gap-4 rounded-md border px-3 py-2.5"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <span>
                      <span className="block text-[13px]">Inertia</span>
                      <span className="mt-0.5 block text-[11px]" style={{ color: "var(--faint)" }}>
                        Lower = floatier orbit · higher = snappier
                      </span>
                    </span>
                    <span className="flex w-44 flex-none items-center gap-2">
                      <Range
                        min={0.02}
                        max={0.2}
                        step={0.01}
                        value={p.cameraSettings.damping}
                        onChange={(v) => p.onCameraSettings({ ...p.cameraSettings, damping: v })}
                      />
                      <span className="font-mono2 w-9 text-right text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {p.cameraSettings.damping.toFixed(2)}
                      </span>
                    </span>
                  </div>
                  <div
                    className="flex items-center justify-between gap-4 rounded-md border px-3 py-2.5"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <span>
                      <span className="block text-[13px]">Orbit speed</span>
                      <span className="mt-0.5 block text-[11px]" style={{ color: "var(--faint)" }}>
                        How fast the camera rotates with the mouse
                      </span>
                    </span>
                    <span className="flex w-44 flex-none items-center gap-2">
                      <Range
                        min={0.5}
                        max={2}
                        step={0.1}
                        value={p.cameraSettings.orbitSpeed}
                        onChange={(v) => p.onCameraSettings({ ...p.cameraSettings, orbitSpeed: v })}
                      />
                      <span className="font-mono2 w-9 text-right text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {p.cameraSettings.orbitSpeed.toFixed(1)}×
                      </span>
                    </span>
                  </div>
                  <div
                    className="flex items-center justify-between rounded-md border px-3 py-2.5"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <span>
                      <span className="block text-[13px]">Auto-rotate</span>
                      <span className="mt-0.5 block text-[11px]" style={{ color: "var(--faint)" }}>
                        Slow turntable while idle — pauses whenever you interact
                      </span>
                    </span>
                    <Switch
                      checked={p.cameraSettings.autoRotate}
                      onChange={(v) => p.onCameraSettings({ ...p.cameraSettings, autoRotate: v })}
                    />
                  </div>
                  <div
                    className="flex items-center justify-between gap-4 rounded-md border px-3 py-2.5"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <span>
                      <span className="block text-[13px]">Auto-rotate delay</span>
                      <span className="mt-0.5 block text-[11px]" style={{ color: "var(--faint)" }}>
                        Idle time before the turntable starts
                      </span>
                    </span>
                    <span className="flex w-44 flex-none items-center gap-2">
                      <Range
                        min={0}
                        max={30}
                        step={1}
                        value={p.cameraSettings.autoRotateDelay}
                        onChange={(v) => p.onCameraSettings({ ...p.cameraSettings, autoRotateDelay: v })}
                        disabled={!p.cameraSettings.autoRotate}
                      />
                      <span className="font-mono2 w-9 text-right text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {p.cameraSettings.autoRotateDelay}s
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {section === "graph" && (
              <div>
                <h2 className="font-display text-[14px] font-semibold">Graph data</h2>
                <p className="mt-1 mb-4 text-[12px]" style={{ color: "var(--text-muted)" }}>
                  Import, export and reset the current graph. Everything is saved locally in your browser.
                </p>
                <div className="flex max-w-md flex-col gap-2">
                  <div className="flex items-center justify-between rounded-md border px-3 py-2.5" style={{ borderColor: "var(--line)" }}>
                    <span>
                      <span className="block text-[13px]">Import JSON</span>
                      <span className="mt-0.5 block text-[11px]" style={{ color: "var(--faint)" }}>
                        Load a graph from an exported .json file
                      </span>
                    </span>
                    <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
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
                  </div>
                  <div className="flex items-center justify-between rounded-md border px-3 py-2.5" style={{ borderColor: "var(--line)" }}>
                    <span>
                      <span className="block text-[13px]">Export JSON</span>
                      <span className="mt-0.5 block text-[11px]" style={{ color: "var(--faint)" }}>
                        Download the current graph as a file
                      </span>
                    </span>
                    <button type="button" className="btn" onClick={p.onExport}>
                      <IconDownload /> Export
                    </button>
                  </div>
                  <div className="flex items-center justify-between rounded-md border px-3 py-2.5" style={{ borderColor: "var(--line)" }}>
                    <span>
                      <span className="block text-[13px]">Sample architecture</span>
                      <span className="mt-0.5 block text-[11px]" style={{ color: "var(--faint)" }}>
                        Replace the current graph with the sample
                      </span>
                    </span>
                    <button type="button" className="btn" onClick={p.onLoadSample}>
                      <IconWand /> Restore
                    </button>
                  </div>
                </div>
              </div>
            )}

            {section === "about" && (
              <div>
                <h2 className="font-display text-[14px] font-semibold">About</h2>
                <div className="mt-4 flex items-center gap-3">
                  <span style={{ color: "var(--amber)" }}>
                    <IconLogo size={28} />
                  </span>
                  <div>
                    <div className="font-display text-[15px] font-bold tracking-[0.18em]">ARCHIGRAPH</div>
                    <div className="font-mono2 text-[10.5px]" style={{ color: "var(--faint)" }}>
                      3D architecture graph editor
                    </div>
                  </div>
                </div>
                <p className="mt-4 max-w-md text-[12px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  A 3D playground for weighted graphs: build architectures, run BFS, DFS, Dijkstra or
                  A* and watch the search states evolve node by node.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
