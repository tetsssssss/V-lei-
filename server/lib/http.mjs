// Utilidades HTTP no padrão Web (Request/Response): funcionam em Node e em funções serverless.
export const json = (obj, status = 200, headers = {}) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
export const fail = (status, message, headers) => json({ error: message }, status, headers);

export function corsHeaders(req, allowed) {
  const origin = req.headers.get('origin');
  if (!origin || !allowed.includes(origin)) return {};
  return { 'access-control-allow-origin': origin, vary: 'Origin', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-max-age': '600' };
}

/** Lê o corpo com limite; aborta cedo se passar do máximo. */
export async function readLimited(req, max) {
  const len = Number(req.headers.get('content-length') || 0);
  if (len && len > max) return { tooBig: true };
  const reader = req.body && req.body.getReader(); if (!reader) return { buf: Buffer.alloc(0) };
  const chunks = []; let total = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; total += value.length; if (total > max) { try { await reader.cancel(); } catch (_) {} return { tooBig: true }; } chunks.push(value); }
  return { buf: Buffer.concat(chunks) };
}
export const clientIp = (req, fallback = 'local') => (req.headers.get('x-nf-client-connection-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || fallback);
