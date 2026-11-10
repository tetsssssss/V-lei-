#!/usr/bin/env node
// Gera o APK do Nosso Sim + Íris SEM Android SDK completo: aapt + javac + dx + zipalign + apksigner (pacotes do Ubuntu).
//   node scripts/build-apk.mjs --variant public|private --out <pasta> [--keystore <pasta>] [--api https://backend.exemplo]
//  public  = sem dados pessoais (abre vazio; importe o backup JSON)      package br.nossosim.iris.publico
//  private = com seed/fotos reais, SÓ para vocês (nunca publicar)        package br.nossosim.iris
// ATENÇÃO: o APK é construído e verificado estruturalmente aqui, mas NÃO pôde ser executado (sem emulador/aparelho).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const VARIANT = arg('--variant', 'public'); if (!['public', 'private'].includes(VARIANT)) throw new Error('--variant public|private');
const OUT = path.resolve(arg('--out', path.join(ROOT, 'dist')));
const KSDIR = path.resolve(arg('--keystore', OUT));
const API = arg('--api', '');
const VERSION = { code: 1, name: '3.0.0' };

const SDK = '/usr/lib/android-sdk', BT = `${SDK}/build-tools/debian`;
const ANDROID_JAR = `${SDK}/platforms/android-23/android.jar`, FRAMEWORK = '/usr/share/android-framework-res/framework-res.apk';
const run = (cmd, args, o = {}) => { const r = execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, ...o }); return r; };
const rm = p => fs.rmSync(p, { recursive: true, force: true }), mk = p => fs.mkdirSync(p, { recursive: true });
for (const f of [ANDROID_JAR, FRAMEWORK, `${BT}/dx`, '/usr/bin/aapt', '/usr/bin/apksigner', '/usr/bin/zipalign']) if (!fs.existsSync(f)) throw new Error(`ferramenta ausente: ${f} (apt install aapt apksigner dalvik-exchange libandroid-23-java android-framework-res zipalign)`);

const PKG = VARIANT === 'private' ? 'br.nossosim.iris' : 'br.nossosim.iris.publico';
const APPNAME = VARIANT === 'private' ? 'Nosso Sim · Íris' : 'Nosso Sim Íris (público)';
const WORK = path.join(OUT, `apk-${VARIANT}`); rm(WORK); mk(WORK);
mk(OUT); mk(KSDIR);

// 1) arquivos web (reaproveita o frontend público já com CSP) ------------------------------------
const stageRoot = path.join(OUT, '_stage'); 
run('node', [path.join(ROOT, 'scripts/build-packages.mjs'), OUT, '--stage-only']);
const www = path.join(WORK, 'assets/www'); mk(path.dirname(www)); fs.cpSync(path.join(stageRoot, 'frontend'), www, { recursive: true });
for (const f of ['_headers', 'LEIA-ME.txt']) rm(path.join(www, f));
if (VARIANT === 'private') {
  for (const [from, to] of [['seed/seed-casal.js', 'seed/seed-casal.js'], ['assets/casal', 'assets/casal'], ['assets/padrinhos', 'assets/padrinhos']]) { const src = path.join(ROOT, from); if (fs.existsSync(src)) { mk(path.dirname(path.join(www, to))); fs.cpSync(src, path.join(www, to), { recursive: true }); } }
}
if (API) { // backend opcional: libera a origem na CSP e informa o endpoint
  const u = new URL(API); let html = fs.readFileSync(path.join(www, 'index.html'), 'utf8');
  html = html.replace("connect-src 'self'", `connect-src 'self' ${u.origin}`).replace('<meta name="referrer" content="no-referrer">', `<meta name="referrer" content="no-referrer">\n  <meta name="iris-api" content="${u.origin}/api/iris">`);
  fs.writeFileSync(path.join(www, 'index.html'), html);
}

// 2) manifest, recursos e ícones ----------------------------------------------------------------
const fill = s => s.replaceAll('__PACKAGE__', PKG).replaceAll('__VERSION_CODE__', String(VERSION.code)).replaceAll('__VERSION_NAME__', VERSION.name).replaceAll('__APP_NAME__', APPNAME);
fs.writeFileSync(path.join(WORK, 'AndroidManifest.xml'), fill(fs.readFileSync(path.join(ROOT, 'android/AndroidManifest.xml'), 'utf8')));
fs.cpSync(path.join(ROOT, 'android/res'), path.join(WORK, 'res'), { recursive: true });
for (const f of ['values/strings.xml', 'xml/shortcuts.xml']) fs.writeFileSync(path.join(WORK, 'res', f), fill(fs.readFileSync(path.join(WORK, 'res', f), 'utf8')));
for (const d of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) { mk(path.join(WORK, `res/mipmap-${d}`)); fs.copyFileSync(path.join(ROOT, 'icons/icon-192.png'), path.join(WORK, `res/mipmap-${d}/ic_launcher.png`)); }

// 3) aapt: manifest + recursos + assets → APK sem classes ----------------------------------------
const unsigned = path.join(WORK, 'app.unsigned.apk');
run('aapt', ['package', '-f', '-M', path.join(WORK, 'AndroidManifest.xml'), '-S', path.join(WORK, 'res'), '-A', path.join(WORK, 'assets'), '-I', FRAMEWORK, '-F', unsigned, '--min-sdk-version', '24', '--target-sdk-version', '34', '--version-code', String(VERSION.code), '--version-name', VERSION.name]);

// 4) Java → classes → dex ------------------------------------------------------------------------
const classes = path.join(WORK, 'classes'); mk(classes);
run('javac', ['--release', '8', '-Xlint:-options', '-cp', ANDROID_JAR, '-d', classes, path.join(ROOT, 'android/src/br/nossosim/iris/MainActivity.java')]);
run(`${BT}/dx`, ['--dex', '--min-sdk-version=24', `--output=${path.join(WORK, 'classes.dex')}`, classes]);
run('aapt', ['add', unsigned, 'classes.dex'], { cwd: WORK });

// 5) alinhar e assinar ---------------------------------------------------------------------------
const ks = path.join(KSDIR, 'nosso-sim-chave-de-assinatura.keystore'), pwf = path.join(KSDIR, 'chave-senha.txt');
if (!fs.existsSync(ks)) {
  const pw = crypto.randomBytes(18).toString('base64url');
  run('keytool', ['-genkeypair', '-keystore', ks, '-alias', 'nossosim', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000', '-storepass', pw, '-keypass', pw, '-dname', 'CN=Nosso Sim Iris, O=Gabriel e Isabelle, C=BR']);
  fs.writeFileSync(pwf, pw + '\n'); fs.chmodSync(pwf, 0o600); fs.chmodSync(ks, 0o600);
}
const pw = fs.readFileSync(pwf, 'utf8').trim();
const aligned = path.join(WORK, 'app.aligned.apk'); run('zipalign', ['-p', '-f', '4', unsigned, aligned]);
const final = path.join(OUT, `NossoSim-Iris-v${VERSION.name}-${VARIANT === 'private' ? 'PRIVADO' : 'PUBLICO'}.apk`);
run('apksigner', ['sign', '--ks', ks, '--ks-key-alias', 'nossosim', '--ks-pass', `pass:${pw}`, '--key-pass', `pass:${pw}`, '--out', final, aligned]);

// 6) verificação estrutural ----------------------------------------------------------------------
const ver = run('apksigner', ['verify', '--verbose', '--print-certs', final]);
const badging = run('aapt', ['dump', 'badging', final]);
const list = run('unzip', ['-Z1', final]).split('\n');
const must = ['classes.dex', 'resources.arsc', 'AndroidManifest.xml', 'assets/www/index.html', 'assets/www/iris/boot.js', 'assets/www/iris/voice/native.js'];
const missing = must.filter(m => !list.includes(m));
const get = rx => (badging.match(rx) || [])[1];
const sums = crypto.createHash('sha256').update(fs.readFileSync(final)).digest('hex');
const problems = [];
if (!/Verifies/.test(ver)) problems.push('assinatura não verifica');
if (missing.length) problems.push('faltam no APK: ' + missing.join(', '));
if (get(/package: name='([^']+)'/) !== PKG) problems.push('package inesperado');
if (get(/sdkVersion:'(\d+)'/) !== '24' || get(/targetSdkVersion:'(\d+)'/) !== '34') problems.push('min/target SDK inesperados');
for (const perm of ['android.permission.RECORD_AUDIO', 'android.permission.INTERNET']) if (!badging.includes(perm)) problems.push('permissão ausente ' + perm);
const extra = [...badging.matchAll(/uses-permission: name='([^']+)'/g)].map(m => m[1]).filter(p => !['android.permission.RECORD_AUDIO', 'android.permission.INTERNET'].includes(p));
if (extra.length) problems.push('permissões inesperadas: ' + extra.join(', '));
if (VARIANT === 'public') { try { run('node', [path.join(ROOT, 'scripts/leak-scan.mjs'), final]); } catch (e) { problems.push('LEAK-SCAN reprovou o APK público:\n' + e.stderr + e.stdout); } }
console.log(`${path.basename(final)}  ${(fs.statSync(final).size / 1024).toFixed(0)} KB  sha256 ${sums.slice(0, 16)}…  ${PKG}  v${VERSION.name}`);
console.log(ver.split('\n').filter(l => /Verifies|Number of signers|SHA-256 digest/.test(l)).join('\n'));
if (problems.length) { console.error('✘ APK REPROVADO:\n - ' + problems.join('\n - ')); process.exit(1); }
console.log('✔ APK aprovado na verificação estrutural (assinatura, manifest, permissões, conteúdo' + (VARIANT === 'public' ? ', scan anti-vazamento' : '') + '). NÃO foi executado em aparelho.');
fs.writeFileSync(path.join(OUT, `${path.basename(final)}.sha256`), `${sums}  ${path.basename(final)}\n`);
