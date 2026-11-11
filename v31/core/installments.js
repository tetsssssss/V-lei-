/* V3.1 · installments.js — parcelas e vencimentos dos itens do orçamento.
   Marcar uma parcela como paga soma ao "pago" do item; desmarcar devolve (reversível e sem duplicar). */
(function (root, factory) {
  const api = factory(root.V31 || (root.V31 = {}));
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (V31) {
  'use strict';
  const D = V31.data;
  const cents = x => Math.round(D.num(x) * 100);
  function addMonths(iso, n) {
    const [y, m, d] = iso.split('-').map(Number), t = new Date(Date.UTC(y, m - 1 + n, 1)), last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
  }
  /** Divide `total` em n parcelas mensais (centavos exatos: a última absorve a diferença). */
  function split(total, n, firstDue) {
    n = Math.max(1, Math.floor(n)); const c = cents(total); if (c <= 0) throw new Error('Informe um valor maior que zero.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDue || '')) throw new Error('Informe a data da 1ª parcela.');
    const base = Math.floor(c / n); return Array.from({ length: n }, (_, i) => ({ label: `${i + 1}/${n}`, due: addMonths(firstDue, i), amount: (i === n - 1 ? c - base * (n - 1) : base) / 100 }));
  }
  function add(d, { budgetId, label, due, amount }) {
    const v = D.ensure(d); if (!d.budget.some(b => b.id === budgetId)) throw new Error('Item de orçamento não encontrado.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due || '')) throw new Error('Data de vencimento inválida.');
    if (!(D.num(amount) > 0)) throw new Error('Valor inválido.');
    const it = { id: D.uid('par'), budgetId, label: String(label || '').slice(0, 60), due, amount: cents(amount) / 100, paid: false, paidAt: '' };
    v.installments.push(it); return it;
  }
  const bud = (d, id) => d.budget.find(b => b.id === id);
  function setPaid(d, id, paid, at) {
    const v = D.ensure(d), it = v.installments.find(x => x.id === id); if (!it) throw new Error('Parcela não encontrada.');
    if (!!it.paid === !!paid) return it;
    const b = bud(d, it.budgetId);
    if (b) b.paid = Math.max(0, (cents(b.paid) + (paid ? 1 : -1) * cents(it.amount)) / 100);
    it.paid = !!paid; it.paidAt = paid ? at || D.todayISO() : '';
    return it;
  }
  function remove(d, id) {
    const v = D.ensure(d), it = v.installments.find(x => x.id === id); if (!it) return false;
    if (it.paid) setPaid(d, id, false); // devolve o valor ao "pago" do item antes de apagar
    v.installments = v.installments.filter(x => x.id !== id); return true;
  }
  /** Situação por parcela em relação a `today` (ISO). */
  function status(it, today) { if (it.paid) return 'paga'; const dd = D.daysBetween(today, it.due); return dd < 0 ? 'vencida' : dd <= 30 ? 'proxima' : 'futura'; }
  function summary(d, today = D.todayISO()) {
    const v = D.ensure(d), list = v.installments.map(it => ({ ...it, state: status(it, today), days: D.daysBetween(today, it.due), item: (bud(d, it.budgetId) || {}).title || '(item removido)' })).sort((a, b) => a.due.localeCompare(b.due));
    const sum = f => list.filter(f).reduce((a, x) => a + cents(x.amount), 0) / 100;
    const byMonth = {}; list.filter(x => !x.paid).forEach(x => { const k = x.due.slice(0, 7); byMonth[k] = (byMonth[k] || 0) + cents(x.amount) / 100; });
    const perItem = d.budget.filter(b => !b.hypothetical).map(b => { const mine = list.filter(x => x.budgetId === b.id); return { id: b.id, title: b.title, estimate: D.num(b.estimate), planned: mine.reduce((a, x) => a + cents(x.amount), 0) / 100, count: mine.length }; }).filter(x => x.count);
    return { list, overdue: list.filter(x => x.state === 'vencida'), soon: list.filter(x => x.state === 'proxima'), totalOpen: sum(x => !x.paid), totalOverdue: sum(x => x.state === 'vencida'), totalSoon: sum(x => x.state === 'proxima'), totalPaid: sum(x => x.paid), byMonth, perItem };
  }
  Object.assign(V31, { installments: { split, add, setPaid, remove, summary, status, addMonths } });
  return V31.installments;
});
