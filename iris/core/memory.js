/* Íris · memory.js — o que a Íris lembra (visível, editável, apagável) com ORIGEM de cada informação. Puro. */
(function (root, factory) {
  const api = factory(root.Iris || (root.Iris = {}));
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Iris) {
  'use strict';
  const SOURCES = {
    declarado: 'declarado por quem estava falando',
    documento: 'documento do casal',
    orcamento: 'orçamento contratado',
    link: 'link pesquisado',
    estimativa: 'estimativa',
    hipotese: 'hipótese',
    opiniao_iris: 'opinião da assistente',
  };
  function createMemory(store, now = () => Date.now()) {
    const items = () => store.get().memory;
    return {
      SOURCES,
      add({ text, source = 'declarado', author = '' }) {
        const t = String(text || '').trim().slice(0, 400); if (!t) return null;
        if (!SOURCES[source]) source = 'declarado';
        const m = { id: `m-${now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, ts: now(), text: t, source, author };
        items().push(m); store.save(); return m;
      },
      list: () => items().slice().reverse(),
      update(id, text) { const m = items().find(x => x.id === id); if (m) { m.text = String(text).trim().slice(0, 400); store.save(); } return m || null; },
      remove(id) { const i = items().findIndex(x => x.id === id); if (i >= 0) { items().splice(i, 1); store.save(); return true; } return false; },
      clear() { store.get().memory = []; store.save(); },
      label: s => SOURCES[s] || SOURCES.declarado,
    };
  }
  const api = { createMemory, SOURCES };
  Iris.memory = api;
  return api;
});
