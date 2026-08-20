import type { Graph, Vec3 } from "./types";

/**
 * Small deterministic 3D force-directed layout.
 *
 * Works ONLY on visual positions: ids, connections, weights, direction
 * and metadata are never touched. Geometric distances are naturally
 * recomputed afterwards; logical weights stay exactly as they were.
 */
export function computeForceLayout(graph: Graph): Map<string, Vec3> {
  const ids = graph.nodes.map((n) => n.id);
  const pos = new Map<string, Vec3>(graph.nodes.map((n) => [n.id, { ...n.position }]));
  if (ids.length === 0) return pos;

  const REPULSION = 520;
  const REST_LEN = 13;
  const SPRING = 0.03;
  const GRAVITY = 0.0035;
  const ITERATIONS = 320;
  const MAX_STEP = 1.7;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const cooling = 1 - iter / ITERATIONS;
    const force = new Map<string, Vec3>(ids.map((id) => [id, { x: 0, y: 0, z: 0 }]));

    // Pairwise repulsion.
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = pos.get(ids[i]);
        const b = pos.get(ids[j]);
        if (!a || !b) continue;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let dz = a.z - b.z;
        let d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 0.01) {
          dx = (i - j) * 0.13;
          dy = 0.11;
          dz = 0.07;
          d2 = dx * dx + dy * dy + dz * dz;
        }
        const d = Math.sqrt(d2);
        const f = REPULSION / d2;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        const fz = (dz / d) * f;
        const fa = force.get(ids[i]);
        const fb = force.get(ids[j]);
        if (!fa || !fb) continue;
        fa.x += fx; fa.y += fy; fa.z += fz;
        fb.x -= fx; fb.y -= fy; fb.z -= fz;
      }
    }

    // Springs along edges (weights are ignored — layout is purely visual).
    for (const e of graph.edges) {
      const s = pos.get(e.source);
      const t = pos.get(e.target);
      const fs = force.get(e.source);
      const ft = force.get(e.target);
      if (!s || !t || !fs || !ft) continue;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dz = t.z - s.z;
      const d = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 0.01);
      const f = (d - REST_LEN) * SPRING;
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      const fz = (dz / d) * f;
      fs.x += fx; fs.y += fy; fs.z += fz;
      ft.x -= fx; ft.y -= fy; ft.z -= fz;
    }

    // Gentle pull toward the origin + integrate.
    for (const id of ids) {
      const p = pos.get(id);
      const f = force.get(id);
      if (!p || !f) continue;
      f.x -= p.x * GRAVITY;
      f.y -= p.y * GRAVITY;
      f.z -= p.z * GRAVITY;
      const scale = Math.min(1, MAX_STEP / Math.max(Math.hypot(f.x, f.y, f.z), 0.0001));
      const k = scale * (0.25 + 0.75 * cooling);
      p.x = clamp(p.x + f.x * k);
      p.y = clamp(p.y + f.y * k);
      p.z = clamp(p.z + f.z * k);
    }
  }

  return pos;
}

function clamp(v: number): number {
  return Math.max(-30, Math.min(30, v));
}
