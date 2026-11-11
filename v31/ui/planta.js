/* V3.1 · planta.js — "A chácara em planta": print + escala calibrada, mesas, zonas, vista isométrica, dia/noite.
   Tudo em METROS. Sem medida da chácara presumida: ou você calibra o print (2 pontos + distância real), ou informa a área. */
(function () {
  'use strict';
  const V = window.V31, K = V.kit, { h, s } = K, G = V.geo, P = V.plan, D = V.data;
  let ns = null, root = null;
  const st = { view: 'plan', tool: 'select', sel: null, zoom: 0, calib: null, night: false, hour: null, rot: 0, imgUrl: null, imgKey: null, imgMissing: false, grid: null, drag: null, draw: null };
  const dd = () => ns.getData(), vv = () => D.ensure(dd());
  const save = () => ns.save();
  const fmt = n => (Math.round(n * 100) / 100).toString().replace('.', ',');

  // ---------- cores ----------
  const hex = c => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ''); const n = m ? parseInt(m[1], 16) : 0x888888; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const shade = (c, f) => { const [r, g, b] = hex(c); const cl = x => Math.max(0, Math.min(255, Math.round(x))); return `rgb(${cl(r * f)},${cl(g * f)},${cl(b * f)})`; };

  // ---------- peças comuns ----------
  const chairs = o => {
    const n = Math.floor(D.num(o.seats)); if (!n) return [];
    if (o.shape === 'circle') { const r = o.w / 2 + 0.3; return Array.from({ length: n }, (_, i) => [r * Math.cos(2 * Math.PI * i / n), r * Math.sin(2 * Math.PI * i / n)]); }
    const top = Math.ceil(n / 2), bot = n - top, out = [], hw = o.w / 2, hh = o.h / 2 + 0.3;
    for (let i = 0; i < top; i++) out.push([-hw + (o.w * (i + 0.5)) / top, -hh]);
    for (let i = 0; i < bot; i++) out.push([-hw + (o.w * (i + 0.5)) / bot, hh]);
    return out;
  };
  const rotLocal = (o, [x, y]) => { const t = G.rad(o.rot || 0), c = Math.cos(t), sn = Math.sin(t); return [o.x + x * c - y * sn, o.y + x * sn + y * c]; };
  const nice = m => { for (const n of [1, 2, 5, 10, 20, 50, 100, 200, 500]) if (n >= m) return n; return 1000; };

  // ================= VISTA DE CIMA =================
  function planSvg({ forExport = false, href = '' } = {}) {
    const d = dd(), v = vv(), size = G.baseSize(v.plan.base), W = size.w, H = size.h, z = forExport ? 1800 / W : st.zoom;
    const px = n => n / z; // pixels de tela → metros (para traços/rótulos de tamanho constante)
    const usage = P.usage(d), flagged = new Set(V.ceri.check(d).findings.filter(f => f.level !== 'ok' && f.objId).map(f => f.objId));
    const svg = s('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: `0 0 ${W} ${H}`, width: Math.round(W * z), height: Math.round(H * z), role: 'img', 'aria-label': 'Planta da chácara vista de cima', tabindex: forExport ? null : '0', class: 'v31-svg' });
    const b = v.plan.base;
    if (b.kind === 'image' && (href || st.imgUrl)) svg.append(s('image', { href: href || st.imgUrl, x: 0, y: 0, width: W, height: H, preserveAspectRatio: 'none' }));
    else svg.append(s('rect', { x: 0, y: 0, width: W, height: H, fill: '#eef3e6' }));
    if (st.grid === true || (st.grid === null && b.kind === 'blank')) { const step = nice(W / 12); for (let x = step; x < W; x += step) svg.append(s('line', { x1: x, y1: 0, x2: x, y2: H, stroke: '#00000022', 'stroke-width': px(1) })); for (let y = step; y < H; y += step) svg.append(s('line', { x1: 0, y1: y, x2: W, y2: y, stroke: '#00000022', 'stroke-width': px(1) })); }
    svg.append(s('rect', { x: 0, y: 0, width: W, height: H, fill: 'none', stroke: '#00000066', 'stroke-width': px(1.5) }));
    const fs = px(12);
    const objs = [...v.plan.objects].sort((a, c) => (a.kind === 'zona' ? 0 : 1) - (c.kind === 'zona' ? 0 : 1));
    for (const o of objs) {
      const g = s('g', { 'data-id': o.id, class: 'v31-obj' + (st.sel === o.id && !forExport ? ' sel' : '') });
      const bad = flagged.has(o.id), stroke = bad ? '#c0392b' : st.sel === o.id && !forExport ? '#1d4ed8' : '#00000088', sw = px(bad || st.sel === o.id ? 2.5 : 1.2);
      const tr = `translate(${o.x} ${o.y}) rotate(${o.rot || 0})`;
      const sh = o.kind === 'zona' ? s('rect', { x: -o.w / 2, y: -o.h / 2, width: o.w, height: o.h, fill: o.color, 'fill-opacity': 0.42, stroke, 'stroke-width': sw, 'stroke-dasharray': `${px(7)} ${px(4)}`, transform: tr })
        : o.shape === 'circle' ? s('circle', { r: o.w / 2, fill: o.color, stroke, 'stroke-width': sw, transform: tr }) : s('rect', { x: -o.w / 2, y: -o.h / 2, width: o.w, height: o.h, rx: 0.05, fill: o.color, stroke, 'stroke-width': sw, transform: tr });
      g.append(sh);
      if (o.kind !== 'zona') for (const c of chairs(o)) { const [cx, cy] = rotLocal(o, c); g.append(s('circle', { cx, cy, r: 0.22, fill: '#fff', stroke: '#00000066', 'stroke-width': px(0.8), 'pointer-events': 'none' })); }
      const u = usage[o.id], lab = o.label + (u ? ` ${u.used}/${u.seats}` : '');
      g.append(s('text', { x: o.x, y: o.y, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': fs, fill: '#2b2226', stroke: '#ffffffcc', 'stroke-width': px(3), 'paint-order': 'stroke', 'pointer-events': 'none', 'font-family': 'system-ui,sans-serif', 'font-weight': 600 }, lab));
      svg.append(g);
    }
    // régua
    const L = nice(W / 8), y0 = H - px(14);
    svg.append(s('g', { 'pointer-events': 'none' }, s('rect', { x: px(8), y: y0 - px(16), width: L + px(18), height: px(30), fill: '#ffffffd9', rx: px(4) }), s('line', { x1: px(17), y1: y0, x2: px(17) + L, y2: y0, stroke: '#111', 'stroke-width': px(2.5) }), s('text', { x: px(17), y: y0 - px(4), 'font-size': px(11), fill: '#111', 'font-family': 'system-ui' }, `${L} m`)));
    if (!forExport && st.calib) { for (const p of st.calib.pts) svg.append(s('circle', { cx: p[0], cy: p[1], r: px(6), fill: '#ef4444', stroke: '#fff', 'stroke-width': px(2) })); if (st.calib.pts.length === 2) svg.append(s('line', { x1: st.calib.pts[0][0], y1: st.calib.pts[0][1], x2: st.calib.pts[1][0], y2: st.calib.pts[1][1], stroke: '#ef4444', 'stroke-width': px(2.5) })); }
    if (!forExport && st.draw) svg.append(s('rect', { x: Math.min(st.draw.x0, st.draw.x1), y: Math.min(st.draw.y0, st.draw.y1), width: Math.abs(st.draw.x1 - st.draw.x0), height: Math.abs(st.draw.y1 - st.draw.y0), fill: '#1d4ed833', stroke: '#1d4ed8', 'stroke-dasharray': `${px(6)} ${px(3)}`, 'stroke-width': px(2), 'pointer-events': 'none' }));
    return svg;
  }

  // ================= VISTA ISOMÉTRICA =================
  const rotPt = (x, y, q, W, Hh) => (q === 0 ? [x, y] : q === 1 ? [Hh - y, x] : q === 2 ? [W - x, Hh - y] : [y, W - x]);
  function isoSvg({ forExport = false, href = '' } = {}) {
    const d = dd(), v = vv(), size = G.baseSize(v.plan.base), W = size.w, Hh = size.h, q = st.rot, b = v.plan.base;
    const date = d.settings.date || D.todayISO(), S = v.settings, minute = (st.hour ?? (st.night ? 21 * 60 : 12 * 60));
    const el = V.solar.elevation(date, minute, D.num(S.lat), D.num(S.lon), D.num(S.tz, -3)), dark = V.solar.darkness(el);
    const T = (x, y, z = 0) => { const [rx, ry] = rotPt(x, y, q, W, Hh); return G.iso(rx, ry, z, 1); };
    const corners = [[0, 0], [W, 0], [W, Hh], [0, Hh]].map(([x, y]) => T(x, y));
    const maxZ = Math.max(4, ...v.plan.objects.map(o => D.num(o.height)));
    const xs = corners.map(c => c[0]), ys = corners.map(c => c[1]); const pad = Math.max(W, Hh) * 0.06 + 1;
    const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad - maxZ, y1 = Math.max(...ys) + pad, VW = x1 - x0, VH = y1 - y0;
    const svg = s('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: `${x0} ${y0} ${VW} ${VH}`, width: forExport ? 1800 : '100%', height: forExport ? Math.round(1800 * VH / VW) : null, class: 'v31-iso', role: 'img', 'aria-label': `Vista isométrica da chácara, ${dark > 0.5 ? 'à noite' : 'de dia'}` });
    const sky0 = dark > 0.5 ? '#0b1230' : '#cfe6f7', sky1 = dark > 0.5 ? '#2a2f5e' : '#fdf3e4';
    svg.append(s('defs', {}, s('linearGradient', { id: 'sky', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: '0', 'stop-color': dark > 0.05 ? mix('#cfe6f7', '#0b1230', dark) : '#cfe6f7' }), s('stop', { offset: '1', 'stop-color': dark > 0.05 ? mix('#fdf3e4', '#2a2f5e', dark) : '#fdf3e4' })),
      s('radialGradient', { id: 'glow' }, s('stop', { offset: '0', 'stop-color': '#ffd27a', 'stop-opacity': 0.95 }), s('stop', { offset: '1', 'stop-color': '#ffd27a', 'stop-opacity': 0 }))));
    svg.append(s('rect', { x: x0, y: y0, width: VW, height: VH, fill: 'url(#sky)' }));
    if (dark > 0.5) for (let i = 0; i < 60; i++) { const r1 = Math.sin(i * 12.9898) * 43758.5453, r2 = Math.sin(i * 78.233) * 12345.678; svg.append(s('circle', { cx: x0 + (r1 - Math.floor(r1)) * VW, cy: y0 + (r2 - Math.floor(r2)) * VH * 0.35, r: VW / 900, fill: '#fff', opacity: 0.8 * dark })); }
    // chão
    const [ox, oy] = T(0, 0), [ux, uy] = T(1, 0), [wx, wy] = T(0, 1);
    if (b.kind === 'image' && (href || st.imgUrl)) { const k = 1 / b.pxPerM; svg.append(s('image', { href: href || st.imgUrl, x: 0, y: 0, width: b.wPx, height: b.hPx, preserveAspectRatio: 'none', transform: `matrix(${(ux - ox) * k} ${(uy - oy) * k} ${(wx - ox) * k} ${(wy - oy) * k} ${ox} ${oy})` })); }
    const ground = corners.map(c => c.join(',')).join(' ');
    if (b.kind !== 'image' || !(href || st.imgUrl)) svg.append(s('polygon', { points: ground, fill: '#9fbf86' }));
    svg.append(s('polygon', { points: ground, fill: 'none', stroke: '#00000055', 'stroke-width': VW / 700 }));
    if (dark > 0.02) svg.append(s('polygon', { points: ground, fill: '#0b1230', opacity: 0.62 * dark }));
    // sombras ilustrativas (dia)
    const items = v.plan.objects.filter(o => o.kind !== 'zona'), zones = v.plan.objects.filter(o => o.kind === 'zona');
    if (dark < 0.9) { const k = Math.min(3, 1 / Math.max(0.35, Math.tan(G.rad(Math.max(8, el))))); for (const o of items) { const hgt = D.num(o.height); if (!hgt) continue; const pts = G.poly(o).map(([x, y]) => T(x - hgt * k * 0.6, y + hgt * k * 0.3)); svg.append(s('polygon', { points: pts.map(p => p.join(',')).join(' '), fill: '#000', opacity: 0.2 * (1 - dark) })); } }
    // zonas
    for (const o of zones) { const pts = G.poly(o).map(([x, y]) => T(x, y)); svg.append(s('polygon', { points: pts.map(p => p.join(',')).join(' '), fill: shade(o.color, 1 - 0.5 * dark), 'fill-opacity': 0.75, stroke: '#00000066', 'stroke-width': VW / 900, 'stroke-dasharray': `${VW / 160} ${VW / 300}` })); const [lx, ly] = T(o.x, o.y); svg.append(s('text', { x: lx, y: ly, 'text-anchor': 'middle', 'font-size': VW / 70, fill: dark > 0.5 ? '#fff' : '#2b2226', opacity: 0.85, 'font-family': 'system-ui' }, o.label)); }
    // luz noturna no chão
    if (dark > 0.15) for (const o of items) { if (!(o.type.startsWith('mesa') || o.type === 'bar' || o.type === 'palco')) continue; const R = Math.max(o.w, o.h) * 1.6, [gx, gy] = T(o.x, o.y); svg.append(s('ellipse', { cx: gx, cy: gy, rx: R * 1.2247, ry: R * 0.7071, fill: 'url(#glow)', opacity: 0.8 * dark })); }
    // objetos por profundidade
    const sorted = items.map(o => { const [rx, ry] = rotPt(o.x, o.y, q, W, Hh); return { o, depth: rx + ry }; }).sort((a, c) => a.depth - c.depth);
    for (const { o } of sorted) {
      const base = G.poly(o, 20), top = D.num(o.height) || 0.05, g = s('g', {});
      const edges = base.map((p, i) => [p, base[(i + 1) % base.length]]), centroid = [o.x, o.y];
      const vis = edges.map(([a, c]) => { const mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2, [rx, ry] = rotPt(mx, my, q, W, Hh), [cx2, cy2] = rotPt(centroid[0], centroid[1], q, W, Hh), nx = rx - cx2, ny = ry - cy2; return { a, c, n: [nx, ny], depth: rx + ry, show: nx + ny > 0 }; }).filter(e => e.show).sort((a, c) => a.depth - c.depth);
      for (const e of vis) { const f = 0.62 + 0.22 * (Math.abs(e.n[0]) > Math.abs(e.n[1]) ? 0 : 1); const q4 = [T(e.a[0], e.a[1], 0), T(e.c[0], e.c[1], 0), T(e.c[0], e.c[1], top), T(e.a[0], e.a[1], top)]; g.append(s('polygon', { points: q4.map(p => p.join(',')).join(' '), fill: shade(o.color, f * (1 - 0.5 * dark)), stroke: '#00000033', 'stroke-width': VW / 1500 })); }
      g.append(s('polygon', { points: base.map(([x, y]) => T(x, y, top).join(',')).join(' '), fill: shade(o.color, 1.12 * (1 - 0.45 * dark)), stroke: '#00000055', 'stroke-width': VW / 1200 }));
      for (const c of chairs(o)) { const [cx, cy] = rotLocal(o, c), [sx, sy] = T(cx, cy, 0.45); g.append(s('ellipse', { cx: sx, cy: sy, rx: 0.24 * 1.2247, ry: 0.24 * 0.7071, fill: shade('#f4efe6', 1 - 0.5 * dark), stroke: '#00000044', 'stroke-width': VW / 2000 })); }
      const [lx, ly] = T(o.x, o.y, top); g.append(s('text', { x: lx, y: ly - VW / 260, 'text-anchor': 'middle', 'font-size': VW / 95, fill: dark > 0.5 ? '#fff' : '#2b2226', stroke: dark > 0.5 ? '#000a' : '#ffffffcc', 'stroke-width': VW / 450, 'paint-order': 'stroke', 'font-family': 'system-ui', 'font-weight': 600 }, o.label));
      svg.append(g);
    }
    // cobertura (telhado translúcido + postes) e luzes de festão
    for (const o of zones) {
      const pts = G.poly(o); if (o.type === 'cobertura') { const hz = D.num(o.height) || 3; for (const [x, y] of pts) svg.append(s('line', { x1: T(x, y)[0], y1: T(x, y)[1], x2: T(x, y, hz)[0], y2: T(x, y, hz)[1], stroke: '#00000088', 'stroke-width': VW / 600 })); svg.append(s('polygon', { points: pts.map(([x, y]) => T(x, y, hz).join(',')).join(' '), fill: '#fff', opacity: 0.28, stroke: '#00000044', 'stroke-width': VW / 900 })); }
      if (['pista', 'cerimonia', 'cobertura'].includes(o.type)) { const n = pts.length; for (let i = 0; i < n; i++) { const a = pts[i], c = pts[(i + 1) % n], len = Math.hypot(c[0] - a[0], c[1] - a[1]), cnt = Math.max(2, Math.round(len / 1.2)); for (let j = 0; j <= cnt; j++) { const t = j / cnt, [sx, sy] = T(a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, 2.8); svg.append(s('circle', { cx: sx, cy: sy, r: VW / 700, fill: '#ffd27a', opacity: 0.35 + 0.65 * dark })); if (dark > 0.3) svg.append(s('circle', { cx: sx, cy: sy, r: VW / 220, fill: 'url(#glow)', opacity: dark })); } } }
    }
    svg.append(s('text', { x: x0 + VW / 50, y: y1 - VW / 60, 'font-size': VW / 80, fill: dark > 0.5 ? '#fff9' : '#0009', 'font-family': 'system-ui' }, `Vista ilustrativa · sombras e luzes são ilustrativas${st.hour !== null ? ' · ' + D.hhmm(minute) : ''}`));
    return svg;
  }
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((x, i) => Math.round(x + (B[i] - x) * t)).join(',')})`; };

  // ================= EXPORTAR PNG / SVG =================
  const toDataUrl = blob => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
  async function snapshot(kind = 'plan') {
    const b = vv().plan.base; if (!G.baseSize(b)) throw new Error('A planta ainda não tem escala.');
    let href = ''; if (b.kind === 'image') { const rec = await K.files.get(b.key).catch(() => null); if (rec) href = await toDataUrl(rec.blob); }
    const svg = kind === 'iso' ? isoSvg({ forExport: true, href }) : planSvg({ forExport: true, href });
    return new XMLSerializer().serializeToString(svg);
  }
  async function snapshotPng(kind = 'plan') {
    const text = await snapshot(kind), blobUrl = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Não consegui desenhar a imagem.')); i.src = blobUrl; });
      const c = h('canvas'); c.width = img.naturalWidth || 1800; c.height = img.naturalHeight || 1200; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      return await new Promise(r => c.toBlob(r, 'image/png'));
    } finally { URL.revokeObjectURL(blobUrl); }
  }

  // ================= INTERFACE =================
  const msg = t => { st.msg = t; const el = root && root.querySelector('.v31-msg'); if (el) el.textContent = t; };
  const tryDo = fn => { try { fn(); return true; } catch (e) { K.toast(e.message, true); return false; } };
  async function loadImage() {
    const b = vv().plan.base; if (!b || b.kind !== 'image') { st.imgUrl = null; st.imgKey = null; return; }
    if (st.imgKey === b.key && st.imgUrl) return;
    const rec = await K.files.get(b.key).catch(() => null);
    if (st.imgUrl) URL.revokeObjectURL(st.imgUrl);
    st.imgKey = b.key; st.imgMissing = !rec; st.imgUrl = rec ? URL.createObjectURL(rec.blob) : null;
  }
  async function pickPrint(keep) {
    const f = await K.pickFile('image/*'); if (!f) return;
    try {
      const { blob, w, hh } = await K.prepareImage(f).then(r => ({ blob: r.blob, w: r.w, hh: r.h })); const old = vv().plan.base, key = keep && old && old.kind === 'image' ? old.key : D.uid('print');
      await K.files.put(key, blob, 'print');
      if (keep && old && old.kind === 'image' && old.wPx === w && old.hPx === hh) { st.imgKey = null; msg('Print restaurado; a calibração foi mantida.'); }
      else { P.setImage(dd(), { key, wPx: w, hPx: hh }); st.imgKey = null; st.calib = { pts: [] }; st.tool = 'calibrate'; msg('Print importado. Agora calibre: toque em 2 pontos de distância conhecida.'); }
      save(); await loadImage(); render();
    } catch (e) { K.toast(e.message, true); }
  }
  function toM(e, svg) { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const m = pt.matrixTransform(svg.getScreenCTM().inverse()); return { x: m.x, y: m.y }; }
  const snap = x => Math.round(x * 20) / 20;

  function wireCanvas(svg) {
    const size = G.baseSize(vv().plan.base);
    svg.addEventListener('pointerdown', e => {
      const m = toM(e, svg), b = vv().plan.base;
      if (st.tool === 'calibrate') { const px = b.pxPerM || 1; const p = [m.x * (b.pxPerM || 1), m.y * (b.pxPerM || 1)]; /* em pixels da imagem */ if (!st.calib || st.calib.pts.length >= 2) st.calib = { pts: [] }; st.calib.pts.push(p); render(); return; }
      if (st.tool.startsWith('zone:')) { st.draw = { x0: m.x, y0: m.y, x1: m.x, y1: m.y }; svg.setPointerCapture(e.pointerId); return; }
      const g = e.target.closest('[data-id]');
      if (g) { const o = vv().plan.objects.find(x => x.id === g.dataset.id); st.sel = o.id; st.drag = { id: o.id, dx: o.x - m.x, dy: o.y - m.y, moved: false }; svg.setPointerCapture(e.pointerId); e.preventDefault(); redraw(); syncInspector(); }
      else { st.sel = null; redraw(); syncInspector(); }
    });
    svg.addEventListener('pointermove', e => {
      const m = toM(e, svg);
      if (st.draw) { st.draw.x1 = m.x; st.draw.y1 = m.y; redraw(); return; }
      if (st.drag) { const o = vv().plan.objects.find(x => x.id === st.drag.id); if (!o) return; o.x = D.clamp(snap(m.x + st.drag.dx), 0, size.w); o.y = D.clamp(snap(m.y + st.drag.dy), 0, size.h); st.drag.moved = true; redraw(); syncInspector(true); }
    });
    const up = () => {
      if (st.draw) { const r = st.draw, rect = { x: Math.min(r.x0, r.x1), y: Math.min(r.y0, r.y1), w: Math.abs(r.x1 - r.x0), h: Math.abs(r.y1 - r.y0) }; st.draw = null; const type = st.tool.slice(5);
        if (tryDo(() => { const o = P.addZone(dd(), type, { x: D.clamp(snap(rect.x), 0, size.w), y: D.clamp(snap(rect.y), 0, size.h), w: snap(rect.w), h: snap(rect.h) }); st.sel = o.id; })) { st.tool = 'select'; save(); } render(); return; }
      if (st.drag) { const moved = st.drag.moved; st.drag = null; if (moved) save(); render(); }
    };
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
    svg.addEventListener('keydown', e => {
      const o = vv().plan.objects.find(x => x.id === st.sel); if (!o) return;
      const step = e.shiftKey ? 1 : 0.1, mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (mv) { e.preventDefault(); o.x = D.clamp(snap(o.x + mv[0]), 0, size.w); o.y = D.clamp(snap(o.y + mv[1]), 0, size.h); save(); redraw(); syncInspector(true); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { if (confirm(`Excluir “${o.label}”?`)) { P.remove(dd(), o.id); st.sel = null; save(); render(); } }
    });
  }

  let canvasHost = null, inspHost = null;
  const redraw = () => { if (!canvasHost) return; const size = G.baseSize(vv().plan.base); if (!size) return; const sc = canvasHost.scrollLeft, sy = canvasHost.scrollTop; const svg = st.view === 'iso' ? isoSvg() : planSvg(); clear(canvasHost); canvasHost.append(svg); if (st.view === 'plan') wireCanvas(svg); canvasHost.scrollLeft = sc; canvasHost.scrollTop = sy; };
  const clear = el => K.clear(el);
  function syncInspector(light) { if (!inspHost) return; if (light) { for (const k of ['x', 'y']) { const i = inspHost.querySelector(`[data-k="${k}"]`); const o = vv().plan.objects.find(x => x.id === st.sel); if (i && o) i.value = fmt(o[k]).replace(',', '.'); } return; } buildInspector(); }

  const numIn = (o, k, label, opts = {}) => { const i = h('input', { type: 'number', step: opts.step || '0.1', min: opts.min, 'data-k': k, value: o[k], 'aria-label': label, inputmode: 'decimal' }); i.addEventListener('change', () => { const val = Number(String(i.value).replace(',', '.')); if (tryDo(() => P.update(dd(), o.id, { [k]: opts.int ? Math.floor(val) : val }))) save(); render(); }); return h('label', { class: 'v31-f' }, h('span', { text: label }), i); };
  function buildInspector() {
    clear(inspHost); const v = vv(), o = v.plan.objects.find(x => x.id === st.sel);
    if (!o) { inspHost.append(h('p', { class: 'v31-muted', text: 'Toque num objeto da planta para ver e editar suas medidas (em metros).' })); return; }
    const t = P.TYPES[o.type] || {};
    const lab = h('input', { type: 'text', value: o.label, maxlength: 60, 'aria-label': 'Nome' }); lab.addEventListener('change', () => { if (tryDo(() => P.update(dd(), o.id, { label: lab.value }))) save(); render(); });
    const note = h('textarea', { rows: 2, 'aria-label': 'Observação', maxlength: 300, text: o.note || '' }); note.addEventListener('change', () => { P.update(dd(), o.id, { note: note.value }); save(); });
    inspHost.append(h('h4', { text: o.kind === 'zona' ? 'Área selecionada' : 'Objeto selecionado' }), h('label', { class: 'v31-f wide' }, h('span', { text: 'Nome' }), lab),
      h('div', { class: 'v31-fgrid' }, numIn(o, 'x', 'Centro X (m)'), numIn(o, 'y', 'Centro Y (m)'), numIn(o, 'w', o.shape === 'circle' ? 'Diâmetro (m)' : 'Largura (m)', { min: 0.1 }), o.shape === 'circle' ? null : numIn(o, 'h', 'Profundidade (m)', { min: 0.1 }), numIn(o, 'rot', 'Giro (°)', { step: 15 }), o.kind === 'zona' && o.type !== 'cobertura' ? null : numIn(o, 'height', 'Altura (m, vista 3D)', { min: 0 }), o.kind !== 'zona' && P.TABLE_TYPES.concat(['mesa-frios']).includes(o.type) ? numIn(o, 'seats', 'Lugares', { step: 1, int: true, min: 0 }) : null));
    if (o.suggested) inspHost.append(h('p', { class: 'v31-warn', text: `Tamanho sugerido para “${t.label}” — não é medida do seu fornecedor. Ajuste conforme a locadora/o espaço.` }));
    inspHost.append(h('label', { class: 'v31-f wide' }, h('span', { text: 'Observação' }), note));
    if (P.isTable(o)) {
      const u = P.usage(dd())[o.id], d = dd(), un = d.guests.filter(g => g.attendance !== 'Não irá' && !(v.guestMeta[g.id] || {}).table);
      const sel = h('select', { 'aria-label': 'Sentar convite nesta mesa' }, h('option', { value: '', text: `+ Sentar convite (${un.length} sem mesa)` }), ...un.map(g => h('option', { value: g.id, text: `${g.name} (${Math.max(1, g.qty | 0)})` })));
      sel.addEventListener('change', () => { if (sel.value && tryDo(() => P.assign(dd(), sel.value, o.id))) save(); render(); });
      inspHost.append(h('h4', { text: `Convites nesta mesa · ${u.used}/${u.seats}` }), h('ul', { class: 'v31-list' }, ...u.guests.map(id => { const g = d.guests.find(x => x.id === id); return h('li', {}, h('span', { text: `${g.name} (${Math.max(1, g.qty | 0)})` }), h('button', { type: 'button', class: 'v31-btn small', onclick: () => { P.assign(dd(), id, null); save(); render(); } }, 'Tirar')); })), sel);
    }
    inspHost.append(h('div', { class: 'v31-row' }, h('button', { type: 'button', class: 'v31-btn', onclick: () => { const n = P.addItem(dd(), o.type === 'zona' ? 'outro' : o.type in P.TYPES && P.TYPES[o.type].kind === 'item' ? o.type : 'outro', { x: o.x + 1, y: o.y + 1 }); if (o.kind !== 'zona') P.update(dd(), n.id, { w: o.w, h: o.h, seats: o.seats, rot: o.rot, height: o.height, label: o.label + ' (cópia)' }); st.sel = n.id; save(); render(); }, disabled: o.kind === 'zona' }, 'Duplicar'),
      h('button', { type: 'button', class: 'v31-btn danger', onclick: () => { if (confirm(`Excluir “${o.label}”?`)) { P.remove(dd(), o.id); st.sel = null; save(); render(); } } }, 'Excluir')));
  }

  function setup() {
    const wi = h('input', { type: 'number', step: '0.5', min: '1', placeholder: 'largura (m)', 'aria-label': 'Largura em metros' }), hi = h('input', { type: 'number', step: '0.5', min: '1', placeholder: 'profundidade (m)', 'aria-label': 'Profundidade em metros' });
    const f = h('form', { class: 'v31-row' }, wi, hi, h('button', { class: 'v31-btn', type: 'submit' }, 'Criar área'));
    f.addEventListener('submit', e => { e.preventDefault(); if (tryDo(() => P.setBlank(dd(), Number(wi.value), Number(hi.value)))) { save(); render(); } });
    return h('div', {}, h('div', { class: 'v31-card' }, h('h3', { text: '1. Importe o print de satélite do Google' }), h('p', { class: 'v31-muted', text: 'Tire um print do Google Maps/Earth (vista de satélite, o mais de cima possível) e escolha o arquivo. A imagem fica só neste aparelho. Depois você marca 2 pontos de distância conhecida (por exemplo, o comprimento do salão) para dar a escala em metros.' }), h('button', { type: 'button', class: 'v31-btn primary', onclick: () => pickPrint(false) }, 'Escolher o print')),
      h('div', { class: 'v31-card' }, h('h3', { text: 'Ou: informe só a área em metros' }), h('p', { class: 'v31-muted', text: 'Sem imagem, a planta é um retângulo em branco com as medidas que VOCÊ informar. O app não presume nenhuma medida nem capacidade da chácara.' }), f));
  }
  function calibForm() {
    const b = vv().plan.base, n = st.calib ? st.calib.pts.length : 0; const dist = h('input', { type: 'number', step: '0.01', min: '0.1', placeholder: 'metros reais', 'aria-label': 'Distância real em metros', inputmode: 'decimal' });
    const go = h('button', { type: 'button', class: 'v31-btn primary', disabled: n < 2 }, 'Aplicar escala');
    go.addEventListener('click', () => { if (tryDo(() => P.calibrate(dd(), st.calib.pts[0], st.calib.pts[1], Number(String(dist.value).replace(',', '.'))))) { save(); st.calib = null; st.tool = 'select'; st.zoom = 0; msg('Escala calibrada.'); render(); } });
    return h('div', { class: 'v31-card calib' }, h('h3', { text: b.pxPerM ? 'Recalibrar a escala' : '2. Calibre a escala' }),
      h('p', { text: n === 0 ? 'Toque no PRIMEIRO ponto de uma distância que você conhece (ex.: uma ponta do salão).' : n === 1 ? 'Agora toque no SEGUNDO ponto.' : 'Digite a distância real entre os dois pontos e aplique.' }), h('div', { class: 'v31-row' }, dist, go, h('button', { type: 'button', class: 'v31-btn', onclick: () => { st.calib = null; st.tool = 'select'; render(); } }, 'Cancelar')),
      h('p', { class: 'v31-muted', text: 'Dica: use a medida que você tem (metragem do salão, da fachada, de um lado do terreno). Quanto mais longe os pontos, mais precisa a escala.' }));
  }

  function toolbar() {
    const d = dd(), v = vv(), size = G.baseSize(v.plan.base), tb = h('div', { class: 'v31-toolbar' });
    const seg = (items, cur, on) => h('div', { class: 'v31-seg', role: 'group' }, ...items.map(([k, l]) => h('button', { type: 'button', class: 'v31-btn' + (cur === k ? ' on' : ''), 'aria-pressed': String(cur === k), onclick: () => on(k) }, l)));
    tb.append(seg([['plan', 'Vista de cima'], ['iso', 'Vista 3D']], st.view, k => { st.view = k; st.tool = 'select'; render(); }));
    if (st.view === 'plan' && size) {
      tb.append(h('button', { type: 'button', class: 'v31-btn', onclick: () => { st.zoom = Math.max(2, st.zoom * 0.8); render(); } }, '−'), h('button', { type: 'button', class: 'v31-btn', onclick: () => { st.zoom = Math.min(400, st.zoom * 1.25); render(); } }, '+'), h('button', { type: 'button', class: 'v31-btn', onclick: () => { st.zoom = 0; render(); } }, 'Ajustar'), h('button', { type: 'button', class: 'v31-btn' + (st.grid ? ' on' : ''), onclick: () => { st.grid = !(st.grid === true || (st.grid === null && v.plan.base.kind === 'blank')); render(); } }, 'Grade'));
    }
    if (st.view === 'iso') {
      const S = v.settings, date = d.settings.date || D.todayISO(), sun = V.solar.sunTimes(date, D.num(S.lat), D.num(S.lon), D.num(S.tz, -3)), cer = V.schedule.analyze(v.dayPlan).items.find(i => i.kind === 'cerimonia' && /^cerim/i.test(i.title));
      const minute = st.hour ?? (st.night ? 21 * 60 : 12 * 60), sl = h('input', { type: 'range', min: 300, max: 1380, step: 5, value: minute, 'aria-label': 'Hora do dia' });
      sl.addEventListener('input', () => { st.hour = Number(sl.value); st.night = V.solar.darkness(V.solar.elevation(date, st.hour, D.num(S.lat), D.num(S.lon), D.num(S.tz, -3))) > 0.5; redraw(); const l = tb.querySelector('.v31-hora'); if (l) l.textContent = D.hhmm(st.hour); });
      tb.append(h('button', { type: 'button', class: 'v31-btn' + (!st.night ? ' on' : ''), onclick: () => { st.night = false; st.hour = 12 * 60 + 30; render(); } }, '☀ Dia'), h('button', { type: 'button', class: 'v31-btn' + (st.night ? ' on' : ''), onclick: () => { st.night = true; st.hour = sun ? Math.min(1380, Math.round(sun.set) + 75) : 21 * 60; render(); } }, '☾ Noite'),
        h('label', { class: 'v31-hr' }, h('span', { class: 'v31-hora', text: D.hhmm(minute) }), sl), cer ? h('button', { type: 'button', class: 'v31-btn', onclick: () => { st.hour = cer.s; st.night = false; render(); } }, `Hora da cerimônia (${cer.start})`) : null,
        h('button', { type: 'button', class: 'v31-btn', onclick: () => { st.rot = (st.rot + 1) % 4; render(); }, 'aria-label': 'Girar a vista 90 graus' }, '↻ Girar'));
      if (sun) tb.append(h('span', { class: 'v31-muted', text: `Pôr do sol estimado: ${D.hhmm(Math.round(sun.set))} (cidade, ±5 min)` }));
    }
    tb.append(h('button', { type: 'button', class: 'v31-btn', onclick: async () => { try { const b = await snapshotPng(st.view); K.toast(await K.saveFile(`planta-${st.view}.png`, b)); } catch (e) { K.toast(e.message, true); } } }, 'Baixar PNG'));
    return tb;
  }

  function palette() {
    const wrap = h('div', { class: 'v31-card' }, h('h4', { text: 'Adicionar' }));
    const items = Object.entries(P.TYPES).filter(([, t]) => t.kind === 'item'), zones = Object.entries(P.TYPES).filter(([, t]) => t.kind === 'zona');
    wrap.append(h('div', { class: 'v31-chips' }, ...items.map(([k, t]) => h('button', { type: 'button', class: 'v31-btn small', onclick: () => { const size = G.baseSize(vv().plan.base), c = viewCenter(size); if (tryDo(() => { const o = P.addItem(dd(), k, c); st.sel = o.id; })) save(); render(); } }, '+ ' + t.label))));
    wrap.append(h('p', { class: 'v31-muted', text: 'Áreas (cerimônia, pista, cobertura…) você desenha arrastando sobre a planta, então o tamanho vem das SUAS medidas:' }), h('div', { class: 'v31-chips' }, ...zones.map(([k, t]) => h('button', { type: 'button', class: 'v31-btn small' + (st.tool === 'zone:' + k ? ' on' : ''), onclick: () => { st.tool = st.tool === 'zone:' + k ? 'select' : 'zone:' + k; st.view = 'plan'; render(); } }, '▭ ' + t.label))));
    return wrap;
  }
  function viewCenter(size) { if (!canvasHost || !st.zoom) return { x: size.w / 2, y: size.h / 2 }; return { x: D.clamp(snap((canvasHost.scrollLeft + canvasHost.clientWidth / 2) / st.zoom), 0, size.w), y: D.clamp(snap((canvasHost.scrollTop + canvasHost.clientHeight / 2) / st.zoom), 0, size.h) }; }

  function seatsBar() {
    const d = dd(), v = vv(), tables = v.plan.objects.filter(P.isTable), seats = tables.reduce((a, o) => a + Math.floor(D.num(o.seats)), 0), pe = g => Math.max(1, Math.floor(D.num(g.qty, 1)));
    const yes = d.guests.filter(g => g.attendance === 'Confirmado').reduce((a, g) => a + pe(g), 0), pend = d.guests.filter(g => g.attendance === 'Pendente').reduce((a, g) => a + pe(g), 0), un = d.guests.filter(g => g.attendance !== 'Não irá' && !(v.guestMeta[g.id] || {}).table).length;
    return h('div', { class: 'v31-card v31-seats' }, h('div', {}, h('b', { text: `${seats} lugares` }), ` em ${tables.length} mesa(s) · ${yes} confirmados · ${pend} sem resposta · ${un} convite(s) sem mesa`), h('button', { type: 'button', class: 'v31-btn', disabled: !tables.length || !un, onclick: () => { const r = P.autoSeat(dd()); save(); K.toast(`Sentei ${r.placed} convite(s)` + (r.left.length ? `; ${r.left.length} não couberam inteiros em nenhuma mesa.` : '.')); render(); } }, 'Distribuir convites nas mesas'));
  }

  function render() {
    if (!root) return; const v = vv(), size = G.baseSize(v.plan.base);
    K.clear(root);
    root.append(h('div', { class: 'page-intro' }, h('div', { class: 'eyebrow', text: 'O grande dia no espaço' }), h('h1', { text: 'A chácara em planta.' }), h('p', { text: 'Monte mesas, mesa de frios, pista e cerimônia sobre o print do local, com medidas em metros que VOCÊ informa. Nada aqui presume o tamanho ou a capacidade da chácara.' })));
    if (!v.plan.base) { root.append(setup()); return; }
    if (v.plan.base.kind === 'image' && st.imgKey !== v.plan.base.key) { loadImage().then(render); root.append(h('p', { class: 'v31-muted', text: 'Carregando o print…' })); return; }
    if (v.plan.base.kind === 'image' && st.imgMissing) root.append(h('div', { class: 'v31-card v31-warn' }, h('b', { text: 'O print não está neste aparelho. ' }), 'As medidas e os objetos continuam salvos. Importe o pacote .zip (em “Pacote do aparelho”) ou escolha o print de novo (use o mesmo recorte).', h('div', { class: 'v31-row' }, h('button', { type: 'button', class: 'v31-btn', onclick: () => pickPrint(true) }, 'Escolher o print de novo'))));
    if (!size) { root.append(calibForm()); if (v.plan.base.kind === 'image' && st.imgUrl) { const view = h('div', { class: 'v31-canvas' }); canvasHost = view; const W = v.plan.base.wPx, Hh = v.plan.base.hPx, z = st.zoom || Math.min(1, (root.clientWidth || 360) / W); const svg = s('svg', { viewBox: `0 0 ${W} ${Hh}`, width: Math.round(W * z), height: Math.round(Hh * z), class: 'v31-svg' }, s('image', { href: st.imgUrl, x: 0, y: 0, width: W, height: Hh })); if (st.calib) { st.calib.pts.forEach(p => svg.append(s('circle', { cx: p[0], cy: p[1], r: 7 / z, fill: '#ef4444', stroke: '#fff', 'stroke-width': 2 / z }))); if (st.calib.pts.length === 2) svg.append(s('line', { x1: st.calib.pts[0][0], y1: st.calib.pts[0][1], x2: st.calib.pts[1][0], y2: st.calib.pts[1][1], stroke: '#ef4444', 'stroke-width': 3 / z })); }
        svg.addEventListener('pointerdown', e => { const m = toM(e, svg); if (!st.calib || st.calib.pts.length >= 2) st.calib = { pts: [] }; st.calib.pts.push([m.x, m.y]); render(); }); view.append(svg); root.append(view); st.tool = 'calibrate'; } return; }
    if (!st.zoom) st.zoom = Math.max(2, Math.min(60, ((root.clientWidth || 360) - 20) / size.w));
    if (st.tool === 'calibrate') root.append(calibForm());
    root.append(toolbar());
    if (st.msg) root.append(h('p', { class: 'v31-msg v31-muted', text: st.msg }));
    if (st.tool.startsWith('zone:')) root.append(h('p', { class: 'v31-hint', text: `Arraste sobre a planta para desenhar: ${P.TYPES[st.tool.slice(5)].label}.` }));
    canvasHost = h('div', { class: 'v31-canvas' + (st.tool.startsWith('zone:') ? ' drawing' : ''), tabindex: '-1' }); inspHost = h('div', { class: 'v31-card v31-insp' });
    root.append(h('div', { class: 'v31-split' }, canvasHost, h('div', { class: 'v31-side' }, st.view === 'plan' ? palette() : null, st.view === 'plan' ? inspHost : null, seatsBar(),
      h('div', { class: 'v31-card' }, h('h4', { text: 'Escala' }), h('p', { class: 'v31-muted', text: v.plan.base.kind === 'image' ? `Print ${v.plan.base.wPx}×${v.plan.base.hPx}px · ${fmt(v.plan.base.pxPerM)} px/m · área ${fmt(size.w)} × ${fmt(size.h)} m (conforme sua calibração).` : `Área em branco: ${fmt(size.w)} × ${fmt(size.h)} m (informada por você).` }),
        h('div', { class: 'v31-row' }, v.plan.base.kind === 'image' ? h('button', { type: 'button', class: 'v31-btn small', onclick: () => { st.tool = 'calibrate'; st.calib = { pts: [] }; render(); } }, 'Recalibrar') : null, h('button', { type: 'button', class: 'v31-btn small danger', onclick: () => { if (confirm('Apagar a planta inteira (print, escala e objetos)? Os convites e o cronograma permanecem.')) { const d = dd(); const vv2 = vv(); const key = vv2.plan.base && vv2.plan.base.key; vv2.plan = { base: null, objects: [], rev: 0 }; Object.values(vv2.guestMeta).forEach(m => delete m.table); if (key) K.files.del(key).catch(() => {}); st.imgKey = null; st.sel = null; save(); render(); } } }, 'Apagar planta'))))));
    redraw(); buildInspector();
  }
  V.planta = { mount(el, n) { root = el; ns = n; render(); }, snapshot, snapshotPng, hasPlan: () => !!(vv().plan.base && G.baseSize(vv().plan.base)) };
})();
