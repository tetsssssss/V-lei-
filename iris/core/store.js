/* Íris · store.js — estado PRÓPRIO da Íris (chave separada do app). Nunca grava áudio. */
(function (root, factory) {
  const api = factory(root.Iris || (root.Iris = {}));
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Iris) {
  'use strict';
  const KEY = 'nosso-sim-iris-v1';
  const DAY = 86400000;

  const defaults = () => ({
    version: 1,
    prefs: {
      name: 'Íris', theme: 'romantico', speakOn: true, rate: 1, volume: 1, voiceURI: '',
      reviewBeforeSend: false, reduceMotion: 'auto', conversationMode: false, sounds: false,
      speakingAs: '', introDone: false, retentionDays: 30, briefingOnOpen: true, sttEngine: 'browser', ttsEngine: 'browser',
    },
    consent: { voice: false, externalAI: false, level: 0 }, // level 0 = só agregados; 1 = +nomes de fornecedores/ideias/tarefas; 2 = +nomes de convidados
    conversation: [], memory: [], audit: [],
  });

  function createStore(storage, now = () => Date.now()) {
    let persistent = true;
    let state = load();
    function load() {
      try {
        const raw = storage && storage.getItem(KEY);
        if (!raw) return defaults();
        const p = JSON.parse(raw), d = defaults();
        return { ...d, ...p, prefs: { ...d.prefs, ...(p.prefs || {}) }, consent: { ...d.consent, ...(p.consent || {}) },
          conversation: Array.isArray(p.conversation) ? p.conversation : [], memory: Array.isArray(p.memory) ? p.memory : [], audit: Array.isArray(p.audit) ? p.audit : [] };
      } catch (_) { persistent = false; return defaults(); }
    }
    function save() {
      prune();
      try { storage && storage.setItem(KEY, JSON.stringify(toPersist())); persistent = true; return true; } catch (_) { persistent = false; return false; }
    }
    // retenção 0 = não gravar a conversa (só memória da sessão)
    function toPersist() {
      const s = state;
      return s.prefs.retentionDays === 0 ? { ...s, conversation: [] } : s;
    }
    function prune() {
      const days = state.prefs.retentionDays;
      if (days > 0) { const min = now() - days * DAY; state.conversation = state.conversation.filter(m => m.ts >= min); }
      state.conversation = state.conversation.slice(-200);
      state.memory = state.memory.slice(-200);
      state.audit = state.audit.slice(-300);
    }
    return {
      get: () => state,
      isPersistent: () => persistent,
      save,
      setPref(k, v) { state.prefs[k] = v; save(); },
      setConsent(k, v) { state.consent[k] = v; save(); },
      addMessage(m) { const msg = { id: `${now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, ts: now(), ...m }; state.conversation.push(msg); save(); return msg; },
      clearConversation() { state.conversation = []; save(); },
      reset() { state = defaults(); save(); },
      KEY,
    };
  }

  const api = { createStore, defaults, KEY };
  Iris.store = api;
  return api;
});
