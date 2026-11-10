/* Íris · briefing.js — "quanto falta organizar" (definição explícita) e briefing proativo. Puro: lê só via `ns`. */
(function (root, factory) {
  const api = factory(root.Iris || (root.Iris = {}));
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Iris) {
  'use strict';
  const T = () => Iris.text;

  const DEFINITION = 'Conto como "falta organizar": tarefas pendentes, itens do orçamento com saldo a pagar, teto não definido, pessoas sem resposta, fornecedores sem cotação, roteiro da cerimônia vazio, chácara sem orçamento/contrato e fotos de padrinhos para revisar. Só uso o que está cadastrado — nada é estimado.';

  const venueOf = d => (d.vendors || []).find(v => v.id === 'venue-veneza') || (d.vendors || []).find(v => v.kind === 'Espaço') || null;

  /** Inconsistências de contagem: convites cujo adultos+crianças ≠ pessoas. */
  function guestMismatch(d) {
    return (d.guests || []).filter(g => g.adults !== undefined && g.children !== undefined && (Number(g.adults) + Number(g.children)) !== Math.max(1, Number(g.qty) || 0));
  }

  function remaining(ns) {
    const d = ns.getData(), h = ns.helpers, s = h.sums(), g = h.guestsInfo(), t = h.complete(), fmt = T().fmtBRL;
    const items = [];
    const push = (key, count, text, section, weight) => { if (count > 0) items.push({ key, count, text, section, weight }); };

    const pendTasks = d.tasks.filter(x => !x.done);
    push('tarefas', pendTasks.length, `${pendTasks.length} de ${t.all} tarefas pendentes`, 'cerimonia', 6);

    const openItems = d.budget.filter(x => !x.hypothetical && h.int(x.estimate) > h.int(x.paid));
    push('orcamento_aberto', openItems.length, `${T().plural(openItems.length, 'item')} do orçamento com ${fmt(s.open)} ainda a pagar`, 'orcamento', 4);
    if (!s.limit) push('teto', 1, 'teto do orçamento ainda não definido', 'ajustes', 9);

    push('rsvp', g.pending, `${T().plural(g.pending, 'pessoa')} sem resposta de presença (${g.yes} confirmada${g.yes === 1 ? '' : 's'})`, 'convidados', 7);

    const noQuote = d.vendors.filter(v => h.int(v.quote) === 0 && v.status !== 'Descartado');
    push('cotacoes', noQuote.length, `${T().plural(noQuote.length, 'fornecedor', 'fornecedores')} sem cotação cadastrada (de ${d.vendors.length})`, 'fornecedores', 8);

    if (!d.timeline.length) push('roteiro', 1, 'roteiro da cerimônia em branco', 'cerimonia', 5);

    const venue = venueOf(d);
    if (venue && venue.status !== 'Fechado') push('chacara', 1, `${venue.name}: sem contrato nem orçamento registrados`, 'pesquisas', 10);

    const review = (d.padrinhoFotos || []).filter(p => p.status === 'sugerido');
    push('fotos_revisar', review.length, `${T().plural(review.length, 'foto de padrinhos', 'fotos de padrinhos')} com vínculo a revisar`, 'padrinhos', 3);

    items.sort((a, b) => b.weight - a.weight);
    return { items, total: items.length, definition: DEFINITION };
  }

  /** Fala curta + linhas de detalhe para "quanto falta organizar". */
  function describeRemaining(rem) {
    if (!rem.items.length) return { speak: 'Pelo que está cadastrado, não há pendências abertas. Vale conferir se tudo já foi cadastrado.', lines: [rem.definition] };
    const top = rem.items.slice(0, 4).map(i => i.text);
    const rest = rem.items.length - top.length;
    return {
      speak: `Pelo que está cadastrado, ainda falta: ${T().humanList(top)}${rest > 0 ? `, e mais ${rest} ${rest === 1 ? 'ponto' : 'pontos'} na tela` : ''}.`,
      lines: rem.items.map(i => `• ${i.text}`).concat('', rem.definition),
    };
  }

  /** Briefing proativo (regras sobre o estado real). */
  function build(ns) {
    const d = ns.getData(), h = ns.helpers, s = h.sums(), g = h.guestsInfo(), fmt = T().fmtBRL;
    const days = h.daysUntil();
    const rem = remaining(ns);
    const venue = venueOf(d);
    const headline = days === null ? 'A data do casamento ainda não foi definida.'
      : days > 0 ? `Faltam ${days} dia${days === 1 ? '' : 's'} para a data de referência (${T().fmtDateBR(d.settings.date)}).`
      : days === 0 ? 'A data de referência é hoje.' : 'A data de referência já passou.';
    const priorities = rem.items.slice(0, 3).map(i => ({ text: i.text, section: i.section, key: i.key }));

    const alerts = [];
    if (!venue || venue.status !== 'Fechado') alerts.push({ level: 'info', text: 'A data é só uma referência de planejamento: não há reserva confirmada.' });
    if ((d.sourceNotes || []).length) alerts.push({ level: 'warn', text: d.sourceNotes[0], section: 'convidados' });
    if (!s.limit) alerts.push({ level: 'warn', text: 'Sem teto definido, não consigo calcular saldo — só o total planejado.', section: 'ajustes' });
    const mm = guestMismatch(d);
    if (mm.length) alerts.push({ level: 'warn', text: `${T().plural(mm.length, 'convite')} com adultos + crianças diferente do total de pessoas.`, section: 'convidados' });
    const eq = (d.nameEquivalences || []).length;
    if (eq) alerts.push({ level: 'info', text: `${T().plural(eq, 'possível equivalência de nome', 'possíveis equivalências de nome')} para revisar (nada foi mesclado).`, section: 'padrinhos' });
    if (s.hypoCount) alerts.push({ level: 'info', text: `${fmt(s.hypo)} em hipóteses ficam fora dos totais do orçamento.`, section: 'orcamento' });

    return { headline, priorities, alerts, remaining: rem, counts: { guests: g.total, confirmed: g.yes } };
  }

  const api = { remaining, describeRemaining, build, guestMismatch, venueOf, DEFINITION };
  Iris.briefing = api;
  return api;
});
