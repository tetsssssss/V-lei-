/* EXEMPLO FICTÍCIO do arquivo seed/seed-casal.js (o real é privado e fica fora do git).
   Formato aceito pelo app; todos os nomes aqui são inventados. */
window.NS_SEED = {
  guests: [
    { id: 'received-01', name: 'Convidado Exemplo + Acompanhante', group: 'Amigos', qty: 2, adults: 2, children: 0, side: 'Gabriel', attendance: 'Pendente', notes: '', source: 'exemplo' },
    { id: 'received-02', name: 'Família Exemplo', group: 'Família', qty: 4, adults: 2, children: 2, side: 'Isabelle', attendance: 'Pendente', notes: '', source: 'exemplo' },
  ],
  couples: [
    { id: 'pair-01', name: 'Fulano & Fulana', side: 'Gabriel', role: 'Padrinhos', notes: 'exemplo' },
    { id: 'entrance-g', name: 'Par de Entrada Exemplo', side: 'Gabriel', role: 'Entrada', notes: '' },
  ],
  settings: { message: 'Mensagem-surpresa de exemplo.' },
  photoLinks: [{ photo: 'assets/padrinhos/foto-01.jpg', label: 'Fulano e Fulana', coupleId: 'pair-01', status: 'exato', note: '' }],
  nameEquivalences: [{ a: 'Nome na lista A', b: 'Nome na lista B', note: 'Possível mesma pessoa; revisar.' }],
  sourceNotes: ['Aviso de exemplo sobre fontes com contagens diferentes.'],
};
