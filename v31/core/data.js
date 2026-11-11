/* V3.1 · data.js — bloco `data.v31` dentro do mesmo estado do app (entra no backup JSON; não mexe nos objetos antigos).
   Nada aqui tem dado pessoal: são só estruturas e padrões editáveis. */
(function (root, factory) {
  const api = factory(root.V31 || (root.V31 = {}));
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (V31) {
  'use strict';
  const defaultSettings = () => ({
    // Mensagem do convite por WhatsApp. {nome} {data} {local} {casal} {limite}. Editável.
    waTemplate: 'Oi, {nome}! Aqui é {casal}. Vamos nos casar em {data}, {local}, e queremos você lá. Pode confirmar sua presença (e quantas pessoas vão) até {limite}? Um abraço!',
    rsvpDeadline: '',
    // Referência para pôr do sol: coordenadas APROXIMADAS DA CIDADE (não da chácara). Ajuste se quiser.
    lat: -22.47, lon: -48.99, tz: -3,
    // Regra de bolso (configurável): folga mínima entre mesas para circular. NÃO é medida da chácara.
    minAisle: 1.0,
  });
  const defaultPlan = () => ({ base: null, objects: [], rev: 0 });
  const defaults = () => ({ version: 1, settings: defaultSettings(), guestMeta: {}, installments: [], plan: defaultPlan(), dayPlan: [], ceriNotes: {} });

  /** Garante a estrutura sem apagar nada que já exista. Muta e devolve `d.v31`. */
  function ensure(d) {
    const base = defaults(), cur = d.v31 && typeof d.v31 === 'object' && !Array.isArray(d.v31) ? d.v31 : {};
    const v = { ...base, ...cur, settings: { ...base.settings, ...(cur.settings || {}) } };
    if (!v.guestMeta || typeof v.guestMeta !== 'object' || Array.isArray(v.guestMeta)) v.guestMeta = {};
    if (!Array.isArray(v.installments)) v.installments = [];
    if (!Array.isArray(v.dayPlan)) v.dayPlan = [];
    if (!v.ceriNotes || typeof v.ceriNotes !== 'object') v.ceriNotes = {};
    const p = v.plan && typeof v.plan === 'object' && !Array.isArray(v.plan) ? v.plan : {};
    v.plan = { ...defaultPlan(), ...p, objects: Array.isArray(p.objects) ? p.objects : [] };
    d.v31 = v;
    return v;
  }
  const uid = (p = 'v') => p + '-' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
  const num = (x, def = 0) => { const n = Number(x); return Number.isFinite(n) ? n : def; };
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const todayISO = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const hhmm = m => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(Math.round(((m % 60) + 60) % 60)).padStart(2, '0')}`;
  const toMin = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
  const brl = n => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dateBR = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
  const daysBetween = (aISO, bISO) => Math.round((Date.UTC(...bISO.split('-').map((x, i) => (i === 1 ? x - 1 : +x))) - Date.UTC(...aISO.split('-').map((x, i) => (i === 1 ? x - 1 : +x)))) / 86400000);
  Object.assign(V31, { data: { defaults, ensure, uid, num, clamp, todayISO, hhmm, toMin, brl, dateBR, daysBetween } });
  return V31.data;
});
