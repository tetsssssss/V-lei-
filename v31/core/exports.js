/* V3.1 · exports.js — o que vai para a cerimonialista: CSV (Excel pt-BR) e dossiê HTML imprimível. Funções PURAS (devolvem texto).
   Privacidade: telefones e valores em R$ só entram se você marcar. Nada é enviado: você escolhe como compartilhar o arquivo. */
(function (root, factory) {
  const api = factory(root.V31 || (root.V31 = {}));
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (V31) {
  'use strict';
  const D = V31.data, S = V31.schedule, I = V31.installments, R = V31.rsvp;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Excel pt-BR: separador ";" e BOM; células que começam com = + - @ ganham aspa (evita "injeção de fórmula").
  const cell = v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = rows => '﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n') + '\r\n';
  const tableName = (v, id) => { const o = v.plan.objects.find(x => x.id === id); return o ? o.label : ''; };
  const people = g => Math.max(1, Math.floor(D.num(g.qty, 1)));

  function csvGuests(d, { phones = false } = {}) {
    const v = D.ensure(d);
    return csv([['Convite', 'Grupo', 'Lado', 'Adultos', 'Crianças', 'Pessoas', 'Presença', 'Mesa', ...(phones ? ['Telefone'] : []), 'Observações'],
      ...d.guests.map(g => [g.name, g.group, g.side, g.adults ?? '', g.children ?? '', people(g), g.attendance, tableName(v, (v.guestMeta[g.id] || {}).table), ...(phones ? [R.formatPhone((v.guestMeta[g.id] || {}).phone || '')] : []), g.notes || ''])]);
  }
  function csvSeating(d) {
    const v = D.ensure(d), u = V31.plan.usage(d), rows = [['Mesa', 'Lugares', 'Ocupados', 'Convite', 'Pessoas']];
    for (const o of v.plan.objects.filter(V31.plan.isTable)) { const gs = u[o.id].guests.map(id => d.guests.find(g => g.id === id)); if (!gs.length) rows.push([o.label, u[o.id].seats, 0, '', '']); gs.forEach((g, i) => rows.push([i ? '' : o.label, i ? '' : u[o.id].seats, i ? '' : u[o.id].used, g.name, people(g)])); }
    return csv(rows);
  }
  function csvSchedule(d) { const v = D.ensure(d), a = S.analyze(v.dayPlan); return csv([['Início', 'Fim', 'Duração (min)', 'Momento', 'Onde', 'Responsável', 'Observações'], ...a.items.map(i => [i.start, D.hhmm(i.e), i.minutes, i.title, tableName(v, i.where), i.who, i.note])]); }
  function csvInstallments(d, today) { const s = I.summary(d, today); return csv([['Vencimento', 'Item', 'Parcela', 'Valor', 'Situação'], ...s.list.map(x => [D.dateBR(x.due), x.item, x.label, x.amount.toFixed(2).replace('.', ','), x.state])]); }

  /** Dossiê HTML único e imprimível (Ctrl+P → PDF). `planSvg`: SVG já pronto (texto) ou ''. */
  function dossier(d, { planSvg = '', findings = null, phones = false, finance = false, vendors = true, today = D.todayISO() } = {}) {
    const v = D.ensure(d), st = d.settings, a = S.analyze(v.dayPlan), u = V31.plan.usage(d);
    const th = h => `<th>${esc(h)}</th>`, td = x => `<td>${esc(x)}</td>`;
    const tbl = (head, rows) => `<table><thead><tr>${head.map(th).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(td).join('')}</tr>`).join('')}</tbody></table>`;
    const yes = d.guests.filter(g => g.attendance === 'Confirmado').reduce((x, g) => x + people(g), 0), pend = d.guests.filter(g => g.attendance === 'Pendente').reduce((x, g) => x + people(g), 0), no = d.guests.filter(g => g.attendance === 'Não irá').reduce((x, g) => x + people(g), 0);
    const sec = [];
    sec.push(`<section><h2>Resumo</h2><p><b>Data:</b> ${esc(D.dateBR(st.date))} · <b>Local:</b> ${esc(st.city)}</p><p><b>Pessoas:</b> ${yes} confirmadas · ${pend} sem resposta · ${no} não irão (total de convites: ${d.guests.length}). Presença só consta como “Confirmado” quando os noivos registraram a resposta.</p></section>`);
    if (a.items.length) sec.push(`<section><h2>Cronograma do dia</h2>${tbl(['Início', 'Fim', 'Momento', 'Onde', 'Responsável', 'Observações'], a.items.map(i => [i.start, D.hhmm(i.e), i.title, tableName(v, i.where), i.who, i.note.replace('Modelo sugerido — ajuste.', '')]))}</section>`);
    if (planSvg) sec.push(`<section class="planta"><h2>Planta da chácara</h2>${planSvg}<p class="peq">Medidas definidas pelos noivos sobre o print do local; sujeito a conferência no local.</p></section>`);
    const tabs = v.plan.objects.filter(V31.plan.isTable);
    if (tabs.length) sec.push(`<section><h2>Mesas</h2>${tbl(['Mesa', 'Lugares', 'Ocupados', 'Convites'], tabs.map(o => [o.label, u[o.id].seats, u[o.id].used, u[o.id].guests.map(id => d.guests.find(g => g.id === id).name).join(' · ')]))}</section>`);
    sec.push(`<section><h2>Convidados</h2>${tbl(['Convite', 'Grupo', 'Pessoas', 'Presença', 'Mesa', ...(phones ? ['Telefone'] : []), 'Obs.'], d.guests.map(g => [g.name, g.group, people(g), g.attendance, tableName(v, (v.guestMeta[g.id] || {}).table), ...(phones ? [R.formatPhone((v.guestMeta[g.id] || {}).phone || '')] : []), g.notes || '']))}</section>`);
    if (vendors) sec.push(`<section><h2>Fornecedores</h2>${tbl(['Fornecedor', 'Tipo', 'Situação', ...(finance ? ['Orçamento'] : []), 'Contato'], d.vendors.map(x => [x.name, x.kind, x.status, ...(finance ? [x.quote ? D.brl(x.quote) : '—'] : []), x.contact || '']))}<p class="peq">“Pesquisando” e “Proposta recebida” não significam contratado.</p></section>`);
    if (finance) sec.push(`<section><h2>Parcelas</h2>${tbl(['Vencimento', 'Item', 'Parcela', 'Valor', 'Situação'], I.summary(d, today).list.map(x => [D.dateBR(x.due), x.item, x.label, D.brl(x.amount), x.state]))}</section>`);
    if (findings && findings.length) sec.push(`<section><h2>Pontos de atenção (conferência automática)</h2><ul>${findings.filter(f => f.level !== 'ok').map(f => `<li><b>${esc(f.level)}</b>: ${esc(f.title)}${f.detail ? ' — ' + esc(f.detail) : ''}</li>`).join('')}</ul></section>`);
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dossiê — ${esc(st.personA)} e ${esc(st.personB)}</title><style>
body{font:14px/1.45 system-ui,sans-serif;color:#2b2226;margin:24px auto;max-width:900px;padding:0 16px}h1{font-family:Georgia,serif;color:#633d4b;margin:0 0 4px}h2{border-bottom:2px solid #c49a65;padding-bottom:3px;margin:26px 0 8px;color:#4d303b;font-size:18px}
table{border-collapse:collapse;width:100%;font-size:12.5px}th,td{border:1px solid #ddd;padding:4px 7px;text-align:left;vertical-align:top}th{background:#f4ece6}tr:nth-child(even) td{background:#fbf8f5}.peq{font-size:11px;color:#777}svg{max-width:100%;height:auto;border:1px solid #ddd}section{break-inside:avoid-page}@media print{body{margin:0;max-width:none}h2{break-after:avoid}table{break-inside:auto}tr{break-inside:avoid}}</style></head><body>
<h1>${esc(st.personA)} &amp; ${esc(st.personB)}</h1><p class="peq">Dossiê para a cerimonialista · gerado em ${esc(D.dateBR(today))} · documento de trabalho, sujeito a alterações</p>${sec.join('')}</body></html>`;
  }
  Object.assign(V31, { exports: { csv, csvGuests, csvSeating, csvSchedule, csvInstallments, dossier, esc } });
  return V31.exports;
});
