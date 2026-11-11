/* V3.1 · ceri.js — CERIMONIALISTA VIRTUAL: regras que CONFEREM o plano. Nada aqui é IA.
   Cada achado tem fonte (os números do app) e uma sugestão. A IA externa (opcional) só REDIGE o texto a partir destes achados.
   Limites das regras que usam número "de bolso" (folga entre mesas) são configuráveis e rotulados; nenhuma medida/capacidade da chácara é presumida. */
(function (root, factory) {
  const api = factory(root.V31 || (root.V31 = {}));
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (V31) {
  'use strict';
  const D = V31.data, G = V31.geo, S = V31.schedule, I = V31.installments, R = V31.rsvp, SOL = V31.solar;
  const TABLE_TYPES = ['mesa-redonda', 'mesa-retangular', 'mesa-noivos', 'mesa-convidados'];
  const isTable = o => TABLE_TYPES.includes(o.type) && D.num(o.seats) > 0;
  const people = g => Math.max(1, Math.floor(D.num(g.qty, 1)));
  const ESSENTIAL = ['Espaço', 'Buffet', 'Fotografia', 'Música', 'Cerimonial'];

  function check(d, { today = D.todayISO() } = {}) {
    const v = D.ensure(d), F = [], add = (level, area, id, title, detail, section, extra = {}) => F.push({ level, area, id, title, detail, section, ...extra });
    const st = d.settings, daysLeft = st.date ? D.daysBetween(today, st.date) : null;

    // ---------- PLANTA ----------
    const plan = v.plan, size = G.baseSize(plan.base), objs = plan.objects;
    if (!plan.base) add('aviso', 'planta', 'planta-sem-base', 'A planta ainda não foi criada', 'Importe o print do Google e calibre a escala (ou informe a área em metros) para eu conferir mesas e espaços.', 'planta');
    else if (!size) add('erro', 'planta', 'planta-sem-escala', 'A planta não tem escala calibrada', 'Sem escala em metros não dá para conferir distâncias nem tamanhos. Marque dois pontos de medida conhecida no print.', 'planta');
    if (size) {
      const polys = objs.map(o => ({ o, p: G.poly(o) }));
      polys.filter(x => !G.inside(x.p, size.w, size.h)).forEach(x => add('erro', 'planta', 'fora-' + x.o.id, `“${x.o.label || x.o.type}” está fora da área da planta`, 'Parte do objeto passa da borda do print/área definida.', 'planta', { objId: x.o.id }));
      const tables = polys.filter(x => isTable(x.o)), rest = polys.filter(x => !isTable(x.o) && x.o.kind !== 'zona');
      for (let i = 0; i < polys.length; i++) for (let j = i + 1; j < polys.length; j++) {
        const A = polys[i], B = polys[j]; if (A.o.kind === 'zona' || B.o.kind === 'zona') continue;
        const dep = G.overlapDepth(A.p, B.p);
        if (dep > 0.02) add('erro', 'planta', `sobrep-${A.o.id}-${B.o.id}`, `“${A.o.label || A.o.type}” e “${B.o.label || B.o.type}” se sobrepõem`, `Sobreposição de cerca de ${(dep * 100).toFixed(0)} cm.`, 'planta', { objId: A.o.id });
      }
      const minA = D.num(v.settings.minAisle, 1);
      for (let i = 0; i < tables.length; i++) for (let j = i + 1; j < tables.length; j++) {
        const dist = G.distance(tables[i].p, tables[j].p);
        if (dist > 0 && dist < minA) add('aviso', 'planta', `folga-${tables[i].o.id}-${tables[j].o.id}`, `Pouco espaço entre “${tables[i].o.label || 'mesa'}” e “${tables[j].o.label || 'mesa'}”`, `${dist.toFixed(2).replace('.', ',')} m entre as bordas; sua folga mínima configurada é ${minA.toFixed(2).replace('.', ',')} m (conta cadeiras e circulação).`, 'planta', { objId: tables[i].o.id });
      }
      const zones = polys.filter(x => x.o.kind === 'zona');
      if (tables.length && zones.length) { /* mesa fora de qualquer zona: só informa se houver zona de festa */ }
    }
    // lugares x convidados
    const tables = objs.filter(isTable), seats = tables.reduce((a, o) => a + Math.floor(D.num(o.seats)), 0);
    const yes = d.guests.filter(g => g.attendance === 'Confirmado').reduce((a, g) => a + people(g), 0), pend = d.guests.filter(g => g.attendance === 'Pendente').reduce((a, g) => a + people(g), 0);
    if (tables.length) {
      const need = yes + pend;
      if (seats < yes) add('erro', 'planta', 'lugares-confirmados', `Faltam lugares: ${seats} lugares para ${yes} confirmados`, `Faltam ${yes - seats} lugar(es) só para quem já confirmou.`, 'planta');
      else if (seats < need) add('aviso', 'planta', 'lugares-pendentes', `Lugares cobrem os confirmados (${yes}) mas não todos os previstos (${yes + pend})`, `${seats} lugares; se todos os pendentes vierem faltam ${need - seats}. (Ninguém foi dado como confirmado sem resposta.)`, 'planta');
      else add('ok', 'planta', 'lugares-ok', `Lugares suficientes: ${seats} para ${need} pessoas (confirmados + pendentes)`, '', 'planta');
      const byTable = {}; for (const g of d.guests) { const t = (v.guestMeta[g.id] || {}).table; if (t) byTable[t] = (byTable[t] || 0) + (g.attendance === 'Não irá' ? 0 : people(g)); }
      for (const o of tables) { const n = byTable[o.id] || 0; if (n > D.num(o.seats)) add('erro', 'planta', 'estouro-' + o.id, `“${o.label || 'Mesa'}” tem ${n} pessoas para ${o.seats} lugares`, 'Mova alguém de mesa.', 'planta', { objId: o.id }); }
      const semMesa = d.guests.filter(g => g.attendance !== 'Não irá' && !(v.guestMeta[g.id] || {}).table);
      if (semMesa.length) add('info', 'planta', 'sem-mesa', `${semMesa.length} convite(s) ainda sem mesa`, `${semMesa.reduce((a, g) => a + people(g), 0)} pessoas.`, 'planta');
    }
    if (size && !objs.some(o => o.type === 'cobertura')) add('aviso', 'planta', 'sem-chuva', 'Não há área coberta marcada para plano de chuva', 'Marque na planta o espaço coberto (ou defina o plano B) para o caso de chover. Quanto cabe ali você precisa medir.', 'planta');
    if (size && objs.some(o => o.type === 'mesa-frios') === false && tables.length) add('info', 'planta', 'sem-frios', 'Mesa de frios não posicionada', 'Se haverá mesa de frios/coquetel, coloque-a na planta.', 'planta');

    // ---------- CRONOGRAMA ----------
    const day = S.analyze(v.dayPlan);
    if (!v.dayPlan.length) add('aviso', 'dia', 'dia-vazio', 'O cronograma do dia está vazio', 'Sem ele a cerimonialista não tem como coordenar fornecedores. Dá para começar pelo modelo sugerido.', 'dia');
    else {
      day.overlaps.forEach(o => add('erro', 'dia', `dia-sobrep-${o.a.id}`, `“${o.a.title}” (${o.a.start}) invade “${o.b.title}” (${o.b.start}) em ${o.minutes} min`, 'Ajuste horário ou duração.', 'dia'));
      day.gaps.forEach(g => add('info', 'dia', `dia-lacuna-${g.a.id}`, `${g.minutes} min sem nada previsto entre “${g.a.title}” e “${g.b.title}”`, 'Pode ser proposital (descanso/deslocamento). Confira.', 'dia'));
      if (!day.items.some(i => /cerim[ôo]nia/i.test(i.title) || i.kind === 'cerimonia')) add('aviso', 'dia', 'dia-sem-cerimonia', 'Nenhum momento “Cerimônia” no cronograma', '', 'dia');
      if (!day.items.some(i => /jantar|buffet|almo[cç]o|refei/i.test(i.title) || i.kind === 'jantar')) add('aviso', 'dia', 'dia-sem-refeicao', 'Nenhuma refeição no cronograma', 'Confirme com o buffet o horário de servir.', 'dia');
      const objIds = new Set(objs.map(o => o.id)); day.items.filter(i => i.where && !objIds.has(i.where)).forEach(i => add('aviso', 'dia', 'dia-lugar-' + i.id, `“${i.title}” aponta para um local que não existe mais na planta`, '', 'dia'));
      // luz natural x cerimônia
      const cer = day.items.find(i => i.kind === 'cerimonia' && /^cerim/i.test(i.title)) || day.items.find(i => /^cerim[ôo]nia$/i.test(i.title));
      const sun = st.date ? SOL.sunTimes(st.date, D.num(v.settings.lat), D.num(v.settings.lon), D.num(v.settings.tz, -3)) : null;
      if (cer && sun) {
        const sunset = Math.round(sun.set);
        if (cer.e > sunset) add('aviso', 'dia', 'dia-escuro', `A cerimônia termina (${D.hhmm(cer.e)}) depois do pôr do sol (~${D.hhmm(sunset)})`, 'Se for ao ar livre, planeje iluminação e fotógrafo. Pôr do sol é estimativa ±5 min para as coordenadas da cidade.', 'dia');
        else if (cer.e > sunset - 30) add('info', 'dia', 'dia-luz', `A cerimônia termina ${sunset - cer.e} min antes do pôr do sol (~${D.hhmm(sunset)})`, 'Pouca margem de luz natural para fotos.', 'dia');
      }
      if (day.last && day.last.e > 24 * 60) add('info', 'dia', 'dia-madrugada', 'O cronograma passa da meia-noite', 'Confirme horários de fornecedores e regras do local.', 'dia');
    }

    // ---------- PARCELAS ----------
    const inst = I.summary(d, today);
    if (inst.overdue.length) add('erro', 'parcelas', 'par-vencidas', `${inst.overdue.length} parcela(s) vencida(s) somando ${D.brl(inst.totalOverdue)}`, inst.overdue.slice(0, 3).map(x => `${x.item} (${D.dateBR(x.due)})`).join('; '), 'parcelas');
    if (inst.soon.length) add('aviso', 'parcelas', 'par-proximas', `${inst.soon.length} parcela(s) vencem nos próximos 30 dias: ${D.brl(inst.totalSoon)}`, inst.soon.slice(0, 3).map(x => `${x.item} (${D.dateBR(x.due)})`).join('; '), 'parcelas');
    inst.perItem.forEach(p => { if (Math.abs(p.planned - p.estimate) > 0.009) add('aviso', 'parcelas', 'par-soma-' + p.id, `Parcelas de “${p.title}” somam ${D.brl(p.planned)}, mas o item está em ${D.brl(p.estimate)}`, 'Ou falta parcela, ou o valor do item mudou.', 'parcelas'); });
    d.budget.filter(b => !b.hypothetical && D.num(b.paid) > D.num(b.estimate) && D.num(b.estimate) > 0).forEach(b => add('aviso', 'parcelas', 'pago-maior-' + b.id, `“${b.title}” tem mais pago que o estimado`, '', 'orcamento'));
    if (daysLeft !== null && daysLeft >= 0 && inst.list.some(x => !x.paid && x.due > st.date)) add('aviso', 'parcelas', 'par-pos-data', 'Há parcela com vencimento depois da data do casamento', 'Pode ser combinado com o fornecedor; só confirme.', 'parcelas');

    // ---------- CONVITES / RSVP ----------
    const rs = R.summary(d);
    if (rs.total) {
      if (rs.noPhone) add('info', 'convites', 'rsvp-sem-fone', `${rs.noPhone} convite(s) sem telefone cadastrado`, 'Sem telefone não há como montar o link de WhatsApp.', 'rsvp');
      if (rs.notSent) add('info', 'convites', 'rsvp-nao-enviados', `${rs.notSent} convite(s) com telefone ainda não enviados`, '', 'rsvp');
      const dl = v.settings.rsvpDeadline;
      if (dl) { const dd = D.daysBetween(today, dl); if (dd < 0 && rs.peoplePending > 0) add('erro', 'convites', 'rsvp-prazo', `O prazo de respostas (${D.dateBR(dl)}) passou e ${rs.peoplePending} pessoas seguem sem resposta`, 'Hora de cobrar com cuidado.', 'rsvp'); else if (dd >= 0 && dd <= 14 && rs.peoplePending > 0) add('aviso', 'convites', 'rsvp-prazo-perto', `Prazo de respostas em ${dd} dia(s); ${rs.peoplePending} pessoas sem resposta`, '', 'rsvp'); }
      else add('info', 'convites', 'rsvp-sem-prazo', 'Defina um prazo para as respostas', 'A mensagem do WhatsApp usa essa data.', 'rsvp');
      if (st.guestGoal && rs.peopleYes > D.num(st.guestGoal)) add('aviso', 'convites', 'rsvp-acima-meta', `Confirmados (${rs.peopleYes}) passam da meta de lugares (${st.guestGoal})`, '', 'convidados');
    }

    // ---------- FORNECEDORES ----------
    if (daysLeft !== null && daysLeft >= 0 && daysLeft < 365) {
      const missing = ESSENTIAL.filter(k => !d.vendors.some(x => x.kind === k && x.status === 'Fechado'));
      if (missing.length) add('aviso', 'fornecedores', 'forn-abertos', `Faltam ${daysLeft} dias e estas categorias não têm fornecedor “Fechado”: ${missing.join(', ')}`, 'Pesquisando ≠ contratado. Nada aqui presume contratação.', 'fornecedores');
    }
    // ---------- GERAL ----------
    if (!st.date) add('erro', 'geral', 'sem-data', 'A data do casamento não está definida', '', 'ajustes');
    const order = { erro: 0, aviso: 1, info: 2, ok: 3 };
    F.sort((a, b) => order[a.level] - order[b.level]);
    const count = l => F.filter(f => f.level === l).length;
    return { findings: F, errors: count('erro'), warnings: count('aviso'), infos: count('info'), oks: count('ok'), facts: { seats, yes, pend, tables: tables.length, daysLeft } };
  }

  /** Texto local (sem IA) a partir dos achados. */
  function narrate(res) {
    const f = res.findings.filter(x => x.level !== 'ok');
    if (!f.length) return 'Conferi o plano e não encontrei pendências nas regras que verifico. Isso não substitui a visita ao local nem a palavra da cerimonialista.';
    const lines = [`Conferi o plano: ${res.errors} problema(s), ${res.warnings} ponto(s) de atenção e ${res.infos} aviso(s).`];
    for (const x of f.slice(0, 8)) lines.push(`• ${x.title}${x.detail ? ' — ' + x.detail : ''}`);
    if (f.length > 8) lines.push(`… e mais ${f.length - 8} no painel.`);
    return lines.join('\n');
  }
  /** Material para a IA REDIGIR (sem nomes de pessoas; só os achados). A IA não decide nada. */
  function draftPrompt(res, kind = 'resumo') {
    const facts = res.findings.filter(x => x.level !== 'ok').map(x => `[${x.level}] ${x.title}${x.detail ? ' — ' + x.detail : ''}`).join('\n');
    const intro = kind === 'mensagem-cerimonialista' ? 'Redija uma mensagem curta, cordial e objetiva em português do Brasil dos noivos para a cerimonialista, apresentando os pontos abaixo e pedindo orientação.' : 'Redija em português do Brasil, em tom acolhedor e claro, um resumo para os noivos priorizando o que fazer primeiro.';
    return `${intro} Use SOMENTE os fatos listados; não invente medidas, preços, nomes nem regras. Se algo não estiver na lista, não mencione.\n\nFATOS:\n${facts || '(sem pendências)'}`;
  }
  Object.assign(V31, { ceri: { check, narrate, draftPrompt, isTable, ESSENTIAL } });
  return V31.ceri;
});
