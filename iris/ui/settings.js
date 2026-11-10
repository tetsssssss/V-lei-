/* Íris · settings.js — configurações, privacidade e "o que a Íris lembra". Tudo local; sem rede. */
(function (root, factory) {
  const api = factory(root.Iris || (root.Iris = {}), root);
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Iris, root) {
  'use strict';
  const { h, icon, clear } = Iris.dom;

  function drawer(title, onBack) {
    const body = h('div', { class: 'iris-drawer-body' });
    const el = h('section', { class: 'iris-drawer', hidden: true, 'aria-label': title },
      h('header', {}, h('button', { class: 'iris-icon-btn', 'aria-label': 'Voltar', onclick: onBack }, icon('back')), h('h3', { text: title })), body);
    return { el, body };
  }
  const sw = (id, checked, onchange, label, hint) => h('div', { class: 'iris-row' }, h('label', { for: id }, label, hint ? h('small', { text: ' ' + hint }) : null), h('span', { class: 'iris-switch' }, h('input', { type: 'checkbox', id, checked: !!checked, onchange: e => onchange(e.target.checked) }), h('span', {})));

  function createSettings({ store, session, tts, stt, mic, engine, memory, apply, remote }) {
    const prefs = () => store.get().prefs, consent = () => store.get().consent;
    const settings = drawer('Configurações da Íris', () => (settings.el.hidden = true));
    const mem = drawer('O que a Íris lembra', () => (mem.el.hidden = true));

    async function renderSettings() {
      const b = clear(settings.body);
      await tts.loadVoices();
      const caps = session.caps();
      const ranked = caps.ptVoices;

      // Voz
      const voiceSel = h('select', { id: 'iris-voice', 'aria-label': 'Voz', onchange: e => { store.setPref('voiceURI', e.target.value); } },
        h('option', { value: '', text: ranked.length ? 'Automática (melhor voz em português)' : 'Voz padrão do aparelho' }),
        ...ranked.map(v => h('option', { value: v.uri, selected: v.uri === prefs().voiceURI, text: `${v.name} (${v.lang}) — ${v.gender}` })));
      b.append(h('div', { class: 'iris-set' }, h('h4', { text: 'Voz' }),
        h('p', { text: caps.tts ? (ranked.length ? 'O navegador não informa o gênero da voz: "feminina provável" é uma estimativa pelo nome. Ouça a amostra e escolha a que preferir.' : 'Não encontrei voz em português neste aparelho. Vou usar a voz padrão (pode soar com sotaque). Instale uma voz pt-BR nas configurações do Android ou use um provedor de voz configurável pelo backend.') : 'Este navegador não tem síntese de voz. As respostas aparecem só na tela.' }),
        voiceSel,
        h('button', { class: 'iris-btn', onclick: () => session.speakText('Oi! Eu sou a ' + prefs().name + '. Esta é a minha voz. Posso falar mais devagar ou mais rápido, como você preferir.') }, 'Ouvir amostra'),
        h('label', { for: 'iris-rate' }, 'Velocidade da fala: ', h('b', { id: 'iris-rate-v', text: prefs().rate.toFixed(2) + '×' })),
        h('input', { type: 'range', id: 'iris-rate', min: '0.6', max: '1.5', step: '0.05', value: String(prefs().rate), oninput: e => { store.setPref('rate', Number(e.target.value)); root.document.getElementById('iris-rate-v').textContent = Number(e.target.value).toFixed(2) + '×'; } }),
        h('label', { for: 'iris-vol' }, 'Volume da fala'),
        h('input', { type: 'range', id: 'iris-vol', min: '0', max: '1', step: '0.05', value: String(prefs().volume), oninput: e => store.setPref('volume', Number(e.target.value)) }),
        sw('iris-sw-speak', prefs().speakOn, v => store.setPref('speakOn', v), 'Responder falando')));

      // Conversa
      b.append(h('div', { class: 'iris-set' }, h('h4', { text: 'Conversa' }),
        sw('iris-sw-review', prefs().reviewBeforeSend, v => store.setPref('reviewBeforeSend', v), 'Revisar o texto antes de enviar', 'Você corrige o que o microfone entendeu.'),
        sw('iris-sw-convo', prefs().conversationMode, v => store.setPref('conversationMode', v), 'Modo conversa', 'Depois de responder, volto a ouvir por alguns segundos. O microfone fica visível como ligado.'),
        sw('iris-sw-sounds', prefs().sounds, v => store.setPref('sounds', v), 'Sons suaves ao ouvir e enviar'),
        sw('iris-sw-brief', prefs().briefingOnOpen, v => store.setPref('briefingOnOpen', v), 'Mostrar o briefing ao abrir', 'Só mostra; só falo se você tocar em "Ouvir".')));

      // Aparência
      b.append(h('div', { class: 'iris-set' }, h('h4', { text: 'Aparência' }),
        h('label', { for: 'iris-theme' }, 'Tema'),
        h('select', { id: 'iris-theme', onchange: e => { store.setPref('theme', e.target.value); apply(); } }, h('option', { value: 'romantico', selected: prefs().theme === 'romantico', text: 'Romântico (padrão)' }), h('option', { value: 'jarvis', selected: prefs().theme === 'jarvis', text: 'Jarvis (azul-ciano)' })),
        h('label', { for: 'iris-motion' }, 'Animações'),
        h('select', { id: 'iris-motion', onchange: e => { store.setPref('reduceMotion', e.target.value); apply(); } }, h('option', { value: 'auto', selected: prefs().reduceMotion === 'auto', text: 'Seguir o sistema' }), h('option', { value: 'on', selected: prefs().reduceMotion === 'on', text: 'Reduzir sempre' }), h('option', { value: 'off', selected: prefs().reduceMotion === 'off', text: 'Sempre ativas' })),
        h('label', { for: 'iris-name' }, 'Nome da assistente'),
        h('input', { type: 'text', id: 'iris-name', maxlength: '20', value: prefs().name, onchange: e => { const v = e.target.value.trim() || 'Íris'; store.setPref('name', v); apply(); } })));

      // Privacidade
      const ext = remote && remote.configuredEndpoint();
      b.append(h('div', { class: 'iris-set' }, h('h4', { text: 'Privacidade e dados' }),
        h('p', { text: 'Seus dados do casamento ficam só neste aparelho. A voz é reconhecida pelo serviço de voz do navegador (no Chrome, o áudio passa pelo Google). Nenhum áudio é guardado por mim, nem fotos ou listas completas são enviadas.' }),
        h('div', { class: 'iris-row' }, h('span', { class: 'iris-badge', 'data-on': consent().voice ? '1' : '0', text: consent().voice ? 'Voz autorizada' : 'Voz ainda não autorizada' }),
          h('button', { class: 'iris-btn', onclick: () => { store.setConsent('voice', false); renderSettings(); } }, 'Revogar')),
        h('div', { class: 'iris-row' }, h('span', { class: 'iris-badge', 'data-on': ext ? '1' : '0', text: ext ? 'IA externa: endpoint configurado' : 'IA externa não configurada' })),
        sw('iris-sw-ext', consent().externalAI && ext, v => store.setConsent('externalAI', v), 'Usar IA externa (opcional)', ext ? '' : 'Indisponível: nenhum backend configurado.'),
        h('label', { for: 'iris-level' }, 'O que posso enviar à IA externa'),
        h('select', { id: 'iris-level', onchange: e => store.setConsent('level', Number(e.target.value)) },
          h('option', { value: '0', selected: consent().level === 0, text: 'Só totais e contagens (padrão)' }), h('option', { value: '1', selected: consent().level === 1, text: '+ nomes de fornecedores, ideias e tarefas' }), h('option', { value: '2', selected: consent().level === 2, text: '+ nomes de convidados' })),
        h('small', { text: 'Fotos nunca são enviadas, em nenhum nível.' }),
        h('label', { for: 'iris-ret' }, 'Guardar o histórico da conversa'),
        h('select', { id: 'iris-ret', onchange: e => { const v = e.target.value; store.setPref('retentionDays', v === 'forever' ? null : Number(v)); store.save(); } },
          ...[['0', 'Não guardar'], ['7', 'Por 7 dias'], ['30', 'Por 30 dias'], ['forever', 'Até eu apagar']].map(([v, l]) => h('option', { value: v, selected: String(prefs().retentionDays === null ? 'forever' : prefs().retentionDays) === v, text: l }))),
        h('div', { class: 'iris-msg-actions' }, h('button', { class: 'iris-btn', onclick: () => { renderMemory(); mem.el.hidden = false; } }, 'Ver o que a Íris lembra'), h('button', { class: 'iris-btn iris-btn--danger', onclick: () => { if (root.confirm('Apagar o histórico da conversa neste aparelho?')) { store.clearConversation(); root.dispatchEvent(new Event('iris:history-cleared')); } } }, 'Apagar histórico'))));

      // Diagnóstico honesto
      const yn = v => (v ? 'sim' : 'não');
      b.append(h('div', { class: 'iris-set' }, h('h4', { text: 'Este aparelho' }),
        h('p', { text: `Reconhecimento de voz: ${yn(caps.stt)} · Síntese de voz: ${yn(caps.tts)} · Vozes em português: ${caps.voices} · Conexão: ${yn(caps.online)} · Página segura (https/localhost): ${yn(caps.secure)}` }),
        h('p', { text: 'Funciona no Chrome (Android e computador). Em outros navegadores o reconhecimento pode não existir; o campo de texto faz tudo igual. O app não escuta em segundo plano.' })));
    }

    function renderMemory() {
      const b = clear(mem.body);
      const items = memory.list();
      b.append(h('p', { class: 'iris-set', text: 'Aqui está o que eu guardei. Você pode corrigir ou apagar. O estado real do casamento eu leio direto do app, não da memória.' }));
      const input = h('input', { type: 'text', id: 'iris-mem-new', placeholder: 'Anotar algo para eu lembrar…', 'aria-label': 'Nova nota', maxlength: '300' });
      b.append(h('form', { class: 'iris-form', onsubmit: e => { e.preventDefault(); if (input.value.trim()) { memory.add({ text: input.value, source: 'declarado', author: prefs().speakingAs || '' }); renderMemory(); } } }, input, h('button', { class: 'iris-btn iris-btn--primary', type: 'submit' }, 'Anotar')));
      if (!items.length) b.append(h('p', { class: 'iris-set', text: 'Ainda não guardei nada.' }));
      for (const m of items) {
        b.append(h('div', { class: 'iris-memory-item' }, h('span', { text: m.text }), h('small', { text: `${memory.label(m.source)}${m.author ? ' · ' + m.author : ''} · ${new Date(m.ts).toLocaleDateString('pt-BR')}` }),
          h('div', { class: 'iris-msg-actions' },
            h('button', { class: 'iris-btn', onclick: () => { const t = root.prompt('Corrigir a nota:', m.text); if (t !== null) { memory.update(m.id, t); renderMemory(); } } }, 'Corrigir'),
            h('button', { class: 'iris-btn iris-btn--danger', onclick: () => { memory.remove(m.id); renderMemory(); } }, 'Apagar'))));
      }
      if (items.length) b.append(h('button', { class: 'iris-btn iris-btn--danger', onclick: () => { if (root.confirm('Apagar toda a memória da Íris?')) { memory.clear(); renderMemory(); } } }, 'Apagar toda a memória'));
    }

    return { settingsEl: settings.el, memoryEl: mem.el, openSettings() { renderSettings(); settings.el.hidden = false; }, openMemory() { renderMemory(); mem.el.hidden = false; }, closeAll() { settings.el.hidden = true; mem.el.hidden = true; }, anyOpen: () => !settings.el.hidden || !mem.el.hidden };
  }

  const api = { createSettings };
  Iris.settings = api;
  return api;
});
