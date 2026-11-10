/* Íris · native.js — ponte com o APK Android (window.IrisAndroid). Dentro do WebView não existe Web Speech API,
   então a voz usa o SpeechRecognizer e o TextToSpeech NATIVOS do Android. Fora do APK este módulo não faz nada. */
(function (root, factory) {
  const api = factory(root.Iris || (root.Iris = {}), root);
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Iris, root) {
  'use strict';
  const A = () => root.IrisAndroid;
  const available = () => !!A();
  let sttHandler = null, permResolve = null; const ttsH = {};
  let seq = 0;

  // O Android chama estes ganchos (via evaluateJavascript).
  root.IrisNativeCb = {
    onStt(type, payload) { if (sttHandler) sttHandler(type, payload); },
    onTts(id, type, payload) { const h = ttsH[id]; if (h) h(type, payload); },
    onPerm(granted) { const r = permResolve; permResolve = null; if (r) r(!!granted); },
  };

  /** 'granted' | 'denied' */
  function requestMic() {
    if (A().hasMicPermission()) return Promise.resolve('granted');
    return new Promise(res => { permResolve = g => res(g ? 'granted' : 'denied'); A().requestMicPermission(); });
  }

  const MSG = { 'no-speech': 'Não ouvi nada. Toque no microfone e fale de novo.', 'network': 'Sem conexão com o serviço de voz do Android. Você pode digitar.', 'not-allowed': 'O microfone está bloqueado. Libere em Configurações do Android → Apps → Nosso Sim → Permissões.', 'audio-capture': 'Não consegui captar áudio. Confira se o microfone está livre.', busy: 'O reconhecimento de voz está ocupado. Tente de novo em instantes.', 'start-failed': 'Não consegui iniciar a escuta. Confira se o app "Google" ou um serviço de voz está instalado e atualizado.' };

  function sttAdapter() {
    return {
      supported: () => available() && !!A().isRecognitionAvailable(),
      create() {
        const handlers = {}; const emit = (e, p) => (handlers[e] || []).forEach(f => { try { f(p); } catch (_) {} });
        let aborted = false;
        return {
          on(e, f) { (handlers[e] = handlers[e] || []).push(f); return this; },
          start() {
            sttHandler = (type, p) => {
              if (aborted) return;
              if (type === 'start') emit('start'); else if (type === 'sound') emit('sound');
              else if (type === 'partial') emit('partial', p); else if (type === 'final') emit('final', p);
              else if (type === 'error') emit('error', { code: p, message: MSG[p] || 'Algo deu errado no reconhecimento de voz.' });
              else if (type === 'end') { sttHandler = null; emit('end'); }
            };
            A().startListening();
          },
          stop() { A().stopListening(); },
          abort() { aborted = true; sttHandler = null; A().cancelListening(); emit('end'); },
        };
      },
    };
  }

  function ttsAdapter() {
    let current = null;
    return {
      supported: () => available(),
      loadVoices: async () => [],
      rank: () => [{ voice: null, name: A() && A().hasPtVoice() ? 'Voz do Android (português do Brasil)' : 'Voz padrão do Android (sem voz pt-BR instalada)', lang: 'pt-BR', uri: '', gender: 'conforme o aparelho' }],
      guess: () => 'conforme o aparelho', chunk: s => [s],
      cancelAll() { if (current) { current.cancelled = true; } A().stopSpeaking(); },
      speak(text, o = {}) {
        const id = 'tts-' + (++seq), st = { cancelled: false }; current = st; let lvl = null;
        const stopLvl = () => { clearInterval(lvl); lvl = null; o.onlevel && o.onlevel(0); };
        const done = new Promise(resolve => {
          ttsH[id] = (type, p) => {
            if (type === 'start') { o.onstart && o.onstart(); if (o.onlevel) lvl = setInterval(() => o.onlevel(.35 + Math.random() * .65), 110); }
            else if (type === 'done') { stopLvl(); delete ttsH[id]; if (!st.cancelled) o.onend && o.onend(); resolve(); }
            else if (type === 'error') { stopLvl(); delete ttsH[id]; if (!st.cancelled) o.onerror && o.onerror(new Error(p || 'tts')); resolve(); }
          };
        });
        A().speak(id, text, o.rate || 1, o.volume === undefined ? 1 : o.volume);
        return { done, cancel() { st.cancelled = true; stopLvl(); delete ttsH[id]; A().stopSpeaking(); } };
      },
    };
  }

  /** Salva texto em Downloads. Retorna { ok, where }. */
  function saveFile(name, text) { const r = String(A().saveFile(name, text)); return r.startsWith('ERRO:') ? { ok: false, where: r } : { ok: true, where: r }; }

  const api = { available, requestMic, sttAdapter, ttsAdapter, saveFile };
  Iris.native = api;
  return api;
});
