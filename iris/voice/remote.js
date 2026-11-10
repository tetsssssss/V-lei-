/* Íris · remote.js — cliente do backend OPCIONAL (STT/TTS/LLM premium). Sem backend configurado, NADA é enviado:
   nenhuma requisição de rede é feita por este módulo até a pessoa ligar "IA externa" e existir um endpoint. */
(function (root, factory) {
  const api = factory(root.Iris || (root.Iris = {}), root);
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Iris, root) {
  'use strict';
  const base = () => {
    try { const m = root.document && root.document.querySelector('meta[name="iris-api"]'); return m ? m.content.replace(/\/$/, '') : ''; } catch (_) { return ''; }
  };
  const configuredEndpoint = () => !!base();
  let cache = null;
  async function health(force) {
    if (!configuredEndpoint()) return { configured: false, reason: 'sem endpoint (meta iris-api ausente)' };
    if (cache && !force) return cache;
    try { const r = await fetch(base() + '/health', { credentials: 'omit' }); cache = r.ok ? await r.json() : { configured: false, reason: 'HTTP ' + r.status }; } catch (e) { cache = { configured: false, reason: 'sem conexão com o backend' }; }
    return cache;
  }
  const api = { configuredEndpoint, health, base };
  Iris.remote = api;
  return api;
});
