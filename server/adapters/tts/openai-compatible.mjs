// Síntese (JSON → áudio). STATUS: verificado só contra servidor upstream FALSO.
export async function synthesize({ text }, cfg, fetchImpl = fetch) {
  const res = await fetchImpl(`${cfg.llm.openaiBase.replace(/\/$/, '')}/audio/speech`, { method: 'POST', signal: AbortSignal.timeout(30000), headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.llm.openaiKey}` }, body: JSON.stringify({ model: cfg.tts.model, voice: cfg.tts.voice, input: text, response_format: 'mp3' }) });
  if (!res.ok) { const e = new Error(`provedor de voz respondeu ${res.status}`); e.status = 502; throw e; }
  return { audio: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') || 'audio/mpeg' };
}
