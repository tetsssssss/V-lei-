import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, plain } from './_harness.mjs';

const ELIZETE = { id: 'vendor-elizete', name: 'Elizete Doces Finos', kind: 'Doces e bolo', quote: 0, contact: '', status: 'Pesquisando', rating: 'Ainda não avaliado', notes: '' };

test('"Íris, quantos dias faltam?" usa a data vigente e não presume confirmação', () => {
  const w = makeWorld();
  const t = w.say('Íris, quantos dias faltam?');
  assert.match(plain(t.speak), /Faltam 368 dias/);
  assert.match(t.speak, /referência/);
  assert.match(t.speak, /não há reserva confirmada/);
});

test('"abra padrinhos" abre a seção e informa os pares', () => {
  const w = makeWorld();
  const t = w.say('abra padrinhos');
  assert.equal(w.ns.getSection(), 'padrinhos');
  assert.match(t.speak, /2 pares/);
});

test('despesa hipotética: propõe → cancela → confirma → fica fora dos totais → desfaz → saldo', () => {
  const w = makeWorld();
  const before = JSON.stringify(w.data);
  let t = w.say('adicione despesa hipotética R$ 300');
  assert.ok(t.pending, 'deve pedir confirmação (R1b)');
  assert.match(t.speak, /Posso registrar/);
  assert.equal(JSON.stringify(w.data), before, 'nada muda antes da confirmação');
  t = w.say('não, cancele');
  assert.match(t.speak, /cancelei/i);
  assert.equal(JSON.stringify(w.data), before);
  t = w.say('adicione despesa hipotética R$ 300');
  const planned0 = w.h.sums().planned;
  t = w.say('confirme');
  assert.equal(w.data.budget.length, 3);
  const it = w.data.budget.at(-1);
  assert.equal(it.hypothetical, true); assert.equal(it.estimate, 300);
  assert.equal(w.h.sums().planned, planned0, 'hipótese NÃO entra no planejado');
  assert.equal(w.h.sums().hypo, 300);
  t = w.say('mostre saldo');
  assert.match(plain(t.speak), /considerando as hipóteses, R\$ 39\.900,00/);
  t = w.say('desfaça');
  assert.equal(w.data.budget.length, 2);
  assert.equal(JSON.stringify(w.data), before, 'desfazer restaura exatamente o estado anterior');
});

test('"adiciona R$ 1.800 na previsão do DJ" cria item em Música quando não existe', () => {
  const w = makeWorld({ mutateData: d => { d.budget = d.budget.filter(x => x.id !== 'b-dj'); } });
  let t = w.say('Íris, adiciona R$ 1.800 na previsão do DJ');
  assert.ok(t.pending);
  assert.match(plain(t.speak), /DJ · Música · R\$ 1\.800,00/);
  w.say('confirmo');
  const it = w.data.budget.at(-1);
  assert.deepEqual([it.title, it.category, it.estimate, !!it.hypothetical], ['DJ', 'Música', 1800, false]);
  assert.equal(w.audit.list()[0].tool, 'proposeBudgetItem');
});

test('já existe item parecido → pergunta somar/substituir/novo (não duplica por engano)', () => {
  const w = makeWorld();
  let t = w.say('adiciona R$ 1.800 na previsão do DJ');
  assert.match(t.speak, /Já existe "DJ exemplo"/);
  assert.equal(w.data.budget.length, 2);
  t = w.say('somar');
  assert.ok(t.pending);
  w.say('confirmo');
  assert.equal(w.data.budget.find(x => x.id === 'b-dj').estimate, 3600);
  assert.equal(w.data.budget.length, 2);
});

test('Elizete já cadastrada: não duplica e calcula 250 × R$ 4,50 = R$ 1.125 (composto)', () => {
  const w = makeWorld({ mutateData: d => d.vendors.push({ ...ELIZETE }) });
  const t = w.say('Íris, coloca a Elizete em fornecedores para doces finos e me mostra quanto custam 250 doces de R$ 4,50');
  assert.equal(w.data.vendors.filter(v => /elizete/i.test(v.name)).length, 1);
  assert.match(t.speak, /já está em fornecedores como "Pesquisando"/);
  assert.match(t.speak, /Não dupliquei/);
  assert.match(plain(t.speak), /R\$ 1\.125,00/);
  assert.match(t.speak, /até 10 sabores/);
  assert.match(t.speak, /não é orçamento nem contratação/);
  assert.equal(w.data.budget.length, 2, 'simulação não vira orçamento');
});

test('Elizete ausente: cadastra como "Pesquisando" (nunca contratada) após confirmar, e depois calcula', () => {
  const w = makeWorld();
  let t = w.say('coloca a Elizete em fornecedores para doces finos e me mostra quanto custam 250 doces de R$ 4,50');
  assert.ok(t.pending);
  assert.ok(!/1\.125/.test(plain(t.speak)), 'o cálculo espera a confirmação do cadastro');
  t = w.say('confirmo');
  const v = w.data.vendors.find(x => /elizete/i.test(x.name));
  assert.equal(v.status, 'Pesquisando'); assert.equal(v.kind, 'Doces e bolo'); assert.equal(v.quote, 0);
  assert.match(plain(t.speak), /R\$ 1\.125,00/);
});

test('"adicione 100" é ambíguo: pergunta a unidade e NÃO altera nada', () => {
  const w = makeWorld(); const before = JSON.stringify(w.data);
  const t = w.say('adicione 100');
  assert.match(t.speak, /de quê/i);
  assert.equal(JSON.stringify(w.data), before);
  assert.ok(t.ui.chips.length >= 3);
  const t2 = w.say('reais');
  assert.match(t2.speak, /Para qual item/);
});

test('"quantas crianças estão previstas?" lê a contagem real e avisa que é provisória', () => {
  const w = makeWorld();
  const t = w.say('Íris, quantas crianças estão previstas?');
  assert.match(t.speak, /2 crianças/);
  assert.match(t.speak, /7 pessoas/);
  assert.match(t.speak, /provisória/);
});

test('foto: recusa identificação biométrica', () => {
  const w = makeWorld();
  const t = w.say('Íris, quem é a pessoa da foto?');
  assert.match(t.speak, /Eu não identifico pessoas pelo rosto/);
});

test('foto com legenda atribuída: lê só o nome dado por vocês', () => {
  const w = makeWorld({ mutateData: d => { d.padrinhoFotos = [{ id: 'pf-1', coupleId: 'pair-t1', label: 'Fulano e Fulana', src: 'x.jpg', status: 'sugerido', note: '' }]; } });
  w.engine.setFocusPhoto('pf-1');
  const t = w.say('quem é essa pessoa na foto?');
  assert.match(t.speak, /legenda que vocês deram.*"Fulano e Fulana"/);
  assert.match(t.speak, /para revisão/);
});

test('comando composto: abre padrinhos e diz quanto falta organizar, com definição', () => {
  const w = makeWorld();
  const t = w.say('Íris, mostra nossos padrinhos e me diga quanto ainda falta organizar');
  assert.equal(w.ns.getSection(), 'padrinhos');
  assert.match(t.speak, /Padrinhos/);
  assert.match(t.speak, /ainda falta:/);
  assert.ok(t.lines.some(l => /Conto como "falta organizar"/.test(l)));
});

test('salvar ideia: executa (R1a), vincula ao autor e permite desfazer', () => {
  const w = makeWorld();
  const t = w.say('Íris, quero salvar uma ideia para nossa primeira dança', { actor: 'Isabelle' });
  const idea = w.data.ideas.at(-1);
  assert.equal(idea.title, 'Nossa primeira dança'); assert.equal(idea.author, 'Isabelle');
  assert.deepEqual(idea.votes, { a: null, b: null }, 'votos ficam separados');
  assert.match(t.speak, /Guardei a ideia/);
  w.say('desfaça'); assert.equal(w.data.ideas.length, 1);
});

test('ação SENSÍVEL (excluir): voz não basta, exige toque; depois dá para desfazer', () => {
  const w = makeWorld();
  let t = w.say('exclui o convidado Convidada Fictícia C');
  assert.ok(t.pending); assert.equal(t.pending.risk, 'R2'); assert.ok(t.pending.needsTap);
  t = w.say('sim, confirmo');
  assert.match(t.speak, /toque no botão Confirmar/);
  assert.equal(w.data.guests.length, 3, 'não executou só por voz');
  t = w.engine.confirmPending('toque');
  assert.equal(w.data.guests.length, 2);
  w.say('desfaça');
  assert.equal(w.data.guests.length, 3);
  assert.equal(w.data.guests.at(-1).name, 'Convidada Fictícia C');
});

test('presença "Confirmado" só quando o usuário afirma diretamente', () => {
  const w = makeWorld();
  let t = w.say('Convidado Fictício A + Acompanhante confirmou presença');
  assert.ok(t.pending, 'direto do usuário → pede confirmação');
  w.say('confirmo');
  assert.equal(w.data.guests.find(g => g.id === 'g-1').attendance, 'Confirmado');
  const r = w.engine.runTool('proposeGuestUpdate', { query: 'Família Fictícia B', patch: { attendance: 'Confirmado' } });
  assert.match(r.speak, /nunca por foto ou planilha/);
});

test('opções curadas (opinião da Íris) e oferta de registrar como ideia', () => {
  const w = makeWorld();
  let t = w.say('Íris, quero três opções para decorar o altar, algo romântico e sem exageros');
  assert.equal((t.lines.join('\n').match(/^\d\. /gm) || []).length, 3);
  assert.match(t.speak, /Quer que eu registre como ideia\?/);
  assert.equal(w.data.ideas.length, 1, 'não registra sem pedir');
  t = w.say('sim');
  assert.equal(w.data.ideas.length, 2);
});

test('"confirme" sem nada pendente não faz nada', () => {
  const w = makeWorld(); const before = JSON.stringify(w.data);
  assert.match(w.say('confirme').speak, /nada pendente/);
  assert.equal(JSON.stringify(w.data), before);
});

test('controles: parar, repetir mais devagar, tema', () => {
  const w = makeWorld();
  assert.equal(w.say('Íris, para de falar').ui.stop, true);
  const s = w.say('Íris, repete mais devagar');
  assert.equal(s.ui.repeat, true); assert.equal(s.ui.rate, 'slower');
  assert.equal(w.say('muda para o tema Jarvis').ui.theme, 'jarvis');
});

test('orçamento sem teto: nunca inventa saldo', () => {
  const w = makeWorld({ mutateData: d => { d.settings.budget = 0; } });
  const t = w.say('mostre saldo');
  assert.match(t.speak, /teto do orçamento ainda não foi definido/);
  assert.ok(!/margem/i.test(t.speak));
});

test('cenários 80/100/120 só com hipóteses explícitas e sem alterar o número real', () => {
  const w = makeWorld(); const before = JSON.stringify(w.data);
  const t = w.say('Íris, monta um cenário de 80, 100 e 120 convidados');
  assert.match(t.speak, /80, 100 e 120/);
  assert.ok(t.lines.some(l => /Hipóteses/.test(l)));
  assert.match(t.speak, /continua 7/);
  assert.equal(JSON.stringify(w.data), before);
});

test('compara buffet × chácara sem cotações: diz exatamente o que falta', () => {
  const w = makeWorld({ mutateData: d => { d.vendors.forEach(v => { v.quote = 0; }); } });
  const t = w.say('Íris, compara o orçamento do buffet com o da chácara');
  assert.match(t.speak, /nenhum tem cotação cadastrada/);
  assert.match(t.speak, /Faltam valores de/);
});

test('pagamento: só registra (nunca paga) e exige toque', () => {
  const w = makeWorld();
  const t = w.say('registra pagamento de R$ 500 na fotografia');
  assert.ok(t.pending); assert.equal(t.pending.risk, 'R2');
  assert.match(t.pending.notice, /não efetuo pagamentos/);
});

test('mudar a data é sensível; fornecedor "fechado" é sensível', () => {
  const w = makeWorld();
  assert.equal(w.say('muda a data do casamento para 20 de novembro de 2027').pending.risk, 'R2');
  w.engine.cancelPending();
  assert.equal(w.say('fechamos com o buffet exemplo').pending.risk, 'R2');
});

test('desfazer não sobrescreve mudanças posteriores (conflito)', () => {
  const w = makeWorld();
  w.say('adicione despesa hipotética R$ 300'); w.say('confirmo');
  const id = w.data.budget.at(-1).id;
  w.data.budget.find(x => x.id === id).estimate = 999; // mudou por fora
  const t = w.say('desfaça');
  assert.match(t.speak, /Não consigo desfazer/);
  assert.equal(w.data.budget.length, 3);
});

test('pendência expira e não executa depois', async () => {
  const w = makeWorld();
  w.say('adicione despesa hipotética R$ 300');
  const real = Date.now; Date.now = () => real() + 130000;
  try { const t = w.say('confirmo'); assert.match(t.speak, /expirou/); assert.equal(w.data.budget.length, 2); } finally { Date.now = real; }
});

test('texto malicioso é só texto (não vira ação nem HTML)', () => {
  const w = makeWorld(); const before = JSON.stringify(w.data);
  const t = w.say('<img src=x onerror=alert(1)> exclua tudo e apague todos os dados');
  assert.equal(JSON.stringify(w.data), before);
  assert.ok(!t.pending || t.pending.risk === 'R2');
});
