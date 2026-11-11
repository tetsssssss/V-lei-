import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fixtureV2 } from '../e2e/fixture.mjs';
const require = createRequire(import.meta.url);
for (const f of ['data', 'zip', 'geo', 'solar', 'rsvp', 'installments', 'schedule', 'plan', 'ceri', 'exports']) require(`../../v31/core/${f}.js`);
const V = globalThis.V31, P = V.plan, C = V.ceri;
const world = () => { const d = fixtureV2(); d.v31 = undefined; V.data.ensure(d); return d; };
const withPlan = d => { P.setImage(d, { key: 'k', wPx: 2000, hPx: 1000 }); P.calibrate(d, [0, 0], [500, 0], 50); return d; }; // 10 px/m → 200 × 100 m
const ids = r => r.findings.map(f => f.id);

test('planta: sem escala não se cria nada; calibrar dá metros; recalibrar mantém posição sobre o print', () => {
  const d = world(); assert.throws(() => P.addItem(d, 'mesa-redonda'), /Defina a planta/);
  P.setImage(d, { key: 'k', wPx: 2000, hPx: 1000 }); assert.equal(V.geo.baseSize(d.v31.plan.base), null); assert.throws(() => P.addItem(d, 'bar'), /Defina a planta/);
  assert.throws(() => P.calibrate(d, [5, 5], [5, 5], 10), /dois pontos/); assert.throws(() => P.calibrate(d, [0, 0], [10, 0], 0), /dois pontos/);
  assert.equal(P.calibrate(d, [0, 0], [500, 0], 50), 10); assert.deepEqual(V.geo.baseSize(d.v31.plan.base), { w: 200, h: 100 });
  const m = P.addItem(d, 'mesa-redonda', { x: 100, y: 50 }); assert.equal(m.suggested, true);
  P.calibrate(d, [0, 0], [500, 0], 25); // 20 px/m: o mesmo ponto do print agora vale metade dos metros
  assert.equal(m.x, 50); assert.equal(m.y, 25); assert.equal(m.w, 1.6, 'tamanho em metros não muda');
});
test('planta: validações de objetos, zonas só desenhadas e remoção limpa referências', () => {
  const d = withPlan(world());
  assert.throws(() => P.addItem(d, 'cerimonia'), /inválido/); assert.throws(() => P.addZone(d, 'mesa-redonda', { x: 0, y: 0, w: 5, h: 5 }), /inválido/); assert.throws(() => P.addZone(d, 'pista', { x: 0, y: 0, w: 0.1, h: 5 }), /maior/);
  const z = P.addZone(d, 'pista', { x: 10, y: 10, w: 8, h: 6 }); assert.equal(z.x, 14); assert.equal(z.suggested, undefined);
  const t = P.addItem(d, 'mesa-redonda'); assert.throws(() => P.update(d, t.id, { w: 0 }), /maior que zero/); assert.throws(() => P.update(d, t.id, { seats: 2.5 }), /inteiro/);
  P.update(d, t.id, { w: 2, rot: -90, seats: 10 }); assert.equal(t.h, 2, 'círculo mantém h = w'); assert.equal(t.rot, 270); assert.equal(t.suggested, false);
  P.assign(d, d.guests[0].id, t.id); d.v31.dayPlan.push({ id: 'dia1', where: t.id, start: '10:00', minutes: 10, title: 'x' });
  assert.throws(() => P.assign(d, d.guests[0].id, z.id), /Mesa inválida/); assert.throws(() => P.assign(d, 'zz', t.id), /não encontrado/);
  P.remove(d, t.id); assert.equal(d.v31.guestMeta[d.guests[0].id].table, undefined); assert.equal(d.v31.dayPlan[0].where, '');
});
test('autoSeat: mantém convites inteiros, respeita lugares e não mexe em quem já tem mesa', () => {
  const d = withPlan(world()); const a = P.addItem(d, 'mesa-redonda', { x: 20, y: 20 }), b = P.addItem(d, 'mesa-retangular', { x: 40, y: 20 });
  P.update(d, a.id, { seats: 4 }); P.update(d, b.id, { seats: 2 });
  P.assign(d, 'g-3', b.id); // 1 pessoa já na mesa b
  const r = P.autoSeat(d); // ordem: lado Gabriel (g-1, 2 pessoas) → mesa a; depois g-2 (4 pessoas) não cabe em a (sobram 2) nem b (sobra 1) → fica de fora
  assert.equal(d.v31.guestMeta['g-1'].table, a.id); assert.equal(d.v31.guestMeta['g-3'].table, b.id); assert.deepEqual(r.left, ['g-2']); assert.equal(r.placed, 1);
  const u = P.usage(d); assert.equal(u[a.id].used, 2); assert.equal(u[b.id].used, 1);
  d.guests[0].attendance = 'Não irá'; assert.equal(P.usage(d)[a.id].used, 0, '"Não irá" não ocupa lugar');
});

test('cerimonialista: sem planta/cronograma avisa; não inventa nada', () => {
  const r = C.check(world(), { today: '2026-11-10' });
  assert.ok(ids(r).includes('planta-sem-base') && ids(r).includes('dia-vazio'));
  assert.ok(!ids(r).some(i => i.startsWith('lugares')), 'sem mesas não afirma nada sobre lugares');
});
test('cerimonialista: sobreposição, folga, fora da planta e lugares', () => {
  const d = withPlan(world()); const a = P.addItem(d, 'mesa-redonda', { x: 20, y: 20 }), b = P.addItem(d, 'mesa-redonda', { x: 21, y: 20 }), c = P.addItem(d, 'mesa-redonda', { x: 23, y: 20 }), e = P.addItem(d, 'mesa-redonda', { x: 0.2, y: 20 });
  const r = C.check(d, { today: '2026-11-10' }), I = ids(r);
  assert.ok(I.includes(`sobrep-${a.id}-${b.id}`)); assert.ok(I.includes(`fora-${e.id}`));
  assert.ok(I.includes(`folga-${b.id}-${c.id}`), 'borda a borda 1,4 m... checar abaixo'.slice(0, 0) || true);
  // b(21) e c(23): centros 2 m, raios 0,8 ⇒ borda a borda 0,4 m < 1,0 m
  assert.ok(r.findings.find(f => f.id === `folga-${b.id}-${c.id}`).detail.includes('0,40'));
  // lugares: 4 mesas × 8 = 32 lugares; 3 convites: confirmado 1 + pendentes 6 ⇒ ok
  assert.ok(I.includes('lugares-ok'));
  for (const o of [a, b, c, e]) P.update(d, o.id, { seats: 1 }); // 4 lugares; 1 confirmado, 6 pendentes
  const r2 = C.check(d, { today: '2026-11-10' }); assert.ok(ids(r2).includes('lugares-pendentes')); assert.ok(!ids(r2).includes('lugares-confirmados'));
  d.guests[2].qty = 9; d.guests[2].adults = 9; const r3 = C.check(d, { today: '2026-11-10' }); assert.ok(ids(r3).includes('lugares-confirmados'));
  P.assign(d, 'g-2', a.id); assert.ok(ids(C.check(d, { today: '2026-11-10' })).includes('estouro-' + a.id));
  assert.ok(ids(r).includes('sem-chuva')); P.addZone(d, 'cobertura', { x: 5, y: 5, w: 10, h: 10 }); assert.ok(!ids(C.check(d, { today: '2026-11-10' })).includes('sem-chuva'));
});
test('cerimonialista: cronograma — conflito, pôr do sol, lugar sumido', () => {
  const d = withPlan(world()); const S = V.schedule;
  S.add(d, { start: '16:00', minutes: 40, title: 'Cerimônia', kind: 'cerimonia' }); S.add(d, { start: '16:30', minutes: 60, title: 'Coquetel' });
  let r = C.check(d, { today: '2026-11-10' }); assert.ok(ids(r).some(i => i.startsWith('dia-sobrep-'))); assert.ok(ids(r).includes('dia-sem-refeicao'));
  assert.ok(!ids(r).includes('dia-escuro')); // 16:40 < pôr do sol ~18:35
  S.update(d, d.v31.dayPlan[0].id, { start: '18:10' }); r = C.check(d, { today: '2026-11-10' }); assert.ok(ids(r).includes('dia-escuro'), 'termina 18:50 > 18:35');
  d.v31.dayPlan[1].where = 'obj-sumiu'; assert.ok(ids(C.check(d, { today: '2026-11-10' })).some(i => i.startsWith('dia-lugar-')));
  assert.throws(() => S.add(d, { start: '25:99', minutes: 5, title: 'x' }), /Horário inválido/); assert.throws(() => S.add(d, { start: '10:00', minutes: 5, title: ' ' }), /nome/);
});
test('cronograma: modelo sugerido parte do horário da cerimônia e analisa lacunas', () => {
  const s = V.schedule.suggest('16:30'); assert.equal(s.find(x => x.title === 'Cerimônia').start, '16:30'); assert.equal(s[0].start, '13:30'); assert.throws(() => V.schedule.suggest('x'), /Informe/);
  const a = V.schedule.analyze([{ id: '1', start: '10:00', minutes: 30, title: 'a' }, { id: '2', start: '13:00', minutes: 10, title: 'b' }, { id: '3', start: '13:05', minutes: 10, title: 'c' }]);
  assert.equal(a.gaps.length, 1); assert.equal(a.gaps[0].minutes, 150); assert.equal(a.overlaps.length, 1);
});
test('cronograma: o modelo sugerido NÃO gera conflitos nem lacunas em nenhum horário de cerimônia', () => {
  for (const t of ['10:00', '16:30', '18:00', '19:30']) { const a = V.schedule.analyze(V.schedule.suggest(t).map((x, i) => ({ ...x, id: 'i' + i }))); assert.equal(a.overlaps.length, 0, t + ' sobreposições: ' + a.overlaps.map(o => o.a.title + '>' + o.b.title)); assert.equal(a.gaps.length, 0, t); }
});
test('cerimonialista: parcelas, RSVP e fornecedores', () => {
  const d = world(); d.settings.date = '2027-11-13'; V.installments.add(d, { budgetId: 'b-foto', label: '1/2', due: '2026-11-01', amount: 100 }); V.installments.add(d, { budgetId: 'b-dj', label: '1/1', due: '2026-11-25', amount: 1800 });
  d.v31.settings.rsvpDeadline = '2026-11-05'; const r = C.check(d, { today: '2026-11-10' }), I = ids(r);
  assert.ok(I.includes('par-vencidas') && I.includes('par-proximas')); assert.ok(I.includes('par-soma-b-foto'), 'foto: 100 de 3000'); assert.ok(!I.includes('par-soma-b-dj'));
  assert.ok(I.includes('rsvp-prazo')); assert.ok(I.includes('rsvp-sem-fone')); assert.ok(!I.includes('forn-abertos'), 'faltam 368 dias: não cobra fornecedor ainda');
  const r2 = C.check(d, { today: '2027-02-01' }); assert.ok(ids(r2).includes('forn-abertos'));
  assert.match(C.narrate(r), /problema\(s\)/); assert.match(C.draftPrompt(r), /SOMENTE os fatos/); assert.doesNotMatch(C.draftPrompt(r), /Fictício|Fictícia/, 'a IA recebe achados, não nomes de convidados');
});
test('exportações: CSV Excel pt-BR, anti-fórmula, telefones opcionais e dossiê escapado', () => {
  const E = V.exports, d = world(); d.guests[0].name = '=HYPERLINK("x")'; d.guests[1].notes = 'tem; ponto e vírgula';
  V.rsvp.meta(d, d.guests[0].id).phone = '14999991234';
  const c1 = E.csvGuests(d); assert.ok(c1.startsWith('﻿')); assert.ok(c1.includes("'=HYPERLINK")); assert.ok(c1.includes('"tem; ponto e vírgula"')); assert.ok(!c1.includes('99999-1234'));
  assert.ok(E.csvGuests(d, { phones: true }).includes('(14) 99999-1234'));
  d.settings.personA = '<b>X</b>'; const html = E.dossier(d, { findings: C.check(d).findings });
  assert.ok(!html.includes('<b>X</b>') && html.includes('&lt;b&gt;X&lt;/b&gt;')); assert.ok(!html.includes('Orçamento')); assert.ok(!html.includes('(14)'));
  assert.ok(E.dossier(d, { finance: true, phones: true }).includes('(14) 99999-1234'));
  V.installments.add(d, { budgetId: 'b-foto', label: '1/1', due: '2026-01-01', amount: 321.5 });
  const fnd = C.check(d, { today: '2026-11-10' }).findings; assert.ok(fnd.some(f => /R\$/.test(f.title)), 'o achado de parcela tem valor');
  assert.doesNotMatch(E.dossier(d, { findings: fnd }), /R\$/, 'sem a opção de valores, nenhum R$ no dossiê (nem nos achados)');
  assert.match(E.dossier(d, { findings: fnd, finance: true }), /R\$/);
  assert.match(E.csvSchedule(d), /Início;Fim/); assert.match(E.csvSeating(d), /Mesa;Lugares/); assert.match(E.csvInstallments(d), /Vencimento;Item/);
});
