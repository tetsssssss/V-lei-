#!/usr/bin/env node
// Ajusta o projeto Android gerado pelo `cap add android` (idempotente):
//  - permissões de voz (microfone) e consulta ao serviço de reconhecimento (Android 11+)
//  - sem backup automático do Android (os dados do casal não vão para a nuvem do Google sem querer)
//  - ícone do app a partir de ../icons (sem ícone adaptativo)
//  - versão (VERSION_CODE / VERSION_NAME vindos do CI)
import fs from 'node:fs';
import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname), CAP = path.resolve(HERE, '..'), ROOT = path.resolve(CAP, '..');
const app = path.join(CAP, 'android/app'), main = path.join(app, 'src/main');
const manifestPath = path.join(main, 'AndroidManifest.xml');
if (!fs.existsSync(manifestPath)) { console.error('Rode `npx cap add android` antes.'); process.exit(1); }

let m = fs.readFileSync(manifestPath, 'utf8');
m = m.replace('android:allowBackup="true"', 'android:allowBackup="false"');
const perms = ['android.permission.RECORD_AUDIO', 'android.permission.MODIFY_AUDIO_SETTINGS'];
for (const p of perms) if (!m.includes(`"${p}"`)) m = m.replace('</manifest>', `    <uses-permission android:name="${p}" />\n</manifest>`);
if (!m.includes('android.speech.RecognitionService')) m = m.replace('</manifest>', `    <queries>\n        <intent>\n            <action android:name="android.speech.RecognitionService" />\n        </intent>\n    </queries>\n</manifest>`);
fs.writeFileSync(manifestPath, m);

// ícone: remove o adaptativo (que recortaria a arte) e usa PNG legado em todas as densidades
const res = path.join(main, 'res');
fs.rmSync(path.join(res, 'mipmap-anydpi-v26'), { recursive: true, force: true });
const icon = fs.readFileSync(path.join(ROOT, 'icons/icon-192.png'));
for (const d of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) { const dir = path.join(res, `mipmap-${d}`); fs.mkdirSync(dir, { recursive: true }); for (const f of ['ic_launcher.png', 'ic_launcher_round.png']) fs.writeFileSync(path.join(dir, f), icon); fs.rmSync(path.join(dir, 'ic_launcher_foreground.png'), { force: true }); }

// versão
const gradle = path.join(app, 'build.gradle'); let g = fs.readFileSync(gradle, 'utf8');
const code = Number(process.env.VERSION_CODE || 1), name = process.env.VERSION_NAME || '3.1.0';
g = g.replace(/versionCode\s+\d+/, `versionCode ${code}`).replace(/versionName\s+"[^"]*"/, `versionName "${name}"`);
fs.writeFileSync(gradle, g);
console.log(`✔ Android ajustado (versionCode ${code}, versionName ${name}).`);
