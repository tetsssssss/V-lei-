/* Íris · orb.js — o orbe é uma ÍRIS: fibras radiais + pupila que dilata (ouvindo), contrai (pensando) e pulsa (falando). */
(function (root, factory) {
  const api = factory(root.Iris || (root.Iris = {}), root);
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Iris, root) {
  'use strict';
  function create() {
    const { h } = Iris.dom;
    const el = h('div', { class: 'iris-orb', 'data-state': 'idle', role: 'img', 'aria-label': 'Íris, assistente de voz' },
      h('div', { class: 'iris-orb__halo' }), h('div', { class: 'iris-orb__base' }), h('div', { class: 'iris-orb__fibers' }), h('div', { class: 'iris-orb__tint' }),
      h('div', { class: 'iris-orb__limbus' }), h('div', { class: 'iris-orb__pupil' }));
    let raf = 0, pending = 0;
    return {
      el,
      setState(s) { el.setAttribute('data-state', s); if (s !== 'listening' && s !== 'speaking') this.setLevel(0); },
      setLevel(v) { pending = Math.max(0, Math.min(1, v || 0)); if (!raf) raf = root.requestAnimationFrame ? root.requestAnimationFrame(() => { raf = 0; el.style.setProperty('--lvl', pending.toFixed(2)); }) : (el.style.setProperty('--lvl', pending.toFixed(2)), 0); },
    };
  }
  /** Mini íris estática do botão flutuante. */
  function mini() { const { h } = Iris.dom; return h('span', { class: 'iris-mini', 'aria-hidden': 'true' }, h('span', { class: 'iris-mini-pupil' })); }
  const api = { create, mini };
  Iris.orb = api;
  return api;
});
