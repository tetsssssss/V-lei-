/* Íris · stt.js — reconhecimento de fala (Web Speech API). Chrome envia o áudio ao serviço de voz do Google;
   por isso há consentimento prévio. Não funciona offline de forma universal. */
(function (root, factory) {
  const api = factory(root.Iris || (root.Iris = {}), root);
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Iris, root) {
  'use strict';
  const Ctor = () => root.SpeechRecognition || root.webkitSpeechRecognition;
  const supported = () => !!Ctor();

  const ERRORS = {
    'no-speech': 'Não ouvi nada. Toque no microfone e fale de novo.',
    'audio-capture': 'Não consegui captar áudio. Confira se o microfone está disponível.',
    'not-allowed': 'O microfone está bloqueado. Libere nas configurações do site (cadeado ao lado do endereço).',
    'service-not-allowed': 'O reconhecimento de voz não está liberado nesta página. Use https ou localhost.',
    network: 'Sem conexão com o serviço de voz do navegador. Você pode digitar.',
    'language-not-supported': 'Este navegador não reconhece português do Brasil. Use o campo de texto.',
    'start-failed': 'Não consegui iniciar a escuta. Tente de novo.',
    timeout: 'A escuta demorou demais e foi encerrada.',
  };

  /** create({lang, silenceMs, maxMs}) → { start, stop, abort, on } ; eventos: start audio sound partial final error end */
  function create({ lang = 'pt-BR', silenceMs = 9000, maxMs = 30000 } = {}) {
    const C = Ctor(); if (!C) throw new Error('SpeechRecognition indisponível');
    const rec = new C();
    rec.lang = lang; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 3;
    const handlers = {}; const emit = (e, p) => (handlers[e] || []).forEach(f => { try { f(p); } catch (_) {} });
    let finalText = '', interim = '', errored = false, aborted = false, silenceT = null, maxT = null, ended = false;
    const clear = () => { clearTimeout(silenceT); clearTimeout(maxT); };
    const armSilence = () => { clearTimeout(silenceT); silenceT = setTimeout(() => { try { rec.stop(); } catch (_) {} }, silenceMs); };

    rec.onstart = () => { emit('start'); armSilence(); };
    rec.onaudiostart = () => emit('audio');
    rec.onsoundstart = () => emit('sound');
    rec.onresult = e => {
      interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) finalText += r[0].transcript + ' '; else interim += r[0].transcript; }
      emit('partial', (finalText + interim).trim()); armSilence();
    };
    rec.onerror = e => {
      if (e.error === 'aborted') return; // abort intencional
      errored = true; clear(); emit('error', { code: e.error, message: ERRORS[e.error] || 'Algo deu errado no reconhecimento de voz.' });
    };
    rec.onend = () => {
      if (ended) return; ended = true; clear();
      if (!errored && !aborted) {
        const text = (finalText + ' ' + interim).replace(/\s+/g, ' ').trim();
        if (text) emit('final', text); else emit('error', { code: 'no-speech', message: ERRORS['no-speech'] });
      }
      emit('end');
    };

    return {
      on(e, f) { (handlers[e] = handlers[e] || []).push(f); return this; },
      start() {
        try { rec.start(); maxT = setTimeout(() => { try { rec.stop(); } catch (_) {} }, maxMs); }
        catch (e) { errored = true; emit('error', { code: 'start-failed', message: ERRORS['start-failed'] }); emit('end'); }
      },
      stop() { try { rec.stop(); } catch (_) {} },          // entrega o que já ouviu
      abort() { aborted = true; clear(); try { rec.abort(); } catch (_) {} }, // descarta
    };
  }
  const api = { supported, create, ERRORS };
  Iris.stt = api;
  return api;
});
