/* V3.1 · zip.js — leitor/escritor de ZIP sem dependências (usa DecompressionStream do navegador/Node 18+).
   Escrever usa método "armazenado" (sem compressão): imagens já são comprimidas e o JSON é pequeno. */
(function (root, factory) {
  const api = factory(root.V31 || (root.V31 = {}));
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (V31) {
  'use strict';
  const te = new TextEncoder(), td = new TextDecoder('utf-8');
  let T = null;
  const crcTable = () => T || (T = Uint32Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }));
  function crc32(u8) { const t = crcTable(); let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = t[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

  const MAX_ENTRIES = 5000, MAX_TOTAL = 400 * 1024 * 1024, MAX_ONE = 120 * 1024 * 1024;

  /** Lê o índice (sem descompactar). Rejeita nomes perigosos (../, absolutos) e excesso de tamanho. */
  function list(buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 22 - 65535); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('Arquivo ZIP inválido (sem diretório central).');
    const n = dv.getUint16(eocd + 10, true), cdOff = dv.getUint32(eocd + 16, true);
    if (n > MAX_ENTRIES) throw new Error('ZIP com arquivos demais.');
    const out = []; let p = cdOff, total = 0;
    for (let i = 0; i < n; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('ZIP corrompido (diretório central).');
      const flags = dv.getUint16(p + 8, true), method = dv.getUint16(p + 10, true), crc = dv.getUint32(p + 16, true), csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
      const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = (flags & 0x800 ? td : new TextDecoder('utf-8')).decode(u8.subarray(p + 46, p + 46 + nl));
      p += 46 + nl + el + cl;
      total += usize;
      if (usize > MAX_ONE || total > MAX_TOTAL) throw new Error('ZIP grande demais.');
      if (/^\/|\\|(^|\/)\.\.(\/|$)/.test(name)) throw new Error('ZIP com caminho perigoso: ' + name);
      out.push({ name, method, crc, csize, usize, off, dir: name.endsWith('/') });
    }
    return out;
  }
  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador não consegue descompactar ZIP.');
    const ds = new DecompressionStream('deflate-raw');
    const res = new Response(new Blob([bytes]).stream().pipeThrough(ds));
    return new Uint8Array(await res.arrayBuffer());
  }
  async function read(buf, entry) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const p = entry.off; if (dv.getUint32(p, true) !== 0x04034b50) throw new Error('ZIP corrompido (arquivo ' + entry.name + ').');
    const start = p + 30 + dv.getUint16(p + 26, true) + dv.getUint16(p + 28, true);
    const raw = u8.subarray(start, start + entry.csize);
    const data = entry.method === 0 ? raw : entry.method === 8 ? await inflateRaw(raw) : null;
    if (!data) throw new Error('Método de compressão não suportado em ' + entry.name);
    if (data.length !== entry.usize || crc32(data) !== entry.crc) throw new Error('Arquivo danificado no ZIP: ' + entry.name);
    return data;
  }
  const readText = async (buf, entry) => td.decode(await read(buf, entry));

  /** files: [{name, data: Uint8Array|string}] → Uint8Array do ZIP. */
  function write(files) {
    const parts = [], central = []; let off = 0;
    const u16 = v => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v, true); return b; };
    const u32 = v => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0, true); return b; };
    const cat = arr => { const o = new Uint8Array(arr.reduce((a, x) => a + x.length, 0)); let q = 0; for (const x of arr) { o.set(x, q); q += x.length; } return o; };
    const d = new Date(), dosT = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dosD = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const f of files) {
      const name = te.encode(f.name), data = typeof f.data === 'string' ? te.encode(f.data) : f.data, crc = crc32(data);
      const local = cat([u32(0x04034b50), u16(20), u16(0x800), u16(0), u16(dosT), u16(dosD), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data]);
      central.push(cat([u32(0x02014b50), u16(20), u16(20), u16(0x800), u16(0), u16(dosT), u16(dosD), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off), name]));
      parts.push(local); off += local.length;
    }
    const cd = cat(central);
    return cat([...parts, cd, u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cd.length), u32(off), u16(0)]);
  }
  Object.assign(V31, { zip: { list, read, readText, write, crc32 } });
  return V31.zip;
});
