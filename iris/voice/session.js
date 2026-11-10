/* Íris · session.js — orquestra: gesto → permissão → STT → motor → TTS, com interrupção e estados explícitos.
   Estados: idle · permission · listening · transcribing · thinking · acting · speaking · offline · error */
(function (root, factory) {
  const api = factory(root.Iris || (root.Iris = {}), root);
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Iris, root) {
  'use strict';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const DOC = () => root.document;

  function createSession({ engine, store, stt, tts, mic, hooks = {} }) {
    const prefs = () => store.get().prefs, consent = () => store.get().consent;
    const h = (n, ...a) => { try { hooks[n] && hooks[n](...a); } catch (e) { console.warn('[Íris hook]', n, e); } };
    let state = 'idle', rec = null, speaking = null, lastSpoken = '', convoT = null, token = 0, convoOff = false, errT = null, audioCtx = null;
    const online = () => (root.navigator ? navigator.onLine !== false : true);

    const setState = (s, meta) => { if (s === state && !meta) return; state = s; h('onState', s, meta || {}); };

    // sons suaves (opt-in; precisam de gesto antes)
    function beep(freq, dur = .09) {
      if (!prefs().sounds) return;
      try {
        const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return; audioCtx = audioCtx || new AC();
        const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = freq; o.type = 'sine';
        g.gain.setValueAtTime(.0001, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(.06 * (prefs().volume || 1), audioCtx.currentTime + .01); g.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + dur);
        o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + dur + .02);
      } catch (_) {}
    }

    function fail(message, code, quiet) {
      clearTimeout(errT);
      if (!quiet) { setState('error', { message, code }); h('onMessage', { role: 'error', text: message }); h('onError', message, code); errT = setTimeout(() => { if (state === 'error') setState(online() ? 'idle' : 'offline'); }, 3500); }
      else setState(online() ? 'idle' : 'offline');
    }

    function stopSpeaking(silent) {
      if (speaking) { speaking.cancel(); speaking = null; }
      tts && tts.cancelAll && tts.cancelAll(); h('onLevel', 0);
      if (state === 'speaking') setState('idle');
    }

    function caps() {
      const ranked = tts.supported() ? tts.rank(root.speechSynthesis.getVoices() || []) : [];
      return { stt: stt.supported(), tts: tts.supported(), secure: mic.secure(), online: online(), voices: ranked.length, ptVoices: ranked };
    }

    // ---------- escuta ----------
    async function startListening({ fromConvo = false } = {}) {
      clearTimeout(convoT); clearTimeout(errT);
      if (!stt.supported()) return fail('Este navegador não tem reconhecimento de voz. Use o campo de texto: faz tudo o mesmo.', 'unsupported');
      if (!mic.secure()) return fail(mic.MESSAGES.insecure, 'insecure');
      if (!consent().voice) { h('onNeedConsent'); return; }
      if (!online()) { setState('offline'); h('onMessage', { role: 'error', text: 'Sem internet: o reconhecimento de voz do navegador precisa de conexão. Você pode digitar.' }); return; }
      const my = ++token; if (!fromConvo) convoOff = false; stopSpeaking(true);
      const perm = await mic.permissionState();
      if (my !== token) return;
      if (perm === 'denied') return fail(mic.MESSAGES.denied, 'denied');
      if (perm === 'prompt') {
        setState('permission'); h('onPermissionPrompt');
        const r = await mic.preflight(); if (my !== token) return;
        if (r !== 'granted') return fail(mic.MESSAGES[r] || mic.MESSAGES.error, r);
      }
      h('onPartial', '');
      rec = stt.create({ lang: 'pt-BR' });
      rec.on('start', () => { if (my === token) { setState('listening'); beep(660); } })
        .on('partial', t => { if (my === token) h('onPartial', t); })
        .on('final', t => { if (my === token) onFinal(t); })
        .on('error', e => { if (my !== token) return; if (fromConvo && e.code === 'no-speech') { convoOff = true; return fail('', e.code, true); } fail(e.message, e.code); })
        .on('end', () => { if (my === token && state === 'listening') setState('idle'); });
      rec.start();
    }

    function onFinal(text) {
      beep(440); setState('transcribing');
      if (prefs().reviewBeforeSend) { h('onReview', text); setState('idle'); return; }
      handleInput(text, 'voz');
    }

    // ---------- processamento ----------
    async function handleInput(text, via = 'texto') {
      const my = ++token; h('onPartial', '');
      h('onMessage', { role: 'user', text, via, actor: prefs().speakingAs || '' });
      setState('thinking'); await sleep(0);
      let turn;
      try { turn = await Promise.resolve(engine.handle(text, { actor: prefs().speakingAs || '' })); }
      catch (e) { console.warn('[Íris]', e); turn = { speak: 'Algo deu errado ao processar esse pedido. Nada foi alterado. Tente de novo.', lines: [], ui: {}, ok: false }; }
      if (my !== token) return;
      if (turn && turn.ui && turn.ui.unknown && hooks.external) { // o motor local não entendeu: tenta a IA externa (se houver consentimento e login)
        try { const ext = await hooks.external(text); if (my !== token) return; if (ext) turn = ext; }
        catch (e) { h('onNotice', (e && e.message) || 'A IA externa não respondeu; usei o modo local.'); }
      }
      await present(turn, my, via);
    }

    /** Mostra um turno (mensagem + efeitos de UI + fala). Usado pela voz, pelo texto E pelos botões (confirmar/cancelar/desfazer). */
    async function present(turn, my = ++token, via) {
      const ui = turn.ui || {};
      if (ui.changed) { setState('acting'); await sleep(380); if (my !== token) return; }
      if (ui.stop) stopSpeaking();
      if (ui.speakOn !== undefined) store.setPref('speakOn', !!ui.speakOn);
      if (ui.setActor) store.setPref('speakingAs', ui.setActor);
      if (ui.endConversation) convoOff = true;
      if (turn.speak || (turn.lines && turn.lines.length) || turn.pending) h('onMessage', { role: 'iris', text: turn.speak, lines: turn.lines || [], pending: turn.pending, ui, specialist: turn.specialist, ok: turn.ok });
      h('onUi', ui, turn);
      if (ui.repeat) { await repeat({ rate: ui.rate }); return afterTurn(turn, via); }
      if (turn.speak && prefs().speakOn) await speakText(turn.speak); else if (state !== 'error') setState('idle');
      afterTurn(turn, via);
    }

    function afterTurn(turn, via) {
      const ui = (turn && turn.ui) || {};
      // modo conversa (opt-in): só depois de turnos FALADOS; encerra por "obrigada", silêncio, fechar ou toque
      if (via === 'voz' && prefs().conversationMode && !convoOff && !ui.endConversation && !ui.close && !turn.pending && state === 'idle') {
        convoT = setTimeout(() => startListening({ fromConvo: true }), 700);
      }
    }

    // ---------- fala ----------
    function speakText(text, o = {}) {
      if (!tts.supported()) { h('onNotice', 'Este aparelho não tem síntese de voz. A resposta está na tela.'); setState('idle'); return Promise.resolve(); }
      lastSpoken = text; stopSpeaking(true); setState('speaking');
      const my = token;
      speaking = tts.speak(Iris.text.toSpeech(text), {
        voiceURI: prefs().voiceURI, rate: o.rate || prefs().rate, volume: prefs().volume,
        onlevel: v => h('onLevel', v), onerror: () => h('onNotice', 'Não consegui falar agora. A resposta está na tela.'),
      });
      return speaking.done.then(() => { speaking = null; if (state === 'speaking' && my === token) setState('idle'); h('onLevel', 0); });
    }
    function repeat({ rate } = {}) {
      if (!lastSpoken) { h('onNotice', 'Ainda não falei nada para repetir.'); return Promise.resolve(); }
      const base = prefs().rate || 1;
      return speakText(lastSpoken, { rate: rate === 'slower' ? Math.max(.55, base * .75) : rate === 'faster' ? Math.min(1.8, base * 1.25) : undefined });
    }

    // ---------- interação ----------
    function toggleMic() {
      switch (state) {
        case 'speaking': stopSpeaking(); return startListening();
        case 'listening': rec && rec.stop(); setState('transcribing'); return;
        case 'permission': return abortAll();
        case 'thinking': case 'acting': case 'transcribing': token++; setState('idle'); return;
        default: return startListening();
      }
    }
    function sendText(text) { const t = String(text || '').trim(); if (!t) return; stopSpeaking(true); if (rec) { try { rec.abort(); } catch (_) {} } return handleInput(t, 'texto'); }
    function abortAll() {
      token++; clearTimeout(convoT); clearTimeout(errT); convoOff = true;
      if (rec) { try { rec.abort(); } catch (_) {} rec = null; }
      stopSpeaking(true); h('onPartial', ''); setState(online() ? 'idle' : 'offline');
    }

    // ---------- ambiente ----------
    const d = DOC();
    if (d) {
      d.addEventListener('visibilitychange', () => { if (d.hidden && (state === 'listening' || state === 'speaking' || state === 'permission')) abortAll(); });
      root.addEventListener('pagehide', () => abortAll());
      root.addEventListener('offline', () => { if (state === 'idle') setState('offline'); h('onConnectivity', false); });
      root.addEventListener('online', () => { if (state === 'offline') setState('idle'); h('onConnectivity', true); });
      if (!online()) state = 'offline';
    }

    return { getState: () => state, caps, toggleMic, sendText, repeat, speakText, stopSpeaking, abortAll, startListening, handleInput, present, lastSpoken: () => lastSpoken };
  }

  const api = { createSession };
  Iris.session = api;
  return api;
});
