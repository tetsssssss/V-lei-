/* Íris · tts.js — síntese de voz (speechSynthesis). A API NÃO informa gênero: o "feminina provável" é heurística
   por nome da voz; quem decide é a pessoa, com prévia. Fala em frases (contorna o corte de ~15 s do Chrome). */
(function (root, factory) {
  const api = factory(root.Iris || (root.Iris = {}), root);
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Iris, root) {
  'use strict';
  const synth = () => root.speechSynthesis;
  const supported = () => !!(root.speechSynthesis && root.SpeechSynthesisUtterance);
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  const FEM = ['francisca', 'luciana', 'maria', 'vitoria', 'camila', 'fernanda', 'giovanna', 'thalita', 'leticia', 'heloisa', 'yara', 'manuela', 'raquel', 'brenda', 'joana', 'google portugues do brasil', 'google português do brasil'];
  const MASC = ['daniel', 'antonio', 'jorge', 'felipe', 'marcos', 'ricardo', 'thiago', 'tiago', 'donato', 'jose'];
  function guess(voice) {
    const n = norm(voice.name);
    if (FEM.some(f => n.includes(norm(f)))) return 'feminina provável';
    if (MASC.some(m => n.includes(m))) return 'masculina provável';
    return 'não informado';
  }
  function score(v) {
    let s = 0; const lang = String(v.lang || '').replace('_', '-').toLowerCase();
    if (lang === 'pt-br') s += 100; else if (lang.startsWith('pt')) s += 50; else return -1;
    const g = guess(v); if (g === 'feminina provável') s += 30; if (g === 'masculina provável') s -= 20;
    if (/google|natural|online/i.test(v.name)) s += 6; if (v.localService) s += 2;
    return s;
  }
  /** Vozes pt-* ordenadas; cada item { voice, name, lang, gender } */
  const rank = voices => voices.map(v => ({ voice: v, s: score(v) })).filter(x => x.s >= 0).sort((a, b) => b.s - a.s).map(x => ({ voice: x.voice, name: x.voice.name, lang: x.voice.lang, uri: x.voice.voiceURI, gender: guess(x.voice) }));

  /** Vozes carregam de forma assíncrona (voiceschanged). Resolve com o que houver após `timeout`. */
  function loadVoices(timeout = 2500) {
    return new Promise(resolve => {
      if (!supported()) return resolve([]);
      const get = () => synth().getVoices() || [];
      if (get().length) return resolve(get());
      let done = false; const finish = () => { if (done) return; done = true; synth().removeEventListener && synth().removeEventListener('voiceschanged', on); resolve(get()); };
      const on = () => { if (get().length) finish(); };
      synth().addEventListener && synth().addEventListener('voiceschanged', on);
      setTimeout(finish, timeout);
    });
  }

  /** Divide em frases de até ~170 caracteres. */
  function chunk(text, max = 170) {
    const sentences = String(text).replace(/\s+/g, ' ').trim().split(/(?<=[.!?…;:])\s+/);
    const out = []; let cur = '';
    for (const s of sentences) {
      if ((cur + ' ' + s).trim().length <= max) cur = (cur + ' ' + s).trim();
      else { if (cur) out.push(cur); if (s.length <= max) cur = s; else { const parts = s.split(/,\s*/); cur = ''; for (const p of parts) { if ((cur + ', ' + p).length <= max) cur = cur ? cur + ', ' + p : p; else { if (cur) out.push(cur); cur = p; } } } }
    }
    if (cur) out.push(cur);
    return out;
  }

  /** speak(text,{voiceURI,rate,volume,onstart,onend,onerror,onlevel}) → { cancel(), done:Promise } */
  function speak(text, o = {}) {
    if (!supported()) { o.onerror && o.onerror(new Error('sem síntese de voz')); return { cancel() {}, done: Promise.resolve() }; }
    const chunks = chunk(text); let cancelled = false, idx = 0, levelT = null;
    const voices = synth().getVoices() || [];
    const voice = (o.voiceURI && voices.find(v => v.voiceURI === o.voiceURI)) || (rank(voices)[0] || {}).voice || null;
    const stopLevel = () => { clearInterval(levelT); levelT = null; o.onlevel && o.onlevel(0); };
    const done = new Promise(resolve => {
      const next = () => {
        if (cancelled || idx >= chunks.length) { stopLevel(); if (!cancelled) o.onend && o.onend(); return resolve(); }
        const u = new root.SpeechSynthesisUtterance(chunks[idx++]);
        u.lang = (voice && voice.lang) || 'pt-BR'; if (voice) u.voice = voice;
        u.rate = Math.min(2, Math.max(.5, o.rate || 1)); u.volume = Math.min(1, Math.max(0, o.volume ?? 1)); u.pitch = 1;
        u.onstart = () => { if (idx === 1) o.onstart && o.onstart(); if (!levelT && o.onlevel) levelT = setInterval(() => o.onlevel(.35 + Math.random() * .65), 110); };
        u.onend = next;
        u.onerror = e => { if (cancelled || (e && (e.error === 'canceled' || e.error === 'interrupted'))) return; stopLevel(); o.onerror && o.onerror(e); resolve(); };
        synth().speak(u);
      };
      synth().cancel(); // limpa fila anterior
      setTimeout(next, 30);
    });
    return { done, cancel() { cancelled = true; stopLevel(); try { synth().cancel(); } catch (_) {} } };
  }
  const cancelAll = () => { try { synth() && synth().cancel(); } catch (_) {} };

  const api = { supported, loadVoices, rank, guess, chunk, speak, cancelAll };
  Iris.tts = api;
  return api;
});
