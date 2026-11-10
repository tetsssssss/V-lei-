/* Íris · padrinhos-fotos.js — fotos dos padrinhos: vincular, trocar, remover e enquadrar. Sem reconhecimento facial.
   PRIVACIDADE: imagens importadas ficam só neste aparelho (IndexedDB); nunca vão a backend/LLM/analytics nem ao backup JSON
   (o backup leva só vínculo, legenda e enquadramento). Fotos de pacote privado (assets/padrinhos/) nunca entram no git nem no deploy. */
(function () {
  'use strict';
  const Iris = window.Iris; if (!Iris || !Iris.dom) return;
  const { h } = Iris.dom;
  const doc = document;
  const DB = 'nosso-sim-fotos', STORE = 'fotos', MAX = 900;
  let ns = null, ctx = null;
  const urlCache = new Map();

  // ---------- IndexedDB (falha com elegância se indisponível) ----------
  const openDb = () => new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('Este navegador não permite guardar fotos aqui.'));
    const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'key' });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error || new Error('Não consegui abrir o armazenamento de fotos.'));
  });
  async function idb(mode, fn) {
    const db = await openDb();
    return new Promise((res, rej) => { const tx = db.transaction(STORE, mode); const rq = fn(tx.objectStore(STORE)); tx.oncomplete = () => { db.close(); res(rq && rq.result); }; tx.onerror = () => { db.close(); rej(tx.error); }; });
  }
  const putPhoto = rec => idb('readwrite', s => s.put(rec));
  const getPhoto = key => idb('readonly', s => s.get(key));
  const delPhoto = key => idb('readwrite', s => s.delete(key));

  async function resolveSrc(link) {
    if (!link.src) return null;
    if (!link.src.startsWith('local:')) return link.src; // caminho do pacote privado
    const key = link.src.slice(6);
    if (urlCache.has(key)) return urlCache.get(key);
    try { const rec = await getPhoto(key); if (!rec) return null; const u = URL.createObjectURL(rec.blob); urlCache.set(key, u); return u; } catch (_) { return null; }
  }

  // ---------- importação: reduz, corrige orientação, tira faixas escuras de captura de tela ----------
  async function prepareImage(file) {
    if (!/^image\//.test(file.type)) throw new Error('Escolha um arquivo de imagem.');
    if (file.size > 15 * 1024 * 1024) throw new Error('Imagem grande demais (limite 15 MB).');
    const bmp = await createImageBitmap(file); // respeita a orientação EXIF
    const probe = doc.createElement('canvas'); const pw = 48, ph = Math.max(8, Math.round(48 * bmp.height / bmp.width));
    probe.width = pw; probe.height = ph; const pctx = probe.getContext('2d', { willReadFrequently: true }); pctx.drawImage(bmp, 0, 0, pw, ph);
    const px = pctx.getImageData(0, 0, pw, ph).data;
    const rowStat = y => { let s = 0, s2 = 0; for (let x = 0; x < pw; x++) { const i = (y * pw + x) * 4, l = .299 * px[i] + .587 * px[i + 1] + .114 * px[i + 2]; s += l; s2 += l * l; } const m = s / pw; return { m, sd: Math.sqrt(Math.max(0, s2 / pw - m * m)) }; };
    const dark = y => { const r = rowStat(y); return r.m < 45 && r.sd < 40; };
    let top = 0, bottom = 0; const limit = Math.floor(ph * .2);
    while (top < limit && dark(top)) top++;
    while (bottom < limit && dark(ph - 1 - bottom)) bottom++;
    const sy = Math.round(top / ph * bmp.height), sh = Math.round((ph - top - bottom) / ph * bmp.height);
    const scale = Math.min(1, MAX / Math.max(bmp.width, sh));
    const c = doc.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * scale)); c.height = Math.max(1, Math.round(sh * scale));
    c.getContext('2d').drawImage(bmp, 0, sy, bmp.width, sh, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .86));
    return { blob, trimmed: top > 0 || bottom > 0 };
  }

  // ---------- helpers de UI ----------
  const cropStyle = c => { const k = c || { x: 50, y: 38, zoom: 1 }; return `object-position:${k.x}% ${k.y}%;transform:scale(${k.zoom});transform-origin:${k.x}% ${k.y}%`; };
  const STATUS = { exato: ['Nomes idênticos', 'green'], sugerido: ['Revisar vínculo', 'amber'], revisado: ['Vínculo revisado', 'green'] };
  const toast = (m, e) => ns.toast(m, e);
  const modal = node => { const r = doc.getElementById('modal-root'); r.replaceChildren(h('div', { class: 'overlay', id: 'app-overlay' }, node)); };
  const closeModal = () => { doc.getElementById('modal-root').replaceChildren(); };
  const dialog = (...kids) => h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true' }, h('button', { class: 'btn small secondary close', 'data-action': 'close', 'aria-label': 'Fechar' }, '✕'), ...kids);
  const runTool = (name, args) => ctx.engine.runTool(name, args, { skipConfirm: true, via: 'toque' });
  const coupleOf = id => ns.getData().couples.find(c => c.id === id);

  function frame(link, { size = 'sm' } = {}) {
    const img = h('img', { class: 'pf-img', alt: `Foto atribuída por vocês: ${link.label}`, loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer', style: undefined });
    img.setAttribute('style', cropStyle(link.crop));
    const box = h('div', { class: 'pf-box' + (size === 'lg' ? ' pf-box--lg' : '') }, img);
    resolveSrc(link).then(u => { if (u) img.src = u; else missing(); });
    img.addEventListener('error', missing);
    function missing() { box.replaceChildren(h('span', { class: 'pf-missing', text: 'Foto não está neste aparelho' })); }
    return box;
  }

  function slotFor(coupleId) {
    const d = ns.getData(), link = (d.padrinhoFotos || []).find(p => p.coupleId === coupleId), c = coupleOf(coupleId);
    if (!link) return h('div', { class: 'pf-slot' }, h('button', { class: 'btn tiny secondary', type: 'button', 'data-pf': 'add', onclick: () => pick(coupleId) }, '＋ Foto'));
    const st = STATUS[link.status] || STATUS.revisado;
    return h('figure', { class: 'pf', 'data-pf-id': link.id },
      h('button', { class: 'pf-open', type: 'button', 'aria-label': `Abrir foto: ${link.label}`, onclick: () => lightbox(link) }, frame(link)),
      h('figcaption', {}, h('strong', { text: link.label }), h('span', { class: 'chip ' + st[1], text: st[0] }),
        h('div', { class: 'pf-actions' },
          h('button', { class: 'btn tiny secondary', type: 'button', onclick: () => cropEditor(link) }, 'Enquadrar'),
          h('button', { class: 'btn tiny secondary', type: 'button', onclick: () => pick(coupleId, link) }, 'Trocar'),
          h('button', { class: 'btn tiny secondary', type: 'button', onclick: () => rename(link) }, 'Legenda'),
          h('button', { class: 'btn tiny danger', type: 'button', onclick: () => remove(link) }, 'Remover'))));
  }

  function lightbox(link) {
    ctx.engine.setFocusPhoto(link.id);
    const c = coupleOf(link.coupleId), big = frame({ ...link, crop: { x: 50, y: 50, zoom: 1 } }, { size: 'lg' });
    modal(dialog(h('h2', { text: link.label }), big,
      h('p', { class: 'muted mini', text: `${c ? 'Par vinculado: ' + c.name + '. ' : ''}${link.note || ''}` }),
      h('p', { class: 'muted mini', text: 'A legenda foi atribuída por vocês. A Íris não identifica pessoas pelo rosto e esta foto não é enviada a nenhum serviço.' })));
  }

  async function pick(coupleId, existing) {
    const c = coupleOf(coupleId); if (!c) return;
    const input = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    doc.body.append(input);
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0]; input.remove(); if (!f) return;
      try {
        toast('Preparando a foto…');
        const { blob, trimmed } = await prepareImage(f);
        const key = 'pf-' + coupleId + '-' + Date.now().toString(36);
        await putPhoto({ key, blob, ts: Date.now() });
        const old = existing && existing.src && existing.src.startsWith('local:') ? existing.src.slice(6) : null;
        const res = runTool('linkPadrinhoPhoto', { coupleId, src: 'local:' + key, label: existing ? existing.label : c.name, status: 'revisado' });
        if (res.ok === false) { toast(res.speak || 'Não consegui vincular a foto.', true); await delPhoto(key); return; }
        if (old) { try { await delPhoto(old); urlCache.delete(old); } catch (_) {} }
        toast(trimmed ? 'Foto vinculada (faixas escuras recortadas). Ela fica só neste aparelho.' : 'Foto vinculada. Ela fica só neste aparelho.');
      } catch (e) { toast(e.message || 'Não consegui importar a foto.', true); }
    });
    input.click();
  }

  function rename(link) {
    const v = window.prompt('Legenda da foto (como vocês chamam essas pessoas):', link.label);
    if (v === null || !v.trim()) return;
    ns.mutate(d => { const l = d.padrinhoFotos.find(p => p.id === link.id); if (l) l.label = v.trim().slice(0, 80); });
  }

  async function remove(link) {
    if (!window.confirm('Remover o vínculo desta foto? Se ela foi importada neste aparelho, a cópia também será apagada.')) return;
    runTool('unlinkPadrinhoPhoto', { id: link.id });
    if (link.src && link.src.startsWith('local:')) { try { await delPhoto(link.src.slice(6)); urlCache.delete(link.src.slice(6)); } catch (_) {} }
    toast('Vínculo removido. O par continua na lista.');
  }

  function cropEditor(link) {
    const cur = { x: 50, y: 38, zoom: 1, ...(link.crop || {}) };
    const preview = frame({ ...link, crop: cur }, { size: 'lg' }); const imgEl = () => preview.querySelector('img');
    const apply = () => { const i = imgEl(); if (i) i.setAttribute('style', cropStyle(cur)); };
    const slider = (id, label, min, max, step, key) => h('div', { class: 'field' }, h('label', { for: id, text: label }), h('input', { id, type: 'range', min, max, step, value: String(cur[key]), oninput: e => { cur[key] = Number(e.target.value); apply(); } }));
    let drag = null;
    preview.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, sx: cur.x, sy: cur.y }; preview.setPointerCapture(e.pointerId); });
    preview.addEventListener('pointermove', e => { if (!drag) return; const r = preview.getBoundingClientRect(); cur.x = Math.min(100, Math.max(0, drag.sx - (e.clientX - drag.x) / r.width * 100)); cur.y = Math.min(100, Math.max(0, drag.sy - (e.clientY - drag.y) / r.height * 100)); apply(); doc.getElementById('pf-x').value = cur.x; doc.getElementById('pf-y').value = cur.y; });
    preview.addEventListener('pointerup', () => { drag = null; });
    modal(dialog(h('h2', { text: 'Enquadrar a foto' }), h('p', { class: 'muted mini', text: 'Arraste a imagem ou use os controles. É só o enquadramento: a foto original não é alterada.' }), preview,
      h('div', { class: 'form-grid', style: { marginTop: '14px' } }, slider('pf-zoom', 'Aproximar', 1, 3, .05, 'zoom'), slider('pf-x', 'Posição horizontal', 0, 100, 1, 'x'), slider('pf-y', 'Posição vertical', 0, 100, 1, 'y')),
      h('div', { class: 'dialog-actions' }, h('button', { class: 'btn secondary', type: 'button', onclick: closeModal }, 'Cancelar'),
        h('button', { class: 'btn', type: 'button', onclick: () => { ns.mutate(d => { const l = d.padrinhoFotos.find(p => p.id === link.id); if (l) l.crop = { x: Math.round(cur.x), y: Math.round(cur.y), zoom: Math.round(cur.zoom * 100) / 100 }; }); closeModal(); toast('Enquadramento salvo.'); } }, 'Salvar enquadramento'))));
  }

  function reviewPanel() {
    const d = ns.getData(), eq = d.nameEquivalences || [], sug = (d.padrinhoFotos || []).filter(p => p.status === 'sugerido');
    const kids = [h('h3', { text: 'Fotos e nomes: para revisar' }),
      h('p', { class: 'muted mini', text: 'As fotos ficam só neste aparelho e não vão para o backup nem para nenhum serviço. A Íris não reconhece rostos: cada foto tem a legenda que vocês deram, e o vínculo com um par é uma sugestão para conferir. Nada é mesclado nem renomeado automaticamente.' })];
    for (const p of sug) { const c = coupleOf(p.coupleId); kids.push(h('div', { class: 'item', 'data-pf-review': p.id }, h('div', { class: 'row' }, h('strong', { text: `${p.label} → ${c ? c.name : '(par removido)'}` }), h('button', { class: 'btn tiny secondary', type: 'button', onclick: () => { runTool('confirmPhotoLink', { id: p.id }); } }, 'Marcar como revisado')), h('p', { text: p.note || '' }))); }
    if (eq.length) { kids.push(h('h4', { text: 'Possíveis equivalências entre listas' })); for (const e of eq) kids.push(h('p', { class: 'muted mini', text: `${e.a} ⇄ ${e.b}. ${e.note}` })); }
    return h('div', { class: 'card pf-review', style: { marginTop: '16px' } }, ...kids);
  }

  function hydrate() {
    const content = doc.getElementById('content'); if (!content) return;
    content.querySelectorAll('.item[data-couple-id]').forEach(item => item.append(slotFor(item.dataset.coupleId)));
    content.append(reviewPanel());
  }
  function spotlight() {
    setTimeout(() => {
      const els = [...doc.querySelectorAll('#content .pf')]; if (!els.length) return;
      els[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      els.forEach(e => e.classList.add('pf-spot')); setTimeout(() => els.forEach(e => e.classList.remove('pf-spot')), 2600);
    }, 350);
  }

  Iris.padrinhosFotos = {
    init(n, c) { ns = n; ctx = c; ns.onRender(s => { if (s === 'padrinhos') hydrate(); }); if (ns.getSection() === 'padrinhos') hydrate(); },
    hydrate, spotlight, prepareImage, frame, _db: { putPhoto, getPhoto, delPhoto },
  };
})();
