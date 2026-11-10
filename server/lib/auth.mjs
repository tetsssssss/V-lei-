// Senha compartilhada → token assinado (HMAC-SHA256). Comparações em tempo constante.
import crypto from 'node:crypto';
const b64 = b => Buffer.from(b).toString('base64url');
const sign = (data, secret) => crypto.createHmac('sha256', secret).update(data).digest('base64url');
export const safeEqual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

export function issueToken(secret, { ttlMs = 12 * 3600e3, now = Date.now() } = {}) {
  const payload = b64(JSON.stringify({ exp: now + ttlMs, n: crypto.randomBytes(8).toString('hex') }));
  return { token: `${payload}.${sign(payload, secret)}`, expiresIn: Math.round(ttlMs / 1000) };
}
export function verifyToken(token, secret, now = Date.now()) {
  if (!token || !secret || typeof token !== 'string' || token.length > 400) return false;
  const [payload, sig] = token.split('.'); if (!payload || !sig) return false;
  if (!safeEqual(sig, sign(payload, secret))) return false;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > now; } catch (_) { return false; }
}
export const bearer = req => { const h = req.headers.get('authorization') || ''; const m = h.match(/^Bearer\s+(\S+)$/i); return m ? m[1] : ''; };
