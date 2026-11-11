// Gera um PNG sintético FICTÍCIO (imita um print de satélite: gramado, "galpão", "estrada") sem dependências.
import zlib from 'node:zlib';
const crcT = Uint32Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
const chunk = (t, d) => { const o = Buffer.alloc(12 + d.length); o.writeUInt32BE(d.length, 0); o.write(t, 4); d.copy(o, 8); o.writeUInt32BE(crc(o.subarray(4, 8 + d.length)), 8 + d.length); return o; };
export function fakeSatellitePng(w = 1600, h = 1000) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; for (let x = 0; x < w; x++) {
    let c = [86 + ((x * 7 + y * 3) % 17), 128 + ((x + y) % 23), 70]; // gramado
    if (x > 300 && x < 700 && y > 200 && y < 420) c = [190, 180, 170]; // "salão"
    if (y > 700 && y < 760) c = [120, 110, 100]; // "estrada"
    if (x > 900 && x < 1300 && y > 250 && y < 600) c = [150, 175, 120]; // "gramado aberto"
    const i = y * (w * 4 + 1) + 1 + x * 4; raw[i] = c[0]; raw[i + 1] = c[1]; raw[i + 2] = c[2]; raw[i + 3] = 255; } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
