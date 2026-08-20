import { useEffect, useRef } from "react";
import { GraphScene } from "../engine/GraphScene";
import type { CameraSettings, Graph, LabelSettings, Selection, Vec3 } from "../types";
import type { EdgeAlgoState, NodeAlgoState } from "../algorithms/types";

interface ViewportProps {
  graph: Graph;
  selection: Selection;
  labelSettings: LabelSettings;
  particles: boolean;
  reflections: boolean;
  view2D: boolean;
  cameraSettings: CameraSettings;
  connectActive: boolean;
  connectSource: string | null;
  nodeStates: Map<string, NodeAlgoState>;
  edgeStates: Map<string, EdgeAlgoState>;
  sceneRef: { current: GraphScene | null };
  onSelect: (sel: Selection) => void;
  onNodeDrag: (id: string, pos: Vec3) => void;
  onAddNodeAt: (pos: Vec3) => void;
  onConnectPick: (nodeId: string) => void;
}

/**
 * Thin React wrapper: mounts the imperative GraphScene once and pushes
 * prop changes into it. User intent flows back through stable callbacks.
 */
export function Viewport(props: ViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const live = useRef(props);
  live.current = props;
  const {
    sceneRef,
    graph,
    selection,
    labelSettings,
    particles,
    reflections,
    view2D,
    cameraSettings,
    connectActive,
    connectSource,
    nodeStates,
    edgeStates,
  } = props;

  // Mounts once — latest props are read through the `live` ref, and
  // `sceneRef` is a stable ref object.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-once effect
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const scene = new GraphScene(el, {
      onSelect: (sel) => live.current.onSelect(sel),
      onNodeDrag: (id, pos) => live.current.onNodeDrag(id, pos),
      onNodeDragEnd: () => undefined,
      onAddNodeAt: (pos) => live.current.onAddNodeAt(pos),
      onConnectPick: (id) => live.current.onConnectPick(id),
    });
    sceneRef.current = scene;

    scene.setGraph(live.current.graph);
    scene.setSelection(live.current.selection);
    scene.setLabelSettings(live.current.labelSettings);
    scene.setParticles(live.current.particles);
    scene.setReflections(live.current.reflections);
    scene.set2DMode(live.current.view2D);
    scene.setCameraSettings(live.current.cameraSettings);
    scene.setConnectMode(live.current.connectActive, live.current.connectSource);
    scene.setAlgoStates(live.current.nodeStates, live.current.edgeStates);
    scene.fitToView();

    return () => {
      sceneRef.current = null;
      scene.dispose();
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setGraph(graph);
  }, [sceneRef, graph]);
  useEffect(() => {
    sceneRef.current?.setSelection(selection);
  }, [sceneRef, selection]);
  useEffect(() => {
    sceneRef.current?.setLabelSettings(labelSettings);
  }, [sceneRef, labelSettings]);
  useEffect(() => {
    sceneRef.current?.setParticles(particles);
  }, [sceneRef, particles]);
  useEffect(() => {
    sceneRef.current?.setReflections(reflections);
  }, [sceneRef, reflections]);
  useEffect(() => {
    sceneRef.current?.set2DMode(view2D);
  }, [sceneRef, view2D]);
  useEffect(() => {
    sceneRef.current?.setCameraSettings(cameraSettings);
  }, [sceneRef, cameraSettings]);
  useEffect(() => {
    sceneRef.current?.setConnectMode(connectActive, connectSource);
  }, [sceneRef, connectActive, connectSource]);
  useEffect(() => {
    sceneRef.current?.setAlgoStates(nodeStates, edgeStates);
  }, [sceneRef, nodeStates, edgeStates]);

  return <div ref={containerRef} className="viewport-bg absolute inset-0 overflow-hidden" />;
}
