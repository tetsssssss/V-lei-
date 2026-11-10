/* Íris · remote.js — cliente do backend OPCIONAL (LLM, STT, TTS premium).
   - Sem endpoint configurado (meta "iris-api"), NENHUMA requisição de rede é feita.
   - O estado do casamento vive no navegador: o laço de ferramentas roda AQUI; o modelo só propõe,
     e toda alteração passa pelo mesmo portão de risco/confirmação do modo local.
   - Minimização (LGPD): o contexto enviado depende do nível escolhido; fotos nunca são enviadas. */
(function (root, factory) {
  const api = factory(root.Iris || (root.Iris = {}), root);
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Iris, root) {
  'use strict';
  const doc = () => root.document;
  const base = () => { try { const m = doc() && doc().querySelector('meta[name="iris-api"]'); return m ? m.content.replace(/\/$/, '') : ''; } catch (_) { return ''; } };
  const configuredEndpoint = () => !!base();
  const SKEY = 'iris-token';
  let token = ''; try { token = (root.sessionStorage && root.sessionStorage.getItem(SKEY)) || ''; } catch (_) {}
  const setToken = t => { token = t || ''; try { t ? root.sessionStorage.setItem(SKEY, t) : root.sessionStorage.removeItem(SKEY); } catch (_) {} };
  let cache = null;

  async function api(path, opts = {}) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), opts.timeout || 35000);
    try { return await fetch(base() + path, { credentials: 'omit', ...opts, signal: ctl.signal, headers: { ...(token ? { authorization: 'Bearer ' + token } : {}), ...(opts.headers || {}) } }); }
    finally { clearTimeout(t); }
  }
  async function health(force) {
    if (!configuredEndpoint()) return { configured: false, reason: 'sem endpoint (meta iris-api ausente)' };
    if (cache && !force) return cache;
    try { const r = await api('/health', { timeout: 6000 }); cache = r.ok ? await r.json() : { configured: false, reason: 'HTTP ' + r.status }; } catch (_) { cache = { configured: false, reason: 'sem conexão com o backend' }; }
    return cache;
  }
  async function login(passcode) {
    const r = await api('/session', { method: 'POST', body: JSON.stringify({ passcode }), timeout: 8000 });
    if (r.status === 429) throw new Error('Muitas tentativas. Aguarde alguns minutos.');
    if (!r.ok) throw new Error(r.status === 401 ? 'Senha incorreta.' : 'Não consegui entrar agora.');
    setToken((await r.json()).token); return true;
  }
  const logout = () => setToken('');
  const loggedIn = () => !!token;
  const llmReady = () => !!(cache && cache.llm && cache.llm.configured && token);

  // ---------- minimização de dados ----------
  /** nível 0: só totais/contagens · 1: + nomes de fornecedores/ideias/tarefas · 2: + nomes de convidados. Fotos: nunca. */
  function contextFor(ns, level) {
    const d = ns.getData(), h = ns.helpers, s = h.sums(), g = h.guestsInfo(), t = h.complete();
    const ctx = { diasParaDataDeReferencia: h.daysUntil(), dataEhReferenciaSemReserva: true, pessoasPrevistas: g.total, confirmadas: g.yes, semResposta: g.pending, tarefas: { feitas: t.done, total: t.all }, orcamento: { planejado: s.planned, pago: s.paid, teto: s.limit || null, hipotesesForaDosTotais: s.hypo }, fornecedores: { total: d.vendors.length, fechados: d.vendors.filter(v => v.status === 'Fechado').length, semCotacao: d.vendors.filter(v => !Number(v.quote)).length } };
    if (level >= 1) { ctx.nomesFornecedores = d.vendors.map(v => ({ nome: v.name, tipo: v.kind, status: v.status })); ctx.ideias = d.ideas.map(i => i.title); ctx.tarefasPendentes = d.tasks.filter(x => !x.done).map(x => x.title); }
    if (level >= 2) ctx.convidados = d.guests.map(x => ({ nome: x.name, lado: x.side, pessoas: x.qty, presenca: x.attendance }));
    return ctx;
  }
  const NAME_TOOLS = { 1: ['listGodparents', 'getIdeaVotes', 'searchLocalProjectData', 'explainPhoto', 'reviewNameEquivalences', 'listVendors', 'compareVendorQuotes', 'listCeremonySchedule', 'getGiftRegistry'], 2: ['listGuests', 'listGodparents', 'searchLocalProjectData', 'explainPhoto', 'reviewNameEquivalences'] };
  /** O que o LLM vê de um resultado de ferramenta: nada de nomes além do nível autorizado. */
  function sanitizeToolResult(name, turn, level) {
    const hide = (level < 1 && NAME_TOOLS[1].includes(name)) || (level < 2 && NAME_TOOLS[2].includes(name));
    if (hide) return { ok: turn.ok !== false, aviso: 'conteúdo com nomes omitido pelo nível de privacidade escolhido' };
    return { ok: turn.ok !== false, resumo: turn.speak || '', pendente: !!turn.pending };
  }

  // ---------- laço de ferramentas (cliente) ----------
  async function ask(text, { ns, engine, tools, store }) {
    const level = store.get().consent.level | 0;
    const hist = store.get().conversation.slice(-6).filter(m => m.text).map(m => ({ role: m.role === 'iris' ? 'assistant' : 'user', content: m.text }));
    const msgs = [...hist, { role: 'user', content: text }];
    const toolDefs = tools.describe().map(t => ({ name: t.name, description: t.description, input_schema: t.input_schema }));
    const collected = { lines: [], ui: {}, pending: null };
    for (let i = 0; i < 4; i++) {
      const r = await api('/chat', { method: 'POST', body: JSON.stringify({ messages: msgs, tools: toolDefs, context: contextFor(ns, level) }) });
      if (!r.ok) throw new Error(r.status === 401 ? 'Sessão da IA externa expirou. Entre de novo nas configurações.' : r.status === 429 ? 'Limite de uso da IA externa atingido por agora.' : 'A IA externa não respondeu agora.');
      const out = await r.json();
      if (!out.toolCalls || !out.toolCalls.length) return { speak: out.text || 'Não consegui formular uma resposta.', lines: collected.lines, ui: { ...collected.ui, source: 'externa' }, pending: collected.pending, source: 'externa' };
      msgs.push({ role: 'assistant', content: [...(out.text ? [{ type: 'text', text: out.text }] : []), ...out.toolCalls.map(c => ({ type: 'tool_use', id: c.id, name: c.name, input: c.input }))] });
      const results = [];
      for (const c of out.toolCalls) {
        const t = engine.runTool(c.name, c.input || {}); // MESMO portão de risco: R1b/R2 viram confirmação na tela
        collected.lines.push(...(t.lines || [])); collected.ui = { ...collected.ui, ...(t.ui || {}) };
        if (t.pending) { collected.pending = t.pending; return { speak: t.speak, lines: collected.lines, ui: { ...collected.ui, source: 'externa' }, pending: t.pending, source: 'externa' }; }
        results.push({ type: 'tool_result', tool_use_id: c.id, content: JSON.stringify(sanitizeToolResult(c.name, t, level)) });
      }
      msgs.push({ role: 'user', content: results });
    }
    return { speak: 'Preciso de mais um passo seu para continuar. Pode reformular?', lines: collected.lines, ui: collected.ui, source: 'externa' };
  }

  // ---------- STT remoto (MediaRecorder → backend) ----------
  function sttAdapter() {
    return {
      supported: () => !!(root.MediaRecorder && root.navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      create({ maxMs = 30000, silenceMs = 1600 } = {}) {
        const handlers = {}; const emit = (e, p) => (handlers[e] || []).forEach(f => { try { f(p); } catch (_) {} });
        let stream, rec, chunks = [], ctx, timer, silenceT, aborted = false, stopped = false, sawVoice = false, ended = false;
        const cleanup = () => { clearTimeout(timer); clearInterval(silenceT); try { stream && stream.getTracks().forEach(t => t.stop()); } catch (_) {} try { ctx && ctx.close(); } catch (_) {} };
        const finish = () => { if (ended) return; ended = true; cleanup(); emit('end'); };
        return {
          on(e, f) { (handlers[e] = handlers[e] || []).push(f); return this; },
          async start() {
            try {
              stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(m => root.MediaRecorder.isTypeSupported && root.MediaRecorder.isTypeSupported(m)) || '';
              rec = new root.MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
              rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
              rec.onstop = async () => {
                if (aborted) return finish();
                const type = (rec.mimeType || 'audio/webm').split(';')[0]; const blob = new Blob(chunks, { type });
                if (!blob.size) { emit('error', { code: 'no-speech', message: 'Não ouvi nada. Toque no microfone e fale de novo.' }); return finish(); }
                try {
                  const r = await api('/stt', { method: 'POST', headers: { 'content-type': rec.mimeType ? rec.mimeType.split(';')[0] : type }, body: blob });
                  if (!r.ok) throw new Error('http ' + r.status);
                  const text = String((await r.json()).text || '').trim();
                  if (text) emit('final', text); else emit('error', { code: 'no-speech', message: 'Não entendi o áudio. Tente de novo.' });
                } catch (_) { emit('error', { code: 'network', message: 'A transcrição externa não respondeu. Você pode digitar.' }); }
                finish();
              };
              try { const AC = root.AudioContext || root.webkitAudioContext; ctx = new AC(); const an = ctx.createAnalyser(); an.fftSize = 512; ctx.createMediaStreamSource(stream).connect(an); const buf = new Uint8Array(an.fftSize); let quiet = 0; silenceT = setInterval(() => { an.getByteTimeDomainData(buf); let s = 0; for (const v of buf) s += (v - 128) * (v - 128); const rms = Math.sqrt(s / buf.length); if (rms > 6) { sawVoice = true; quiet = 0; } else if (sawVoice) { quiet += 150; if (quiet >= silenceMs) { this.stop(); } } }, 150); } catch (_) {}
              rec.start(); emit('start'); emit('audio'); timer = setTimeout(() => this.stop(), maxMs);
            } catch (e) { emit('error', { code: e && e.name === 'NotAllowedError' ? 'not-allowed' : 'audio-capture', message: 'Não consegui acessar o microfone.' }); finish(); }
          },
          stop() { if (stopped) return; stopped = true; clearInterval(silenceT); try { rec && rec.state !== 'inactive' ? rec.stop() : finish(); } catch (_) { finish(); } },
          abort() { aborted = true; stopped = true; try { rec && rec.state !== 'inactive' && rec.stop(); } catch (_) {} finish(); },
        };
      },
    };
  }

  // ---------- TTS remoto (backend → áudio) ----------
  function ttsAdapter() {
    let audio = null, cancelled = false, url = '';
    const release = () => { try { audio && audio.pause(); } catch (_) {} audio = null; if (url) { URL.revokeObjectURL(url); url = ''; } };
    return {
      supported: () => !!root.Audio, loadVoices: async () => [], rank: () => [{ voice: null, name: 'Voz do provedor externo', lang: 'pt-BR', uri: '', gender: 'conforme o provedor' }], guess: () => 'conforme o provedor', chunk: s => [s],
      cancelAll() { cancelled = true; release(); },
      speak(text, o = {}) {
        cancelled = false;
        const done = (async () => {
          try {
            const r = await api('/tts', { method: 'POST', body: JSON.stringify({ text }) }); if (!r.ok) throw new Error('http ' + r.status);
            const blob = await r.blob(); if (cancelled) return; release(); url = URL.createObjectURL(blob); audio = new Audio(url); audio.volume = Math.min(1, Math.max(0, o.volume ?? 1)); audio.playbackRate = Math.min(2, Math.max(.5, o.rate || 1));
            await new Promise((res, rej) => { audio.onplay = () => { o.onstart && o.onstart(); o.onlevel && o.onlevel(.7); }; audio.onended = res; audio.onerror = () => rej(new Error('áudio')); audio.play().catch(rej); });
            o.onlevel && o.onlevel(0); if (!cancelled) o.onend && o.onend();
          } catch (e) { if (!cancelled) o.onerror && o.onerror(e); } finally { release(); }
        })();
        return { done, cancel() { cancelled = true; release(); } };
      },
    };
  }

  const apiObj = { configuredEndpoint, health, login, logout, loggedIn, llmReady, contextFor, sanitizeToolResult, ask, sttAdapter, ttsAdapter, base };
  Iris.remote = apiObj;
  return apiObj;
});
