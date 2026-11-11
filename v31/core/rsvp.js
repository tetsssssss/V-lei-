/* V3.1 · rsvp.js — convites e respostas por WhatsApp, 100% LOCAL.
   O app NUNCA envia nada sozinho: ele monta o link wa.me e VOCÊ toca em "enviar" no WhatsApp.
   Presença só vira "Confirmado" quando você registra a resposta (regra do projeto). */
(function (root, factory) {
  const api = factory(root.V31 || (root.V31 = {}));
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (V31) {
  'use strict';
  const D = V31.data;
  /** Telefone BR → só dígitos com DDI 55. null se não parecer um celular/fixo brasileiro. */
  function normalizePhone(raw) {
    let d = String(raw || '').replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    if (d.startsWith('55') && (d.length === 12 || d.length === 13)) return d;
    if (d.length === 10 || d.length === 11) return '55' + d;
    return null;
  }
  const formatPhone = n => { const d = normalizePhone(n); if (!d) return String(n || ''); const l = d.slice(2); return `(${l.slice(0, 2)}) ${l.length === 11 ? l.slice(2, 7) + '-' + l.slice(7) : l.slice(2, 6) + '-' + l.slice(6)}`; };
  const firstName = full => { const s = String(full || '').replace(/\+.*$/, '').replace(/^(fam[ií]lia|casal|sr\.?|sra\.?|dr\.?|dra\.?)\s+/i, '').trim(); return s.split(/\s+/)[0] || 'tudo bem'; };

  function fill(tpl, vars) { return String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== '' ? vars[k] : m === '{limite}' ? 'em breve' : m)); }
  function message(d, guest) {
    const v = D.ensure(d), s = v.settings, st = d.settings;
    const couple = `${st.personA || ''} e ${st.personB || ''}`.trim();
    const local = String(st.city || '').split(/[,/]/)[0].trim();
    return fill(s.waTemplate, { nome: firstName(guest.name), data: D.dateBR(st.date), local, casal: couple, limite: D.dateBR(s.rsvpDeadline) });
  }
  const link = (phone, text) => { const n = normalizePhone(phone); return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null; };
  const meta = (d, gid) => { const v = D.ensure(d); return (v.guestMeta[gid] = v.guestMeta[gid] || {}); };

  const REPLY = { sim: 'Confirmado', nao: 'Não irá', talvez: 'Pendente' };
  /** Registra a resposta e atualiza a presença do convidado (adultos/crianças opcionais, validados). */
  function recordReply(d, gid, { status, adults, children, note, at }) {
    const g = d.guests.find(x => x.id === gid); if (!g) throw new Error('Convidado não encontrado.');
    if (!REPLY[status]) throw new Error('Resposta inválida.');
    const m = meta(d, gid);
    const a = adults === undefined ? undefined : Math.max(0, Math.floor(D.num(adults))), c = children === undefined ? undefined : Math.max(0, Math.floor(D.num(children)));
    if (status === 'sim' && a !== undefined && c !== undefined) {
      if (a + c < 1) throw new Error('Informe ao menos 1 pessoa.');
      g.adults = a; g.children = c; g.qty = a + c;
    }
    g.attendance = REPLY[status];
    m.reply = { status, adults: g.adults, children: g.children, note: String(note || '').slice(0, 300), at: at || new Date().toISOString() };
    return g;
  }
  const markSent = (d, gid, at) => { meta(d, gid).sentAt = at || new Date().toISOString(); };
  function clearReply(d, gid) { const m = meta(d, gid); delete m.reply; const g = d.guests.find(x => x.id === gid); if (g) g.attendance = 'Pendente'; }

  /** Quadro de situação. */
  function summary(d) {
    const v = D.ensure(d); const rows = d.guests.map(g => { const m = v.guestMeta[g.id] || {}; return { g, m, phone: normalizePhone(m.phone), sent: !!m.sentAt, replied: !!m.reply }; });
    const people = x => Math.max(1, Math.floor(D.num(x.qty, 1)));
    const sum = f => rows.filter(f).reduce((a, r) => a + people(r.g), 0);
    return { total: rows.length, withPhone: rows.filter(r => r.phone).length, noPhone: rows.filter(r => !r.phone).length, sent: rows.filter(r => r.sent).length, notSent: rows.filter(r => r.phone && !r.sent).length,
      awaiting: rows.filter(r => r.sent && !r.replied).length, replied: rows.filter(r => r.replied).length,
      peopleYes: sum(r => r.g.attendance === 'Confirmado'), peoplePending: sum(r => r.g.attendance === 'Pendente'), peopleNo: sum(r => r.g.attendance === 'Não irá'), rows };
  }
  Object.assign(V31, { rsvp: { normalizePhone, formatPhone, firstName, message, link, recordReply, markSent, clearReply, summary, meta, fill } });
  return V31.rsvp;
});
