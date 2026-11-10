// Janela deslizante em memória (por chave). Suficiente para 2 usuários; troque por Redis se escalar.
export function createLimiter({ windowMs, max, now = () => Date.now() }) {
  const hits = new Map();
  return {
    check(key) {
      const t = now(), arr = (hits.get(key) || []).filter(x => t - x < windowMs);
      if (arr.length >= max) { hits.set(key, arr); return { ok: false, retryAfter: Math.ceil((windowMs - (t - arr[0])) / 1000) }; }
      arr.push(t); hits.set(key, arr);
      if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || t - v.at(-1) > windowMs) hits.delete(k);
      return { ok: true };
    },
  };
}
