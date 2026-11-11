/* V3.1 · kit.js — DOM seguro, imagens locais (IndexedDB), salvar/abrir arquivos e pacote ZIP (exportar/importar).
   Tudo roda NO APARELHO. Nada sai para a internet. */
(function () {
  'use strict';
  const V = window.V31 = window.V31 || {};
  const NS = 'http://www.w3.org/2000/svg';
  /** h('div',{class:'x',onclick:fn},'texto',filho). Texto SEMPRE vira nó de texto (nunca HTML). */
  function mk(ns, tag, attrs, kids) {
    const el = ns ? document.createElementNS(NS, tag) : document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.setAttribute('class', v);
      else if (k === 'text') el.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'value') el.value = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
    for (const kid of kids.flat(Infinity)) { if (kid === null || kid === undefined || kid === false) continue; el.append(kid.nodeType ? kid : document.createTextNode(String(kid))); }
    return el;
  }
  const h = (tag, attrs, ...kids) => mk(false, tag, attrs, kids);
  const s = (tag, attrs, ...kids) => mk(true, tag, attrs, kids);
  const clear = el => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  // ---------- imagens locais (print do Google etc.) ----------
  const DB = 'nosso-sim-v31', STORE = 'files';
  const openDb = () => new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('Este navegador não permite guardar imagens aqui.'));
    const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'key' });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error || new Error('Armazenamento de imagens indisponível.'));
  });
  async function idb(mode, fn) { const db = await openDb(); return new Promise((res, rej) => { const tx = db.transaction(STORE, mode); const rq = fn(tx.objectStore(STORE)); tx.oncomplete = () => { db.close(); res(rq && rq.result); }; tx.onerror = () => { db.close(); rej(tx.error); }; }); }
  const files = { put: (key, blob, name) => idb('readwrite', st => st.put({ key, blob, name: name || key, at: Date.now() })), get: key => idb('readonly', st => st.get(key)), del: key => idb('readwrite', st => st.delete(key)) };

  // ---------- salvar / abrir ----------
  const b64 = async blob => { const buf = new Uint8Array(await blob.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return btoa(bin); };
  /** Salva/compartilha um arquivo. Ordem: APK antigo (IrisAndroid) → Capacitor (Filesystem+Share) → download do navegador. Devolve texto para mostrar. */
  async function saveFile(name, blob) {
    const cap = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() ? window.Capacitor.Plugins : null;
    if (cap && cap.Filesystem && cap.Share) {
      const w = await cap.Filesystem.writeFile({ path: name, data: await b64(blob), directory: 'CACHE' });
      await cap.Share.share({ title: name, url: w.uri, dialogTitle: 'Salvar ou enviar' }); return 'Escolha onde salvar/enviar.';
    }
    if (window.IrisAndroid && window.IrisAndroid.saveFile && blob.type.startsWith('text/')) { const r = String(window.IrisAndroid.saveFile(name, await blob.text())); if (r.indexOf('ERRO:') === 0) throw new Error(r.slice(5).trim()); return 'Salvo em ' + r; }
    const a = h('a', { href: URL.createObjectURL(blob), download: name, rel: 'noopener' }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); return 'Arquivo baixado: ' + name;
  }
  const pickFile = accept => new Promise(res => { const i = h('input', { type: 'file', accept: accept || '', style: { display: 'none' } }); i.addEventListener('change', () => { res(i.files && i.files[0] || null); i.remove(); }); document.body.append(i); i.click(); });
  const toast = (msg, bad) => { try { window.NossoSim.toast(msg, !!bad); } catch (_) { console.log(msg); } };

  /** Imagem → { blob, w, h } (reduz o lado maior a 2600 px para caber no aparelho; a escala em metros vem da calibração, não do tamanho). */
  async function prepareImage(file, max = 2600) {
    if (!/^image\//.test(file.type)) throw new Error('Escolha um arquivo de imagem (PNG/JPG).');
    if (file.size > 25 * 1024 * 1024) throw new Error('Imagem grande demais (limite 25 MB).');
    const bmp = await createImageBitmap(file); const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (k === 1 && /^image\/(png|jpeg)$/.test(file.type)) return { blob: file, w: bmp.width, h: bmp.height };
    const c = h('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9)); return { blob, w: c.width, h: c.height };
  }

  // ---------- pacote ZIP do aparelho ----------
  const PHOTO_DB = 'nosso-sim-fotos', PHOTO_STORE = 'fotos';
  const allPhotos = () => new Promise(res => { if (!window.indexedDB) return res([]); const r = indexedDB.open(PHOTO_DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(PHOTO_STORE, { keyPath: 'key' }); r.onerror = () => res([]); r.onsuccess = () => { const db = r.result, q = db.transaction(PHOTO_STORE).objectStore(PHOTO_STORE).getAll(); q.onsuccess = () => { db.close(); res(q.result || []); }; q.onerror = () => { db.close(); res([]); }; }; });
  const putPhoto = rec => new Promise((res, rej) => { const r = indexedDB.open(PHOTO_DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(PHOTO_STORE, { keyPath: 'key' }); r.onerror = () => rej(r.error); r.onsuccess = () => { const db = r.result, tx = db.transaction(PHOTO_STORE, 'readwrite'); tx.objectStore(PHOTO_STORE).put(rec); tx.oncomplete = () => { db.close(); res(); }; tx.onerror = () => { db.close(); rej(tx.error); }; }; });
  const extOf = b => (/png/.test(b.type) ? 'png' : /webp/.test(b.type) ? 'webp' : 'jpg');
  const u8 = async blob => new Uint8Array(await blob.arrayBuffer());

  async function exportPackage(ns, { photos = true } = {}) {
    const d = ns.getData(), fl = [], man = { app: 'nosso-sim', format: 'pacote-v31', created: new Date().toISOString(), files: [] };
    fl.push({ name: 'nosso-sim-backup.json', data: JSON.stringify(d, null, 2) });
    const base = d.v31 && d.v31.plan && d.v31.plan.base;
    if (base && base.kind === 'image') { const rec = await files.get(base.key).catch(() => null); if (rec) { const p = `planta/print.${extOf(rec.blob)}`; fl.push({ name: p, data: await u8(rec.blob) }); man.files.push({ path: p, kind: 'plan', key: base.key, type: rec.blob.type }); } }
    if (photos) for (const rec of await allPhotos()) { if (!rec.blob) continue; const p = `fotos/${rec.key}.${extOf(rec.blob)}`; fl.push({ name: p, data: await u8(rec.blob) }); man.files.push({ path: p, kind: 'photo', key: rec.key, type: rec.blob.type }); }
    fl.push({ name: 'manifest.json', data: JSON.stringify(man, null, 1) });
    return new Blob([V.zip.write(fl)], { type: 'application/zip' });
  }
  const seedFrom = text => { const i = text.indexOf('NS_SEED'); const a = text.indexOf('{', i), b = text.lastIndexOf('}'); if (i < 0 || a < 0 || b < a) return null; try { return JSON.parse(text.slice(a, b + 1)); } catch (_) { return null; } }; // JSON.parse, NUNCA eval

  /** Lê o ZIP e devolve o que há nele, SEM aplicar (para confirmar com o usuário). */
  async function inspectPackage(file) {
    if (file.size > 400 * 1024 * 1024) throw new Error('Arquivo grande demais.');
    const buf = new Uint8Array(await file.arrayBuffer()), entries = V.zip.list(buf).filter(e => !e.dir), by = n => entries.find(e => e.name === n);
    const out = { buf, entries, backup: null, seed: null, manifest: null, plan: null, photos: [], notes: [] };
    const mf = by('manifest.json'); if (mf) { try { const m = JSON.parse(await V.zip.readText(buf, mf)); if (m && m.app === 'nosso-sim') out.manifest = m; } catch (_) {} }
    const bk = entries.filter(e => /(^|\/)nosso-sim-backup[^/]*\.json$/.test(e.name)).sort((a, b) => a.name.localeCompare(b.name)).pop();
    if (bk) { try { out.backup = JSON.parse(await V.zip.readText(buf, bk)); out.backupName = bk.name; } catch (_) { out.notes.push('O backup JSON do ZIP está ilegível.'); } }
    const sd = by('seed/seed-casal.js'); if (sd && !out.backup) { out.seed = seedFrom(await V.zip.readText(buf, sd)); if (!out.seed) out.notes.push('seed-casal.js não pôde ser lido.'); }
    if (out.manifest) { for (const f of out.manifest.files || []) { const e = by(f.path); if (!e) continue; if (f.kind === 'plan') out.plan = { entry: e, key: f.key, type: f.type }; else if (f.kind === 'photo') out.photos.push({ entry: e, key: f.key, type: f.type }); } }
    if (!out.backup && !out.seed) throw new Error('Não encontrei dados do Nosso Sim neste ZIP (esperava nosso-sim-backup.json ou seed/seed-casal.js).');
    return out;
  }
  const mime = n => (/\.png$/i.test(n) ? 'image/png' : /\.webp$/i.test(n) ? 'image/webp' : 'image/jpeg');
  /** Aplica o que foi inspecionado. Devolve texto-resumo. */
  async function applyPackage(ns, pk) {
    let msg = [];
    if (pk.backup) { ns.replaceData(pk.backup); msg.push('dados do backup'); }
    else {
      const d = JSON.parse(JSON.stringify(ns.getData())), sd = pk.seed || {};
      if (Array.isArray(sd.guests)) d.guests = sd.guests; if (Array.isArray(sd.couples)) d.couples = sd.couples;
      if (sd.settings && sd.settings.message) d.settings.message = sd.settings.message;
      d.padrinhoFotos = (sd.photoLinks || []).map((p, i) => ({ id: 'pf-' + (i + 1), coupleId: p.coupleId, label: p.label, src: p.photo, status: p.status, note: p.note || '', crop: { x: 50, y: 62, zoom: 1.18 } }));
      d.nameEquivalences = sd.nameEquivalences || []; d.sourceNotes = sd.sourceNotes || [];
      ns.replaceData(d); msg.push(`dados do seed (${(sd.guests || []).length} convites)`);
    }
    if (pk.plan) { const bytes = await V.zip.read(pk.buf, pk.plan.entry); await files.put(pk.plan.key, new Blob([bytes], { type: pk.plan.type || mime(pk.plan.entry.name) }), 'print'); msg.push('print da planta'); }
    let np = 0;
    for (const p of pk.photos) { const bytes = await V.zip.read(pk.buf, p.entry); await putPhoto({ key: p.key, blob: new Blob([bytes], { type: p.type || mime(p.entry.name) }), name: p.key, at: Date.now() }); np++; }
    if (np) msg.push(`${np} foto(s)`);
    // seed antigo (zip "privado completo"): fotos de padrinhos pelos caminhos assets/padrinhos/*
    if (!pk.manifest) { const d = ns.getData(); let moved = 0; for (const l of d.padrinhoFotos || []) { const e = l.src && !l.src.startsWith('local:') ? pk.entries.find(x => x.name === l.src) : null; if (!e) continue; const key = 'zip-' + V.zip.crc32(new TextEncoder().encode(e.name)).toString(36); await putPhoto({ key, blob: new Blob([await V.zip.read(pk.buf, e)], { type: mime(e.name) }), name: e.name, at: Date.now() }); l.src = 'local:' + key; moved++; } if (moved) { ns.save(); ns.render(); msg.push(`${moved} foto(s) de padrinhos`); } }
    return 'Importado: ' + msg.join(', ') + '.';
  }
  V.kit = { h, s, clear, files, saveFile, pickFile, toast, prepareImage, exportPackage, inspectPackage, applyPackage };
})();
