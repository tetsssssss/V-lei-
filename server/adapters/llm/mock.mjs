// Provedor SIMULADO (sem custo, sem rede). Para testes e demonstração: não é IA de verdade.
export const seen = []; // últimas requisições recebidas (só para testes de minimização de dados)
export async function complete({ system, messages, tools }) {
  seen.push({ system, messages: JSON.parse(JSON.stringify(messages)), tools: (tools || []).map(t => t.name) });
  if (seen.length > 20) seen.shift();
  const last = messages.at(-1), lastText = typeof last.content === 'string' ? last.content : last.content.filter(b => b.type === 'text').map(b => b.text).join(' ');
  const gotResult = Array.isArray(last.content) && last.content.some(b => b.type === 'tool_result');
  if (gotResult) { const r = last.content.find(b => b.type === 'tool_result'); return { text: `Pronto (resposta simulada). Resultado da ferramenta: ${String(typeof r.content === 'string' ? r.content : JSON.stringify(r.content)).slice(0, 160)}`, toolCalls: [], stop: 'end_turn' }; }
  if (/segredo|dias/i.test(lastText) && (tools || []).some(t => t.name === 'calculateDaysUntilWedding')) return { text: '', toolCalls: [{ id: 'mock-1', name: 'calculateDaysUntilWedding', input: {} }], stop: 'tool_use' };
  if (/sumir com (os )?dados/i.test(lastText)) return { text: '', toolCalls: [{ id: 'mock-2', name: 'deleteRecord', input: { list: 'guests', query: 'Convidada' } }], stop: 'tool_use' };
  return { text: 'Esta é uma resposta simulada do provedor de teste.', toolCalls: [], stop: 'end_turn' };
}
