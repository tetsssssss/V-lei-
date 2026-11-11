import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fixtureV2 } from '../e2e/fixture.mjs';
const require = createRequire(import.meta.url);
for (const f of ['data', 'zip', 'geo', 'solar', 'rsvp', 'installments']) require(`../../v31/core/${f}.js`);
const V = globalThis.V31;

test('data.ensure: cria o bloco sem apagar nada e é idempotente', () => {
  const d = fixtureV2(); const before = JSON.stringify({ ...d, v31: undefined });
  const v = V.data.ensure(d); V.data.ensure(d);
  assert.equal(JSON.stringify({ ...d, v31: undefined }), before);
  assert.deepEqual(Object.keys(v).sort(), ['ceriNotes', 'dayPlan', 'guestMeta', 'installments', 'plan', 'settings', 'version']);
  d.v31.plan.objects.push({ id: 'x' }); d.v31.settings.minAisle = 1.4; V.data.ensure(d);
  assert.equal(d.v31.plan.objects.length, 1); assert.equal(d.v31.settings.minAisle, 1.4);
  d.v31 = 'lixo'; assert.equal(V.data.ensure(d).installments.length, 0);
});

test('zip: escreve e lê de volta (acentos, binário)', async () => {
  const bin = new Uint8Array(1000).map((_, i) => (i * 7) % 256);
  const z = V.zip.write([{ name: 'a/ação.json', data: '{"ok":"é"}' }, { name: 'img.bin', data: bin }]);
  const es = V.zip.list(z); assert.equal(es.length, 2);
  assert.equal(await V.zip.readText(z, es[0]), '{"ok":"é"}'); assert.equal(es[0].name, 'a/ação.json');
  assert.deepEqual([...(await V.zip.read(z, es[1]))], [...bin]);
});
test('zip: lê ZIP REAL criado pelo utilitário `zip` do sistema (deflate)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ziptest-')); fs.mkdirSync(path.join(dir, 'sub'));
  const big = 'linha repetida para comprimir\n'.repeat(500); fs.writeFileSync(path.join(dir, 'sub', 'texto.txt'), big);
  execFileSync('zip', ['-r', '-q', path.join(dir, 'x.zip'), 'sub'], { cwd: dir });
  const buf = new Uint8Array(fs.readFileSync(path.join(dir, 'x.zip'))); const es = V.zip.list(buf).filter(e => !e.dir);
  assert.equal(es[0].method, 8); assert.equal(await V.zip.readText(buf, es[0]), big);
});
test('zip: rejeita caminho perigoso, arquivo lixo e dado corrompido', async () => {
  const evil = V.zip.write([{ name: '../fora.txt', data: 'x' }]);
  assert.throws(() => V.zip.list(evil), /perigoso/);
  assert.throws(() => V.zip.list(new Uint8Array(50)), /inválido/);
  const z = V.zip.write([{ name: 'a.txt', data: 'conteudo' }]); z[40] ^= 0xff; // estraga o conteúdo
  await assert.rejects(() => V.zip.read(z, V.zip.list(z)[0]), /danificado/);
});

test('geo: poligonos, sobreposição e distância', () => {
  const a = { x: 0, y: 0, w: 2, h: 2, rot: 0 }, b = { x: 1.5, y: 0, w: 2, h: 2, rot: 0 }, c = { x: 4, y: 0, w: 2, h: 2, rot: 0 };
  assert.ok(Math.abs(V.geo.overlapDepth(V.geo.poly(a), V.geo.poly(b)) - 0.5) < 1e-9);
  assert.equal(V.geo.overlapDepth(V.geo.poly(a), V.geo.poly(c)), 0);
  assert.ok(Math.abs(V.geo.distance(V.geo.poly(a), V.geo.poly(c)) - 2) < 1e-9);
  assert.ok(Math.abs(V.geo.area({ shape: 'circle', w: 2 }) - Math.PI) < 1e-9);
  const r = { x: 0, y: 0, w: 4, h: 1, rot: 90 }, bb = V.geo.bounds(V.geo.poly(r)); assert.ok(Math.abs(bb.maxY - 2) < 1e-9 && Math.abs(bb.maxX - 0.5) < 1e-9);
  assert.ok(V.geo.inside(V.geo.poly(a), 10, 10) === false); // centro em 0,0 => metade fora
  assert.equal(V.geo.pxPerMFrom(300, 30), 10); assert.equal(V.geo.pxPerMFrom(0, 30), null);
  assert.deepEqual(V.geo.baseSize({ kind: 'image', wPx: 1000, hPx: 500, pxPerM: 10 }), { w: 100, h: 50 }); assert.equal(V.geo.baseSize({ kind: 'image', wPx: 1000, hPx: 500 }), null);
});
test('geo: matriz isométrica leva (u,v) da imagem ao mesmo ponto que iso(x,y)', () => {
  const p = 8, [a, b, c, d] = V.geo.isoImageMatrix(p, 10); const u = 80, v = 40; // 10 m, 5 m
  const [ix, iy] = V.geo.iso(u / p, v / p, 0, 10); assert.ok(Math.abs(a * u + c * v - ix) < 1e-9 && Math.abs(b * u + d * v - iy) < 1e-9);
});

test('solar: pôr do sol em Agudos em 13/11/2027 cai na faixa astronômica esperada', () => {
  const t = V.solar.sunTimes('2027-11-13', -22.47, -48.99, -3);
  // Referência independente: São Paulo (lon −46,6) ≈ 18:22 em meados de nov.; Agudos está ~2,4° a oeste (+~10 min) ⇒ ≈ 18:32 (±5)
  assert.ok(t.set > 18 * 60 + 27 && t.set < 18 * 60 + 40, 'set=' + V.data.hhmm(t.set));
  assert.ok(t.rise > 5 * 60 + 15 && t.rise < 5 * 60 + 40, 'rise=' + V.data.hhmm(t.rise));
  const noon = V.solar.elevation('2027-11-13', 12 * 60 + 15, -22.47, -48.99); assert.ok(noon > 75, String(noon));
  assert.ok(V.solar.elevation('2027-11-13', 23 * 60, -22.47, -48.99) < -20);
  assert.equal(V.solar.darkness(30), 0); assert.equal(V.solar.darkness(-30), 1);
  assert.equal(V.solar.sunTimes('2027-06-21', 80, 0, 0), null); // sol da meia-noite
});

test('rsvp: telefone, mensagem, link wa.me e resposta', () => {
  const R = V.rsvp;
  assert.equal(R.normalizePhone('(14) 99999-1234'), '5514999991234'); assert.equal(R.normalizePhone('+55 14 3222-1234'), '551432221234');
  assert.equal(R.normalizePhone('12345'), null); assert.equal(R.normalizePhone(''), null);
  assert.equal(R.formatPhone('14999991234'), '(14) 99999-1234');
  assert.equal(R.firstName('Família Fictícia B'), 'Fictícia'); assert.equal(R.firstName('Convidado Fictício A + Acompanhante'), 'Convidado');
  const d = fixtureV2(); d.v31 = undefined; const g = d.guests[1];
  d.settings.city = 'Chácara Exemplo, Agudos / Bauru - SP';
  const msg = R.message(d, g); assert.match(msg, /Gabriel e Isabelle/); assert.match(msg, /13\/11\/2027/); assert.match(msg, /em breve/); assert.doesNotMatch(msg, /\{/);
  const l = R.link('(14) 99999-1234', msg); assert.ok(l.startsWith('https://wa.me/5514999991234?text=')); assert.equal(decodeURIComponent(l.split('text=')[1]), msg);
  assert.equal(R.link('abc', 'x'), null);
  // resposta: só muda presença quando registrada; valida
  assert.equal(g.attendance, 'Pendente');
  R.recordReply(d, g.id, { status: 'sim', adults: 2, children: 1 }); assert.equal(g.attendance, 'Confirmado'); assert.equal(g.qty, 3); assert.equal(g.children, 1);
  assert.throws(() => R.recordReply(d, g.id, { status: 'sim', adults: 0, children: 0 }), /ao menos 1/); assert.throws(() => R.recordReply(d, 'nao-existe', { status: 'sim' }), /não encontrado/); assert.throws(() => R.recordReply(d, g.id, { status: 'xx' }), /inválida/);
  assert.equal(g.qty, 3);
  R.recordReply(d, g.id, { status: 'nao' }); assert.equal(g.attendance, 'Não irá'); assert.equal(g.qty, 3, 'não apaga a contagem ao recusar');
  R.clearReply(d, g.id); assert.equal(g.attendance, 'Pendente');
  R.meta(d, d.guests[0].id).phone = '14999990000'; R.markSent(d, d.guests[0].id, '2026-11-10T10:00:00Z');
  const s = R.summary(d); assert.equal(s.total, 3); assert.equal(s.withPhone, 1); assert.equal(s.sent, 1); assert.equal(s.awaiting, 1); assert.equal(s.peopleYes, 1);
});

test('parcelas: divisão exata em centavos, pago reflete no item, remoção devolve', () => {
  const I = V.installments; const parts = I.split(1000, 3, '2026-12-31');
  assert.deepEqual(parts.map(p => p.amount), [333.33, 333.33, 333.34]); assert.deepEqual(parts.map(p => p.due), ['2026-12-31', '2027-01-31', '2027-02-28']);
  assert.equal(parts.reduce((a, p) => a + Math.round(p.amount * 100), 0), 100000);
  assert.throws(() => I.split(0, 2, '2026-01-01'), /maior que zero/); assert.throws(() => I.split(10, 2, ''), /1ª parcela/);
  const d = fixtureV2(); const it = I.add(d, { budgetId: 'b-foto', label: '1/2', due: '2026-11-05', amount: 750 }); I.add(d, { budgetId: 'b-foto', label: '2/2', due: '2026-12-05', amount: 1750.5 });
  assert.throws(() => I.add(d, { budgetId: 'nao', due: '2026-01-01', amount: 1 }), /não encontrado/); assert.throws(() => I.add(d, { budgetId: 'b-foto', due: '31/12', amount: 1 }), /inválida/);
  let s = I.summary(d, '2026-11-10'); assert.equal(s.overdue.length, 1); assert.equal(s.soon.length, 1); assert.equal(s.totalOverdue, 750); assert.equal(s.totalOpen, 2500.5);
  I.setPaid(d, it.id, true, '2026-11-10'); I.setPaid(d, it.id, true); assert.equal(d.budget[0].paid, 1250, 'pagar duas vezes não soma duas vezes');
  I.setPaid(d, it.id, false); assert.equal(d.budget[0].paid, 500);
  I.setPaid(d, it.id, true); assert.equal(I.remove(d, it.id), true); assert.equal(d.budget[0].paid, 500, 'remover parcela paga devolve o valor');
  s = I.summary(d, '2026-11-10'); assert.equal(s.perItem[0].planned, 1750.5);
});
