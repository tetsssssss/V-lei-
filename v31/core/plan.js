/* V3.1 · plan.js — modelo da planta da chácara. Posições e tamanhos em METROS (centro do objeto).
   REGRA: nenhuma medida/capacidade da chácara é presumida. Zonas (cerimônia, pista, área coberta…) só nascem de um retângulo
   DESENHADO por você sobre o print calibrado. Os itens (mesas etc.) trazem um tamanho SUGERIDO, sempre editável e rotulado como sugestão. */
(function (root, factory) {
  const api = factory(root.V31 || (root.V31 = {}));
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (V31) {
  'use strict';
  const D = V31.data, G = V31.geo;
  // kind: 'item' (tem tamanho sugerido) | 'zona' (você desenha). height = altura (m) só para a vista isométrica.
  const TYPES = {
    'mesa-redonda':   { kind: 'item', label: 'Mesa redonda', shape: 'circle', w: 1.6, h: 1.6, seats: 8, height: 0.75, color: '#c49a65' },
    'mesa-retangular':{ kind: 'item', label: 'Mesa retangular', shape: 'rect', w: 2.4, h: 0.9, seats: 8, height: 0.75, color: '#c49a65' },
    'mesa-noivos':    { kind: 'item', label: 'Mesa dos noivos', shape: 'rect', w: 3, h: 0.9, seats: 6, height: 0.75, color: '#a96974' },
    'mesa-frios':     { kind: 'item', label: 'Mesa de frios', shape: 'rect', w: 2.4, h: 0.9, seats: 0, height: 0.9, color: '#427565' },
    'mesa-doces':     { kind: 'item', label: 'Mesa de doces/bolo', shape: 'rect', w: 1.8, h: 0.8, seats: 0, height: 0.9, color: '#d29aa6' },
    'bar':            { kind: 'item', label: 'Bar', shape: 'rect', w: 3, h: 0.8, seats: 0, height: 1.1, color: '#5b6f8c' },
    'palco':          { kind: 'item', label: 'Palco / DJ', shape: 'rect', w: 4, h: 3, seats: 0, height: 0.5, color: '#7a5360' },
    'outro':          { kind: 'item', label: 'Outro item', shape: 'rect', w: 1, h: 1, seats: 0, height: 0.8, color: '#8a8a8a' },
    'cerimonia':      { kind: 'zona', label: 'Área da cerimônia', color: '#f0c9a8', height: 0 },
    'pista':          { kind: 'zona', label: 'Pista de dança', color: '#d8c3e8', height: 0 },
    'cobertura':      { kind: 'zona', label: 'Área coberta (plano de chuva)', color: '#b9d3e6', height: 3 },
    'estacionamento': { kind: 'zona', label: 'Estacionamento', color: '#cfcfcf', height: 0 },
    'cozinha':        { kind: 'zona', label: 'Cozinha / apoio', color: '#e6d9a8', height: 0 },
    'banheiros':      { kind: 'zona', label: 'Banheiros', color: '#c9dccb', height: 0 },
    'zona':           { kind: 'zona', label: 'Outra área', color: '#e0e0e0', height: 0 },
  };
  const TABLE_TYPES = ['mesa-redonda', 'mesa-retangular', 'mesa-noivos'];

  function setBlank(d, wM, hM) { const v = D.ensure(d); if (!(wM > 0 && hM > 0 && wM <= 5000 && hM <= 5000)) throw new Error('Informe largura e profundidade em metros (maiores que zero).'); v.plan.base = { kind: 'blank', wM, hM }; v.plan.rev++; return v.plan.base; }
  /** Registra a imagem (a imagem em si fica no IndexedDB; aqui só o índice). Escala ainda NÃO calibrada. */
  function setImage(d, { key, wPx, hPx }) { const v = D.ensure(d); if (!(wPx > 0 && hPx > 0)) throw new Error('Imagem inválida.'); v.plan.base = { kind: 'image', key, wPx, hPx, pxPerM: null, calib: null }; v.plan.rev++; return v.plan.base; }
  /** Calibra: dois pontos (pixels) com distância real conhecida (m). Mantém os objetos no MESMO lugar sobre a imagem. */
  function calibrate(d, p1, p2, meters) {
    const v = D.ensure(d), b = v.plan.base; if (!b || b.kind !== 'image') throw new Error('Importe o print primeiro.');
    const px = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), ppm = G.pxPerMFrom(px, meters);
    if (!ppm) throw new Error('Marque dois pontos diferentes e informe a distância real em metros.');
    if (b.pxPerM) { const k = b.pxPerM / ppm; for (const o of v.plan.objects) { o.x *= k; o.y *= k; } } // posição acompanha o print; tamanhos (em m) não mudam
    b.pxPerM = ppm; b.calib = { p1, p2, meters }; v.plan.rev++; return ppm;
  }
  function checkObj(o) {
    if (!(o.w > 0) || !(o.shape === 'circle' || o.h > 0)) throw new Error('Tamanho precisa ser maior que zero.');
    if (o.w > 2000 || o.h > 2000) throw new Error('Tamanho fora do razoável (metros).');
    if (o.seats !== undefined && !(Number.isInteger(o.seats) && o.seats >= 0 && o.seats <= 200)) throw new Error('Lugares: número inteiro de 0 a 200.');
  }
  function addItem(d, type, pos = {}) {
    const v = D.ensure(d), t = TYPES[type]; if (!t || t.kind !== 'item') throw new Error('Tipo de item inválido.'); if (!G.baseSize(v.plan.base)) throw new Error('Defina a planta (print calibrado ou área em metros) antes.');
    const n = v.plan.objects.filter(o => o.type === type).length + 1, sz = G.baseSize(v.plan.base);
    const o = { id: D.uid('obj'), type, kind: 'item', shape: t.shape, label: `${t.label} ${n}`, x: pos.x ?? sz.w / 2, y: pos.y ?? sz.h / 2, w: t.w, h: t.shape === 'circle' ? t.w : t.h, rot: 0, seats: t.seats, height: t.height, color: t.color, note: '', suggested: true };
    checkObj(o); v.plan.objects.push(o); v.plan.rev++; return o;
  }
  /** Zona desenhada por você: retângulo em metros (x,y = canto superior esquerdo). */
  function addZone(d, type, rect) {
    const v = D.ensure(d), t = TYPES[type]; if (!t || t.kind !== 'zona') throw new Error('Tipo de área inválido.'); if (!G.baseSize(v.plan.base)) throw new Error('Defina a planta antes.');
    if (!(rect.w >= 0.5 && rect.h >= 0.5)) throw new Error('Desenhe uma área maior (mínimo 0,5 m de cada lado).');
    const n = v.plan.objects.filter(o => o.type === type).length + 1;
    const o = { id: D.uid('zona'), type, kind: 'zona', shape: 'rect', label: n > 1 ? `${t.label} ${n}` : t.label, x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, w: rect.w, h: rect.h, rot: 0, seats: 0, height: t.height, color: t.color, note: '' };
    v.plan.objects.push(o); v.plan.rev++; return o;
  }
  function update(d, id, patch) {
    const v = D.ensure(d), o = v.plan.objects.find(x => x.id === id); if (!o) throw new Error('Objeto não encontrado.');
    const next = { ...o, ...patch }; if (next.shape === 'circle') next.h = next.w; checkObj(next);
    for (const k of ['x', 'y', 'w', 'h', 'rot', 'height']) next[k] = D.num(next[k]); next.rot = ((next.rot % 360) + 360) % 360; next.label = String(next.label || '').slice(0, 60); next.note = String(next.note || '').slice(0, 300);
    if (patch.w !== undefined || patch.h !== undefined) next.suggested = false; // você mudou: já não é a sugestão
    Object.assign(o, next); v.plan.rev++; return o;
  }
  function remove(d, id) {
    const v = D.ensure(d), n = v.plan.objects.length; v.plan.objects = v.plan.objects.filter(o => o.id !== id);
    for (const m of Object.values(v.guestMeta)) if (m.table === id) delete m.table;
    for (const it of v.dayPlan) if (it.where === id) it.where = '';
    v.plan.rev++; return v.plan.objects.length < n;
  }
  const isTable = o => TABLE_TYPES.includes(o.type) && D.num(o.seats) > 0;
  const people = g => Math.max(1, Math.floor(D.num(g.qty, 1)));
  function assign(d, gid, tableId) {
    const v = D.ensure(d); if (!d.guests.some(g => g.id === gid)) throw new Error('Convidado não encontrado.');
    const m = (v.guestMeta[gid] = v.guestMeta[gid] || {});
    if (!tableId) { delete m.table; return; }
    const t = v.plan.objects.find(o => o.id === tableId); if (!t || !isTable(t)) throw new Error('Mesa inválida.'); m.table = tableId;
  }
  function usage(d) {
    const v = D.ensure(d), out = {};
    for (const o of v.plan.objects.filter(isTable)) out[o.id] = { seats: Math.floor(o.seats), used: 0, guests: [] };
    for (const g of d.guests) { const t = (v.guestMeta[g.id] || {}).table; if (t && out[t] && g.attendance !== 'Não irá') { out[t].used += people(g); out[t].guests.push(g.id); } }
    return out;
  }
  /** Distribui quem ainda não tem mesa: mantém cada convite (família) junto; agrupa por lado e grupo. Não mexe em quem já tem mesa. */
  function autoSeat(d) {
    const v = D.ensure(d), u = usage(d), tables = v.plan.objects.filter(isTable);
    const todo = d.guests.filter(g => g.attendance !== 'Não irá' && !(v.guestMeta[g.id] || {}).table).sort((a, b) => String(a.side).localeCompare(String(b.side)) || String(a.group).localeCompare(String(b.group)) || people(b) - people(a));
    const left = []; let placed = 0;
    for (const g of todo) {
      const t = tables.find(t => u[t.id].seats - u[t.id].used >= people(g));
      if (!t) { left.push(g.id); continue; }
      assign(d, g.id, t.id); u[t.id].used += people(g); placed++;
    }
    return { placed, left };
  }
  Object.assign(V31, { plan: { TYPES, TABLE_TYPES, setBlank, setImage, calibrate, addItem, addZone, update, remove, assign, usage, autoSeat, isTable } });
  return V31.plan;
});
