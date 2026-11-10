// Configuração a partir do ambiente. NUNCA registra valores de chaves.
import fs from 'node:fs';

/** Carrega .env (se existir) sem sobrescrever variáveis já definidas. Parser mínimo, sem dependências. */
export function loadDotEnv(file, target = process.env) {
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m || line.trim().startsWith('#')) continue;
      if (target[m[1]] === undefined) target[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  } catch (_) { /* sem .env: ok */ }
}

export function readConfig(env = process.env) {
  const n = (k, d) => (env[k] === undefined || env[k] === '' ? d : env[k]);
  const llm = n('IRIS_LLM_PROVIDER', ''), stt = n('IRIS_STT_PROVIDER', ''), tts = n('IRIS_TTS_PROVIDER', '');
  return {
    passcode: n('IRIS_PASSCODE', ''), tokenSecret: n('IRIS_TOKEN_SECRET', ''),
    allowedOrigins: n('ALLOWED_ORIGINS', '').split(',').map(s => s.trim()).filter(Boolean),
    llm: { provider: llm, model: n('IRIS_LLM_MODEL', llm === 'anthropic' || llm === 'mock' || llm === '' ? 'claude-sonnet-5-5' : ''), anthropicKey: n('ANTHROPIC_API_KEY', ''), anthropicBase: n('ANTHROPIC_BASE_URL', 'https://api.anthropic.com'), openaiKey: n('OPENAI_API_KEY', ''), openaiBase: n('OPENAI_BASE_URL', 'https://api.openai.com/v1') },
    stt: { provider: stt, model: n('IRIS_STT_MODEL', 'whisper-1') }, tts: { provider: tts, model: n('IRIS_TTS_MODEL', 'tts-1'), voice: n('IRIS_TTS_VOICE', 'nova') },
    port: Number(n('PORT', '8080')) || 8080,
  };
}

/** O que cada serviço realmente tem para funcionar (só booleanos, nunca valores). */
export function capabilities(cfg) {
  // Lista só os NOMES das variáveis que faltam (nunca valores) para a tela dizer o que fazer.
  const missing = [];
  if (cfg.llm.provider === 'anthropic' && !cfg.llm.anthropicKey) missing.push('ANTHROPIC_API_KEY');
  if (cfg.llm.provider === 'openai') { if (!cfg.llm.openaiKey) missing.push('OPENAI_API_KEY'); if (!cfg.llm.model) missing.push('IRIS_LLM_MODEL'); }
  const llm = cfg.llm.provider === 'mock' || (['anthropic', 'openai'].includes(cfg.llm.provider) && missing.length === 0);
  const voiceKey = !!cfg.llm.openaiKey;
  return {
    auth: !!cfg.passcode && cfg.tokenSecret.length >= 16,
    llm: { configured: llm, provider: llm ? cfg.llm.provider : null, ...(missing.length ? { missing } : {}) },
    stt: { configured: cfg.stt.provider === 'mock' || (cfg.stt.provider === 'openai' && voiceKey) },
    tts: { configured: cfg.tts.provider === 'mock' || (cfg.tts.provider === 'openai' && voiceKey) },
  };
}
