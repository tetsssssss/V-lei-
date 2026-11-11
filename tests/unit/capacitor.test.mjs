import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const src = fs.readFileSync(new URL('../../iris/voice/capacitor.js', import.meta.url), 'utf8');
const load = root => { const m = { exports: {} }; new Function('module', 'self', `const globalThis = self; ${src}`)(m, root); return m.exports; };
const mkRoot = (native = true) => {
  const listeners = {}, calls = [], root = { IrisNativeCb: { events: [], onStt(t, p) { root.IrisNativeCb.events.push(['stt', t, p]); }, onTts(i, t, p) { root.IrisNativeCb.events.push(['tts', i, t, p]); }, onPerm(g) { root.IrisNativeCb.events.push(['perm', g]); } }, NossoSim: { toast() {} } };
  root.Capacitor = { isNativePlatform: () => native, Plugins: {
    SpeechRecognition: { checkPermissions: async () => ({ speechRecognition: 'prompt' }), requestPermissions: async () => ({ speechRecognition: 'granted' }), addListener: async (n, f) => { listeners[n] = f; }, start: async o => { calls.push(['start', o]); }, stop: async () => { calls.push(['stop']); listeners.listeningState && listeners.listeningState({ status: 'stopped' }); } },
    TextToSpeech: { isLanguageSupported: async () => ({ supported: true }), speak: async o => { calls.push(['speak', o]); }, stop: async () => { calls.push(['tstop']); } },
    Filesystem: { writeFile: async o => { calls.push(['write', o]); return { uri: 'file:///cache/' + o.path }; } }, Share: { share: async o => { calls.push(['share', o]); } },
  } };
  return { root, listeners, calls };
};
const tick = () => new Promise(r => setTimeout(r, 5));

test('capacitor: fora do app nativo não faz nada (PWA/navegador)', () => { const { root } = mkRoot(false); load(root); assert.equal(root.IrisAndroid, undefined); const r2 = { }; load(r2); assert.equal(r2.IrisAndroid, undefined); });
test('capacitor: expõe a MESMA interface do APK antigo (todos os métodos que native.js usa)', () => {
  const { root } = mkRoot(); load(root); const need = ['version', 'isRecognitionAvailable', 'hasMicPermission', 'requestMicPermission', 'startListening', 'stopListening', 'cancelListening', 'isTtsReady', 'hasPtVoice', 'speak', 'stopSpeaking', 'saveFile'];
  for (const k of need) assert.equal(typeof root.IrisAndroid[k], 'function', k);
  const java = fs.readFileSync(new URL('../../android/src/br/nossosim/iris/MainActivity.java', import.meta.url), 'utf8'); for (const k of need) assert.ok(java.includes(` ${k}(`), 'Java antigo também tem ' + k);
});
test('capacitor: permissão, voz parcial → final, e fim', async () => {
  const { root, calls } = mkRoot(); load(root); const A = root.IrisAndroid, ev = root.IrisNativeCb.events; await tick();
  assert.equal(A.hasMicPermission(), false); A.requestMicPermission(); await tick(); assert.equal(A.hasMicPermission(), true); assert.deepEqual(ev.pop(), ['perm', true]);
  assert.equal(A.hasPtVoice(), true); assert.equal(A.isRecognitionAvailable(), true);
  A.startListening(); await tick(); assert.equal(calls.find(c => c[0] === 'start')[1].language, 'pt-BR'); assert.deepEqual(ev.shift(), ['stt', 'start', '']);
});
test('capacitor: eventos do plugin viram onStt(partial/final/end); cancelar não emite final', async () => {
  const { root, listeners } = mkRoot(); load(root); const A = root.IrisAndroid, ev = root.IrisNativeCb.events; await tick();
  A.startListening(); await tick(); listeners.partialResults({ matches: ['quantos dias'] }); listeners.partialResults({ matches: ['quantos dias faltam'] }); A.stopListening(); await tick();
  assert.deepEqual(ev.filter(e => e[0] === 'stt').map(e => e[1] + ':' + e[2]), ['start:', 'partial:quantos dias', 'partial:quantos dias faltam', 'final:quantos dias faltam', 'end:']);
  ev.length = 0; A.startListening(); await tick(); listeners.partialResults({ matches: ['x'] }); A.cancelListening(); await tick(); assert.ok(!ev.some(e => e[1] === 'final'), 'cancelado não entrega final'); assert.ok(ev.some(e => e[1] === 'end'));
  ev.length = 0; A.startListening(); await tick(); listeners.listeningState({ status: 'stopped' }); assert.deepEqual(ev.filter(e => e[1] === 'error').map(e => e[2]), ['no-speech'], 'silêncio → no-speech');
});
test('capacitor: TTS emite start/done e erro; saveFile grava no cache e abre o compartilhamento', async () => {
  const { root, calls } = mkRoot(); load(root); const A = root.IrisAndroid, ev = root.IrisNativeCb.events; await tick();
  A.speak('t1', 'olá', 1.2, 0.5); await tick(); assert.deepEqual(ev.filter(e => e[0] === 'tts').map(e => e[2]), ['start', 'done']); assert.deepEqual([calls.find(c => c[0] === 'speak')[1].rate, calls.find(c => c[0] === 'speak')[1].lang], [1.2, 'pt-BR']);
  root.Capacitor.Plugins.TextToSpeech.speak = async () => { throw new Error('boom'); }; ev.length = 0; A.speak('t2', 'x', 1, 1); await tick(); assert.deepEqual(ev.filter(e => e[0] === 'tts').map(e => e[2]), ['start', 'error'], 'erro não é seguido de done');
  root.Capacitor.Plugins.TextToSpeech.speak = () => { throw new Error('sync'); }; ev.length = 0; A.speak('t3', 'x', 1, 1); await tick(); assert.deepEqual(ev.filter(e => e[0] === 'tts').map(e => e[2]), ['start', 'error'], 'erro síncrono do plugin também');
  const r = A.saveFile('bk.json', '{}'); await tick(); assert.ok(!r.startsWith('ERRO')); assert.deepEqual(calls.filter(c => c[0] === 'write' || c[0] === 'share').map(c => c[0]), ['write', 'share']); assert.equal(calls.find(c => c[0] === 'write')[1].directory, 'CACHE');
});
