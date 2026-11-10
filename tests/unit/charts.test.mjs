import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const C = require('../../iris/ui/charts.js');

test('rosca: ângulos somam 360, ordem preservada e fatias zeradas omitidas', () => {
  const m = C.donutModel([{ label: 'a', value: 3 }, { label: 'b', value: 0 }, { label: 'c', value: 1 }]);
  assert.equal(m.slices.length, 2);
  assert.equal(m.total, 4);
  assert.equal(m.slices[0].start, 0);
  assert.ok(Math.abs(m.slices.at(-1).end - 360) < 1e-9);
  assert.ok(Math.abs(m.slices[0].pct - 75) < 1e-9);
});
test('rosca sem dados: total 0, nenhuma fatia (não divide por zero)', () => {
  const m = C.donutModel([{ label: 'a', value: 0 }]);
  assert.deepEqual([m.total, m.slices.length], [0, 0]);
});
test('anel: limita 0–100 e tolera total 0', () => {
  assert.equal(C.ringModel(1, 3).pct.toFixed(2), '33.33');
  assert.equal(C.ringModel(5, 3).pct, 100);
  assert.equal(C.ringModel(1, 0).pct, 0);
});
test('medidor: sem teto não inventa saldo; acima do limite de segurança é sinalizado', () => {
  assert.deepEqual(C.gaugeModel(4800, 0), { state: 'sem-teto', pct: 0, over: false });
  const ok = C.gaugeModel(4800, 50000, 5000); assert.equal(ok.over, false); assert.ok(Math.abs(ok.pct - 9.6) < 1e-9);
  assert.equal(C.gaugeModel(48000, 50000, 5000).over, true);
});
test('linha do tempo: semanas restantes e marcos vencidos', () => {
  const day = 86400000, now = Date.UTC(2026, 10, 10), end = now + 368 * day;
  const m = C.timelineModel(now, end, [{ label: 'x', ms: now - day }, { label: 'y', ms: now + 184 * day }]);
  assert.equal(m.weeksLeft, Math.ceil(368 / 7));
  assert.equal(m.marks[0].past, true); assert.equal(m.marks[0].pos, 0);
  assert.ok(Math.abs(m.marks[1].pos - 50) < 0.5);
});
test('pipeline de fornecedores conta por etapa', () => {
  const p = C.pipelineModel([{ status: 'Pesquisando' }, { status: 'Pesquisando' }, { status: 'Fechado' }]);
  assert.deepEqual(p.map(x => x.count), [2, 0, 0, 1, 0]);
});
test('R$ compacto cabe no centro do gráfico', () => {
  assert.equal(C.compactBRL(21800), 'R$ 21,8 mil');
  assert.equal(C.compactBRL(1200000), 'R$ 1,2 mi');
  assert.match(C.compactBRL(950), /^R\$ 950$/);
});

// ---------- contraste WCAG dos dois temas (lê os tokens reais do themes.css) ----------
const css = fs.readFileSync(new URL('../../iris/themes.css', import.meta.url), 'utf8');
const block = name => { const i = css.indexOf(name); return css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i)); };
const tokens = txt => Object.fromEntries([...txt.matchAll(/--i-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map(m => [m[1], m[2]]));
const lum = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)); return .2126 * r + .7152 * g + .0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
const THEMES = { romantico: { ...tokens(block('#iris-root, .iris-central, .iris-fab {')) }, };
THEMES.jarvis = { ...THEMES.romantico, ...tokens(block('#iris-root[data-iris-theme="jarvis"]')) };
for (const [name, t] of Object.entries(THEMES)) {
  test(`contraste (${name}): texto ≥ 4.5:1 e componentes/gráficos ≥ 3:1`, () => {
    const text = [['ink', 'bg'], ['ink', 'surface'], ['muted', 'bg'], ['muted', 'surface'], ['accent-ink', 'accent'], ['accent', 'surface'], ['ink', 'you']];
    for (const [fg, bg] of text) assert.ok(ratio(t[fg], t[bg]) >= 4.5, `${name}: ${fg} sobre ${bg} = ${ratio(t[fg], t[bg]).toFixed(2)}`);
    const graphics = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'ok', 'warn', 'danger'];
    for (const g of graphics) assert.ok(ratio(t[g], t.surface) >= 3, `${name}: ${g} sobre surface = ${ratio(t[g], t.surface).toFixed(2)}`);
  });
}
