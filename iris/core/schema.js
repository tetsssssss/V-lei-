/* Íris · schema.js — validador mínimo de entradas/saídas das ferramentas. Puro. */
(function (root, factory) {
  const api = factory(root.Iris || (root.Iris = {}));
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Iris) {
  'use strict';
  const CTRL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

  /** validate(schema, value) → { ok, value (saneado, só campos conhecidos), errors[] } */
  function validate(schema, value, path = '$') {
    const errors = [];
    const out = walk(schema, value, path, errors);
    return { ok: errors.length === 0, value: out, errors };
  }

  function walk(s, v, p, errors) {
    if (v === undefined || v === null) {
      if (s.default !== undefined) return typeof s.default === 'object' ? JSON.parse(JSON.stringify(s.default)) : s.default;
      return undefined;
    }
    switch (s.type) {
      case 'string': {
        if (typeof v !== 'string') { errors.push(`${p}: esperado texto`); return undefined; }
        let t = v.replace(CTRL, '');
        if (s.trim !== false) t = t.replace(/\s+/g, ' ').trim();
        if (s.minLength && t.length < s.minLength) errors.push(`${p}: texto curto demais`);
        if (s.maxLength && t.length > s.maxLength) errors.push(`${p}: texto longo demais (máx. ${s.maxLength})`);
        if (s.enum && !s.enum.includes(t)) errors.push(`${p}: valor fora da lista (${s.enum.join(', ')})`);
        if (s.pattern && !new RegExp(s.pattern).test(t)) errors.push(`${p}: formato inválido`);
        return t;
      }
      case 'number': case 'integer': {
        const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
        if (typeof n !== 'number' || !Number.isFinite(n)) { errors.push(`${p}: esperado número`); return undefined; }
        if (s.type === 'integer' && !Number.isInteger(n)) errors.push(`${p}: esperado inteiro`);
        if (s.min !== undefined && n < s.min) errors.push(`${p}: mínimo ${s.min}`);
        if (s.max !== undefined && n > s.max) errors.push(`${p}: máximo ${s.max}`);
        return n;
      }
      case 'boolean':
        if (typeof v !== 'boolean') { errors.push(`${p}: esperado verdadeiro/falso`); return undefined; }
        return v;
      case 'array': {
        if (!Array.isArray(v)) { errors.push(`${p}: esperado lista`); return undefined; }
        if (s.maxItems && v.length > s.maxItems) errors.push(`${p}: itens demais (máx. ${s.maxItems})`);
        return s.items ? v.map((x, i) => walk(s.items, x, `${p}[${i}]`, errors)) : v.slice();
      }
      case 'object': {
        if (!isObj(v)) { errors.push(`${p}: esperado objeto`); return undefined; }
        const o = {};
        for (const [k, sub] of Object.entries(s.properties || {})) {
          const r = walk(sub, v[k], `${p}.${k}`, errors);
          if (r !== undefined) o[k] = r;
        }
        for (const k of s.required || []) if (o[k] === undefined) errors.push(`${p}.${k}: obrigatório`);
        return o;
      }
      default: return v;
    }
  }

  const api = { validate };
  Iris.schema = api;
  return api;
});
