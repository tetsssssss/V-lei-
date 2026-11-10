/* Íris · mic.js — permissão do microfone SEM manter o mic aberto. Só roda por gesto do usuário. */
(function (root, factory) {
  const api = factory(root.Iris || (root.Iris = {}), root);
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Iris, root) {
  'use strict';
  const secure = () => {
    if (typeof root.isSecureContext === 'boolean') return root.isSecureContext;
    const l = root.location || {}; return l.protocol === 'https:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(l.hostname || '');
  };
  const hasMedia = () => !!(root.navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  /** 'granted' | 'denied' | 'prompt' | 'insecure' | 'unsupported' */
  async function permissionState() {
    if (!secure()) return 'insecure';
    if (!hasMedia()) return 'unsupported';
    try { const r = await navigator.permissions.query({ name: 'microphone' }); return r.state; } catch (_) { return 'prompt'; }
  }

  const MESSAGES = {
    insecure: 'O microfone só funciona em páginas seguras. Abra o app por https ou por localhost.',
    unsupported: 'Este navegador não permite usar o microfone. Use o campo de texto.',
    denied: 'O microfone está bloqueado. Toque no cadeado ao lado do endereço, libere o microfone e tente de novo.',
    'no-device': 'Não encontrei um microfone neste aparelho.',
    busy: 'O microfone está em uso por outro app. Feche o outro app e tente de novo.',
    error: 'Não consegui acessar o microfone agora.',
  };

  /** Pede permissão (mostra o aviso do navegador) e SOLTA o microfone imediatamente. Retorna 'granted' ou o motivo. */
  async function preflight() {
    const st = await permissionState();
    if (st === 'insecure' || st === 'unsupported' || st === 'denied') return st;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      await new Promise(r => setTimeout(r, 180)); // dá tempo do Chrome Android liberar o mic antes do SpeechRecognition
      return 'granted';
    } catch (e) {
      if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) return 'denied';
      if (e && (e.name === 'NotFoundError' || e.name === 'OverconstrainedError')) return 'no-device';
      if (e && e.name === 'NotReadableError') return 'busy';
      return 'error';
    }
  }
  const api = { secure, hasMedia, permissionState, preflight, MESSAGES };
  Iris.mic = api;
  return api;
});
