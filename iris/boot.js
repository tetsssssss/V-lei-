/* Íris · boot.js — liga tudo à ponte NossoSim. Sem rede. Estado da Íris em chave própria (nosso-sim-iris-v1). */
(function () {
  'use strict';
  const Iris = window.Iris, ns = window.NossoSim;
  if (!Iris || !ns) { console.warn('[Íris] ponte NossoSim ausente; assistente não iniciada.'); return; }

  let storage = null;
  try { storage = window.localStorage; storage.getItem('__iris_probe__'); } catch (_) { storage = null; } // modo privado etc.: cai para memória
  const store = Iris.store.createStore(storage);
  const audit = Iris.audit.createAudit(store);
  const memory = Iris.memory.createMemory(store);
  const tools = Iris.tools.createTools(ns, { audit, memory, store });
  const engine = Iris.intents.createEngine({ ns, tools, store, audit, memory });
  const hooks = {};
  // STT/TTS: navegador (padrão) ou externo (só se configurado + autenticado + escolhido nas configurações)
  const remoteOn = k => store.get().prefs[k] === 'remote' && Iris.remote && Iris.remote.llmReady() !== undefined && Iris.remote.loggedIn();
  let rSTT = null, rTTS = null; const getRSTT = () => (rSTT = rSTT || Iris.remote.sttAdapter()), getRTTS = () => (rTTS = rTTS || Iris.remote.ttsAdapter());
  const sttEngine = () => (remoteOn('sttEngine') ? getRSTT() : Iris.stt), ttsEngine = () => (remoteOn('ttsEngine') ? getRTTS() : Iris.tts);
  const sttProxy = { supported: () => sttEngine().supported(), create: o => sttEngine().create(o) };
  const ttsProxy = { supported: () => ttsEngine().supported(), rank: v => ttsEngine().rank(v), loadVoices: t => ttsEngine().loadVoices(t), guess: v => ttsEngine().guess(v), chunk: x => ttsEngine().chunk(x), speak: (t, o) => ttsEngine().speak(t, o), cancelAll: () => { Iris.tts.cancelAll(); if (rTTS) rTTS.cancelAll(); } };
  const session = Iris.session.createSession({ engine, store, stt: sttProxy, tts: ttsProxy, mic: Iris.mic, hooks });
  // IA externa: só se o casal ligou, há login e o backend tem LLM; o motor local sempre tenta primeiro.
  hooks.external = async text => (store.get().consent.externalAI && Iris.remote.llmReady() ? Iris.remote.ask(text, { ns, engine, tools, store }) : null);
  if (Iris.remote.configuredEndpoint()) Iris.remote.health().catch(() => {});
  let panel = null;
  const settings = Iris.settings.createSettings({ store, session, tts: ttsProxy, stt: sttProxy, mic: Iris.mic, engine, memory, apply: () => panel && panel.apply(), remote: Iris.remote });
  panel = Iris.panel.createPanel({ ns, store, engine, session, memory, audit, tts: ttsProxy, stt: sttProxy, mic: Iris.mic, remote: Iris.remote, hooks, settings });

  // "Conversar com a Íris" no menu (desktop, "Mais" no celular). Abre a tela de voz; não é uma seção roteada.
  ns.registerSection('iris', { title: 'Conversar com a Íris', icon: '◉', position: 1, open: () => panel.open(), render: () => '' });
  if (Iris.dashboard && Iris.dashboard.register) Iris.dashboard.register(ns, { panel, engine, session, store, tools });
  if (Iris.padrinhosFotos && Iris.padrinhosFotos.init) Iris.padrinhosFotos.init(ns, { engine, session, store });

  // import/reset de dados: o desfazer antigo não vale mais e o contexto pendente é descartado
  window.addEventListener('nossosim:data-replaced', () => { audit.invalidateUndo(); engine.reset(); });
  if (Iris.tts && Iris.tts.supported()) Iris.tts.loadVoices();
  panel.apply();
  if (/[?&]iris=1(?:&|$)/.test(location.search)) panel.open();

  Iris.app = { ns, store, engine, session, panel, tools, audit, memory, version: '3.0' }; // inspeção e testes; não contém segredos
  window.dispatchEvent(new Event('iris:ready'));
})();
