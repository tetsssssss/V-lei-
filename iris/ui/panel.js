/* Íris · panel.js — tela de voz (orbe, legendas, confirmações, chips), botão flutuante e modo "espiar". */
(function (root, factory) {
  const api = factory(root.Iris || (root.Iris = {}), root);
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Iris, root) {
  'use strict';
  const { h, icon, clear } = Iris.dom;
  const doc = root.document;

  const STATUS = {
    idle: 'Toque no microfone para falar', permission: 'Aguardando a permissão do microfone…', listening: 'Ouvindo…', transcribing: 'Transcrevendo…',
    thinking: 'Pensando…', acting: 'Aplicando a alteração…', speaking: 'Falando…', offline: 'Sem conexão: digite, que funciona igual', error: 'Algo deu errado',
  };
  const MIC_LABEL = { idle: 'Toque para falar', listening: 'Toque para enviar', speaking: 'Toque para interromper', thinking: 'Toque para cancelar', acting: 'Toque para cancelar', transcribing: 'Toque para cancelar', permission: 'Toque para cancelar', offline: 'Sem conexão', error: 'Toque para tentar de novo' };

  function createPanel({ ns, store, engine, session, memory, audit, tts, stt, mic, remote, hooks, settings }) {
    const prefs = () => store.get().prefs;
    let mode = 'closed', opener = null, briefed = false;

    // ---------- estrutura ----------
    const orb = Iris.orb.create();
    const status = h('div', { class: 'iris-status', 'aria-live': 'polite' });
    const partial = h('div', { class: 'iris-partial', 'aria-live': 'off' });
    const specialist = h('div', { class: 'iris-specialist' });
    const log = h('div', { class: 'iris-log', role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversa com a Íris' });
    const pendingEl = h('div', { class: 'iris-pending', hidden: true, role: 'group' });
    const chipsEl = h('div', { class: 'iris-chips', role: 'group', 'aria-label': 'Sugestões' });
    const input = h('input', { type: 'text', id: 'iris-input', 'aria-label': 'Escreva para a Íris', placeholder: 'Ou escreva aqui…', autocomplete: 'off', enterkeyhint: 'send', maxlength: '400' });
    const sendBtn = h('button', { class: 'iris-btn iris-btn--primary', type: 'submit', 'aria-label': 'Enviar' }, icon('send'));
    const micBtn = h('button', { class: 'iris-mic', type: 'button', 'aria-pressed': 'false', 'aria-label': 'Falar com a Íris', onclick: () => session.toggleMic() }, icon('mic'));
    const micLabel = h('div', { class: 'iris-mic-label', 'aria-hidden': 'true' });
    const liveEl = h('div', { class: 'iris-live' }, h('p', { class: 'iris-live-empty', text: 'Quando eu falar de orçamento, convidados ou padrinhos, os números reais aparecem aqui.' }));
    const actorWrap = h('div', { class: 'iris-actor', role: 'group', 'aria-label': 'Quem está falando' });
    const title = h('h2', { text: 'Íris' });
    const modeBtn = h('button', { class: 'iris-icon-btn', 'aria-label': 'Reduzir para ver o app', onclick: () => setMode(mode === 'peek' ? 'full' : 'peek') }, icon('back'));
    const consentEl = h('div', { class: 'iris-consent', hidden: true, role: 'alertdialog', 'aria-labelledby': 'iris-consent-t' },
      h('div', {}, h('h3', { id: 'iris-consent-t', text: 'Antes de usar a voz' }),
        h('p', { text: 'Para entender o que você fala, o navegador usa o serviço de reconhecimento de voz dele. No Chrome, o áudio é enviado ao Google para virar texto. Eu não guardo áudio e não envio fotos nem listas de convidados.' }),
        h('p', { text: 'O microfone só liga quando você toca no botão, e aparece sempre que está ligado. Se preferir, escreva: faz tudo igual.' }),
        h('div', { class: 'iris-msg-actions' },
          h('button', { class: 'iris-btn iris-btn--primary', onclick: () => { store.setConsent('voice', true); consentEl.hidden = true; session.startListening(); } }, 'Concordo, usar a voz'),
          h('button', { class: 'iris-btn', onclick: () => { consentEl.hidden = true; input.focus(); } }, 'Prefiro escrever'))));

    const sheet = h('div', { class: 'iris-sheet' },
      h('div', { class: 'iris-top' }, title, actorWrap,
        h('button', { class: 'iris-icon-btn', 'aria-label': 'Configurações da Íris', onclick: () => settings.openSettings() }, icon('gear')), modeBtn,
        h('button', { class: 'iris-icon-btn', 'aria-label': 'Fechar a conversa', onclick: () => close() }, icon('close'))),
      h('div', { class: 'iris-body' },
        h('div', { class: 'iris-left' },
          h('div', { class: 'iris-stage' }, orb.el, status, partial, specialist),
          h('div', { class: 'iris-main' }, log), pendingEl,
          h('form', { class: 'iris-dock', onsubmit: e => { e.preventDefault(); const t = input.value.trim(); if (t) { input.value = ''; session.sendText(t); } } },
            chipsEl, h('div', { class: 'iris-form' }, input, sendBtn), h('div', { class: 'iris-mic-row' }, micBtn, micLabel))),
        liveEl),
      settings.settingsEl, settings.memoryEl, consentEl);

    const rootEl = h('div', { id: 'iris-root', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Conversa com a Íris', 'data-mode': 'closed' }, h('div', { class: 'iris-backdrop', onclick: () => close() }), sheet);
    const fab = h('button', { class: 'iris-fab', type: 'button', 'aria-label': 'Conversar com a Íris', onclick: e => open({ opener: e.currentTarget }) }, Iris.orb.mini());
    doc.body.append(rootEl, fab);

    // ---------- aparência ----------
    function apply() {
      const p = prefs();
      for (const el of [rootEl, fab, ...doc.querySelectorAll('.iris-central')]) el.setAttribute('data-iris-theme', p.theme);
      if (p.reduceMotion === 'on') doc.documentElement.setAttribute('data-iris-motion', 'off'); else doc.documentElement.removeAttribute('data-iris-motion');
      title.textContent = p.name;
      fab.setAttribute('aria-label', 'Conversar com a ' + p.name);
      renderActor();
    }
    function renderActor() {
      clear(actorWrap);
      const A = ns.getData().settings.personA, B = ns.getData().settings.personB;
      for (const name of [A, B]) {
        actorWrap.append(h('button', { type: 'button', 'aria-pressed': String(prefs().speakingAs === name), onclick: () => { const next = prefs().speakingAs === name ? '' : name; store.setPref('speakingAs', next); engine.setActor(next); renderActor(); } }, name));
      }
      engine.setActor(prefs().speakingAs || '');
    }

    // ---------- modos / abrir / fechar ----------
    function setMode(m) {
      mode = m; rootEl.setAttribute('data-mode', m);
      modeBtn.setAttribute('aria-label', m === 'peek' ? 'Expandir a conversa' : 'Reduzir para ver o app');
      doc.documentElement.style.overflow = m === 'full' ? 'hidden' : '';
      if (m === 'full') scrollLog();
    }
    function open({ opener: o, peek } = {}) {
      opener = o || opener || doc.activeElement; rootEl.hidden = false; fab.hidden = true; apply();
      setMode(peek ? 'peek' : 'full'); viewport();
      if (!log.childElementCount) restoreHistory();
      if (!prefs().introDone) intro(); else if (prefs().briefingOnOpen && !briefed) renderBriefing();
      renderChips(engine.suggestions()); renderPending();
      micBtn.focus({ preventScroll: true });
    }
    function close() {
      session.abortAll(); settings.closeAll(); rootEl.hidden = true; fab.hidden = false; mode = 'closed'; rootEl.setAttribute('data-mode', 'closed'); doc.documentElement.style.overflow = '';
      briefed = false; if (opener && opener.focus) { try { opener.focus({ preventScroll: true }); } catch (_) {} }
    }
    const isOpen = () => !rootEl.hidden;

    // ---------- mensagens ----------
    const scrollLog = () => { log.scrollTop = log.scrollHeight; };
    function addMsg(node) {
      log.append(node);
      // resposta da Íris: mostra o COMEÇO dela (o painel vivo ocupa espaço); demais mensagens: rola ao fim
      if (node.classList.contains('iris-msg--iris') && log.scrollHeight > log.clientHeight) log.scrollTop += node.getBoundingClientRect().top - log.getBoundingClientRect().top - 4;
      else scrollLog();
    }
    function restoreHistory() {
      for (const m of store.get().conversation.slice(-30)) {
        if (m.role === 'user') addMsg(userNode(m)); else if (m.role === 'iris') addMsg(irisNode({ text: m.text, lines: [] }));
      }
    }
    const userNode = m => h('div', { class: 'iris-msg iris-msg--you' }, h('p', { text: m.text }), h('small', { text: [m.actor, m.via === 'voz' ? 'por voz' : 'digitado'].filter(Boolean).join(' · ') }));
    function irisNode(m) {
      const n = h('div', { class: 'iris-msg iris-msg--iris' }, m.text ? h('p', { text: m.text }) : null);
      if (m.lines && m.lines.length) n.append(h('details', {}, h('summary', { text: `Ver detalhes (${m.lines.filter(Boolean).length})` }), h('ul', {}, ...m.lines.filter(l => l !== '').map(l => h('li', { text: l })))));
      const acts = [];
      if (m.ui && m.ui.undoId) acts.push(h('button', { class: 'iris-btn', type: 'button', onclick: e => { e.currentTarget.disabled = true; session.present(engine.runTool('undoRecentAction', {})); } }, icon('undo'), ' Desfazer'));
      if (m.speakBtn) acts.push(m.speakBtn);
      if (acts.length) n.append(h('div', { class: 'iris-msg-actions' }, ...acts));
      return n;
    }
    function intro() {
      const A = ns.getData().settings.personA, B = ns.getData().settings.personB, text = `Oi, ${A} e ${B}! Eu sou a ${prefs().name}. Posso ajudar vocês a organizar o casamento. Por onde começamos?`;
      store.setPref('introDone', true);
      addMsg(irisNode({ text }));
      if (prefs().speakOn && session.caps().tts) session.speakText(text);
    }
    function renderBriefing() {
      briefed = true;
      let b; try { b = Iris.briefing.build(ns); } catch (e) { return; }
      const spoken = `${b.headline} ${b.priorities.length ? 'Prioridades: ' + b.priorities.map(p => p.text).join('; ') + '.' : 'Não há pendências abertas.'}`;
      const lines = [...b.priorities.map(p => '• ' + p.text), ...b.alerts.map(a => (a.level === 'warn' ? '⚠ ' : 'ℹ ') + a.text)];
      const listen = h('button', { class: 'iris-btn', type: 'button', onclick: () => session.speakText(spoken) }, 'Ouvir o briefing');
      const n = irisNode({ text: b.headline, lines, speakBtn: listen }); n.querySelector('details') && n.querySelector('details').setAttribute('open', '');
      addMsg(n);
    }

    function renderPending() {
      const p = engine.state().pending; clear(pendingEl); pendingEl.hidden = !p; rootEl.classList.toggle('iris-has-pending', !!p); if (!p) return;
      pendingEl.setAttribute('data-risk', p.risk);
      const rows = (p.diff || []).map(d => h('tr', {}, h('th', { text: d.label }), h('td', {}, d.from !== null && d.from !== undefined && String(d.from) !== String(d.to) ? h('span', { class: 'from', text: String(d.from) }) : null, String(d.to))));
      pendingEl.append(h('h3', { text: p.needsTap ? 'Ação sensível: confirme com o toque' : 'Confirmar esta alteração?' }), h('table', { class: 'iris-diff' }, ...rows),
        ...(p.notice ? [h('p', { text: p.notice })] : []), ...(p.warnings || []).map(w => h('p', { text: w })),
        h('div', { class: 'iris-msg-actions' },
          h('button', { class: 'iris-btn iris-btn--primary', type: 'button', id: 'iris-confirm', onclick: () => { session.present(engine.confirmPending('toque')); renderPending(); } }, 'Confirmar'),
          h('button', { class: 'iris-btn', type: 'button', id: 'iris-cancel', onclick: () => { session.present(engine.cancelPending('toque')); renderPending(); } }, 'Cancelar')));
      scrollLog();
    }
    function renderChips(chips) {
      clear(chipsEl);
      for (const c of (chips && chips.length ? chips : engine.suggestions()).slice(0, 6)) chipsEl.append(h('button', { class: 'iris-chip', type: 'button', onclick: () => session.sendText(c.say) }, c.label));
    }

    // ---------- ganchos da sessão ----------
    hooks.onState = (s, meta) => {
      orb.setState(s);
      status.textContent = s === 'error' && meta && meta.message ? meta.message : STATUS[s] || '';
      micBtn.setAttribute('aria-pressed', String(s === 'listening'));
      const active = ['listening', 'speaking', 'thinking', 'acting', 'transcribing', 'permission'].includes(s);
      micBtn.replaceChildren(icon(active && s !== 'listening' ? 'stop' : s === 'listening' ? 'stop' : 'mic'));
      micBtn.setAttribute('aria-label', MIC_LABEL[s] || 'Falar');
      micLabel.textContent = MIC_LABEL[s] || '';
      fab.setAttribute('data-live', s === 'listening' ? '1' : '0');
      if (s === 'idle') partial.textContent = '';
    };
    hooks.onPartial = t => { partial.textContent = t ? '“' + t + '”' : ''; };
    hooks.onLevel = v => orb.setLevel(v);
    hooks.onMessage = m => {
      if (m.role === 'user') { store.addMessage({ role: 'user', text: m.text, via: m.via, actor: m.actor }); addMsg(userNode(m)); }
      else if (m.role === 'iris') { store.addMessage({ role: 'iris', text: m.text }); addMsg(irisNode(m)); specialist.textContent = m.specialist ? 'Consultando ' + m.specialist : ''; }
      else if (m.role === 'error') addMsg(h('div', { class: 'iris-msg iris-msg--error', role: 'alert' }, h('p', { text: m.text })));
      renderPending();
    };
    hooks.onNotice = t => addMsg(h('div', { class: 'iris-msg iris-msg--error' }, h('p', { text: t })));
    hooks.onUi = (ui, turn) => {
      if (ui.theme) { store.setPref('theme', ui.theme); apply(); }
      if (ui.setActor) renderActor();
      if (ui.close) close();
      if (ui.openMemory) settings.openMemory();
      renderChips(ui.chips && ui.chips.length ? ui.chips : null);
      if (ui.panel && Iris.livePanels) { Iris.livePanels.show(ui.panel, ns, liveEl, { engine, turn }); rootEl.classList.add('iris-has-live'); }
      if (ui.opened || ui.showPhotos) { if (mode === 'full') setMode('peek'); }
      if (ui.showPhotos && Iris.padrinhosFotos) Iris.padrinhosFotos.spotlight();
      if (ui.focusConfirm) { const c = doc.getElementById('iris-confirm'); c && c.focus(); }
      renderPending();
    };
    hooks.onNeedConsent = () => { consentEl.hidden = false; consentEl.querySelector('button').focus(); };
    hooks.onReview = t => { input.value = t; input.focus(); status.textContent = 'Revise o texto e toque em Enviar'; };
    hooks.onConnectivity = () => {};
    root.addEventListener('iris:history-cleared', () => clear(log));

    // ---------- teclado / foco / viewport ----------
    function viewport() {
      const vv = root.visualViewport; if (!vv) return;
      const hgt = Math.round(vv.height); rootEl.style.setProperty('--iris-vh', hgt + 'px');
      rootEl.classList.toggle('iris-compact', hgt < 560 && root.innerWidth < 980);
      if (doc.activeElement === input) setTimeout(scrollLog, 50);
    }
    if (root.visualViewport) { root.visualViewport.addEventListener('resize', viewport); root.visualViewport.addEventListener('scroll', viewport); }
    root.addEventListener('resize', viewport);
    rootEl.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.stopPropagation(); if (settings.anyOpen()) settings.closeAll(); else if (!consentEl.hidden) consentEl.hidden = true; else if (mode === 'full') close(); else setMode('full'); return; }
      if (e.key === 'Tab' && mode === 'full') {
        const f = [...rootEl.querySelectorAll('button:not([disabled]), input, select, summary, [href]')].filter(el => el.offsetParent !== null);
        if (!f.length) return; const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    input.addEventListener('focus', () => setTimeout(() => { viewport(); scrollLog(); }, 250));

    apply();
    hooks.onState(session.getState());
    return { open, close, isOpen, apply, setMode, rootEl, fab, liveEl, getMode: () => mode };
  }

  const api = { createPanel };
  Iris.panel = api;
  return api;
});
