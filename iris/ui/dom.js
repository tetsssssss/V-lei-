/* Íris · dom.js — construtor de DOM seguro. Texto SEMPRE vira nó de texto (nunca HTML). */
(function (root, factory) {
  const api = factory(root.Iris || (root.Iris = {}), root);
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Iris, root) {
  'use strict';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ICONS = {
    mic: 'M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0M12 16v4m-3 0h6',
    stop: 'M7 7h10v10H7z', send: 'M4 12l16-8-6 16-3-7-7-1z', gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-2-1.2L14.6 2h-4l-.4 2.7a7.6 7.6 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7.4 7.4 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7.6 7.6 0 0 0 2 1.2l.4 2.7h4l.4-2.7a7.6 7.6 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
    close: 'M6 6l12 12M18 6L6 18', back: 'M15 5l-7 7 7 7', undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3', brain: 'M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a3 3 0 0 0-3-1zm6 0a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1',
  };
  /** h('div', {class:'x', onclick:fn, 'aria-label':'..', hidden:true}, 'texto', outroNo) */
  function h(tag, attrs, ...kids) {
    const el = root.document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'text') el.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
    for (const kid of kids.flat()) { if (kid === null || kid === undefined || kid === false) continue; el.append(kid.nodeType ? kid : root.document.createTextNode(String(kid))); }
    return el;
  }
  function icon(name) {
    const s = root.document.createElementNS(SVG_NS, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', name === 'stop' || name === 'send' ? 'currentColor' : 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
    const p = root.document.createElementNS(SVG_NS, 'path'); p.setAttribute('d', ICONS[name] || ''); s.append(p); return s;
  }
  const clear = el => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  const api = { h, icon, clear, ICONS };
  Iris.dom = api;
  return api;
});
