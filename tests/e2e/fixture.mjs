// Dados 100% FICTÍCIOS para testes. Seguro para o repositório público.
// Chave do localStorage legado preservada pelo app.
export const STORAGE_KEY = 'nosso-sim-ateliê-v1';

export function fixtureV2() {
  return {
    version: 2,
    settings: {
      personA: 'Gabriel', personB: 'Isabelle', date: '2027-11-13', city: 'Local Exemplo, SP',
      budget: 50000, guestGoal: 100, reservePct: 10, style: 'Romântico', message: 'Mensagem de teste.',
    },
    budget: [
      { id: 'b-foto', title: 'Fotografia exemplo', category: 'Fotografia', estimate: 3000, paid: 500 },
      { id: 'b-dj', title: 'DJ exemplo', category: 'Música', estimate: 1800, paid: 0 },
    ],
    guests: [
      { id: 'g-1', name: 'Convidado Fictício A + Acompanhante', group: 'Amigos', qty: 2, adults: 2, children: 0, side: 'Gabriel', attendance: 'Pendente', notes: '', source: 'teste' },
      { id: 'g-2', name: 'Família Fictícia B', group: 'Família', qty: 4, adults: 2, children: 2, side: 'Isabelle', attendance: 'Pendente', notes: '', source: 'teste' },
      { id: 'g-3', name: 'Convidada Fictícia C', group: 'Trabalho', qty: 1, adults: 1, children: 0, side: 'Ambos', attendance: 'Confirmado', notes: '', source: 'teste' },
    ],
    couples: [
      { id: 'pair-t1', name: 'Fulano Teste & Fulana Teste', side: 'Gabriel', role: 'Padrinhos', notes: 'fictício' },
      { id: 'pair-t2', name: 'Beltrano Teste & Beltrana Teste', side: 'Isabelle', role: 'Padrinhos', notes: 'fictício' },
      { id: 'entrance-t', name: 'Par de Entrada Teste', side: 'Gabriel', role: 'Entrada', notes: '' },
    ],
    sweetsQty: {},
    gifts: [{ id: 'gift-t1', name: 'Presente exemplo', group: 'Casa', price: 0, store: '', url: '', notes: '', status: 'Desejado', origin: 'teste' }],
    vendors: [
      { id: 'v-buffet', name: 'Buffet Exemplo', kind: 'Buffet', quote: 5000, contact: 'contato fictício', status: 'Proposta recebida', rating: 'Boa opção', notes: '' },
      { id: 'v-chacara', name: 'Chácara Exemplo', kind: 'Espaço', quote: 0, contact: '', status: 'Pesquisando', rating: 'Ainda não avaliado', notes: '' },
    ],
    tasks: [
      { id: 't-1', title: 'Tarefa teste 1', phase: 'Planejamento', due: '', owner: 'Juntos', done: true },
      { id: 't-2', title: 'Tarefa teste 2', phase: 'Fornecedores', due: '', owner: 'Gabriel', done: false },
      { id: 't-3', title: 'Tarefa teste 3', phase: 'Cerimônia', due: '', owner: 'Isabelle', done: false },
    ],
    timeline: [],
    padrinhoFotos: [], nameEquivalences: [], sourceNotes: [],
    ideas: [
      { id: 'i-1', title: 'Ideia teste', category: 'Decoração', details: 'detalhe', votes: { a: 'sim', b: 'talvez' } },
    ],
    created: '2026-11-10T12:00:00.000Z',
  };
}

/** Backup legado V1 (antes da migração para v2): deve ser preservado e migrado. */
export function fixtureLegacyV1() {
  return {
    version: 1,
    settings: { personA: '', personB: '', date: '', city: '', budget: 12345, guestGoal: 100, reservePct: 12, style: 'Clássico', message: 'msg v1' },
    budget: [{ id: 'v1-b', title: 'Item legado V1', category: 'Buffet', estimate: 999, paid: 100 }],
    guests: [], vendors: [],
    tasks: [{ id: 'v1-t', title: 'Tarefa legada V1', phase: 'Geral', due: '', owner: 'Juntos', done: false }],
    timeline: [{ id: 'v1-e', time: '16:00', title: 'Momento legado', details: '' }],
    ideas: [{ id: 'v1-i', title: 'Ideia legada', category: 'Música', details: '', votes: { a: null, b: null } }],
    created: '2026-01-01T00:00:00.000Z',
  };
}
