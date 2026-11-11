/* V3.1 · boot.js — liga as novas seções ao app via ponte NossoSim. Sem rede. */
(function () {
  'use strict';
  const ns = window.NossoSim, V = window.V31;
  if (!ns || !V || !V.sections || !V.planta) { console.warn('[V3.1] ponte NossoSim ou módulos ausentes; recursos V3.1 não iniciados.'); return; }
  try { V.data.ensure(ns.getData()); } catch (e) { console.warn('[V3.1] não consegui preparar os dados', e); }
  V.sections.init(ns);
  V.version = '3.1';
  window.dispatchEvent(new Event('v31:ready'));
})();
