// API estilo OpenAI (chat.completions + tools). Converte o formato normalizado (blocos Anthropic) para o da API.
// STATUS: verificado só contra servidor upstream FALSO. Sem chave real aqui.
export function toOpenAIMessages(system, messages) {
  const out = [{ role: 'system', content: system }];
  for (const m of messages) {
    if (typeof m.content === 'string') { out.push({ role: m.role, content: m.content }); continue; }
    const text = m.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    const uses = m.content.filter(b => b.type === 'tool_use'), results = m.content.filter(b => b.type === 'tool_result');
    if (m.role === 'assistant') out.push({ role: 'assistant', content: text || null, ...(uses.length ? { tool_calls: uses.map(u => ({ id: u.id, type: 'function', function: { name: u.name, arguments: JSON.stringify(u.input || {}) } })) } : {}) });
    else { for (const r of results) out.push({ role: 'tool', tool_call_id: r.tool_use_id, content: typeof r.content === 'string' ? r.content : JSON.stringify(r.content) }); if (text) out.push({ role: 'user', content: text }); }
  }
  return out;
}
export async function complete({ system, messages, tools, maxTokens = 700 }, cfg, fetchImpl = fetch) {
  const res = await fetchImpl(`${cfg.llm.openaiBase.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST', signal: AbortSignal.timeout(30000), headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.llm.openaiKey}` },
    body: JSON.stringify({ model: cfg.llm.model, max_tokens: maxTokens, messages: toOpenAIMessages(system, messages), ...(tools && tools.length ? { tools: tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } })) } : {}) }),
  });
  if (!res.ok) { const e = new Error(`provedor de IA respondeu ${res.status}`); e.status = res.status === 429 ? 429 : 502; throw e; }
  const msg = ((await res.json()).choices || [])[0]?.message || {};
  const toolCalls = (msg.tool_calls || []).map(c => { let input = {}; try { input = JSON.parse(c.function.arguments || '{}'); } catch (_) {} return { id: c.id, name: c.function.name, input }; });
  return { text: (msg.content || '').trim(), toolCalls, stop: toolCalls.length ? 'tool_use' : 'end_turn' };
}
