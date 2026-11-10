/* Íris · intents.js — motor de conversa LOCAL (regras pt-BR, sem rede). Entende, pergunta quando ambíguo,
   executa ferramentas pelo portão de risco, confirma, desfaz. Devolve "turnos" (fala curta + detalhes + ações de UI). */
(function (root, factory) {
  const api = factory(root.Iris || (root.Iris = {}));
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Iris) {
  'use strict';
  const T = () => Iris.text;
  const R = () => Iris.risk;
  const PENDING_TTL = 120000;

  const SECTION_WORDS = [
    ['central', ['central de comando', 'painel de comando', 'central', 'dashboard', 'painel geral']],
    ['inicio', ['pagina inicial', 'tela inicial', 'inicio', 'home']],
    ['album', ['nossa historia', 'album', 'fotos do casal']],
    ['orcamento', ['orcamento', 'financas', 'financeiro']],
    ['convidados', ['lista de convidados', 'convidados', 'convites']],
    ['padrinhos', ['padrinhos', 'madrinhas', 'entradas', 'corte']],
    ['doces', ['catalogo de doces', 'doces', 'elizete', 'confeitaria']],
    ['presentes', ['lista de presentes', 'presentes', 'casa nova']],
    ['pesquisas', ['atracoes', 'pesquisas', 'chacara']],
    ['fornecedores', ['fornecedores', 'propostas', 'cotacoes']],
    ['cerimonia', ['cerimonia', 'tarefas', 'checklist', 'roteiro', 'cronograma']],
    ['ideias', ['ideias', 'opinioes', 'votacoes', 'mural']],
    ['consultores', ['consultores', 'especialistas']],
    ['ajustes', ['ajustes', 'personalizar', 'configuracoes', 'configuracao']],
  ];
  const sectionFrom = n => {
    let best = null;
    for (const [key, words] of SECTION_WORDS) for (const w of words) if ((' ' + n + ' ').includes(' ' + w + ' ') && (!best || w.length > best.len)) best = { key, len: w.length };
    return best ? best.key : null;
  };
  const SECTION_SUMMARY = { orcamento: 'getBudgetSummary', convidados: 'getGuestCounts', padrinhos: 'listGodparents', cerimonia: 'listCeremonySchedule', fornecedores: 'listVendors', presentes: 'getGiftRegistry', ideias: 'getIdeaVotes', pesquisas: 'getVenueStatus' };
  const LIST_NOUNS = [[/convidad[oa]s?|convite/, 'guests'], [/fornecedor(es)?/, 'vendors'], [/tarefa/, 'tasks'], [/ideia/, 'ideas'], [/presente/, 'gifts'], [/padrinhos?|madrinhas?/, 'couples'], [/momento|roteiro/, 'timeline'], [/item|gasto|despesa|orcamento/, 'budget']];

  /** Devolve a frase com acentos/caixa do texto original quando possível ("dj" → "DJ"). */
  function restoreCase(raw, phrase) {
    const map = new Map();
    for (const t of String(raw).split(/\s+/).map(x => x.replace(/^[^\p{L}\p{N}$]+|[^\p{L}\p{N}]+$/gu, '')).filter(Boolean)) { const k = T().norm(t); if (!map.has(k)) map.set(k, t); }
    const out = String(phrase).split(' ').filter(Boolean).map(w => map.get(w) || w).join(' ');
    return out.charAt(0).toUpperCase() + out.slice(1);
  }

  const turn = (o = {}) => ({ speak: '', lines: [], ui: {}, pending: null, ...o });
  function merge(turns) {
    const t = turn();
    for (const x of turns.filter(Boolean)) {
      if (x.speak) t.speak = (t.speak ? t.speak + ' ' : '') + x.speak;
      t.lines.push(...(x.lines || []));
      const u = x.ui || {};
      t.ui = { ...t.ui, ...u, chips: [...(t.ui.chips || []), ...(u.chips || [])] };
      if (x.pending) t.pending = x.pending;
      if (x.specialist) t.specialist = x.specialist;
      if (x.tool) t.tool = x.tool;
      if (x.ok === false) t.ok = false;
    }
    return t;
  }

  function createEngine({ ns, tools, store, audit, memory }) {
    const S = () => store.get();
    const ctx = { actor: '', focusPhoto: null };
    let pending = null, clarify = null, offer = null, queue = [], lastTopic = null;
    const now = () => Date.now();
    const fmt = v => T().fmtBRL(v);

    // ---------- execução de ferramentas pelo portão de risco ----------
    const fromResult = (res, tool) => turn({ speak: res.speak || '', lines: res.lines || [], ui: { ...(res.ui || {}), ...(res.panel ? { panel: res.panel } : {}) }, ok: res.ok, data: res.data, tool });
    const pendingView = () => pending && ({ id: pending.id, tool: pending.tool, summary: pending.summary, diff: pending.diff, risk: pending.risk, needsTap: R().policy(pending.risk).tap, notice: pending.notice || '', warnings: pending.warnings || [] });

    function runTool(name, args = {}, opts = {}) {
      const def = tools.get(name);
      if (!def) return turn({ speak: 'Não tenho essa ferramenta.', ok: false });
      const v = Iris.schema.validate(def.input, args);
      if (!v.ok) return turn({ speak: 'Não consegui validar esse pedido: ' + v.errors[0].replace(/^\$\.?/, ''), ok: false });
      const a = v.value, risk = tools.riskOf(name, a);
      if (def.run) { const res = def.run(a, ctx); return fromResult(res, name); }
      const res = def.prepare(a, ctx);
      if (!res.ok) {
        if (res.clarify) { clarify = { type: 'tool', tool: name, args: a, options: res.options }; return turn({ speak: res.speak, ui: { chips: res.options.map(o => ({ label: o.label, say: o.key })) }, tool: name }); }
        return turn({ speak: res.speak, ok: false, tool: name });
      }
      if (res.noop) return turn({ speak: res.speak, ui: res.ui, tool: name });
      const pol = R().policy(risk);
      if (!pol.confirm || opts.skipConfirm) return execute({ tool: name, args: a, risk, prepared: res, summary: res.summary }, opts.via || 'voz');
      pending = { id: `p-${now().toString(36)}`, tool: name, args: a, risk, prepared: res, summary: res.summary, diff: res.diff, notice: res.notice, warnings: res.warnings, expires: now() + PENDING_TTL };
      const lead = pol.tap ? `Ação sensível: ${res.summary}. ${res.notice ? res.notice + ' ' : ''}Toque em Confirmar na tela para executar.` : `Posso registrar: ${res.summary}. Confirma?`;
      return turn({ speak: lead, lines: res.warnings || [], pending: pendingView(), ui: { chips: pol.tap ? [{ label: 'Cancelar', say: 'cancela' }] : [{ label: 'Confirmar', say: 'confirmo' }, { label: 'Cancelar', say: 'não, cancele' }] }, tool: name });
    }

    function execute(p, via) {
      let out;
      try { out = p.prepared.execute(); } catch (e) { return turn({ speak: 'Não consegui aplicar a alteração: ' + e.message, ok: false }); }
      const e = audit.record({ actor: ctx.actor || 'Casal', via, tool: p.tool, risk: p.risk, summary: p.summary, args: p.args, ops: out.ops, memId: out.memId });
      return turn({ speak: out.speak, ui: { ...(out.ui || {}), undoId: e.id, chips: [{ label: 'Desfazer', say: 'desfaça' }], changed: true }, tool: p.tool, ok: true, data: { auditId: e.id } });
    }

    function confirmPending(via = 'toque') {
      if (!pending) return turn({ speak: 'Não há nada pendente para confirmar.', ok: false });
      if (now() > pending.expires) { pending = null; return turn({ speak: 'Essa confirmação expirou. Peça de novo se ainda quiser.', ok: false }); }
      const p = pending; pending = null;
      const t = execute(p, via);
      return withQueue(t);
    }
    function cancelPending(via = 'voz') {
      if (!pending) return turn({ speak: 'Não há nada pendente.' });
      const p = pending; pending = null;
      audit.record({ actor: ctx.actor || 'Casal', via, tool: p.tool, risk: p.risk, summary: p.summary, args: p.args, status: 'cancelled' });
      return withQueue(turn({ speak: 'Tudo bem, cancelei. Nada foi alterado.', ui: { cancelled: true } }));
    }
    function withQueue(t) {
      if (!queue.length || pending || clarify) return t;
      const rest = queue; queue = [];
      const more = rest.map(seg => dispatch(seg, seg));
      return merge([t, ...more]);
    }

    // ---------- análise de frases ----------
    function sideOf(n) { return /\bnoiva\b|isabelle/.test(n) ? 'Isabelle' : /\bnoivo\b|gabriel/.test(n) ? 'Gabriel' : null; }
    const GENERIC_TITLE = /^(despesa|gasto|custo|valor|previsao|orcamento|hipotetica|hipotetico|um|uma|na|no|de|do|da|para|ao|a|o|em|e|item|novo|nova)( |$)/;

    function extractBudgetTitle(n, raw, money) {
      let s = ' ' + n.replace(/r\$/g, ' ').replace(money.raw, ' ').replace(/\b(reais|real)\b/g, ' ') + ' ';
      s = s.replace(/^\s*(adiciona|adicione|adicionar|coloca|colocar|bota|botar|inclui|incluir|lanca|lance|lancar|registra|registre|registrar|cria|crie|criar)\s+/, ' ');
      s = s.replace(/\b(hipotetic[oa]|simulada?|simulacao)\b/g, ' ').replace(/\s+/g, ' ').trim();
      let m = s.match(/previsao (?:do|da|de|dos|das)\s+(.+)$/);
      if (!m) m = s.match(/(?:gasto|despesa|custo|valor|orcamento|previsao)?\s*(?:d[oae]s?|com|para(?: o| a)?|pr[oa])\s+(?:o |a |os |as |um |uma )?(.+)$/);
      let t = m ? m[1] : s;
      t = t.replace(/\b(no|na|ao)\s+(orcamento|previsao)\b/g, ' ').replace(/\s+/g, ' ').trim();
      if (!t || GENERIC_TITLE.test(t + ' ') && t.split(' ').every(w => GENERIC_TITLE.test(w + ' '))) return null;
      return restoreCase(raw, t);
    }

    function budgetAdd(n, raw) {
      const money = T().findMoney(n);
      const hyp = /hipotetic|simula|e se |suponha|imagina/.test(n);
      if (!money) {
        const nums = T().findNumbers(n).numbers;
        if (nums.length) { clarify = { type: 'unit', value: nums[0].value }; return turn({ speak: `Adicionar ${nums[0].value} de quê: reais no orçamento, convidados ou doces?`, ui: { chips: [{ label: `R$ ${nums[0].value} no orçamento`, say: 'reais' }, { label: 'Convidados', say: 'convidados' }, { label: 'Doces', say: 'doces' }] } }); }
        return null;
      }
      const title = extractBudgetTitle(n, raw, money);
      if (!title && !hyp) { clarify = { type: 'slot', tool: 'proposeBudgetItem', args: { estimate: money.value }, ask: 'title' }; return turn({ speak: `Certo, ${fmt(money.value)}. Para qual item do orçamento? Por exemplo: DJ, fotografia ou decoração.` }); }
      return runTool('proposeBudgetItem', { title: title || 'Despesa hipotética', estimate: money.value, hypothetical: hyp || undefined, category: T().guessCategory(title || '', ns.catalogs.categories) || undefined });
    }

    function sweetsCalc(n, raw) {
      const q = T().findQuantity(n, ['doces', 'doce', 'docinhos', 'unidades', 'unidade', 'brigadeiros', 'bem casados', 'salgados']);
      const money = T().findMoney(n);
      if (!q) return turn({ speak: 'Quantos doces vocês querem simular, e a quanto cada um? Por exemplo: 250 doces de R$ 4,50.' });
      if (!money) { clarify = { type: 'slot', tool: 'calculateSweetsBasket', args: { qty: q.value }, ask: 'unitPrice' }; return turn({ speak: `Para ${q.value} doces, qual o preço por unidade? Posso consultar o catálogo se disser o sabor.` }); }
      return runTool('calculateSweetsBasket', { qty: Math.round(q.value), unitPrice: money.value });
    }

    function vendorAdd(n, raw) {
      const m = n.match(/(?:coloca|colocar|adiciona|adicione|adicionar|cadastra|cadastre|cadastrar|inclui|incluir|registra|registre)\s+(?:a |o |os |as )?(.+?)\s+(?:em|nos|na lista de|no cadastro de) fornecedores?(?:\s+(?:para|de|como)\s+(.+))?$/);
      if (!m) return null;
      const kindTxt = m[2] || '', kinds = ns.catalogs.kinds;
      let kind = kinds.find(k => T().norm(k) === T().norm(kindTxt));
      if (!kind && /doce|bolo|confeit/.test(kindTxt + ' ' + m[1]) && kinds.includes('Doces e bolo')) kind = 'Doces e bolo';
      if (!kind) { const g = T().guessCategory(kindTxt, kinds); if (g && kinds.includes(g)) kind = g; }
      return runTool('proposeVendor', { name: restoreCase(raw, m[1]), kind: kind || undefined, notes: kindTxt ? `Para: ${kindTxt}. Cadastrado pela Íris; pesquisa, sem contrato.` : undefined });
    }

    function remember(n, raw) {
      const m = n.match(/(?:lembra|lembre|guarda|guarde|anota|anote)\s+que\s+(.+)$/);
      return m ? runTool('rememberNote', { text: restoreCase(raw, m[1]) }) : null;
    }

    function deleteIntent(n, raw) {
      if (!/\b(exclui|exclua|excluir|apaga|apague|apagar|remove|remova|remover|deleta|delete)\b/.test(n)) return null;
      const noun = LIST_NOUNS.find(([re]) => re.test(n)); if (!noun) return turn({ speak: 'O que devo excluir? Diga o tipo e o nome, por exemplo: "exclui o convidado Fulano".' });
      const q = n.replace(/\b(exclui|exclua|excluir|apaga|apague|apagar|remove|remova|remover|deleta|delete)\b/, ' ').replace(noun[0], ' ').replace(/\b(o|a|os|as|do|da|dos|das|de|no|na|item|gasto|despesa|orcamento|lista)\b/g, ' ').replace(/\s+/g, ' ').trim();
      return runTool('deleteRecord', { list: noun[1], query: q || undefined });
    }

    // ---------- despachante: um segmento de comando ----------
    function dispatch(n, raw) {
      const has = re => re.test(n);
      const topicTurn = (t, topic) => { lastTopic = topic; return t; };

      // controles de voz/interface
      if (has(/^(para|pare|cala|calma|silencio|chega)( de falar| a fala)?$|^para de falar|\bpara de falar\b/)) return turn({ speak: '', ui: { stop: true } });
      if (has(/repet(e|ir|a).*(devagar|lent)|(fala|fale|diz|diga) (mais )?(devagar|lento)|^mais devagar/)) return turn({ speak: 'Claro, repetindo mais devagar.', ui: { repeat: true, rate: 'slower' } });
      if (has(/(fala|fale|diz|diga) (mais )?rapido|^mais rapido/)) return turn({ speak: 'Certo, mais rápido.', ui: { repeat: true, rate: 'faster' } });
      if (has(/^(repete|repita|repetir|de novo|pode repetir|fala de novo|nao entendi)/)) return turn({ speak: '', ui: { repeat: true } });
      if (has(/(desativa|desliga|para com|silencia) (a |as )?(voz|fala|respostas? faladas?)/)) return turn({ speak: 'Pronto, vou responder só por escrito.', ui: { speakOn: false } });
      if (has(/(ativa|liga|volta com) (a |as )?(voz|fala|respostas? faladas?)/)) return turn({ speak: 'Pronto, voltei a falar.', ui: { speakOn: true } });
      if (has(/tema (jarvis|futurista|ciano|azul)|modo (jarvis|futurista)/)) return turn({ speak: 'Tema Jarvis ativado.', ui: { theme: 'jarvis' } });
      if (has(/tema (romantico|bordo|classico|normal|original)|modo romantico/)) return turn({ speak: 'Tema romântico de volta.', ui: { theme: 'romantico' } });
      if (has(/^(obrigad[oa]|valeu|tchau|era so isso|encerra|encerrar|pode parar|ate mais)/)) return turn({ speak: 'De nada! Estou por aqui.', ui: { endConversation: true } });
      if (has(/^(fecha|fechar|fecha a|sair)\s*(a )?(tela|painel|conversa)?$/)) return turn({ speak: '', ui: { close: true } });
      const who = n.match(/(?:\bsou (?:o |a )?|aqui (?:e|eh) (?:o |a )?|falando como |quem fala (?:e|eh) (?:o |a )?)(gabriel|isabelle)/);
      if (who) { const a = who[1] === 'gabriel' ? 'Gabriel' : 'Isabelle'; ctx.actor = a; return turn({ speak: `Certo, ${a}. Vou registrar as ações em seu nome.`, ui: { setActor: a } }); }

      // desfazer
      if (has(/\b(desfaz|desfaca|desfazer|anula|anular|volta atras|reverte|reverter)\b/)) return runTool('undoRecentAction', {});

      // consultas centrais
      if (has(/(quanto|o que)( ainda| mais)? falta( ainda)? (organizar|fazer|resolver|decidir|acertar)|\bpendencias\b|o que (ainda )?falta\b/)) return topicTurn(runTool('remainingToOrganize', {}), 'remaining');
      if (has(/quantos dias|quanto tempo (ainda )?falta|quanto falta (pra|para)|contagem regressiva|falta quanto/)) return runTool('calculateDaysUntilWedding', {});
      if (has(/\b(resumo|visao geral|panorama|como estamos|status geral)\b/) && !has(/orcamento/)) return runTool('getWeddingOverview', {});
      if (has(/\b(saldo|margem|quanto (ja )?(gastamos|gastei|pagamos|planejamos)|quanto (temos|sobra|resta)|resumo do orcamento|como (esta|ta) o orcamento|situacao do orcamento)\b/)) return topicTurn(runTool('getBudgetSummary', {}), 'orcamento');

      // exclusão / pagamento / fechamento / data (ações sensíveis)
      const del = deleteIntent(n, raw); if (del) return del;
      if (has(/\b(paguei|pagamos|registra(r)? (o )?pagamento|pagamento de)\b/)) {
        const money = T().findMoney(n); if (!money) return turn({ speak: 'Qual foi o valor do pagamento?' });
        const q = n.replace(/r\$/g, ' ').replace(/\b(paguei|pagamos|registra|registrar|registre|o|pagamento|de|do|da|no|na|para|pro|pra|reais|real)\b/g, ' ').replace(money.raw, ' ').replace(/\s+/g, ' ').trim();
        return runTool('registerPayment', { amount: money.value, query: q || undefined });
      }
      if (has(/(fechamos|contratamos|fechei) |marca(r)? .* (como )?(fechado|contratado)|fornecedor (fechado|contratado)/)) {
        const q = n.replace(/\b(fechamos|contratamos|fechei|marca|marcar|como|fechado|contratado|o|a|com|o fornecedor|fornecedor)\b/g, ' ').replace(/\s+/g, ' ').trim();
        return runTool('markVendorClosed', { query: q || undefined });
      }
      if (has(/\b(muda|mude|mudar|altera|altere|alterar|troca|troque)\b.*\bdata\b/)) {
        const date = T().parseDate(n); if (!date) return turn({ speak: 'Para qual data? Diga assim: 13 de novembro de 2027.' });
        return runTool('changeWeddingDate', { date });
      }

      // convidados
      const rsvp = n.match(/^(.+?)\s+(confirmou|confirmaram)(?: presenca)?$/);
      if (rsvp) return runTool('proposeGuestUpdate', { query: rsvp[1].replace(/^(o|a|os|as)\s+/, ''), patch: { attendance: 'Confirmado' }, userStated: true });
      const notgo = n.match(/^(.+?)\s+nao\s+(vai|vao|pode|podem)(?: ir)?$/);
      if (notgo) return runTool('proposeGuestUpdate', { query: notgo[1].replace(/^(o|a|os|as)\s+/, ''), patch: { attendance: 'Não vai' } });
      if (has(/(adiciona|adicione|adicionar|cadastra|cadastre|inclui|incluir)\s+(o |a )?convidad[oa]\s+/)) {
        const m = n.match(/convidad[oa]\s+(.+?)(?:\s+com\s+(\S+)\s+pessoas?)?$/);
        const qty = m && m[2] ? (T().findNumbers(m[2]).numbers[0] || {}).value : undefined;
        return runTool('proposeGuestUpdate', { create: true, name: restoreCase(raw, m ? m[1] : ''), patch: qty ? { qty } : {} });
      }
      if (has(/\b(quantos|quantas)\b.*\b(convidados|pessoas|criancas|adultos|confirmados|convites|previstos|previstas)\b|contagem de convidados|lista provisoria/)) {
        const t = runTool('getGuestCounts', {});
        const c = t.data;
        if (c && has(/crianc/)) t.speak = `${c.fieldsComplete ? `Estão previstas ${T().plural(c.children, 'criança')}` : 'Não consigo separar crianças: o preenchimento por convite está incompleto'}, de ${c.total} pessoas previstas. ${c.confirmed} presenças confirmadas até agora. Trate como contagem provisória; ${(ns.getData().sourceNotes || []).length ? 'há fontes anteriores com números diferentes.' : 'ainda pode mudar.'}`;
        else if (c && has(/adulto/) && c.fieldsComplete) t.speak = `Estão previstos ${T().plural(c.adults, 'adulto')}, de ${c.total} pessoas no total. Contagem provisória, sem presenças confirmadas.`;
        return topicTurn(t, 'convidados');
      }
      if (has(/cenario|cenarios|simul(a|e|ar|acao)\b.*convidados/)) {
        const counts = T().findNumbers(n).numbers.map(x => x.value).filter(v => v >= 10 && v <= 5000);
        if (counts.length < 2) return turn({ speak: 'Quais quantidades de convidados comparo? Por exemplo: 80, 100 e 120.' });
        return runTool('simulateGuestScenarios', { counts: counts.slice(0, 6) });
      }

      // doces / fornecedores
      if (has(/(coloca|colocar|adiciona|adicione|adicionar|cadastra|cadastre|cadastrar|inclui|incluir|registra|registre)\b.*\bfornecedores?\b/)) { const v = vendorAdd(n, raw); if (v) return v; }
      if (has(/\bdoces?\b|\bdocinhos?\b|\bbem casados?\b/) && (T().findMoney(n) || T().findQuantity(n, ['doces', 'doce', 'docinhos', 'unidades'])) && has(/\b(quanto|custa|custam|calcula|calcule|simula|simule|fica|ficam|total)\b/)) return topicTurn(sweetsCalc(n, raw), 'doces');
      if (has(/\b(compara|comparar|comparacao|comparativo)\b/)) {
        const kinds = [];
        if (/buffet/.test(n)) kinds.push('Buffet'); if (/chacara|espaco|local|salao/.test(n)) kinds.push('Espaço'); if (/foto/.test(n)) kinds.push('Fotografia'); if (/doce/.test(n)) kinds.push('Doces e bolo');
        const names = ns.getData().vendors.filter(v => kinds.includes(v.kind)).map(v => v.name);
        return runTool('compareVendorQuotes', names.length ? { names } : {});
      }
      if (has(/\b(chacara|veneza|local do casamento)\b/) && has(/status|situacao|contrato|valor|capacidade|reserva|plano|chuva|como (esta|anda)/)) return runTool('getVenueStatus', {});

      // ideias, presentes, tarefas
      const idea = n.match(/(?:salvar|guardar|registrar|anotar|salva|guarda|registra|anota|registre|salve|guarde)\s+(?:uma |a |essa )?ideia(?:\s+(?:para|de|sobre|da|do|pra))?\s*(.*)$/);
      if (idea) {
        const title = idea[1].trim();
        if (!title) { clarify = { type: 'slot', tool: 'proposeIdea', args: {}, ask: 'title' }; return turn({ speak: 'Claro. Qual é a ideia?' }); }
        return runTool('proposeIdea', { title: restoreCase(raw, title) });
      }
      const gift = n.match(/(?:adiciona|adicione|adicionar|coloca|colocar|inclui|incluir|anota|anote)\s+(?:um |uma |o |a )?(.+?)\s+(?:na|a|em) lista de presentes/);
      if (gift) return runTool('addGiftIdea', { name: restoreCase(raw, gift[1]) });
      const task = n.match(/(?:cria|crie|criar|adiciona|adicione|adicionar|anota|anote|lembra|lembre)\s+(?:uma |a )?(?:tarefa|lembrete)(?:\s+(?:para|de|sobre|pra|:))?\s*(.*)$/);
      if (task) { if (!task[1].trim()) { clarify = { type: 'slot', tool: 'proposeCeremonyTask', args: {}, ask: 'title' }; return turn({ speak: 'Qual é a tarefa?' }); } return runTool('proposeCeremonyTask', { title: restoreCase(raw, task[1].trim()), owner: ctx.actor || undefined }); }
      const rem = remember(n, raw); if (rem) return rem;

      // orçamento (adicionar valores)
      const verbAdd = has(/\b(adiciona|adicione|adicionar|coloca|colocar|bota|botar|inclui|incluir|lanca|lance|lancar|registra|registre|registrar|cria|crie|criar)\b/);
      if (verbAdd && !has(/ideia|presente|tarefa|convidad|padrinho|fornecedor/)) { const b = budgetAdd(n, raw); if (b) return b; }

      // padrinhos e fotos
      if (has(/quem (e|eh|seria)\b.*\bpessoa|quem (esta|aparece) na foto|reconhec(e|er)\b.*\b(rosto|foto)|identifica.*(pessoa|foto)/)) return runTool('explainPhoto', {});
      if (has(/\b(mostra|mostre|mostrar|ver|abre|abra|exibe)\b.*\bfotos?\b/) && (lastTopic === 'padrinhos' || ns.getSection() === 'padrinhos' || has(/padrinho/))) {
        const withPhotos = (ns.getData().padrinhoFotos || []).length;
        if (ns.getSection() !== 'padrinhos') ns.navigate('padrinhos');
        return topicTurn(turn({ speak: withPhotos ? `Aqui estão as ${withPhotos} fotos vinculadas, com a legenda que vocês atribuíram. Não identifico ninguém pelo rosto.` : 'Ainda não há fotos vinculadas aos padrinhos. Posso abrir a tela para vocês adicionarem.', ui: { panel: 'godparents', showPhotos: true } }), 'padrinhos');
      }
      if (has(/\b(padrinhos|madrinhas|padrinho)\b/) && has(/\b(abre|abra|abrir|mostra|mostre|mostrar|lista|listar|quais|quem|ver|quero ver)\b/)) {
        ns.navigate('padrinhos');
        const t = runTool('listGodparents', { side: sideOf(n) || undefined });
        t.ui = { ...t.ui, opened: 'padrinhos', showPhotos: has(/foto/) };
        return topicTurn(t, 'padrinhos');
      }

      // abrir seções
      const verbOpen = has(/\b(abre|abra|abrir|mostra|mostre|mostrar|exibe|exiba|va para|vai para|ir para|leva|me leva|quero ver|navega|volta para|voltar para)\b/);
      const sec = sectionFrom(n);
      if (verbOpen && sec) {
        const showVerb = has(/\b(mostra|mostre|mostrar|exibe|exiba|quero ver)\b/);
        const o = runTool('openSection', { section: sec });
        if (showVerb && SECTION_SUMMARY[sec]) { const s = runTool(SECTION_SUMMARY[sec], {}); return topicTurn(merge([o, { ...s, speak: s.speak }]), sec); }
        return topicTurn(o, sec);
      }
      if (sec && has(/^(como esta|como ta|e o|e a|e os|e as)\b/) && SECTION_SUMMARY[sec]) return topicTurn(runTool(SECTION_SUMMARY[sec], {}), sec);

      // listas
      if (has(/\bfornecedores?\b|\bcotacoes\b/)) return topicTurn(runTool('listVendors', {}), 'fornecedores');
      if (has(/\b(votos|votacoes|consenso|ideias votadas)\b|o que (nos )?dois (amaram|curtiram)/)) return runTool('getIdeaVotes', {});
      if (has(/\b(presentes|lista de presentes)\b/)) return topicTurn(runTool('getGiftRegistry', {}), 'presentes');
      if (has(/\b(roteiro|cerimonia|agenda|cronograma|checklist|tarefas)\b/)) return topicTurn(runTool('listCeremonySchedule', {}), 'cerimonia');
      if (has(/\b(historico|ultimas (acoes|alteracoes)|o que (voce|vc) (fez|alterou|mudou))\b/)) return runTool('getHistory', {});
      if (has(/equivalenc|grafia|nomes? (parecid|diferent)|mesma pessoa/)) return runTool('reviewNameEquivalences', {});
      if (has(/o que (voce|vc) (lembra|sabe) (de|sobre) (nos|a gente)|o que (voce|vc) lembra\b/)) return turn({ speak: 'Abri a memória: lá vocês veem, corrigem e apagam o que eu guardei.', ui: { openMemory: true } });
      if (has(/\bpresentes?\b/) || has(/casa nova/)) return topicTurn(runTool('getGiftRegistry', {}), 'presentes');

      // sugestões curadas / especialistas
      const adv = Iris.specialists.options(n);
      if (adv && has(/opco|sugest|ideias? (de|para)|como decorar|decorar|quero|dicas?|me (da|de)/)) {
        const cnt = (T().findNumbers(n, { allowBareOne: true }).numbers.find(x => x.value >= 2 && x.value <= 6) || {}).value || 3;
        const o = Iris.specialists.options(n, cnt);
        offer = { tool: 'proposeIdea', args: { title: `${o.title}: ${o.items[0].t}`, details: o.items.map(i => i.t).join(' | ') } };
        return topicTurn(turn({ speak: `Na minha opinião, ${T().plural(o.items.length, 'opção', 'opções')} para ${o.title.toLowerCase()}: ${o.items.map((i, k) => `${k + 1}, ${i.t.charAt(0).toLowerCase() + i.t.slice(1)}`).join('; ')}. Quer que eu registre como ideia?`, lines: o.items.map((i, k) => `${k + 1}. ${i.t}\n   Por quê: ${i.why}\n   Cuidado: ${i.care}`).concat('Origem: opinião da Íris (sem preços; confirme viabilidade com a chácara).'), specialist: Iris.specialists.label('decoracao'), ui: { chips: [{ label: 'Registrar como ideia', say: 'sim' }, { label: 'Não precisa', say: 'não' }] } }), 'decoracao');
      }
      if (has(/\b(consultor|especialista|cerimonialista|conselho|me ajuda|dica|o que voce acha|o que acha)\b/)) {
        const id = Iris.specialists.route(n), a = Iris.specialists.advise(id, ns);
        return turn({ speak: `Falando como ${a.label}: ${a.body} ${a.points[0] || ''}`, lines: [a.title, ...a.points.map(p => '• ' + p), 'Origem: regras do app e opinião da Íris.'], specialist: a.label });
      }

      return null;
    }

    function unknown() {
      return turn({ speak: 'Não entendi bem. Posso mostrar números, abrir telas, simular doces, comparar fornecedores e registrar alterações com a confirmação de vocês. Tente, por exemplo, "quanto falta organizar?".', ok: false, ui: { chips: suggestions().slice(0, 4), unknown: true } });
    }

    function suggestions() {
      return [
        { label: 'Quanto falta organizar?', say: 'quanto falta organizar' }, { label: 'Quantos dias faltam?', say: 'quantos dias faltam' },
        { label: 'Resumo do orçamento', say: 'mostre o saldo' }, { label: 'Abrir padrinhos', say: 'abre os padrinhos' },
        { label: 'Quantas crianças?', say: 'quantas crianças estão previstas' }, { label: 'Simular 250 doces', say: 'quanto custam 250 doces de R$ 4,50' },
      ];
    }

    // ---------- fluxos pendentes (confirmação, esclarecimento, oferta) ----------
    function handleFlows(n, raw) {
      let prefix = null;
      if (pending && now() > pending.expires) { pending = null; prefix = turn({ speak: 'A confirmação anterior expirou, então não alterei nada.' }); }
      if (pending) {
        if (R().isNo(n)) return cancelPending('voz');
        if (pending.risk === 'R2') {
          if (R().isExplicitConfirm(n) || R().isYes(n)) return turn({ speak: 'Isso é uma ação sensível: preciso do seu toque no botão Confirmar, só a voz não basta.', pending: pendingView(), ui: { focusConfirm: true } });
        } else if (R().isYes(n)) return confirmPending('voz');
        const c = cancelPending('voz'); c.speak = 'Cancelei a ação pendente.'; prefix = c;
      }
      if (clarify) {
        const c = clarify;
        if (R().isNo(n)) { clarify = null; queue = []; return turn({ speak: 'Tudo bem, deixei de lado.' }); }
        if (c.type === 'tool') {
          const opt = c.options.find(o => o.words.some(w => (' ' + n + ' ').includes(' ' + w + ' ')) || n === o.key);
          if (opt) { clarify = null; return withQueue(runTool(c.tool, { ...c.args, ...opt.args, ...(c.options.existingId ? {} : {}) }, {})); }
          clarify = null; // não respondeu: segue como comando novo
        } else if (c.type === 'unit') {
          clarify = null;
          if (/reais|real|orcamento|dinheiro/.test(n)) { clarify = { type: 'slot', tool: 'proposeBudgetItem', args: { estimate: c.value }, ask: 'title' }; return turn({ speak: `Certo, ${fmt(c.value)}. Para qual item do orçamento?` }); }
          if (/convidad|pessoas/.test(n)) { clarify = { type: 'slot', tool: 'proposeGuestUpdate', args: { create: true, patch: { qty: Math.round(c.value) } }, ask: 'name' }; return turn({ speak: `Certo, ${c.value} pessoas. Qual o nome do convidado ou da família?` }); }
          if (/doce/.test(n)) { clarify = { type: 'slot', tool: 'calculateSweetsBasket', args: { qty: Math.round(c.value) }, ask: 'unitPrice' }; return turn({ speak: `Certo, ${c.value} doces. Qual o preço por unidade?` }); }
        } else if (c.type === 'slot') {
          clarify = null;
          if (c.ask === 'unitPrice') { const m = T().findMoney(n) || (T().findNumbers(n).numbers[0] && { value: T().findNumbers(n).numbers[0].value }); if (!m) return turn({ speak: 'Não peguei o valor. Diga o preço por unidade, por exemplo: quatro reais e cinquenta centavos.' }); return withQueue(runTool(c.tool, { ...c.args, unitPrice: m.value })); }
          const val = restoreCase(raw, n.replace(/^(e |para |pro |pra |de |do |da |o |a )+/, ''));
          const args = { ...c.args };
          if (c.ask === 'title') args.title = val; if (c.ask === 'name') args.name = val;
          return withQueue(runTool(c.tool, args));
        }
      }
      if (offer) {
        const o = offer;
        if (R().isYes(n)) { offer = null; return runTool(o.tool, { ...o.args, author: ctx.actor || undefined }); }
        if (R().isNo(n)) { offer = null; return turn({ speak: 'Tudo bem, não registrei.' }); }
        offer = null;
      }
      if (!pending && !clarify && /^(sim|confirmo|confirma|confirme|confirmar|ok|pode|pode ser|isso)$/.test(n)) return prefix ? turn({ speak: prefix.speak + ' Peça de novo se ainda quiser.' }) : turn({ speak: 'Não há nada pendente para confirmar.' });
      if (!pending && !clarify && /^(nao|cancela|cancele|cancelar)$/.test(n)) return turn({ speak: 'Certo.' });
      return prefix ? { prefixOnly: prefix } : null;
    }

    // ---------- entrada principal ----------
    function handle(text, opts = {}) {
      if (opts.actor !== undefined) ctx.actor = opts.actor;
      if (opts.focusPhoto !== undefined) ctx.focusPhoto = opts.focusPhoto;
      const raw = String(text || '').trim();
      if (!raw) return turn({ speak: 'Pode falar, estou ouvindo.' });
      const n = T().stripWake(raw, [S().prefs.name]);
      if (!n) return turn({ speak: 'Oi! Pode falar, estou ouvindo.' });
      const flow = handleFlows(n, raw);
      let prefix = null;
      if (flow && !flow.prefixOnly) return flow;
      if (flow && flow.prefixOnly) prefix = flow.prefixOnly;
      const segs = T().splitCompound(n);
      const turns = prefix ? [prefix] : [];
      let any = false;
      for (let i = 0; i < segs.length; i++) {
        const t = dispatch(segs[i], raw);
        if (t) { any = true; turns.push(t); } else if (segs.length === 1) { turns.push(unknown()); any = true; } else turns.push(turn({ speak: `Não entendi "${segs[i]}".`, ok: false }));
        if (t && (t.pending || clarify)) { queue = segs.slice(i + 1); break; }
      }
      return merge(turns);
    }

    return {
      handle, confirmPending, cancelPending, runTool, suggestions,
      setActor: a => { ctx.actor = a; }, getActor: () => ctx.actor, setFocusPhoto: id => { ctx.focusPhoto = id; },
      state: () => ({ pending: pendingView(), hasClarify: !!clarify, hasOffer: !!offer, lastTopic }),
      reset() { pending = null; clarify = null; offer = null; queue = []; },
    };
  }

  const api = { createEngine, SECTION_WORDS, sectionFrom, restoreCase };
  Iris.intents = api;
  return api;
});
