/* Íris · risk.js — classes de risco, política de confirmação e interpretação de sim/não. Puro. */
(function (root, factory) {
  const api = factory(root.Iris || (root.Iris = {}));
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Iris) {
  'use strict';
  const T = () => Iris.text;

  /** R0 leitura · R1a reversível leve · R1b reversível relevante · R2 sensível */
  const POLICY = {
    R0: { label: 'somente leitura', confirm: false, tap: false, undo: false },
    R1a: { label: 'alteração reversível leve', confirm: false, tap: false, undo: true },
    R1b: { label: 'alteração reversível relevante', confirm: true, tap: false, undo: true },
    R2: { label: 'ação sensível', confirm: true, tap: true, undo: true },
  };
  const policy = r => POLICY[r] || POLICY.R2;

  const YES = /^(sim|confirmo|confirma|confirme|confirmar|confirmado|pode|pode ser|pode sim|pode fazer|isso|isso mesmo|ok|okay|certo|claro|com certeza|manda ver|faz|faca|executa|execute|vai|vai em frente|positivo|aceito)(\s|$)/;
  const NO = /^(nao|n|cancela|cancele|cancelar|cancelado|deixa|deixa pra la|deixa para la|esquece|esqueca|melhor nao|negativo|desisto|para|pare|nada disso|de jeito nenhum)(\s|$)/;
  const isYes = s => { const n = T().norm(s); return !NO.test(n) && YES.test(n); };
  const isNo = s => NO.test(T().norm(s));
  /** Para ações R2 a voz sozinha NÃO basta: exigimos a palavra "confirmo" E o toque no botão. */
  const isExplicitConfirm = s => /\bconfirm(o|a|e|ar)\b/.test(T().norm(s)) && !isNo(s);

  const api = { POLICY, policy, isYes, isNo, isExplicitConfirm };
  Iris.risk = api;
  return api;
});
