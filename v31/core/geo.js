/* V3.1 · geo.js — geometria da planta. TODAS as medidas em METROS. Sem DOM. */
(function (root, factory) {
  const api = factory(root.V31 || (root.V31 = {}));
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (V31) {
  'use strict';
  const rad = d => (d * Math.PI) / 180;
  const isRound = o => o.shape === 'circle';
  /** Polígono (metros) de um objeto {x,y = CENTRO, w,h (círculo: w = diâmetro), rot em graus}. */
  function poly(o, seg = 24) {
    const cx = +o.x || 0, cy = +o.y || 0, t = rad(+o.rot || 0), c = Math.cos(t), s = Math.sin(t);
    let pts;
    if (isRound(o)) { const r = (+o.w || 0) / 2; pts = Array.from({ length: seg }, (_, i) => [r * Math.cos((2 * Math.PI * i) / seg), r * Math.sin((2 * Math.PI * i) / seg)]); }
    else { const hw = (+o.w || 0) / 2, hh = (+o.h || 0) / 2; pts = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]; }
    return pts.map(([px, py]) => [cx + px * c - py * s, cy + px * s + py * c]);
  }
  const area = o => (isRound(o) ? Math.PI * ((+o.w || 0) / 2) ** 2 : (+o.w || 0) * (+o.h || 0));
  function bounds(pts) { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }; }
  const axes = pts => pts.map((p, i) => { const q = pts[(i + 1) % pts.length], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; });
  const project = (pts, ax) => { let mn = Infinity, mx = -Infinity; for (const p of pts) { const v = p[0] * ax[0] + p[1] * ax[1]; if (v < mn) mn = v; if (v > mx) mx = v; } return [mn, mx]; };
  /** Sobreposição (SAT, polígonos convexos): devolve a profundidade mínima de penetração em metros (>0 = sobrepõe) ou 0. */
  function overlapDepth(a, b) {
    let best = Infinity;
    for (const ax of [...axes(a), ...axes(b)]) { const [a0, a1] = project(a, ax), [b0, b1] = project(b, ax); const o = Math.min(a1, b1) - Math.max(a0, b0); if (o <= 1e-9) return 0; if (o < best) best = o; }
    return best === Infinity ? 0 : best;
  }
  const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy; let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)); };
  /** Menor distância entre dois polígonos convexos (0 se sobrepõem). */
  function distance(a, b) {
    if (overlapDepth(a, b) > 0) return 0;
    let m = Infinity;
    for (const [P, Q] of [[a, b], [b, a]]) for (const p of P) for (let i = 0; i < Q.length; i++) m = Math.min(m, segDist(p, Q[i], Q[(i + 1) % Q.length]));
    return m;
  }
  const inside = (pts, w, h) => { const bb = bounds(pts); return bb.minX >= -1e-6 && bb.minY >= -1e-6 && bb.maxX <= w + 1e-6 && bb.maxY <= h + 1e-6; };

  // ---- vista isométrica (projeção dimétrica 2:1 "de jogo": ângulo 30°) ----
  const C30 = Math.cos(rad(30)), S30 = Math.sin(rad(30));
  /** metros (x,y,z) → plano da tela, em metros*escala. */
  const iso = (x, y, z = 0, k = 1) => [(x - y) * C30 * k, (x + y) * S30 * k - z * k];
  /** Matriz SVG que leva pixels da imagem (u,v) ao plano iso, dado px por metro. */
  const isoImageMatrix = (pxPerM, k = 1) => [C30 * k / pxPerM, S30 * k / pxPerM, -C30 * k / pxPerM, S30 * k / pxPerM];

  /** Dimensões do plano em metros. */
  function baseSize(base) {
    if (!base) return null;
    if (base.kind === 'blank') return { w: +base.wM, h: +base.hM };
    if (base.kind === 'image' && base.pxPerM > 0) return { w: base.wPx / base.pxPerM, h: base.hPx / base.pxPerM };
    return null;
  }
  const pxPerMFrom = (distPx, meters) => (distPx > 0 && meters > 0 ? distPx / meters : null);

  Object.assign(V31, { geo: { poly, area, bounds, overlapDepth, distance, inside, iso, isoImageMatrix, baseSize, pxPerMFrom, isRound, rad } });
  return V31.geo;
});
