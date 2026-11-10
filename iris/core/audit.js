/* Íris · audit.js — trilha de auditoria (quem, o quê, quando) + desfazer por operações inversas. Puro. */
(function (root, factory) {
  const api = factory(root.Iris || (root.Iris = {}));
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Iris) {
  'use strict';
  const clone = o => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const stripSensitive = a => { try { return clone(a); } catch (_) { return {}; } };

  /** Operações elementares sobre `data` — cada uma devolve o registro necessário para desfazer. */
  const ops = {
    add(d, list, obj) { d[list].push(obj); return { op: 'add', list, id: obj.id, after: clone(obj) }; },
    update(d, list, id, patch) {
      const o = d[list].find(x => x.id === id); if (!o) throw new Error('registro não encontrado');
      const before = clone(o); Object.assign(o, patch); return { op: 'update', list, id, before, after: clone(o) };
    },
    remove(d, list, id) {
      const i = d[list].findIndex(x => x.id === id); if (i < 0) throw new Error('registro não encontrado');
      const before = clone(d[list][i]); d[list].splice(i, 1); return { op: 'remove', list, id, before, index: i };
    },
    setSetting(d, key, value) { const before = d.settings[key]; d.settings[key] = value; return { op: 'setting', key, before: clone(before), after: clone(value) }; },
    setMap(d, map, key, value) {
      d[map] = d[map] && typeof d[map] === 'object' ? d[map] : {};
      const had = Object.prototype.hasOwnProperty.call(d[map], key), before = d[map][key];
      if (value === null) delete d[map][key]; else d[map][key] = value;
      return { op: 'map', map, key, had, before: clone(before), after: clone(value) };
    },
  };

  /** Desfaz uma lista de operações (ordem inversa). Retorna { ok, conflicts[] } sem alterar nada se houver conflito. */
  function undoOps(d, list) {
    const conflicts = [];
    for (const o of list) {
      if (o.op === 'add') { const cur = d[o.list].find(x => x.id === o.id); if (cur && !same(cur, o.after)) conflicts.push(`${o.list}:${o.id} mudou depois`); }
      else if (o.op === 'update') { const cur = d[o.list].find(x => x.id === o.id); if (!cur) conflicts.push(`${o.list}:${o.id} não existe mais`); else if (!same(cur, o.after)) conflicts.push(`${o.list}:${o.id} mudou depois`); }
      else if (o.op === 'setting') { if (!same(d.settings[o.key], o.after)) conflicts.push(`ajuste ${o.key} mudou depois`); }
      else if (o.op === 'map') { if (!same((d[o.map] || {})[o.key], o.after === null ? undefined : o.after)) conflicts.push(`${o.map}.${o.key} mudou depois`); }
    }
    if (conflicts.length) return { ok: false, conflicts };
    for (const o of [...list].reverse()) {
      if (o.op === 'add') { const i = d[o.list].findIndex(x => x.id === o.id); if (i >= 0) d[o.list].splice(i, 1); }
      else if (o.op === 'update') { const i = d[o.list].findIndex(x => x.id === o.id); if (i >= 0) d[o.list][i] = clone(o.before); }
      else if (o.op === 'remove') { d[o.list].splice(Math.min(o.index, d[o.list].length), 0, clone(o.before)); }
      else if (o.op === 'setting') d.settings[o.key] = clone(o.before);
      else if (o.op === 'map') { if (o.had) d[o.map][o.key] = clone(o.before); else delete d[o.map][o.key]; }
    }
    return { ok: true, conflicts: [] };
  }

  function createAudit(store, now = () => Date.now()) {
    const list = () => store.get().audit;
    return {
      /** entry: {actor, via, tool, risk, summary, args, ops?, status} */
      record(entry) {
        const e = { id: `a-${now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, ts: now(), status: 'executed', undoable: !!(entry.ops && entry.ops.length), ...entry, args: stripSensitive(entry.args || {}) };
        list().push(e); store.save(); return e;
      },
      list({ actor, limit = 20 } = {}) { return list().filter(e => !actor || e.actor === actor).slice(-limit).reverse(); },
      get: id => list().find(e => e.id === id),
      latestUndoable() { for (let i = list().length - 1; i >= 0; i--) { const e = list()[i]; if (e.undoable && e.status === 'executed') return e; } return null; },
      setStatus(id, status) { const e = list().find(x => x.id === id); if (e) { e.status = status; if (status !== 'executed') e.undoable = false; store.save(); } },
      /** Dados substituídos por import/reset: as operações antigas não valem mais. */
      invalidateUndo() { list().forEach(e => { e.undoable = false; }); store.save(); },
    };
  }

  const api = { ops, undoOps, createAudit, clone };
  Iris.audit = api;
  return api;
});
