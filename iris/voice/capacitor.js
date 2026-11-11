/* Íris · capacitor.js — dentro do APK feito com Capacitor, cria a ponte `window.IrisAndroid` (a mesma interface do APK
   antigo) usando os plugins @capacitor-community/speech-recognition e text-to-speech, e @capacitor/filesystem+share
   para salvar backups. Fora do Capacitor (navegador/PWA) este módulo não faz NADA.
   STATUS: testado só com plugins SIMULADOS; nunca rodou num Android real. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  function install() {
    const C = root.Capacitor;
    if (!C || !C.isNativePlatform || !C.isNativePlatform() || root.IrisAndroid) return false;
    const P = C.Plugins || {}, SR = P.SpeechRecognition, TTS = P.TextToSpeech, FS = P.Filesystem, SH = P.Share;
    const cb = () => root.IrisNativeCb || {};
    const st = { perm: false, ptVoice: false, listening: false, cancelled: false, last: '', gotFinal: false, errored: false };
    // sempre devolve uma Promise (nunca lança): erros síncronos ou assíncronos do plugin vão para `f`
    const guard = (p, f) => { try { return Promise.resolve(p()).catch(e => { if (f) f(e); }); } catch (e) { if (f) f(e); return Promise.resolve(); } };

    if (SR) {
      guard(() => SR.checkPermissions(), () => {}).then(r => { st.perm = !!r && r.speechRecognition === 'granted'; });
      const end = () => { if (!st.listening) return; st.listening = false; const c = cb(); if (!st.cancelled && !st.errored) { if (st.last) c.onStt && c.onStt('final', st.last); else c.onStt && c.onStt('error', 'no-speech'); } c.onStt && c.onStt('end', ''); };
      guard(() => SR.addListener('partialResults', ev => { const t = ev && ev.matches && ev.matches[0]; if (t && st.listening) { st.last = t; cb().onStt && cb().onStt('partial', t); } }));
      guard(() => SR.addListener('listeningState', ev => { if (ev && ev.status === 'stopped') end(); }));
    }
    if (TTS) guard(() => TTS.isLanguageSupported({ lang: 'pt-BR' }), () => {}).then(r => { st.ptVoice = !!(r && r.supported); });

    root.IrisAndroid = {
      version: () => 'capacitor-3.1',
      isRecognitionAvailable: () => !!SR,
      hasMicPermission: () => st.perm,
      requestMicPermission() { guard(() => SR.requestPermissions(), () => {}).then(r => { st.perm = !!r && r.speechRecognition === 'granted'; cb().onPerm && cb().onPerm(st.perm); }); },
      startListening() {
        st.listening = true; st.cancelled = false; st.last = ''; st.errored = false;
        const fail = e => { st.errored = true; st.listening = false; const c = cb(); c.onStt && c.onStt('error', /perm|denied/i.test(String(e && e.message)) ? 'not-allowed' : 'network'); c.onStt && c.onStt('end', ''); };
        guard(() => SR.start({ language: 'pt-BR', maxResults: 1, prompt: '', partialResults: true, popup: false }), fail);
        const c = cb(); c.onStt && c.onStt('start', '');
      },
      stopListening() { guard(() => SR.stop()); },
      cancelListening() { st.cancelled = true; guard(() => SR.stop()); },
      isTtsReady: () => !!TTS,
      hasPtVoice: () => st.ptVoice,
      speak(id, text, rate, volume) {
        const c = cb(); c.onTts && c.onTts(id, 'start', '');
        let pr; try { pr = Promise.resolve(TTS.speak({ text, lang: 'pt-BR', rate: rate || 1, volume: volume === undefined ? 1 : volume, category: 'ambient' })); } catch (e) { pr = Promise.reject(e); }
        pr.then(() => { cb().onTts && cb().onTts(id, 'done', ''); }, e => { cb().onTts && cb().onTts(id, 'error', String((e && e.message) || 'tts')); });
      },
      stopSpeaking() { guard(() => TTS.stop()); },
      /** O Android não deixa salvar de forma síncrona: grava no cache do app e abre o "Compartilhar/Salvar" do sistema. */
      saveFile(name, text) {
        if (!FS || !SH) return 'ERRO: salvar arquivos indisponível neste aparelho.';
        const toast = (m, bad) => { try { root.NossoSim.toast(m, bad); } catch (_) {} };
        (async () => { const w = await FS.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' }); await SH.share({ title: name, url: w.uri, dialogTitle: 'Salvar ou enviar o backup' }); })().catch(e => toast('Não consegui salvar o backup: ' + (e && e.message || e), true));
        return 'o menu de compartilhamento do Android (escolha onde guardar)';
      },
    };
    return true;
  }
  install();
  return { install };
});
