import { ROADS } from '../world/layout.js';

/**
 * Road network for hired helpers, built from ROADS (so it follows map editor changes): nodes at the
 * road points, where roads cross and where a road ends on another one; edges along the roads.
 * route(from, to) gives the points of the shortest way: off-road to the nearest road, along the
 * roads (on the right-hand side, like the cars), and off-road again to the destination.
 */
const MERGE = 1.5; // nodes closer than this are one node
const JOIN = 6; // a road end this close to another road joins it
const LANE = 1.2; // keep right of the centre line by this much

let net = null;

function build() {
  const nodes = []; // { x, z, edges: [{ to, d }] }
  const node = (x, z) => {
    for (let i = 0; i < nodes.length; i++) if (Math.hypot(nodes[i].x - x, nodes[i].z - z) < MERGE) return i;
    nodes.push({ x, z, edges: [] });
    return nodes.length - 1;
  };
  const link = (a, b) => {
    if (a === b) return;
    const d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z);
    if (!nodes[a].edges.some(e => e.to === b)) { nodes[a].edges.push({ to: b, d }); nodes[b].edges.push({ to: a, d }); }
  };
  const segs = [];
  for (const r of ROADS) for (let k = 1; k < r.pts.length; k++) segs.push({ a: r.pts[k - 1], b: r.pts[k], cuts: [0, 1], ids: [] });
  const at = (s, t) => [s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t];
  const project = (s, x, z) => {
    const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], L = dx * dx + dz * dz;
    const t = L ? Math.max(0, Math.min(1, ((x - s.a[0]) * dx + (z - s.a[1]) * dz) / L)) : 0;
    const [px, pz] = at(s, t);
    return { t, d: Math.hypot(x - px, z - pz), x: px, z: pz };
  };
  // crossings
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const p = segs[i], q = segs[j];
      const rx = p.b[0] - p.a[0], rz = p.b[1] - p.a[1], sx = q.b[0] - q.a[0], sz = q.b[1] - q.a[1];
      const den = rx * sz - rz * sx;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((q.a[0] - p.a[0]) * sz - (q.a[1] - p.a[1]) * sx) / den, u = ((q.a[0] - p.a[0]) * rz - (q.a[1] - p.a[1]) * rx) / den;
      if (t > 0 && t < 1 && u > 0 && u < 1) { p.cuts.push(t); q.cuts.push(u); }
    }
  }
  // road ends that stop at (or just short of) another road
  const joins = [];
  for (const s of segs) {
    for (const end of [s.a, s.b]) {
      for (const o of segs) {
        if (o === s) continue;
        const pr = project(o, end[0], end[1]);
        if (pr.d >= JOIN) continue;
        if (pr.t > 0 && pr.t < 1) o.cuts.push(pr.t); // at t = 0 or 1 the other road's end node is already there
        joins.push([end, [pr.x, pr.z]]);
      }
    }
  }
  for (const s of segs) {
    s.cuts = [...new Set(s.cuts.map(t => Math.round(t * 1e6) / 1e6))].sort((a, b) => a - b);
    s.ids = s.cuts.map(t => node(...at(s, t)));
    for (let k = 1; k < s.ids.length; k++) link(s.ids[k - 1], s.ids[k]);
  }
  for (const [e, p] of joins) link(node(...e), node(...p));
  net = { nodes, segs, project, at };
}

/** Nearest point on any road: { x, z, d, a, b } with a, b = the network nodes on either side. */
function nearest(x, z) {
  let best = null;
  for (const s of net.segs) {
    const pr = net.project(s, x, z);
    if (!best || pr.d < best.d) {
      let k = 1;
      while (k < s.cuts.length - 1 && s.cuts[k] < pr.t) k++;
      best = { ...pr, a: s.ids[k - 1], b: s.ids[k] };
    }
  }
  return best;
}

/** Shortest way from (x0, z0) to (x1, z1) as a list of { x, z } points. */
export function route(x0, z0, x1, z1) {
  if (!net) build();
  const N = net.nodes, A = nearest(x0, z0), B = nearest(x1, z1);
  if (!A || !B) return [{ x: x0, z: z0 }, { x: x1, z: z1 }];
  // Dijkstra from the start projection (joined to its two nodes) to the end projection
  const dist = new Float64Array(N.length).fill(Infinity), prev = new Int32Array(N.length).fill(-1), done = new Uint8Array(N.length);
  const d0 = (i, p) => Math.hypot(N[i].x - p.x, N[i].z - p.z);
  for (const i of [A.a, A.b]) { const d = d0(i, A); if (d < dist[i]) { dist[i] = d; prev[i] = -2; } }
  const sameSeg = (A.a === B.a && A.b === B.b) || (A.a === B.b && A.b === B.a);
  let bestEnd = -1, bestLen = sameSeg ? Math.hypot(A.x - B.x, A.z - B.z) : Infinity;
  for (;;) {
    let u = -1;
    for (let i = 0; i < N.length; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] >= bestLen) break;
    done[u] = 1;
    if (u === B.a || u === B.b) { const L = dist[u] + d0(u, B); if (L < bestLen) { bestLen = L; bestEnd = u; } }
    for (const e of N[u].edges) if (dist[u] + e.d < dist[e.to]) { dist[e.to] = dist[u] + e.d; prev[e.to] = u; }
  }
  const mid = [];
  for (let i = bestEnd; i >= 0; i = prev[i]) mid.unshift({ x: N[i].x, z: N[i].z });
  const road = [{ x: A.x, z: A.z }, ...mid, { x: B.x, z: B.z }].filter((p, i, a) => !i || Math.hypot(p.x - a[i - 1].x, p.z - a[i - 1].z) > 0.5);
  // keep right: shift every road point to the right of the direction of travel ((-dz, dx) here, as for the cars)
  const shifted = road.map((p, i) => {
    const a = road[Math.max(0, i - 1)], b = road[Math.min(road.length - 1, i + 1)];
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
    return { x: p.x - (dz / L) * LANE, z: p.z + (dx / L) * LANE };
  });
  const out = [{ x: x0, z: z0 }, ...shifted, { x: x1, z: z1 }];
  return out.filter((p, i, a) => !i || Math.hypot(p.x - a[i - 1].x, p.z - a[i - 1].z) > 0.5);
}

/** Total length of a list of points. */
export const pathLength = pts => pts.reduce((a, p, i) => (i ? a + Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) : 0), 0);

/** Forget the network (after the map changed). */
export const resetRoads = () => { net = null; };
