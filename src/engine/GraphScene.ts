import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type {
  CameraSettings,
  Graph,
  GraphEdge,
  GraphNode,
  LabelSettings,
  NodeKind,
  Selection,
  Vec3,
  ViewPreset,
} from "../types";
import { DEFAULT_EDGE_COLOR, KIND_META, edgeColor, nodeColor, nodeRadius } from "../types";
import type { EdgeAlgoState, NodeAlgoState } from "../algorithms/types";

export interface GraphSceneCallbacks {
  onSelect: (sel: Selection | null) => void;
  onNodeDrag: (id: string, pos: Vec3) => void;
  onNodeDragEnd: (id: string, pos: Vec3) => void;
  onAddNodeAt: (pos: Vec3) => void;
  onConnectPick: (nodeId: string) => void;
}

interface LabelLine {
  text: string;
  font: string;
  color: string;
}

interface NodeRec {
  id: string;
  data: GraphNode;
  group: THREE.Group;
  mesh: THREE.Mesh;
  ring: THREE.Mesh;
  label: THREE.Sprite;
  kindSig: string;
  labelKey: string;
  phase: number;
  state: NodeAlgoState;
  targetScale: number;
}

interface EdgeRec {
  id: string;
  data: GraphEdge;
  geom: LineGeometry;
  line: Line2;
  mat: LineMaterial;
  overlay: Line2;
  overlayMat: LineMaterial;
  arrow: THREE.Mesh;
  label: THREE.Sprite;
  labelKey: string;
  labelVisible: boolean;
  state: EdgeAlgoState;
  dashSpeed: number;
}

const ALGO_NODE_COLOR: Record<NodeAlgoState, string> = {
  idle: "#ffffff",
  frontier: "#4ea1ff",
  visiting: "#ffb224",
  visited: "#3ec5ce",
  path: "#ff6b4a",
};

const ALGO_EDGE_COLOR: Record<EdgeAlgoState, string> = {
  idle: "#000000",
  traversing: "#ffb224",
  visited: "#3ec5ce",
  path: "#ff6b4a",
};

/** Visible half-height (world units) of the 2D orthographic view at zoom=1. */
const ORTHO_HALF_H = 22;

function makeKindGeometry(kind: NodeKind, size: number): THREE.BufferGeometry {
  const s = size;
  switch (kind) {
    case "gateway":
      return new THREE.OctahedronGeometry(1.2 * s, 0);
    case "database":
      return new THREE.CylinderGeometry(0.95 * s, 0.95 * s, 1.7 * s, 24);
    case "cache":
      return new THREE.IcosahedronGeometry(1.08 * s, 0);
    case "queue":
      return new THREE.TorusGeometry(0.85 * s, 0.38 * s, 14, 26);
    case "client":
      return new THREE.SphereGeometry(1.05 * s, 28, 20);
    default:
      return new THREE.BoxGeometry(1.55 * s, 1.55 * s, 1.55 * s);
  }
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Imperative Three.js renderer for the editor.
 * React owns the data; this class only mirrors it into WebGL and
 * reports user intent (selection, drags, picks) back through callbacks.
 */
export class GraphScene {
  private container: HTMLElement;
  private cb: GraphSceneCallbacks;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private ortho: THREE.OrthographicCamera;
  private controls: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2();
  private ro: ResizeObserver;
  private themeObserver: MutationObserver;

  private nodeRoot = new THREE.Group();
  private edgeRoot = new THREE.Group();
  private nodes = new Map<string, NodeRec>();
  private edges = new Map<string, EdgeRec>();

  private graph: Graph = { nodes: [], edges: [] };
  private selection: Selection | null = null;
  private hover: Selection | null = null;
  private labelSettings: LabelSettings = { name: true, weight: true, distance: false };
  private connectMode = false;
  private connectSource: string | null = null;

  private nodeStates = new Map<string, NodeAlgoState>();
  private edgeStates = new Map<string, EdgeAlgoState>();

  private dragging: { id: string; plane: THREE.Plane; offset: THREE.Vector3; dataZ: number } | null = null;
  /** 0 = full 3D depth, 1 = everything flattened to Z=0. Animated on toggle. */
  private zAnim: { from: number; to: number; t: number } | null = null;
  private downPos: { x: number; y: number } | null = null;
  private focusTween: {
    fromT: THREE.Vector3;
    toT: THREE.Vector3;
    fromC: THREE.Vector3;
    toC: THREE.Vector3;
    t: number;
    fromZoom?: number;
    toZoom?: number;
  } | null = null;

  private particles: THREE.Points;
  private shell: THREE.LineSegments;
  private reflections = true;
  private view2D = false;
  private autoRotateSetting = false;
  /** Seconds until auto-rotate may resume after the user last interacted. */
  private interactionCool = 0;
  private clock = new THREE.Clock();
  private raf = 0;
  private alive = true;
  private labelEpoch = 0;

  private onPointerDownB = (e: PointerEvent) => this.onPointerDown(e);
  private onPointerMoveB = (e: PointerEvent) => this.onPointerMove(e);
  private onPointerUpB = (e: PointerEvent) => this.onPointerUp(e);
  private onDblClickB = (e: MouseEvent) => this.onDblClick(e);
  private onWheelB = () => (this.interactionCool = 2);

  constructor(container: HTMLElement, cb: GraphSceneCallbacks) {
    this.container = container;
    this.cb = cb;

    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.setClearColor(0x000000, 0);
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = "block";

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 600);
    this.camera.position.set(27, 19, 34);

    // 2D mode renders through an orthographic camera — zero perspective
    // distortion: pan/zoom never change node scale.
    this.ortho = new THREE.OrthographicCamera(
      (-ORTHO_HALF_H * w) / h,
      (ORTHO_HALF_H * w) / h,
      ORTHO_HALF_H,
      -ORTHO_HALF_H,
      0.1,
      600,
    );
    this.ortho.position.copy(this.camera.position);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, -1, 0);
    this.controls.minDistance = 6;
    this.controls.maxDistance = 180;
    // Ortho zoom limits matching the dolly limits above.
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.controls.minZoom = ORTHO_HALF_H / (180 * tanHalf);
    this.controls.maxZoom = ORTHO_HALF_H / (6 * tanHalf);
    this.controls.autoRotateSpeed = 0.7;

    this.scene.fog = new THREE.Fog(0x0a0f16, 95, 240);

    // ---------- lights ----------
    this.scene.add(new THREE.HemisphereLight(0x33495f, 0x0a0f16, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 1.7);
    key.position.set(26, 36, 18);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x3ec5ce, 0.6);
    rim.position.set(-30, -10, -28);
    this.scene.add(rim);
    const warm = new THREE.DirectionalLight(0xffb224, 0.32);
    warm.position.set(18, -24, 26);
    this.scene.add(warm);

    // ---------- ambient scenery ----------
    const grid = new THREE.GridHelper(120, 60, 0x27405c, 0x15212e);
    grid.position.y = -17;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.45;
    this.scene.add(grid);

    const shellGeo = new THREE.IcosahedronGeometry(78, 1);
    this.shell = new THREE.LineSegments(
      new THREE.WireframeGeometry(shellGeo),
      new THREE.LineBasicMaterial({ color: 0x1b2b3d, transparent: true, opacity: 0.16 }),
    );
    this.scene.add(this.shell);

    const starCount = 420;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 40 + Math.random() * 75;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi) * 0.7;
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    this.particles = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({
        color: 0x3d5a7c,
        size: 0.55,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      }),
    );
    this.scene.add(this.particles);

    this.scene.add(this.edgeRoot);
    this.scene.add(this.nodeRoot);

    // Picking tolerance for fat lines. With worldUnits=false the threshold
    // is added to the line width in screen pixels — 12px keeps edge
    // clicking comfortable without stealing node hits.
    (this.raycaster.params as unknown as { Line2: { threshold: number } }).Line2 = {
      threshold: 12,
    };

    // ---------- events ----------
    const dom = this.renderer.domElement;
    dom.addEventListener("pointerdown", this.onPointerDownB);
    dom.addEventListener("pointermove", this.onPointerMoveB);
    window.addEventListener("pointerup", this.onPointerUpB);
    dom.addEventListener("dblclick", this.onDblClickB);
    dom.addEventListener("wheel", this.onWheelB, { passive: true });

    this.ro = new ResizeObserver(() => this.onResize());
    this.ro.observe(container);

    // Label sprites are canvas-baked — repaint them when the theme class flips.
    this.themeObserver = new MutationObserver(() => {
      if (!this.alive) return;
      this.relabelAll();
    });
    this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    // Rebuild text sprites once webfonts are ready.
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (!this.alive) return;
        this.relabelAll();
      });
    }

    this.tick();
  }

  /* ================================================================ */
  /* Public API                                                        */
  /* ================================================================ */

  setGraph(graph: Graph) {
    this.graph = graph;
    this.reconcileNodes();
    this.reconcileEdges();
    this.applyStates();
  }

  setSelection(sel: Selection | null) {
    this.selection = sel;
    this.applyStates();
    this.refreshEdgeLabels();
  }

  setLabelSettings(s: LabelSettings) {
    this.labelSettings = s;
    this.refreshEdgeLabels();
  }

  setParticles(enabled: boolean) {
    this.particles.visible = enabled;
  }

  setReflections(enabled: boolean) {
    this.reflections = enabled;
    for (const rec of this.nodes.values()) {
      const m = rec.mesh.material as THREE.MeshStandardMaterial;
      m.roughness = enabled ? 0.34 : 0.95;
      m.metalness = enabled ? 0.28 : 0;
    }
    for (const rec of this.edges.values()) {
      const m = rec.arrow.material as THREE.MeshStandardMaterial;
      m.roughness = enabled ? 0.4 : 0.95;
      m.metalness = enabled ? 0.2 : 0;
    }
  }

  /**
   * 2D mode = "2D in 3D": the camera is locked dead-on to the XY sheet
   * and renders through an orthographic projection (zero perspective
   * distortion), orbiting is disabled and left-drag pans instead.
   * All nodes are also flattened to the Z=0 plane (animated), so depth
   * doesn't shrink/fatten them or make them crowd each other. The graph
   * data keeps its original Z — going back to 3D restores full depth.
   */
  set2DMode(enabled: boolean) {
    if (this.view2D === enabled) return;
    this.zAnim = { from: this.view2D ? 1 : 0, to: enabled ? 1 : 0, t: 0 };
    this.view2D = enabled;
    this.controls.enableRotate = !enabled;
    this.controls.mouseButtons.LEFT = enabled ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    if (enabled) {
      const target = this.controls.target.clone();
      const dist = Math.max(this.camera.position.distanceTo(target), 12);
      // Keep the framing: match the perspective's visible half-height.
      const hh = dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
      this.ortho.zoom = ORTHO_HALF_H / hh;
      this.ortho.position.copy(target).add(new THREE.Vector3(0, 0, dist));
      this.ortho.updateProjectionMatrix();
      this.controls.object = this.ortho;
    } else {
      this.controls.object = this.camera;
    }
    this.controls.update();
  }

  /** Active camera: perspective in 3D, orthographic in 2D. */
  private cam(): THREE.Camera {
    return this.view2D ? this.ortho : this.camera;
  }

  setCameraSettings(s: CameraSettings) {
    this.camera.fov = s.fov;
    this.camera.updateProjectionMatrix();
    this.controls.dampingFactor = s.damping;
    this.controls.rotateSpeed = s.orbitSpeed;
    this.autoRotateSetting = s.autoRotate;
    if (!s.autoRotate) this.controls.autoRotate = false;
  }

  /** Tween the 3D camera to a preset angle, keeping target and distance. */
  setViewPreset(preset: ViewPreset) {
    if (this.view2D) return; // the front view already exists in 2D
    const DIRS: Record<ViewPreset, THREE.Vector3> = {
      top: new THREE.Vector3(0, 1, 0),
      front: new THREE.Vector3(0, 0, 1),
      side: new THREE.Vector3(1, 0, 0),
      iso: new THREE.Vector3(1, 0.75, 1).normalize(),
    };
    const target = this.controls.target.clone();
    const dist = THREE.MathUtils.clamp(
      this.camera.position.distanceTo(target),
      this.controls.minDistance,
      this.controls.maxDistance,
    );
    this.focusTween = {
      fromT: target.clone(),
      toT: target,
      fromC: this.camera.position.clone(),
      toC: target.clone().add(DIRS[preset].clone().multiplyScalar(dist)),
      t: 0,
    };
  }

  setConnectMode(active: boolean, sourceId: string | null) {
    this.connectMode = active;
    this.connectSource = sourceId;
    this.applyStates();
  }

  setAlgoStates(nodeStates: Map<string, NodeAlgoState>, edgeStates: Map<string, EdgeAlgoState>) {
    this.nodeStates = nodeStates;
    this.edgeStates = edgeStates;
    this.applyStates();
  }

  fitToView() {
    // Bounding box of the rendered positions (Z=0 while in 2D mode).
    const pts = Array.from(this.nodes.values()).map((r) => r.group.position);
    if (pts.length === 0) return;
    const box = new THREE.Box3();
    for (const p of pts) box.expandByPoint(p);
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(box.getBoundingSphere(new THREE.Sphere()).radius, 8);
    if (this.view2D) {
      // Same framing as the 3D fit, expressed as an ortho zoom.
      const hh = (radius * 2.6 + 12) * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
      const dist = Math.max(this.ortho.position.distanceTo(this.controls.target), 12);
      this.focusTween = {
        fromT: this.controls.target.clone(),
        toT: center,
        fromC: this.ortho.position.clone(),
        toC: center.clone().add(new THREE.Vector3(0, 0, dist)),
        t: 0,
        fromZoom: this.ortho.zoom,
        toZoom: ORTHO_HALF_H / hh,
      };
      return;
    }
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.focusTween = {
      fromT: this.controls.target.clone(),
      toT: center,
      fromC: this.camera.position.clone(),
      toC: center.clone().add(dir.multiplyScalar(radius * 2.6 + 12)),
      t: 0,
    };
  }

  focusNode(id: string) {
    const rec = this.nodes.get(id);
    if (!rec) return;
    const to = rec.group.position.clone();
    const cam = this.cam();
    const delta = to.clone().sub(this.controls.target);
    this.focusTween = {
      fromT: this.controls.target.clone(),
      toT: to,
      fromC: cam.position.clone(),
      toC: cam.position.clone().add(delta),
      t: 0,
    };
  }

  dispose() {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.themeObserver.disconnect();
    const dom = this.renderer.domElement;
    dom.removeEventListener("pointerdown", this.onPointerDownB);
    dom.removeEventListener("pointermove", this.onPointerMoveB);
    window.removeEventListener("pointerup", this.onPointerUpB);
    dom.removeEventListener("dblclick", this.onDblClickB);
    dom.removeEventListener("wheel", this.onWheelB);
    this.controls.dispose();
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = (mesh as { material?: THREE.Material | THREE.Material[] }).material;
      if (Array.isArray(mat)) {
        for (const m of mat) this.disposeMaterial(m);
      } else if (mat) {
        this.disposeMaterial(mat);
      }
    });
    this.renderer.dispose();
    if (dom.parentElement === this.container) this.container.removeChild(dom);
  }

  private disposeMaterial(m: THREE.Material) {
    const sm = m as THREE.SpriteMaterial;
    if (sm.map) sm.map.dispose();
    m.dispose();
  }

  /* ================================================================ */
  /* Reconciliation                                                    */
  /* ================================================================ */

  private reconcileNodes() {
    const seen = new Set<string>();
    for (const n of this.graph.nodes) {
      seen.add(n.id);
      let rec = this.nodes.get(n.id);
      if (!rec) {
        rec = this.createNodeRec(n);
        this.nodes.set(n.id, rec);
      } else {
        rec.data = n;
      }
      rec.group.position.set(n.position.x, n.position.y, this.nodeZ(n.position.z));

      const sig = `${n.kind}:${(n.size ?? 1).toFixed(2)}`;
      if (rec.kindSig !== sig) {
        rec.kindSig = sig;
        const geo = makeKindGeometry(n.kind, n.size ?? 1);
        rec.mesh.geometry.dispose();
        rec.mesh.geometry = geo;
        rec.mesh.rotation.x = n.kind === "queue" ? Math.PI / 2 : 0;
        rec.label.position.y = -(1.75 * (n.size ?? 1) + 1.25);
        rec.labelKey = "";
      }
      const mat = rec.mesh.material as THREE.MeshStandardMaterial;
      mat.color.set(nodeColor(n));
    }
    for (const [id, rec] of this.nodes) {
      if (!seen.has(id)) {
        this.nodeRoot.remove(rec.group);
        rec.mesh.geometry.dispose();
        (rec.mesh.material as THREE.Material).dispose();
        (rec.ring.material as THREE.Material).dispose();
        rec.ring.geometry.dispose();
        this.nodes.delete(id);
      }
    }
    this.refreshNodeLabels();
  }

  private createNodeRec(n: GraphNode): NodeRec {
    const group = new THREE.Group();
    const geo = makeKindGeometry(n.kind, n.size ?? 1);
    const mat = new THREE.MeshStandardMaterial({
      color: nodeColor(n),
      roughness: this.reflections ? 0.34 : 0.95,
      metalness: this.reflections ? 0.28 : 0,
      emissive: new THREE.Color(nodeColor(n)),
      emissiveIntensity: 0.18,
      transparent: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.nodeId = n.id;
    if (n.kind === "queue") mesh.rotation.x = Math.PI / 2;
    group.add(mesh);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.75, 0.055, 10, 48),
      new THREE.MeshBasicMaterial({ color: 0xffb224, transparent: true, opacity: 0.95 }),
    );
    ring.visible = false;
    group.add(ring);

    const label = this.makeSprite();
    label.position.set(0, -(1.75 * (n.size ?? 1) + 1.25), 0);
    group.add(label);

    group.position.set(n.position.x, n.position.y, n.position.z);
    this.nodeRoot.add(group);

    return {
      id: n.id,
      data: n,
      group,
      mesh,
      ring,
      label,
      kindSig: `${n.kind}:${(n.size ?? 1).toFixed(2)}`,
      labelKey: "",
      phase: (n.id.length * 7 + n.id.charCodeAt(0)) % 10,
      state: "idle",
      targetScale: 1,
    };
  }

  private reconcileEdges() {
    const seen = new Set<string>();
    for (const e of this.graph.edges) {
      seen.add(e.id);
      let rec = this.edges.get(e.id);
      if (!rec) {
        rec = this.createEdgeRec(e);
        this.edges.set(e.id, rec);
      } else {
        rec.data = e;
      }
      this.updateEdgeGeometry(rec);
    }
    for (const [id, rec] of this.edges) {
      if (!seen.has(id)) {
        this.edgeRoot.remove(rec.line);
        this.edgeRoot.remove(rec.overlay);
        this.edgeRoot.remove(rec.arrow);
        this.edgeRoot.remove(rec.label);
        rec.geom.dispose();
        rec.mat.dispose();
        rec.overlayMat.dispose();
        (rec.arrow.material as THREE.Material).dispose();
        rec.arrow.geometry.dispose();
        this.edges.delete(id);
      }
    }
    this.refreshEdgeLabels();
  }

  private createEdgeRec(e: GraphEdge): EdgeRec {
    const geom = new LineGeometry();
    geom.setPositions([0, 0, 0, 0, 0, 0]);

    const mat = new LineMaterial({
      color: edgeColor(e),
      linewidth: e.width ?? 2,
      transparent: true,
      opacity: 0.92,
      worldUnits: false,
      depthWrite: false,
    });
    mat.resolution.set(this.container.clientWidth, this.container.clientHeight);
    const line = new Line2(geom, mat);
    line.computeLineDistances();
    line.userData.edgeId = e.id;
    this.edgeRoot.add(line);

    const overlayMat = new LineMaterial({
      color: 0xffe3b3,
      linewidth: (e.width ?? 2) + 1,
      transparent: true,
      opacity: 0.95,
      worldUnits: false,
      dashed: true,
      dashSize: 1.1,
      gapSize: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    overlayMat.resolution.set(this.container.clientWidth, this.container.clientHeight);
    const overlay = new Line2(geom, overlayMat);
    overlay.computeLineDistances();
    overlay.visible = false;
    overlay.renderOrder = 5;
    this.edgeRoot.add(overlay);

    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.34, 0.95, 14),
      new THREE.MeshStandardMaterial({
        color: edgeColor(e),
        roughness: this.reflections ? 0.4 : 0.95,
        metalness: this.reflections ? 0.2 : 0,
        emissive: new THREE.Color(edgeColor(e)),
        emissiveIntensity: 0.35,
        transparent: true,
      }),
    );
    arrow.visible = false;
    this.edgeRoot.add(arrow);

    const label = this.makeSprite();
    this.edgeRoot.add(label);

    return {
      id: e.id,
      data: e,
      geom,
      line,
      mat,
      overlay,
      overlayMat,
      arrow,
      label,
      labelKey: "",
      labelVisible: false,
      state: "idle",
      dashSpeed: 0,
    };
  }

  /** Current flatten amount: 0 (3D) → 1 (everything at Z=0), eased while animating. */
  private flattenFactor(): number {
    if (!this.zAnim) return this.view2D ? 1 : 0;
    const k = Math.min(this.zAnim.t, 1);
    const ease = 1 - (1 - k) ** 3;
    return this.zAnim.from + (this.zAnim.to - this.zAnim.from) * ease;
  }

  /** Rendered Z for a node's data Z: collapses toward 0 while in 2D mode. */
  private nodeZ(dataZ: number): number {
    return dataZ * (1 - this.flattenFactor());
  }

  private updateEdgeGeometry(rec: EdgeRec) {
    // Use the *rendered* group positions so edges follow the 2D flattening.
    const s = this.nodes.get(rec.data.source);
    const t = this.nodes.get(rec.data.target);
    if (!s || !t) {
      rec.line.visible = false;
      rec.overlay.visible = false;
      rec.arrow.visible = false;
      rec.label.visible = false;
      return;
    }
    rec.line.visible = true;
    rec.label.visible = rec.labelVisible;

    const sp = s.group.position.clone();
    const tp = t.group.position.clone();
    const dir = tp.clone().sub(sp);
    const len = dir.length();
    const d = len > 0.0001 ? dir.clone().normalize() : new THREE.Vector3(0, 1, 0);

    const rs = nodeRadius(s.data) * 1.15;
    const rt = nodeRadius(t.data) * 1.15;
    const usable = Math.max(len - rs - rt, 0.2);
    const start = sp.clone().add(d.clone().multiplyScalar(Math.min(rs, len / 2 - 0.1)));
    const end = start.clone().add(d.clone().multiplyScalar(usable));

    this.geomSetPositions(rec.geom, start, end);
    rec.line.computeLineDistances();
    rec.overlay.computeLineDistances();

    if (rec.data.directed) {
      rec.arrow.visible = true;
      rec.arrow.position.copy(end.clone().sub(d.clone().multiplyScalar(0.5)));
      rec.arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    } else {
      rec.arrow.visible = false;
    }

    rec.label.position.copy(start.clone().add(end).multiplyScalar(0.5).add(new THREE.Vector3(0, 1.15, 0)));
  }

  private geomSetPositions(geom: LineGeometry, a: THREE.Vector3, b: THREE.Vector3) {
    geom.setPositions([a.x, a.y, a.z, b.x, b.y, b.z]);
  }

  /* ================================================================ */
  /* Labels (canvas sprites)                                           */
  /* ================================================================ */

  /** Force a full repaint of every label sprite (fonts, theme). */
  private relabelAll() {
    this.labelEpoch++;
    for (const rec of this.nodes.values()) rec.labelKey = "";
    for (const rec of this.edges.values()) rec.labelKey = "";
    this.refreshEdgeLabels();
    this.refreshNodeLabels();
  }

  /** Text colors for baked label sprites, per theme. */
  private labelColors() {
    return document.documentElement.classList.contains("dark")
      ? { text: "#eaf2fb", sub: "#8fa5bd", accent: "#ffce6b", cyan: "#7fd4da" }
      : { text: "#16202c", sub: "#5b6c80", accent: "#9a5304", cyan: "#0e7490" };
  }

  private makeSprite(): THREE.Sprite {
    const mat = new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.renderOrder = 20;
    return sprite;
  }

  private paintSprite(
    sprite: THREE.Sprite,
    lines: LabelLine[],
    scaleK: number,
    padX = 16,
    padY = 12,
  ) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const measure = lines.map((l) => {
      ctx.font = l.font;
      return ctx.measureText(l.text).width;
    });
    const w = Math.max(...measure, 40) + padX * 2;
    const lineH = 34;
    const h = lines.length * lineH + padY * 2 - 8;
    canvas.width = Math.ceil(w);
    canvas.height = Math.ceil(h);

    const dark = document.documentElement.classList.contains("dark");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    roundedRect(ctx, 1, 1, canvas.width - 2, canvas.height - 2, 10);
    ctx.fillStyle = dark ? "rgba(9, 14, 21, 0.82)" : "rgba(255, 255, 255, 0.94)";
    ctx.fill();
    ctx.strokeStyle = dark ? "rgba(126, 152, 182, 0.28)" : "rgba(91, 108, 128, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textBaseline = "middle";
    lines.forEach((l, i) => {
      ctx.font = l.font;
      ctx.fillStyle = l.color;
      ctx.fillText(l.text, padX, padY + i * lineH + 13);
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const mat = sprite.material as THREE.SpriteMaterial;
    if (mat.map) mat.map.dispose();
    mat.map = tex;
    mat.needsUpdate = true;
    sprite.scale.set(canvas.width * scaleK, canvas.height * scaleK, 1);
  }

  private refreshNodeLabels() {
    for (const rec of this.nodes.values()) {
      const n = rec.data;
      const key = `n${this.labelEpoch}|${n.label}|${n.kind}`;
      if (rec.labelKey === key) continue;
      rec.labelKey = key;
      const lc = this.labelColors();
      this.paintSprite(
        rec.label,
        [
          { text: n.label, font: '600 30px "Chakra Petch", sans-serif', color: lc.text },
          {
            text: KIND_META[n.kind]?.label.toUpperCase() ?? n.kind.toUpperCase(),
            font: '500 19px "IBM Plex Mono", monospace',
            color: KIND_META[n.kind]?.color ?? lc.sub,
          },
        ],
        0.0165,
      );
    }
  }

  private refreshEdgeLabels() {
    for (const rec of this.edges.values()) {
      const e = rec.data;
      const s = this.nodes.get(e.source);
      const t = this.nodes.get(e.target);
      if (!s || !t) {
        rec.label.visible = false;
        continue;
      }
      const isFocus =
        (this.selection?.type === "edge" && this.selection.id === e.id) ||
        (this.hover?.type === "edge" && this.hover.id === e.id);
      const ls = this.labelSettings;
      const lc = this.labelColors();
      const arrow = e.directed ? "→" : "↔";
      // Rendered distance — flat (X/Y) in 2D mode, full 3D otherwise.
      const sp = s.group.position;
      const tp = t.group.position;
      const dist = Math.sqrt(
        (tp.x - sp.x) ** 2 +
          (tp.y - sp.y) ** 2 +
          (tp.z - sp.z) ** 2,
      );

      const lines: LabelLine[] = [];
      if (isFocus || ls.name) {
        lines.push({
          text: e.label ? e.label : `${s.data.label} ${arrow} ${t.data.label}`,
          font: '600 25px "Chakra Petch", sans-serif',
          color: lc.text,
        });
        if (isFocus && e.label) {
          lines.push({
            text: `${s.data.label} ${arrow} ${t.data.label}`,
            font: '500 19px "IBM Plex Mono", monospace',
            color: lc.sub,
          });
        }
      }
      if (isFocus || ls.weight) {
        lines.push({
          text: `weight: ${e.weight}`,
          font: '500 21px "IBM Plex Mono", monospace',
          color: lc.accent,
        });
      }
      if (isFocus || ls.distance) {
        lines.push({
          text: `distance: ${dist.toFixed(2)}`,
          font: '500 21px "IBM Plex Mono", monospace',
          color: lc.cyan,
        });
      }

      const key = `${this.labelEpoch}|${isFocus ? 1 : 0}|${lines.map((l) => l.text).join("¶")}`;
      if (rec.labelKey !== key) {
        rec.labelKey = key;
        if (lines.length > 0) this.paintSprite(rec.label, lines, 0.0118, 14, 10);
      }
      rec.labelVisible = lines.length > 0;
      rec.label.visible = rec.labelVisible;
    }
    this.applyStates();
  }

  /* ================================================================ */
  /* Visual state                                                      */
  /* ================================================================ */

  private applyStates() {
    const algoActive = this.nodeStates.size > 0 || this.edgeStates.size > 0;

    for (const rec of this.nodes.values()) {
      const st: NodeAlgoState = this.nodeStates.get(rec.id) ?? "idle";
      rec.state = st;
      const mat = rec.mesh.material as THREE.MeshStandardMaterial;
      const base = nodeColor(rec.data);
      const color = st === "idle" ? base : ALGO_NODE_COLOR[st];
      mat.color.set(color);
      mat.emissive.set(color);
      mat.emissiveIntensity =
        st === "idle" ? 0.18 : st === "frontier" ? 0.55 : st === "visiting" ? 0.95 : st === "visited" ? 0.5 : 0.95;
      mat.opacity = algoActive && st === "idle" ? 0.32 : 1;
      (rec.label.material as THREE.SpriteMaterial).opacity = algoActive && st === "idle" ? 0.22 : 0.96;
      rec.targetScale = st === "path" ? 1.18 : 1;

      // ring priority: selection > connect source > path
      const ringMat = rec.ring.material as THREE.MeshBasicMaterial;
      const selected = this.selection?.type === "node" && this.selection.id === rec.id;
      const isSource = this.connectMode && this.connectSource === rec.id;
      if (selected) {
        rec.ring.visible = true;
        ringMat.color.set("#ffb224");
        rec.ring.scale.setScalar(nodeRadius(rec.data) / 1.75 * 1.05);
      } else if (isSource) {
        rec.ring.visible = true;
        ringMat.color.set("#3ec5ce");
        rec.ring.scale.setScalar(nodeRadius(rec.data) / 1.75 * 1.05);
      } else if (st === "path") {
        rec.ring.visible = true;
        ringMat.color.set("#ff6b4a");
        rec.ring.scale.setScalar(nodeRadius(rec.data) / 1.75 * 1.12);
      } else {
        rec.ring.visible = false;
      }
    }

    for (const rec of this.edges.values()) {
      const st: EdgeAlgoState = this.edgeStates.get(rec.id) ?? "idle";
      rec.state = st;
      const base = rec.data.color ?? DEFAULT_EDGE_COLOR;
      const color = st === "idle" ? base : ALGO_EDGE_COLOR[st];
      const baseW = rec.data.width ?? 2;

      rec.mat.color.set(color);
      rec.mat.linewidth =
        st === "path" ? baseW + 3 : st === "traversing" ? baseW + 1.6 : st === "visited" ? baseW + 0.6 : baseW;
      rec.mat.opacity = algoActive && st === "idle" ? 0.14 : 0.92;

      const active = st === "traversing" || st === "path";
      rec.overlay.visible = active && rec.line.visible;
      rec.overlayMat.color.set(st === "path" ? 0xffb3a0 : 0xffe3b3);
      rec.overlayMat.linewidth = rec.mat.linewidth + 0.8;
      rec.dashSpeed = st === "path" ? -2.4 : -6;

      const arrowMat = rec.arrow.material as THREE.MeshStandardMaterial;
      arrowMat.color.set(color);
      arrowMat.emissive.set(color);
      arrowMat.opacity = rec.mat.opacity;

      (rec.label.material as THREE.SpriteMaterial).opacity = algoActive && st === "idle" ? 0.14 : 0.96;
    }
  }

  /* ================================================================ */
  /* Picking & interaction                                             */
  /* ================================================================ */

  private setPointerFromEvent(e: { clientX: number; clientY: number }) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private pickNode(): NodeRec | null {
    this.raycaster.setFromCamera(this.pointerNdc, this.cam());
    const meshes = Array.from(this.nodes.values()).map((r) => r.mesh);
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return null;
    const id = hits[0].object.userData.nodeId as string;
    return this.nodes.get(id) ?? null;
  }

  private pickEdge(): EdgeRec | null {
    this.raycaster.setFromCamera(this.pointerNdc, this.cam());
    const lines = Array.from(this.edges.values())
      .filter((r) => r.line.visible)
      .map((r) => r.line);
    const hits = this.raycaster.intersectObjects(lines, false);
    if (hits.length === 0) return null;
    const id = hits[0].object.userData.edgeId as string;
    return this.edges.get(id) ?? null;
  }

  private onPointerDown(e: PointerEvent) {
    this.interactionCool = 2;
    if (e.button !== 0) return;
    this.downPos = { x: e.clientX, y: e.clientY };
    this.setPointerFromEvent(e);
    const node = this.pickNode();
    if (node && !this.connectMode) {
      const camDir = this.cam().getWorldDirection(new THREE.Vector3());
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, node.group.position);
      const hit = this.raycaster.ray.intersectPlane(plane, new THREE.Vector3());
      if (hit) {
        this.dragging = {
          id: node.id,
          plane,
          offset: node.group.position.clone().sub(hit),
          dataZ: node.data.position.z,
        };
        this.controls.enabled = false;
        this.renderer.domElement.style.cursor = "grabbing";
      }
    }
  }

  private onPointerMove(e: PointerEvent) {
    this.setPointerFromEvent(e);

    if (this.dragging) {
      this.raycaster.setFromCamera(this.pointerNdc, this.cam());
      const hit = this.raycaster.ray.intersectPlane(this.dragging.plane, new THREE.Vector3());
      if (hit) {
        const p = hit.add(this.dragging.offset);
        const rec = this.nodes.get(this.dragging.id);
        if (rec) {
          // In 2D the drag plane is Z=0, but the node keeps its original
          // depth in the data so 3D restores it unchanged.
          rec.group.position.set(p.x, p.y, this.view2D ? this.nodeZ(this.dragging.dataZ) : p.z);
        }
        const pos = {
          x: Math.round(p.x * 100) / 100,
          y: Math.round(p.y * 100) / 100,
          z: this.view2D ? this.dragging.dataZ : Math.round(p.z * 100) / 100,
        };
        // Live-update dependent edge geometry + distance labels.
        for (const erec of this.edges.values()) {
          if (erec.data.source === this.dragging.id || erec.data.target === this.dragging.id) {
            const s = this.nodes.get(erec.data.source);
            const t = this.nodes.get(erec.data.target);
            if (s && t) {
              this.updateEdgeGeometryFrom(s.group.position, t.group.position, erec, s.data, t.data);
              erec.labelKey = "";
            }
          }
        }
        this.refreshEdgeLabels();
        this.cb.onNodeDrag(this.dragging.id, pos);
      }
      return;
    }

    // Hover detection (click-drag orbit also passes here — cheap enough).
    const prevHover = this.hover;
    const node = this.pickNode();
    if (node) {
      this.hover = { type: "node", id: node.id };
    } else {
      const edge = this.pickEdge();
      this.hover = edge ? { type: "edge", id: edge.id } : null;
    }
    const changed =
      (prevHover?.type !== this.hover?.type || prevHover?.id !== this.hover?.id);
    this.renderer.domElement.style.cursor = this.hover
      ? "pointer"
      : this.connectMode
        ? "crosshair"
        : "grab";
    if (changed) {
      this.applyHoverScales();
      if (this.hover?.type === "edge" || prevHover?.type === "edge") this.refreshEdgeLabels();
    }
  }

  private applyHoverScales() {
    for (const rec of this.nodes.values()) {
      const hovered = this.hover?.type === "node" && this.hover.id === rec.id;
      rec.group.userData.hoverBoost = hovered ? 1.1 : 1;
    }
  }

  private updateEdgeGeometryFrom(
    sp: THREE.Vector3,
    tp: THREE.Vector3,
    rec: EdgeRec,
    s: GraphNode,
    t: GraphNode,
  ) {
    const dir = tp.clone().sub(sp);
    const len = dir.length();
    const d = len > 0.0001 ? dir.clone().normalize() : new THREE.Vector3(0, 1, 0);
    const rs = nodeRadius(s) * 1.15;
    const usable = Math.max(len - rs - nodeRadius(t) * 1.15, 0.2);
    const start = sp.clone().add(d.clone().multiplyScalar(Math.min(rs, len / 2 - 0.1)));
    const end = start.clone().add(d.clone().multiplyScalar(usable));
    this.geomSetPositions(rec.geom, start, end);
    rec.line.computeLineDistances();
    rec.overlay.computeLineDistances();
    if (rec.data.directed) {
      rec.arrow.position.copy(end.clone().sub(d.clone().multiplyScalar(0.5)));
      rec.arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    }
    rec.label.position.copy(start.clone().add(end).multiplyScalar(0.5).add(new THREE.Vector3(0, 1.15, 0)));
  }

  private onPointerUp(e: PointerEvent) {
    if (this.dragging) {
      const rec = this.nodes.get(this.dragging.id);
      this.dragging = null;
      this.controls.enabled = true;
      this.renderer.domElement.style.cursor = "grab";
      if (rec) {
        this.cb.onNodeDragEnd(rec.id, {
          x: rec.group.position.x,
          y: rec.group.position.y,
          z: rec.group.position.z,
        });
      }
      return;
    }
    if (!this.downPos) return;
    const dx = e.clientX - this.downPos.x;
    const dy = e.clientY - this.downPos.y;
    this.downPos = null;
    if (dx * dx + dy * dy > 25) return; // it was an orbit drag
    if (e.target !== this.renderer.domElement) return;

    this.setPointerFromEvent(e);
    const node = this.pickNode();
    if (node) {
      if (this.connectMode) this.cb.onConnectPick(node.id);
      else this.cb.onSelect({ type: "node", id: node.id });
      return;
    }
    const edge = this.pickEdge();
    if (edge) {
      this.cb.onSelect({ type: "edge", id: edge.id });
      return;
    }
    this.cb.onSelect(null);
  }

  private onDblClick(e: MouseEvent) {
    this.setPointerFromEvent(e);
    if (this.pickNode() || this.pickEdge()) return;
    this.raycaster.setFromCamera(this.pointerNdc, this.cam());
    const camDir = this.cam().getWorldDirection(new THREE.Vector3());
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, new THREE.Vector3(0, 0, 0));
    const hit = this.raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    if (!hit) return;
    const clampV = (v: number) => Math.max(-40, Math.min(40, v));
    this.cb.onAddNodeAt({
      x: Math.round(clampV(hit.x) * 10) / 10,
      y: Math.round(clampV(hit.y) * 10) / 10,
      z: Math.round(clampV(hit.z) * 10) / 10,
    });
  }

  private onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const a = w / h;
    this.ortho.left = -ORTHO_HALF_H * a;
    this.ortho.right = ORTHO_HALF_H * a;
    this.ortho.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    for (const rec of this.edges.values()) {
      rec.mat.resolution.set(w, h);
      rec.overlayMat.resolution.set(w, h);
    }
  }

  /* ================================================================ */
  /* Render loop                                                       */
  /* ================================================================ */

  private tick = () => {
    if (!this.alive) return;
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const t = this.clock.elapsedTime;

    // Auto-rotate: spins while idle, pauses on interaction, resumes after a cooldown.
    if (this.autoRotateSetting) {
      this.interactionCool -= dt;
      this.controls.autoRotate =
        !this.view2D &&
        this.downPos === null &&
        this.dragging === null &&
        this.focusTween === null &&
        this.interactionCool <= 0;
    }

    this.controls.update();

    // 2D flatten / unflatten: nodes ease toward Z=0 (and back), edges follow.
    if (this.zAnim) {
      this.zAnim.t += dt / 0.45;
      for (const rec of this.nodes.values()) {
        rec.group.position.z = this.nodeZ(rec.data.position.z);
      }
      for (const rec of this.edges.values()) this.updateEdgeGeometry(rec);
      this.refreshEdgeLabels();
      if (this.zAnim.t >= 1) this.zAnim = null;
    }

    // ambient motion
    this.particles.rotation.y += dt * 0.012;
    this.shell.rotation.y -= dt * 0.006;
    this.shell.rotation.x += dt * 0.002;

    // node pulses + hover boost + ring billboards
    for (const rec of this.nodes.values()) {
      const boost = (rec.group.userData.hoverBoost as number) ?? 1;
      let s = rec.targetScale * boost;
      if (rec.state === "visiting") s *= 1 + 0.1 * Math.sin(t * 8 + rec.phase);
      else if (rec.state === "path") s *= 1 + 0.035 * Math.sin(t * 4 + rec.phase);
      else if (rec.state === "idle") s *= 1 + 0.015 * Math.sin(t * 1.6 + rec.phase);
      rec.group.scale.setScalar(s);
      if (rec.ring.visible) {
        rec.ring.lookAt(this.cam().position);
        rec.ring.rotateZ(t * 0.8);
      }
    }

    // flowing dashes on active edges
    for (const rec of this.edges.values()) {
      if (rec.overlay.visible) rec.overlayMat.dashOffset += rec.dashSpeed * dt;
    }

    // camera target tween
    if (this.focusTween) {
      this.focusTween.t += dt / 0.45;
      const k = Math.min(this.focusTween.t, 1);
      const ease = 1 - (1 - k) ** 3;
      this.controls.target.lerpVectors(this.focusTween.fromT, this.focusTween.toT, ease);
      if (this.view2D) {
        if (this.focusTween.fromZoom !== undefined && this.focusTween.toZoom !== undefined) {
          this.ortho.zoom = this.focusTween.fromZoom + (this.focusTween.toZoom - this.focusTween.fromZoom) * ease;
          this.ortho.updateProjectionMatrix();
        }
        this.ortho.position.lerpVectors(this.focusTween.fromC, this.focusTween.toC, ease);
      } else {
        this.camera.position.lerpVectors(this.focusTween.fromC, this.focusTween.toC, ease);
      }
      if (k >= 1) this.focusTween = null;
    }

    this.renderer.render(this.scene, this.cam());
  };
}
