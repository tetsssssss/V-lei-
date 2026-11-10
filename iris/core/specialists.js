/* Íris · specialists.js — especialistas INTERNOS (uma voz só). Roteia por assunto, reaproveita os 6 consultores
   do app (`recommendations`) e acrescenta decoração/experiências e casa nova. Sem preços inventados. */
(function (root, factory) {
  const api = factory(root.Iris || (root.Iris = {}));
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Iris) {
  'use strict';
  const T = () => Iris.text;

  const SPECIALISTS = {
    cerimonialista: { label: 'cerimonialista', agent: 'cerimonia', words: ['cerimonia', 'entrada', 'roteiro', 'padrinho', 'ensaio', 'votos', 'alianca', 'altar', 'corredor'] },
    buffet: { label: 'buffet e confeitaria', agent: 'buffet', words: ['buffet', 'doce', 'doces', 'bolo', 'cardapio', 'sabor', 'sabores', 'restricao', 'alergia', 'elizete', 'comida', 'bebida'] },
    financas: { label: 'finanças', agent: 'financeiro', words: ['orcamento', 'parcela', 'reserva', 'teto', 'gasto', 'custo', 'saldo', 'prioridade', 'pagamento', 'cenario'] },
    fornecedores: { label: 'fornecedores de Bauru e Agudos', agent: 'fornecedores', words: ['fornecedor', 'fornecedores', 'cotacao', 'proposta', 'contrato', 'chacara', 'veneza', 'bauru', 'agudos', 'fotografo', 'dj'] },
    decoracao: { label: 'decoração e experiências', agent: null, words: ['decoracao', 'decorar', 'flores', 'floral', 'pista', 'danca', 'sorvete', 'plataforma', '360', 'musica', 'iluminacao', 'ambientacao'] },
    convidados: { label: 'convidados e RSVP', agent: 'convidados', words: ['convidado', 'convidados', 'rsvp', 'confirmacao', 'crianca', 'criancas', 'mesa', 'mesas', 'lista'] },
    casanova: { label: 'casa nova', agent: null, words: ['presente', 'presentes', 'casa nova', 'geladeira', 'fogao', 'eletrodomestico', 'liquidificador', 'enxoval'] },
    mediacao: { label: 'mediação do casal', agent: 'decisoes', words: ['discordamos', 'divergencia', 'decidir', 'decisao', 'opiniao', 'consenso', 'nao concordamos', 'cada um quer'] },
  };

  function route(text) {
    const n = ' ' + T().norm(text) + ' ';
    let best = null;
    for (const [id, sp] of Object.entries(SPECIALISTS)) {
      const hits = sp.words.filter(w => n.includes(' ' + w + ' ') || n.includes(' ' + w + 's ')).length;
      if (hits && (!best || hits > best.hits)) best = { id, hits };
    }
    return best ? best.id : 'financas';
  }
  const label = id => (SPECIALISTS[id] || SPECIALISTS.financas).label;

  // Opções curadas — OPINIÃO da Íris, sem preços, com o cuidado prático de cada uma.
  const KB = {
    altar: { title: 'Decoração do altar', items: [
      { t: 'Arco ou moldura de flores naturais em tons suaves (branco, rosé, verde)', why: 'Romântico clássico e fotografa muito bem.', care: 'Em área aberta, prefira flores resistentes ao calor e confirme com a chácara se pode montar a estrutura.', tags: ['romantico', 'classico'] },
      { t: 'Cortina de tecido leve com luzes quentes', why: 'Dá intimidade sem exagero e valoriza o pôr do sol.', care: 'Precisa de ponto de energia e fixação firme por causa do vento.', tags: ['romantico', 'discreto'] },
      { t: 'Composição baixa de flores e folhagens com velas em lanternas nas laterais', why: 'Elegante e discreto: o foco continua nos noivos.', care: 'Use velas LED se houver vento ou restrição de fogo.', tags: ['discreto', 'romantico'] },
      { t: 'Painel simples de madeira clara com folhagens e uma peça de destaque', why: 'Acolhedor e fácil de adaptar ao estilo rústico-chique.', care: 'Combine o peso/transporte com o decorador.', tags: ['rustico', 'discreto'] },
    ] },
    danca: { title: 'Primeira dança', items: [
      { t: 'Música lenta que tenha significado para os dois, com uma coreografia simples de cerca de um minuto', why: 'Emocional e fácil de ensaiar.', care: 'Ensaie no tipo de piso do local.', tags: ['romantico', 'discreto'] },
      { t: 'Começar a dois e chamar padrinhos e família na segunda metade', why: 'Quebra o nervosismo e anima a pista.', care: 'Combine a deixa com o DJ ou a banda.', tags: ['animado'] },
      { t: 'Aulas rápidas com uma escola de dança da região antes do casamento', why: 'Dá segurança e vira momento a dois.', care: 'Há escolas pesquisadas na aba Chácara & atrações; preço só após orçamento.', tags: ['pratico'] },
    ] },
    pista: { title: 'Pista de dança', items: [
      { t: 'Pista de LED sob a área de dança', why: 'Efeito visual forte para a festa.', care: 'Confirme com a chácara energia, piso e permissão para equipamentos.', tags: ['animado'] },
      { t: 'Iluminação cênica e globo, sem pista especial', why: 'Barato em esforço e muda o clima da noite.', care: 'Combine tomadas e horário de montagem.', tags: ['discreto'] },
    ] },
    sorvete: { title: 'Sorvete e experiências', items: [
      { t: 'Carrinho de sorvete no fim do jantar', why: 'Memorável e agrada adultos e crianças.', care: 'Confirme se a chácara permite fornecedor externo e energia; valores só com proposta.', tags: ['animado'] },
      { t: 'Estação de sobremesas com os doces finos', why: 'Combina com o catálogo já pesquisado.', care: 'Mínimo de 25 unidades por sabor.', tags: ['romantico'] },
    ] },
    plataforma360: { title: 'Plataforma 360', items: [
      { t: 'Plataforma 360 por um período fixo da festa', why: 'Diversão para convidados e vídeos para vocês.', care: 'Peça tempo de uso, equipe e espaço necessário; confirme com a chácara.', tags: ['animado'] },
    ] },
    flores: { title: 'Flores', items: [
      { t: 'Poucas flores bem escolhidas na cerimônia e arranjos baixos nas mesas', why: 'Evita exagero e deixa os convidados se verem.', care: 'Flores de época costumam durar mais no calor.', tags: ['discreto', 'romantico'] },
      { t: 'Mistura de flores com folhagens e ramos secos', why: 'Visual mais natural e econômico em volume.', care: 'Combine o tom com a decoração geral.', tags: ['rustico'] },
    ] },
  };

  function topicOf(text) {
    const n = T().norm(text);
    if (/altar|corredor|arco/.test(n)) return 'altar';
    if (/primeira danca|valsa|coreografia/.test(n)) return 'danca';
    if (/pista|led|dancante/.test(n)) return 'pista';
    if (/sorvete|carrinho/.test(n)) return 'sorvete';
    if (/360|plataforma/.test(n)) return 'plataforma360';
    if (/flor|floral|buque/.test(n)) return 'flores';
    return null;
  }

  /** Opções curadas para o assunto, ordenadas por tom pedido ("romântico", "sem exageros"...). */
  function options(text, count = 3) {
    const topic = topicOf(text); if (!topic) return null;
    const n = T().norm(text), want = [];
    if (/romantic/.test(n)) want.push('romantico');
    if (/sem exager|discret|simples|minimal|clean/.test(n)) want.push('discreto');
    if (/rustic/.test(n)) want.push('rustico');
    if (/anim|festa|divert/.test(n)) want.push('animado');
    const kb = KB[topic];
    const ranked = kb.items.map(i => ({ ...i, score: want.reduce((s, w) => s + (i.tags.includes(w) ? 1 : 0), 0) })).sort((a, b) => b.score - a.score);
    return { topic, title: kb.title, items: ranked.slice(0, count), source: 'opiniao_iris' };
  }

  /** Orientação do especialista, reaproveitando as regras transparentes dos 6 consultores do app. */
  function advise(id, ns) {
    const sp = SPECIALISTS[id] || SPECIALISTS.financas;
    if (sp.agent && ns.recommendations) { const r = ns.recommendations(sp.agent); return { id, label: sp.label, title: r.title, body: r.body, points: r.points }; }
    if (id === 'casanova') {
      const g = ns.getData().gifts, priced = g.filter(x => Number(x.price) > 0).length;
      return { id, label: sp.label, title: 'Lista da casa nova', body: `${g.length} itens, ${priced} com preço de referência.`, points: ['Compare o MESMO modelo (SKU), voltagem e frete antes de falar em "menor preço".', 'Registre sempre loja, data e link do preço encontrado.', 'Itens sem preço pesquisado aparecem como "a cotar" — não estimo valores.'] };
    }
    return { id, label: sp.label, title: 'Decoração e experiências', body: 'Posso sugerir opções para altar, flores, primeira dança, pista, sorvete e plataforma 360.', points: ['Diga o assunto e o tom (ex.: "romântico e sem exageros") que eu proponho opções com o cuidado de cada uma.', 'Antes de decidir qualquer item, confirme com a chácara o que é permitido montar.'] };
  }

  const api = { SPECIALISTS, route, label, options, advise, topicOf };
  Iris.specialists = api;
  return api;
});
