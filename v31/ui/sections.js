/* V3.1 · sections.js — telas: Convites (WhatsApp), Parcelas, Cronograma do dia, Cerimonialista Virtual, Pacote do aparelho. */
(function () {
  'use strict';
  const V = window.V31, K = V.kit, { h } = K, D = V.data, R = V.rsvp, I = V.installments, S = V.schedule, E = V.exports, C = V.ceri, P = V.plan;
  let ns = null;
  const d = () => ns.getData(), v = () => D.ensure(d());
  const save = () => ns.save(), redo = () => ns.render();
  const attempt = fn => { try { fn(); return true; } catch (e) { K.toast(e.message, true); return false; } };
  const intro = (eyebrow, title, text) => h('div', { class: 'page-intro' }, h('div', { class: 'eyebrow', text: eyebrow }), h('h1', { text: title }), h('p', { text }));
  const stat = (label, value, sub, tone) => h('div', { class: 'v31-stat ' + (tone || '') }, h('div', { class: 'v31-stat-l', text: label }), h('div', { class: 'v31-stat-v', text: String(value) }), sub ? h('div', { class: 'v31-muted', text: sub }) : null);
  const field = (label, input, cls) => h('label', { class: 'v31-f ' + (cls || '') }, h('span', { text: label }), input);
  const chip = (text, tone) => h('span', { class: 'v31-chip ' + (tone || ''), text });
  const people = g => Math.max(1, Math.floor(D.num(g.qty, 1)));
  const guard = (label, fn) => async () => { try { await fn(); } catch (e) { K.toast(`${label}: ${e.message}`, true); } };

  // ====================== CONVITES / WHATSAPP ======================
  let rsvpFilter = 'todos', replyOpen = null;
  function rsvpPage() {
    const root = h('div', {}), sm = R.summary(d()), S0 = v().settings;
    root.append(intro('Convites', 'Convites e respostas pelo WhatsApp', 'O app monta a mensagem e abre o WhatsApp; quem envia é você, tocando em “enviar”. Nada sai sozinho e os telefones ficam só neste aparelho. A presença só vira “Confirmado” quando você registra a resposta da pessoa.'));
    root.append(h('div', { class: 'v31-stats' }, stat('Com telefone', `${sm.withPhone}/${sm.total}`, `${sm.noPhone} sem telefone`), stat('Convites abertos no WhatsApp', sm.sent, `${sm.notSent} a enviar`), stat('Aguardando resposta', sm.awaiting), stat('Pessoas confirmadas', sm.peopleYes, `${sm.peoplePending} sem resposta · ${sm.peopleNo} não irão`, 'good')));
    // mensagem + prazo
    const ta = h('textarea', { rows: 4, 'aria-label': 'Modelo da mensagem', maxlength: 600, text: S0.waTemplate }), dl = h('input', { type: 'date', value: S0.rsvpDeadline || '', 'aria-label': 'Prazo para responder' });
    const prev = h('p', { class: 'v31-preview' }), upd = () => { v().settings.waTemplate = ta.value; v().settings.rsvpDeadline = dl.value; const g = d().guests[0]; prev.textContent = g ? R.message(d(), g) : 'Cadastre um convidado para ver a prévia.'; };
    ta.addEventListener('input', upd); dl.addEventListener('change', () => { upd(); save(); }); ta.addEventListener('change', () => { upd(); save(); }); upd();
    root.append(h('div', { class: 'v31-card' }, h('h3', { text: 'Mensagem do convite' }), field('Modelo (use {nome} {casal} {data} {local} {limite})', ta, 'wide'), field('Responder até', dl), h('p', { class: 'v31-muted', text: 'Prévia com o primeiro convidado:' }), prev));
    // filtros
    const flt = [['todos', 'Todos'], ['sem-fone', 'Sem telefone'], ['enviar', 'A enviar'], ['aguardando', 'Aguardando'], ['respondidos', 'Respondidos']];
    root.append(h('div', { class: 'v31-chips', role: 'group', 'aria-label': 'Filtro' }, ...flt.map(([k, l]) => h('button', { type: 'button', class: 'v31-btn small' + (rsvpFilter === k ? ' on' : ''), 'aria-pressed': String(rsvpFilter === k), onclick: () => { rsvpFilter = k; redo(); } }, l))));
    const rows = sm.rows.filter(r => ({ todos: true, 'sem-fone': !r.phone, enviar: r.phone && !r.sent, aguardando: r.sent && !r.replied, respondidos: r.replied })[rsvpFilter]);
    const list = h('div', { class: 'v31-rows' });
    if (!rows.length) list.append(h('p', { class: 'v31-muted', text: d().guests.length ? 'Nenhum convite neste filtro.' : 'Ainda não há convidados. Adicione na aba Convidados ou importe o pacote.' }));
    for (const r of rows) list.append(rsvpRow(r));
    root.append(list);
    return root;
  }
  function rsvpRow({ g, m, phone, sent, replied }) {
    const phoneIn = h('input', { type: 'tel', inputmode: 'tel', value: m.phone || '', placeholder: '(14) 99999-0000', 'aria-label': `Telefone de ${g.name}`, autocomplete: 'off' });
    phoneIn.addEventListener('change', () => { const val = phoneIn.value.trim(); if (val && !R.normalizePhone(val)) { K.toast('Telefone inválido. Use DDD + número.', true); phoneIn.value = m.phone || ''; return; } R.meta(d(), g.id).phone = val ? R.formatPhone(val) : ''; if (!val) delete R.meta(d(), g.id).phone; save(); redo(); });
    const msg = R.message(d(), g), link = phone ? R.link(m.phone, msg) : null;
    const st = g.attendance === 'Confirmado' ? chip('Confirmado', 'good') : g.attendance === 'Não irá' ? chip('Não irá', 'bad') : replied ? chip('Talvez', '') : sent ? chip('Aguardando', 'warn') : chip('Pendente', '');
    const row = h('div', { class: 'v31-row-card' }, h('div', { class: 'v31-rc-head' }, h('b', { text: g.name }), h('span', { class: 'v31-muted', text: `${people(g)} pessoa(s)` }), st, sent ? chip('WhatsApp aberto ' + D.dateBR((m.sentAt || '').slice(0, 10)), '') : null),
      h('div', { class: 'v31-rc-body' }, field('Telefone', phoneIn),
        h('div', { class: 'v31-row' },
          h('a', { class: 'v31-btn primary' + (link ? '' : ' disabled'), href: link || '#', target: '_blank', rel: 'noopener noreferrer', 'aria-disabled': String(!link), onclick: e => { if (!link) { e.preventDefault(); K.toast('Cadastre um telefone válido antes.', true); return; } R.markSent(d(), g.id); save(); setTimeout(redo, 600); } }, sent ? 'Abrir de novo no WhatsApp' : 'Enviar pelo WhatsApp'),
          h('button', { type: 'button', class: 'v31-btn', onclick: async () => { try { await navigator.clipboard.writeText(msg); K.toast('Mensagem copiada.'); } catch (_) { K.toast('Não consegui copiar; abra pelo WhatsApp.', true); } } }, 'Copiar mensagem'),
          sent ? h('button', { type: 'button', class: 'v31-btn small', onclick: () => { delete R.meta(d(), g.id).sentAt; save(); redo(); } }, 'Desmarcar envio') : null)),
      replyForm(g, m));
    return row;
  }
  function replyForm(g, m) {
    const wrap = h('div', { class: 'v31-reply' });
    if (m.reply) wrap.append(h('p', { class: 'v31-muted', text: `Resposta registrada em ${D.dateBR((m.reply.at || '').slice(0, 10))}: ${m.reply.status === 'sim' ? `vai (${m.reply.adults ?? '?'} adulto(s), ${m.reply.children ?? '?'} criança(s))` : m.reply.status === 'nao' ? 'não vai' : 'talvez'}${m.reply.note ? ' — ' + m.reply.note : ''}` }), h('button', { type: 'button', class: 'v31-btn small', onclick: () => { R.clearReply(d(), g.id); save(); redo(); } }, 'Desfazer resposta'));
    else if (replyOpen === g.id) {
      const a = h('input', { type: 'number', min: '0', step: '1', value: g.adults ?? people(g), 'aria-label': 'Adultos' }), c = h('input', { type: 'number', min: '0', step: '1', value: g.children ?? 0, 'aria-label': 'Crianças' }), note = h('input', { type: 'text', maxlength: 300, placeholder: 'Observação (alergia, restrição…)', 'aria-label': 'Observação' });
      wrap.append(h('div', { class: 'v31-fgrid' }, field('Adultos', a), field('Crianças', c), field('Obs.', note)), h('div', { class: 'v31-row' }, h('button', { type: 'button', class: 'v31-btn primary', onclick: () => { if (attempt(() => R.recordReply(d(), g.id, { status: 'sim', adults: a.value, children: c.value, note: note.value }))) { replyOpen = null; save(); redo(); } } }, 'Registrar: vai'), h('button', { type: 'button', class: 'v31-btn', onclick: () => { replyOpen = null; redo(); } }, 'Cancelar')));
    } else wrap.append(h('div', { class: 'v31-row' }, h('span', { class: 'v31-muted', text: 'Respondeu?' }), h('button', { type: 'button', class: 'v31-btn small', onclick: () => { replyOpen = g.id; redo(); } }, 'Vai'), h('button', { type: 'button', class: 'v31-btn small', onclick: () => { R.recordReply(d(), g.id, { status: 'nao' }); save(); redo(); } }, 'Não vai'), h('button', { type: 'button', class: 'v31-btn small', onclick: () => { R.recordReply(d(), g.id, { status: 'talvez' }); save(); redo(); } }, 'Talvez')));
    return wrap;
  }

  // ====================== PARCELAS ======================
  function parcelasPage() {
    const root = h('div', {}), sm = I.summary(d()), items = d().budget.filter(b => !b.hypothetical);
    root.append(intro('Finanças', 'Parcelas e vencimentos', 'Cadastre as parcelas de cada item do orçamento. Marcar como paga soma ao “pago” do item (e desmarcar devolve). O app só registra: nenhum pagamento é feito por aqui.'));
    root.append(h('div', { class: 'v31-stats' }, stat('Vencidas', D.brl(sm.totalOverdue), `${sm.overdue.length} parcela(s)`, sm.overdue.length ? 'bad' : ''), stat('Próximos 30 dias', D.brl(sm.totalSoon), `${sm.soon.length} parcela(s)`, sm.soon.length ? 'warn' : ''), stat('Em aberto', D.brl(sm.totalOpen)), stat('Pagas', D.brl(sm.totalPaid), '', 'good')));
    // por mês
    const months = Object.entries(sm.byMonth).sort(); if (months.length) { const mx = Math.max(...months.map(m => m[1])); root.append(h('div', { class: 'v31-card' }, h('h3', { text: 'Em aberto, mês a mês' }), ...months.map(([k, val]) => h('div', { class: 'v31-bar' }, h('span', { text: `${k.slice(5)}/${k.slice(0, 4)}` }), h('div', { class: 'v31-bar-bg' }, h('div', { class: 'v31-bar-fg', style: { width: Math.max(3, val / mx * 100) + '%' } })), h('b', { text: D.brl(val) }))))); }
    // gerar
    if (!items.length) root.append(h('div', { class: 'v31-card' }, h('p', { text: 'Cadastre itens no Orçamento para poder parcelar.' }), h('button', { type: 'button', class: 'v31-btn', onclick: () => ns.navigate('orcamento') }, 'Ir ao Orçamento')));
    else {
      const sel = h('select', { 'aria-label': 'Item do orçamento' }, ...items.map(b => h('option', { value: b.id, text: `${b.title} (${D.brl(b.estimate)})` }))), tot = h('input', { type: 'number', step: '0.01', min: '0.01', 'aria-label': 'Valor a parcelar' }), n = h('input', { type: 'number', min: '1', max: '120', step: '1', value: '1', 'aria-label': 'Número de parcelas' }), first = h('input', { type: 'date', 'aria-label': 'Primeiro vencimento' });
      const fillTot = () => { const b = items.find(x => x.id === sel.value), planned = sm.perItem.find(x => x.id === sel.value); tot.value = b ? Math.max(0, D.num(b.estimate) - (planned ? planned.planned : 0)).toFixed(2) : ''; }; sel.addEventListener('change', fillTot); fillTot();
      root.append(h('form', { class: 'v31-card', onsubmit: e => { e.preventDefault(); if (attempt(() => { const parts = I.split(Number(tot.value), Number(n.value), first.value); parts.forEach(p => I.add(d(), { budgetId: sel.value, ...p })); K.toast(`${parts.length} parcela(s) criada(s).`); })) { save(); redo(); } } }, h('h3', { text: 'Parcelar um item' }), h('div', { class: 'v31-fgrid' }, field('Item', sel), field('Valor a parcelar (R$)', tot), field('Nº de parcelas', n), field('1º vencimento', first)), h('p', { class: 'v31-muted', text: 'Por padrão sugere o que ainda não foi parcelado do valor estimado do item. Os centavos são divididos exatamente.' }), h('button', { class: 'v31-btn primary', type: 'submit' }, 'Gerar parcelas')));
    }
    // lista
    const tone = { vencida: 'bad', proxima: 'warn', paga: 'good', futura: '' }, lab = { vencida: 'Vencida', proxima: 'Vence em até 30 dias', paga: 'Paga', futura: 'Futura' };
    root.append(h('div', { class: 'v31-card' }, h('h3', { text: 'Todas as parcelas' }), sm.list.length ? h('div', { class: 'v31-table', role: 'table' }, ...sm.list.map(x => h('div', { class: 'v31-trow', role: 'row' }, h('span', { text: D.dateBR(x.due) }), h('span', { class: 'grow', text: `${x.item} · ${x.label}` }), h('b', { text: D.brl(x.amount) }), chip(lab[x.state] + (x.state === 'vencida' ? ` (${-x.days} d)` : ''), tone[x.state]),
      h('button', { type: 'button', class: 'v31-btn small', onclick: () => { I.setPaid(d(), x.id, !x.paid); save(); redo(); } }, x.paid ? 'Desfazer pago' : 'Marcar como paga'), h('button', { type: 'button', class: 'v31-btn small danger', 'aria-label': 'Excluir parcela', onclick: () => { if (confirm('Excluir esta parcela?')) { I.remove(d(), x.id); save(); redo(); } } }, 'Excluir')))) : h('p', { class: 'v31-muted', text: 'Nenhuma parcela cadastrada.' }),
      sm.perItem.some(p => Math.abs(p.planned - p.estimate) > 0.009) ? h('p', { class: 'v31-warn', text: 'Atenção: ' + sm.perItem.filter(p => Math.abs(p.planned - p.estimate) > 0.009).map(p => `“${p.title}”: parcelas somam ${D.brl(p.planned)} e o item está em ${D.brl(p.estimate)}`).join('; ') + '.' }) : null));
    return root;
  }

  // ====================== CRONOGRAMA DO DIA ======================
  let editDia = null, cerTime = '';
  function diaPage() {
    const root = h('div', {}), vv = v(), an = S.analyze(vv.dayPlan), objs = vv.plan.objects;
    root.append(intro('O grande dia', 'Cronograma do dia', 'Quem faz o quê, a que horas e onde. Os horários são sempre definidos por vocês; o modelo é só um ponto de partida.'));
    const date = d().settings.date, sun = date ? V.solar.sunTimes(date, D.num(vv.settings.lat), D.num(vv.settings.lon), D.num(vv.settings.tz, -3)) : null;
    root.append(h('div', { class: 'v31-stats' }, stat('Momentos', an.items.length), stat('Começa', an.first ? an.first.start : '—'), stat('Termina', an.last ? D.hhmm(an.last.e) : '—'), stat('Pôr do sol (estim.)', sun ? D.hhmm(Math.round(sun.set)) : '—', 'coordenadas aproximadas da cidade, ±5 min')));
    const ct = h('input', { type: 'time', value: cerTime, 'aria-label': 'Horário da cerimônia' }); ct.addEventListener('change', () => { cerTime = ct.value; });
    root.append(h('div', { class: 'v31-card' }, h('h3', { text: 'Começar por um modelo' }), h('div', { class: 'v31-row' }, field('Horário da cerimônia', ct), h('button', { type: 'button', class: 'v31-btn', onclick: () => { if (vv.dayPlan.length && !confirm('Já existe cronograma. Adicionar o modelo mesmo assim (os atuais ficam)?')) return; if (attempt(() => S.suggest(cerTime || ct.value).forEach(x => S.add(d(), x)))) { save(); redo(); } } }, 'Gerar modelo sugerido')), h('p', { class: 'v31-muted', text: 'O modelo usa intervalos típicos a partir da cerimônia. Ajuste tudo; a cerimonialista pode ter outra ordem.' })));
    // formulário
    const cur = editDia ? vv.dayPlan.find(x => x.id === editDia) : null;
    const f = { start: h('input', { type: 'time', required: true, value: cur ? cur.start : '', 'aria-label': 'Início' }), min: h('input', { type: 'number', min: '0', max: '1440', step: '5', value: cur ? cur.minutes : 30, 'aria-label': 'Duração em minutos' }), title: h('input', { type: 'text', required: true, maxlength: 80, value: cur ? cur.title : '', 'aria-label': 'Momento' }),
      where: h('select', { 'aria-label': 'Onde' }, h('option', { value: '', text: '(sem local)' }), ...objs.map(o => h('option', { value: o.id, text: o.label, selected: cur && cur.where === o.id }))), who: h('input', { type: 'text', maxlength: 80, value: cur ? cur.who : '', 'aria-label': 'Responsável' }), note: h('input', { type: 'text', maxlength: 300, value: cur ? cur.note : '', 'aria-label': 'Observação' }) };
    root.append(h('form', { class: 'v31-card', onsubmit: e => { e.preventDefault(); const it = { start: f.start.value, minutes: f.min.value, title: f.title.value, where: f.where.value, who: f.who.value, note: f.note.value }; if (attempt(() => (cur ? S.update(d(), cur.id, it) : S.add(d(), it)))) { editDia = null; save(); redo(); } } }, h('h3', { text: cur ? 'Editar momento' : 'Novo momento' }), h('div', { class: 'v31-fgrid' }, field('Início', f.start), field('Duração (min)', f.min), field('Momento', f.title, 'wide'), field('Onde (planta)', f.where), field('Responsável', f.who), field('Observação', f.note, 'wide')), h('div', { class: 'v31-row' }, h('button', { class: 'v31-btn primary', type: 'submit' }, cur ? 'Salvar' : 'Adicionar'), cur ? h('button', { type: 'button', class: 'v31-btn', onclick: () => { editDia = null; redo(); } }, 'Cancelar') : null)));
    // lista
    const bad = new Set(an.overlaps.flatMap(o => [o.a.id, o.b.id]));
    const list = h('div', { class: 'v31-card' }, h('h3', { text: 'Linha do tempo' }));
    if (!an.items.length) list.append(h('p', { class: 'v31-muted', text: 'Nenhum momento ainda.' }));
    an.items.forEach((x, i) => {
      list.append(h('div', { class: 'v31-trow tl' + (bad.has(x.id) ? ' conflict' : '') }, h('b', { class: 'time', text: `${x.start}–${D.hhmm(x.e)}` }), h('span', { class: 'grow' }, h('b', { text: x.title }), (x.where ? ' · ' + ((objs.find(o => o.id === x.where) || {}).label || '?') : '') + (x.who ? ' · ' + x.who : ''), x.note ? h('div', { class: 'v31-muted', text: x.note }) : null), bad.has(x.id) ? chip('conflito', 'bad') : null,
        h('button', { type: 'button', class: 'v31-btn small', onclick: () => { editDia = x.id; redo(); } }, 'Editar'), h('button', { type: 'button', class: 'v31-btn small danger', 'aria-label': 'Excluir momento', onclick: () => { if (confirm(`Excluir “${x.title}”?`)) { S.remove(d(), x.id); save(); redo(); } } }, 'Excluir')));
      const gap = an.gaps.find(g => g.a.id === x.id); if (gap) list.append(h('div', { class: 'v31-gap', text: `⋯ ${gap.minutes} min sem nada previsto` }));
    });
    root.append(list);
    return root;
  }

  // ====================== CERIMONIALISTA VIRTUAL ======================
  let draftText = '', draftBusy = false, exOpts = { phones: false, finance: false };
  const nowTag = () => D.todayISO();
  const SECTION_LABEL = { planta: 'Abrir a planta', dia: 'Abrir o cronograma', parcelas: 'Abrir parcelas', rsvp: 'Abrir convites', convidados: 'Abrir convidados', fornecedores: 'Abrir fornecedores', orcamento: 'Abrir orçamento', ajustes: 'Abrir ajustes' };
  const LV = { erro: ['Problema', 'bad'], aviso: ['Atenção', 'warn'], info: ['Aviso', ''], ok: ['OK', 'good'] };
  function ceriPage() {
    const root = h('div', {}), res = C.check(d());
    root.append(intro('Cerimonialista Virtual', 'Conferência do plano', 'Regras que conferem o que vocês cadastraram: planta, cronograma, parcelas, convites e fornecedores. Não é IA e não substitui a visita ao local nem a cerimonialista de verdade: aponta o que não fecha.'));
    root.append(h('div', { class: 'v31-stats' }, stat('Problemas', res.errors, '', res.errors ? 'bad' : 'good'), stat('Atenção', res.warnings, '', res.warnings ? 'warn' : ''), stat('Avisos', res.infos), stat('Dias para o casamento', res.facts.daysLeft ?? '—')));
    const list = h('div', { class: 'v31-card' }, h('h3', { text: 'O que encontrei' }));
    const f = res.findings; if (!f.length) list.append(h('p', { text: 'Nada a apontar com as regras atuais.' }));
    for (const x of f) list.append(h('div', { class: 'v31-find ' + x.level }, chip(LV[x.level][0], LV[x.level][1]), h('div', { class: 'grow' }, h('b', { text: x.title }), x.detail ? h('div', { class: 'v31-muted', text: x.detail }) : null), x.section && x.level !== 'ok' ? h('button', { type: 'button', class: 'v31-btn small', onclick: () => ns.navigate(x.section) }, SECTION_LABEL[x.section] || 'Abrir') : null));
    root.append(list);
    // texto local + IA só para redigir
    const consent = window.Iris && window.Iris.app ? window.Iris.app.store.get().consent : null, ia = !!(window.Iris && window.Iris.remote && window.Iris.remote.llmReady() && consent && consent.externalAI && consent.level >= 1);
    const out = h('pre', { class: 'v31-pre', text: draftText || C.narrate(res) });
    const btn = h('button', { type: 'button', class: 'v31-btn', disabled: !ia || draftBusy, onclick: async () => { draftBusy = true; redo(); try { draftText = await window.Iris.remote.draft(C.draftPrompt(res, 'mensagem-cerimonialista')); } catch (e) { K.toast(e.message, true); } draftBusy = false; redo(); } }, draftBusy ? 'Redigindo…' : 'Redigir mensagem para a cerimonialista (IA)');
    root.append(h('div', { class: 'v31-card' }, h('h3', { text: 'Resumo para compartilhar' }), out, h('div', { class: 'v31-row' }, h('button', { type: 'button', class: 'v31-btn', onclick: async () => { try { await navigator.clipboard.writeText(out.textContent); K.toast('Copiado.'); } catch (_) { K.toast('Não consegui copiar.', true); } } }, 'Copiar'), btn, draftText ? h('button', { type: 'button', class: 'v31-btn small', onclick: () => { draftText = ''; redo(); } }, 'Voltar ao texto das regras') : null),
      h('p', { class: 'v31-muted', text: ia ? 'A IA só reescreve os achados acima (sem nomes de convidados, sem ferramentas, sem decidir nada). Confira o texto antes de enviar.' : 'IA desligada: o texto acima vem das regras. Para a IA redigir, ligue a IA externa nas configurações da Íris (nível de privacidade 1 ou 2).' })));
    // ajustes das regras (números de bolso e referência de sol)
    const S1 = v().settings, aisle = h('input', { type: 'number', step: '0.05', min: '0.3', max: '5', value: S1.minAisle, 'aria-label': 'Folga mínima entre mesas em metros' }), lat = h('input', { type: 'number', step: '0.01', min: '-90', max: '90', value: S1.lat, 'aria-label': 'Latitude' }), lon = h('input', { type: 'number', step: '0.01', min: '-180', max: '180', value: S1.lon, 'aria-label': 'Longitude' });
    const setNum = (el, key, lo, hi) => el.addEventListener('change', () => { const x = Number(String(el.value).replace(',', '.')); if (!(x >= lo && x <= hi)) { K.toast(`Valor entre ${lo} e ${hi}.`, true); el.value = v().settings[key]; return; } v().settings[key] = x; save(); redo(); });
    setNum(aisle, 'minAisle', 0.3, 5); setNum(lat, 'lat', -90, 90); setNum(lon, 'lon', -180, 180);
    root.append(h('div', { class: 'v31-card' }, h('h3', { text: 'Ajustes das regras' }), h('div', { class: 'v31-fgrid' }, field('Folga mínima entre mesas (m)', aisle), field('Latitude (pôr do sol)', lat), field('Longitude (pôr do sol)', lon)), h('p', { class: 'v31-muted', text: 'A folga é uma regra de bolso sua (não é medida da chácara). Latitude/longitude vêm aproximadas da cidade; troque pelas do local se quiser o pôr do sol mais exato.' })));
    // exportações
    const ph = h('input', { type: 'checkbox', checked: exOpts.phones, 'aria-label': 'Incluir telefones' }), fi = h('input', { type: 'checkbox', checked: exOpts.finance, 'aria-label': 'Incluir valores' });
    ph.addEventListener('change', () => { exOpts.phones = ph.checked; }); fi.addEventListener('change', () => { exOpts.finance = fi.checked; });
    const act = (label, fn) => h('button', { type: 'button', class: 'v31-btn', onclick: guard(label, async () => { K.toast(await fn()); }) }, label);
    root.append(h('div', { class: 'v31-card' }, h('h3', { text: 'Exportar para a cerimonialista' }), h('p', { class: 'v31-muted', text: 'Gera arquivos no aparelho; você escolhe como enviar. Por padrão, SEM telefones e SEM valores em R$.' }),
      h('label', { class: 'v31-check' }, ph, ' Incluir telefones dos convidados'), h('label', { class: 'v31-check' }, fi, ' Incluir valores e parcelas'),
      h('div', { class: 'v31-row wrap' }, act('Dossiê imprimível (HTML)', async () => saveText('dossie-cerimonialista.html', await dossierHtml(), 'text/html')), act('Convidados (CSV)', () => saveText('convidados.csv', E.csvGuests(d(), { phones: exOpts.phones }), 'text/csv')), act('Mesas (CSV)', () => saveText('mesas.csv', E.csvSeating(d()), 'text/csv')), act('Cronograma (CSV)', () => saveText('cronograma.csv', E.csvSchedule(d()), 'text/csv')), exOpts.finance ? act('Parcelas (CSV)', () => saveText('parcelas.csv', E.csvInstallments(d(), nowTag()), 'text/csv')) : null),
      h('div', { class: 'v31-row wrap' }, act('Planta (PNG)', async () => K.saveFile('planta.png', await V.planta.snapshotPng('plan'))), act('Vista 3D (PNG)', async () => K.saveFile('planta-3d.png', await V.planta.snapshotPng('iso'))), act('Tudo num ZIP', async () => K.saveFile('para-a-cerimonialista.zip', await bundleZip())))));
    return root;
  }
  const saveText = (name, text, type) => K.saveFile(name, new Blob([text], { type: type + ';charset=utf-8' }));
  async function dossierHtml() { let planSvg = ''; if (V.planta.hasPlan()) { try { planSvg = await V.planta.snapshot('plan'); } catch (_) {} } return E.dossier(d(), { planSvg, findings: C.check(d()).findings, phones: exOpts.phones, finance: exOpts.finance, today: nowTag() }); }
  async function bundleZip() {
    const files = [{ name: 'dossie-cerimonialista.html', data: await dossierHtml() }, { name: 'convidados.csv', data: E.csvGuests(d(), { phones: exOpts.phones }) }, { name: 'mesas.csv', data: E.csvSeating(d()) }, { name: 'cronograma.csv', data: E.csvSchedule(d()) }];
    if (exOpts.finance) files.push({ name: 'parcelas.csv', data: E.csvInstallments(d(), nowTag()) });
    if (V.planta.hasPlan()) for (const [n, k] of [['planta.png', 'plan'], ['planta-3d.png', 'iso']]) { try { files.push({ name: n, data: new Uint8Array(await (await V.planta.snapshotPng(k)).arrayBuffer()) }); } catch (_) {} }
    files.push({ name: 'LEIA-ME.txt', data: `Arquivos gerados pelo Nosso Sim em ${D.dateBR(nowTag())}.\nDocumento de trabalho dos noivos; sujeito a alterações.\n${exOpts.phones ? 'ATENÇÃO: inclui telefones de convidados.\n' : ''}${exOpts.finance ? 'ATENÇÃO: inclui valores.\n' : ''}` });
    return new Blob([V.zip.write(files)], { type: 'application/zip' });
  }

  // ====================== PACOTE DO APARELHO ======================
  let pk = null, pkBusy = '';
  function pacotePage() {
    const root = h('div', {});
    root.append(intro('Dados', 'Pacote do aparelho', 'O app abre vazio. Aqui você importa o seu ZIP privado (dados, print da planta, fotos) e exporta um novo quando quiser mover para outro celular. Tudo acontece neste aparelho; nada é enviado à internet.'));
    const imp = h('div', { class: 'v31-card' }, h('h3', { text: 'Importar ZIP' }), h('p', { class: 'v31-muted', text: 'Aceita o pacote exportado por este app (nosso-sim-backup.json + planta + fotos) e o pacote privado (seed/seed-casal.js). Importar SUBSTITUI os dados deste aparelho: exporte antes se tiver algo.' }), h('button', { type: 'button', class: 'v31-btn primary', onclick: guard('Importar', async () => { const f = await K.pickFile('.zip,application/zip'); if (!f) return; pkBusy = 'Lendo…'; redo(); try { pk = await K.inspectPackage(f); } finally { pkBusy = ''; } redo(); }) }, 'Escolher o ZIP'), pkBusy ? h('p', { text: pkBusy }) : null);
    if (pk) { const n = pk.backup ? (pk.backup.guests || []).length : (pk.seed && pk.seed.guests || []).length; imp.append(h('div', { class: 'v31-find' }, h('div', { class: 'grow' }, h('b', { text: 'Encontrei no ZIP:' }), h('ul', {}, h('li', { text: pk.backup ? `Backup (${pk.backupName}) com ${n} convite(s)` : `Seed com ${n} convite(s)` }), pk.plan ? h('li', { text: 'Print da planta' }) : null, pk.photos.length ? h('li', { text: `${pk.photos.length} foto(s)` }) : null, ...pk.notes.map(t => h('li', { class: 'v31-warn', text: t })))), h('button', { type: 'button', class: 'v31-btn primary', onclick: guard('Importar', async () => { if (!confirm('Substituir os dados deste aparelho pelos do ZIP?')) return; const r = await K.applyPackage(ns, pk); pk = null; K.toast(r); redo(); }) }, 'Importar e substituir'), h('button', { type: 'button', class: 'v31-btn', onclick: () => { pk = null; redo(); } }, 'Cancelar'))); }
    root.append(imp);
    const withPhotos = h('input', { type: 'checkbox', checked: true, 'aria-label': 'Incluir fotos' });
    root.append(h('div', { class: 'v31-card' }, h('h3', { text: 'Exportar ZIP' }), h('p', { class: 'v31-muted', text: 'Leva o backup completo, o print da planta e (se marcar) as fotos dos padrinhos. Contém dados pessoais: guarde em lugar seguro e nunca publique.' }), h('label', { class: 'v31-check' }, withPhotos, ' Incluir fotos importadas'), h('button', { type: 'button', class: 'v31-btn', onclick: guard('Exportar', async () => { K.toast(await K.saveFile(`nosso-sim-pacote-${D.todayISO()}.zip`, await K.exportPackage(ns, { photos: withPhotos.checked }))); }) }, 'Exportar ZIP')));
    root.append(h('div', { class: 'v31-card' }, h('h3', { text: 'Sobre privacidade' }), h('p', { class: 'v31-muted', text: 'O site e o app instalado não trazem convidados, fotos nem medidas. Os dados ficam no armazenamento deste aparelho e só saem quando você exporta ou envia um link do WhatsApp.' })));
    return root;
  }

  V.sections = {
    init(n) {
      ns = n; V.planta.init(n); const at = () => Math.max(1, ns.catalogs.nav().length - 1);
      const reg = (key, title, icon, render) => { ns.registerSection(key, { title, icon, position: at(), render: () => `<div id="v31-${key}" class="v31-root"></div>` }); ns.onRender(sec => { if (sec === key) { const el = document.getElementById('v31-' + key); if (el) { el.replaceChildren(render()); } } }); };
      reg('rsvp', 'Convites · WhatsApp', '✉', rsvpPage); reg('parcelas', 'Parcelas e vencimentos', '◷', parcelasPage);
      ns.registerSection('planta', { title: 'Chácara em planta', icon: '▦', position: at(), render: () => '<div id="v31-planta" class="v31-root"></div>' }); ns.onRender(sec => { if (sec === 'planta') { const el = document.getElementById('v31-planta'); if (el) V.planta.mount(el, ns); } });
      reg('dia', 'Cronograma do dia', '☀', diaPage); reg('cerimonialista', 'Cerimonialista Virtual', '✦', ceriPage); reg('pacote', 'Pacote do aparelho', '⇅', pacotePage);
    },
  };
})();
