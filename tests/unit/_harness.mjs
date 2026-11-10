// Ponte NossoSim FALSA para testes unitários: replica as fórmulas reais do index.html com dados fictícios.
import { createRequire } from 'node:module';
import { fixtureV2 } from '../e2e/fixture.mjs';
const require = createRequire(import.meta.url);
for (const f of ['text', 'schema', 'risk', 'store', 'audit', 'memory', 'briefing', 'tools', 'specialists', 'intents']) require(`../../iris/core/${f}.js`);
export const Iris = globalThis.Iris;

export const SWEETS = [
  { id: 'elizete-1', category: 'Finos', name: 'Cesta cereja', price: 4.5, unit: 'un.', page: 4 },
  { id: 'elizete-2', category: 'Finos', name: 'Camafeu', price: 4.5, unit: 'un.', page: 4 },
  { id: 'elizete-9', category: 'Premium', name: 'Trufa premium', price: 6.9, unit: 'un.', page: 9 },
  { id: 'elizete-100', category: 'Bolo (R$/kg)', name: 'Bolo prestígio', price: 119, unit: 'kg', page: 27 },
];
export const CATEGORIES = ['Espaço', 'Buffet', 'Bebidas', 'Decoração', 'Fotografia', 'Filmagem', 'Música', 'Trajes', 'Beleza', 'Cerimonial', 'Convites', 'Alianças', 'Transporte', 'Lua de mel', 'Outros'];
export const KINDS = ['Buffet', 'Espaço', 'Fotografia', 'Filmagem', 'Decoração', 'Música', 'Cerimonial', 'Beleza', 'Trajes', 'Doces e bolo', 'Convites', 'Transporte', 'Outros'];
const NAV = [['inicio', 'Início'], ['central', 'Central de Comando'], ['orcamento', 'Orçamento'], ['convidados', 'Convidados'], ['padrinhos', 'Padrinhos & entradas'], ['doces', 'Catálogo de doces'], ['presentes', 'Presentes da casa'], ['pesquisas', 'Chácara & atrações'], ['fornecedores', 'Fornecedores'], ['cerimonia', 'Cerimônia & tarefas'], ['ideias', 'Ideias & opiniões'], ['consultores', 'Consultores'], ['ajustes', 'Personalizar']];

export function makeWorld({ data = fixtureV2(), today = '2026-11-10', mutateData } = {}) {
  if (mutateData) mutateData(data);
  let section = 'inicio', guestQuery = '';
  const int = v => Math.max(0, Number(v) || 0);
  let n = 0;
  const h = {
    money: Iris.text.fmtBRL, int, id: () => `t-${++n}`, percent: (x, y) => (y ? Math.min(100, Math.max(0, Math.round(x / y * 100))) : 0),
    nameA: () => data.settings.personA, nameB: () => data.settings.personB, fmtDate: Iris.text.fmtDateBR, esc: s => s,
    sums() {
      const real = data.budget.filter(x => !x.hypothetical), hyp = data.budget.filter(x => x.hypothetical);
      const planned = real.reduce((a, x) => a + int(x.estimate), 0), paid = real.reduce((a, x) => a + int(x.paid), 0), hypo = hyp.reduce((a, x) => a + int(x.estimate), 0);
      const limit = int(data.settings.budget), reserve = limit * int(data.settings.reservePct) / 100;
      return { planned, paid, limit, reserve, remaining: limit - planned - reserve, open: Math.max(0, planned - paid), hypo, hypoCount: hyp.length, realCount: real.length };
    },
    guestsInfo() { const c = t => data.guests.filter(g => g.attendance === t).reduce((a, g) => a + Math.max(1, int(g.qty)), 0); return { yes: c('Confirmado'), pending: c('Pendente'), no: c('Não vai'), total: data.guests.reduce((a, g) => a + Math.max(1, int(g.qty)), 0) }; },
    complete() { const all = data.tasks.length, done = data.tasks.filter(t => t.done).length; return { all, done, pct: all ? Math.round(done / all * 100) : 0 }; },
    daysUntil() { const t = Date.UTC(...today.split('-').map((v, i) => (i === 1 ? v - 1 : +v))); const d = data.settings.date.split('-').map(Number); return Math.round((Date.UTC(d[0], d[1] - 1, d[2]) - t) / 86400000); },
  };
  const renders = [];
  const ns = {
    getData: () => data, helpers: h, getSection: () => section,
    mutate(fn) { const result = fn(data); renders.push(1); return { result, saved: true }; },
    navigate(s) { section = s; }, setGuestQuery(q) { guestQuery = q; }, setFilter() {}, setSweetsFilter() {}, toast() {},
    catalogs: { sweetCatalog: SWEETS, categories: CATEGORIES, kinds: KINDS, nav: () => NAV },
    recommendations: k => ({ title: `Consultor ${k}`, body: 'corpo', points: ['ponto 1'] }),
    getGuestQuery: () => guestQuery,
  };
  const mem = new Map();
  const storage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v) };
  const store = Iris.store.createStore(storage);
  const audit = Iris.audit.createAudit(store);
  const memory = Iris.memory.createMemory(store);
  const tools = Iris.tools.createTools(ns, { audit, memory, store });
  const engine = Iris.intents.createEngine({ ns, tools, store, audit, memory });
  return { data, ns, store, audit, memory, tools, engine, h, renders, say: (t, o) => engine.handle(t, o) };
}
export const plain = s => String(s).replace(/ /g, ' ');
