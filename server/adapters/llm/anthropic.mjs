// Anthropic Messages API (uso de ferramentas). Formato normalizado de entrada = blocos no estilo Anthropic.
// STATUS: verificado só contra um servidor upstream FALSO nos testes (formato da requisição/resposta). Sem chave real aqui.
export async function complete({ system, messages, tools, maxTokens = 700 }, cfg, fetchImpl = fetch) {
  const res = await fetchImpl(`${cfg.llm.anthropicBase.replace(/\/$/, '')}/v1/messages`, {
    method: 'POST', signal: AbortSignal.timeout(30000),
    headers: { 'content-type': 'application/json', 'x-api-key': cfg.llm.anthropicKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: cfg.llm.model, max_tokens: maxTokens, system, messages, ...(tools && tools.length ? { tools: tools.map(t => ({ name: t.name, description: t.description, input_schema: t.input_schema })) } : {}) }),
  });
  if (!res.ok) { const e = new Error(`provedor de IA respondeu ${res.status}`); e.status = res.status === 429 ? 429 : 502; throw e; }
  const data = await res.json();
  const blocks = Array.isArray(data.content) ? data.content : [];
  return { text: blocks.filter(b => b.type === 'text').map(b => b.text).join('\n').trim(), toolCalls: blocks.filter(b => b.type === 'tool_use').map(b => ({ id: b.id, name: b.name, input: b.input || {} })), stop: data.stop_reason || '' };
}
