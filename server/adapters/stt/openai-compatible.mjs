// Transcrição (multipart). STATUS: verificado só contra servidor upstream FALSO.
export async function transcribe({ audio, contentType }, cfg, fetchImpl = fetch) {
  const form = new FormData();
  const ext = /ogg/.test(contentType) ? 'ogg' : /mp4|m4a/.test(contentType) ? 'm4a' : /wav/.test(contentType) ? 'wav' : 'webm';
  form.append('file', new Blob([audio], { type: contentType }), `audio.${ext}`); form.append('model', cfg.stt.model); form.append('language', 'pt');
  const res = await fetchImpl(`${cfg.llm.openaiBase.replace(/\/$/, '')}/audio/transcriptions`, { method: 'POST', signal: AbortSignal.timeout(30000), headers: { authorization: `Bearer ${cfg.llm.openaiKey}` }, body: form });
  if (!res.ok) { const e = new Error(`provedor de voz respondeu ${res.status}`); e.status = 502; throw e; }
  return { text: String((await res.json()).text || '').trim() };
}
