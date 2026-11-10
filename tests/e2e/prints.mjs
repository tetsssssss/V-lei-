// Gera os prints do layout (Chromium, não de aparelho Android). Fictício → --out ; dados reais (se houver seed) → --private-out
import fs from 'node:fs';
import path from 'node:path';
import { startServer, launch, openPage, sleep } from './lib.mjs';
import { fixtureV2, STORAGE_KEY } from './fixture.mjs';
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('--root', '.')), OUT = arg('--out', ''), POUT = arg('--private-out', '');
for (const d of [OUT, POUT]) if (d) fs.mkdirSync(d, { recursive: true });
const srv = await startServer(ROOT); const browser = await launch();
const SPEECHOFF = "window.SpeechSynthesisUtterance=class{};Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],addEventListener(){},removeEventListener(){},cancel(){},speak(u){setTimeout(()=>u.onend&&u.onend(),10)}},configurable:true});";
const prefs = (o) => ({ content: SPEECHOFF + `localStorage.setItem('nosso-sim-iris-v1', JSON.stringify({prefs:Object.assign({introDone:true,speakOn:false,briefingOnOpen:false,reduceMotion:'on'},${JSON.stringify(o)}),consent:{voice:true,externalAI:false,level:0}}))` });
const data = () => { const f = fixtureV2(); f.budget.push({ id: 'b3', title: 'Buffet exemplo', category: 'Buffet', estimate: 12000, paid: 2000 }, { id: 'b4', title: 'Decoração exemplo', category: 'Decoração', estimate: 5000, paid: 0 }, { id: 'bh', title: 'Hipótese exemplo', category: 'Outros', estimate: 300, paid: 0, hypothetical: true }); f.guests.push({ id: 'g4', name: 'Família Exemplo D', group: 'Família', qty: 5, adults: 3, children: 2, side: 'Gabriel', attendance: 'Pendente' }); f.sweetsQty = { 'elizete-1': 250, 'elizete-2': 20 }; f.ideas.push({ id: 'i2', title: 'Ideia 2', category: 'Música', details: '', votes: { a: 'sim', b: 'sim' } }); return f; };
const settle = p => p.waitForFunction(() => ['idle', 'error'].includes(document.querySelector('.iris-orb')?.getAttribute('data-state')), null, { timeout: 8000 }).then(() => sleep(120));
const say = async (p, t) => { await p.fill('#iris-input', t); await p.press('#iris-input', 'Enter'); await sleep(60); await settle(p); await sleep(900); };

async function set(dir, real) {
  const mk = (vp, theme, o = {}) => openPage(browser, srv.url, { storage: real ? undefined : [STORAGE_KEY, JSON.stringify(data())], viewport: vp, init: prefs({ theme, ...o }) });
  const shot = (p, name, o = {}) => p.screenshot({ path: path.join(dir, name + '.png'), ...o });
  for (const [vp, vn] of [[{ width: 1440, height: 1000 }, '1440'], [{ width: 390, height: 844 }, '390']]) for (const theme of ['romantico', 'jarvis']) {
    const { page, context } = await mk(vp, theme); await page.evaluate(() => Iris.app.ns.navigate('central')); await sleep(900); await shot(page, `central-${vn}-${theme}`, { fullPage: true }); await context.close();
  }
  for (const [theme, st] of [['romantico', 'idle'], ['romantico', 'listening'], ['jarvis', 'thinking'], ['jarvis', 'speaking']]) {
    const { page, context } = await mk({ width: 390, height: 844 }, theme); await page.click('.iris-fab'); await settle(page);
    await page.evaluate(([s]) => { const o = document.querySelector('.iris-orb'); o.setAttribute('data-state', s); o.style.setProperty('--lvl', '.6'); document.querySelector('.iris-status').textContent = { idle: 'Toque no microfone para falar', listening: 'Ouvindo…', thinking: 'Pensando…', speaking: 'Falando…' }[s]; document.querySelector('.iris-partial').textContent = s === 'listening' ? '“quanto falta organizar”' : ''; }, [st]);
    await sleep(300); await shot(page, `voz-390-${theme}-${st}`); await context.close();
  }
  { const { page, context } = await mk({ width: 390, height: 844 }, 'romantico'); await page.click('.iris-fab'); await settle(page); await say(page, 'Íris, mostre o saldo'); await shot(page, 'voz-390-painel-orcamento'); await context.close(); }
  { const { page, context } = await mk({ width: 390, height: 844 }, 'romantico'); await page.click('.iris-fab'); await settle(page); await say(page, 'adicione despesa hipotética R$ 300'); await shot(page, 'voz-390-confirmacao'); await context.close(); }
  { const { page, context } = await mk({ width: 390, height: 844 }, 'romantico'); await page.click('.iris-fab'); await settle(page); await say(page, 'Íris, mostra nossos padrinhos e me diga quanto ainda falta organizar'); await shot(page, 'voz-390-espiar-padrinhos'); await context.close(); }
  { const { page, context } = await mk({ width: 1440, height: 900 }, 'jarvis'); await page.click('.iris-fab'); await settle(page); await say(page, 'Íris, quantas crianças estão previstas?'); await shot(page, 'voz-1440-jarvis-painel-convidados'); await context.close(); }
  { const { page, context } = await mk({ width: 1440, height: 900 }, 'romantico'); await page.click('.iris-fab'); await settle(page); await say(page, 'Íris, mostre o saldo'); await shot(page, 'voz-1440-romantico-painel-orcamento'); await context.close(); }
  // folha com os 9 estados do orbe, nos dois temas
  for (const theme of ['romantico', 'jarvis']) {
    const { page, context } = await mk({ width: 900, height: 560 }, theme);
    await page.evaluate(([th]) => { const st = ['idle', 'permission', 'listening', 'transcribing', 'thinking', 'acting', 'speaking', 'offline', 'error']; const wrap = document.createElement('div'); wrap.id = 'iris-root'; wrap.setAttribute('data-iris-theme', th); wrap.style.cssText = 'position:fixed;inset:0;z-index:999;background:var(--i-bg);display:grid;grid-template-columns:repeat(5,1fr);gap:14px 8px;padding:22px;align-content:start;font:13px var(--i-sans);color:var(--i-ink)'; st.forEach(s => { const c = document.createElement('div'); c.style.cssText = 'display:grid;justify-items:center;gap:10px'; const o = Iris.orb.create(); o.el.style.setProperty('--size', '120px'); o.el.style.setProperty('--lvl', '.6'); o.setState(s); const l = document.createElement('div'); l.textContent = s; c.append(o.el, l); wrap.append(c); }); document.body.append(wrap); }, [theme]);
    await sleep(400); await shot(page, `orbe-estados-${theme}`); await context.close();
  }
}
if (OUT) await set(OUT, false);
if (POUT) await set(POUT, true);
await browser.close(); await srv.close(); console.log('prints ok', OUT, POUT);
