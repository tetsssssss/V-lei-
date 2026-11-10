/* Íris · tools.js — catálogo de ferramentas sobre o ESTADO REAL do app (via ponte NossoSim).
   Leitura → run(args). Escrita → prepare(args) devolve { summary, diff[], execute() } e SÓ o motor decide executar.
   Nenhuma ferramenta faz pagamento, envio externo ou compra. */
(function (root, factory) {
  const api = factory(root.Iris || (root.Iris = {}));
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Iris) {
  'use strict';
  const T = () => Iris.text;
  const OPS = () => Iris.audit.ops;

  const SECTIONS = ['inicio', 'central', 'album', 'orcamento', 'convidados', 'padrinhos', 'doces', 'presentes', 'pesquisas', 'fornecedores', 'cerimonia', 'ideias', 'consultores', 'ajustes'];
  const LISTS = ['budget', 'guests', 'vendors', 'tasks', 'timeline', 'ideas', 'couples', 'gifts'];
  const ATTENDANCE = ['Pendente', 'Confirmado', 'Não vai'];
  const S = {
    str: (max = 200, extra = {}) => ({ type: 'string', maxLength: max, ...extra }),
    num: (min = 0, max = 1e9) => ({ type: 'number', min, max }),
  };

  function createTools(ns, deps = {}) {
    const { audit, memory, store } = deps;
    const D = () => ns.getData();
    const H = () => ns.helpers;
    const fmt = v => T().fmtBRL(v);
    const clone = o => JSON.parse(JSON.stringify(o));
    const ok = (o = {}) => ({ ok: true, ...o });
    const fail = (speak, extra = {}) => ({ ok: false, speak, ...extra });
    const sectionLabel = k => (ns.catalogs.nav().find(x => x[0] === k) || [k, k])[1];
    const venue = () => Iris.briefing.venueOf(D());
    const cats = () => ns.catalogs.categories;

    /** Resolve um registro por id ou por texto aproximado. */
    function resolve(list, { id, query }, textOf) {
      const arr = D()[list] || [];
      if (id) { const r = arr.find(x => x.id === id); if (r) return { item: r }; }
      if (query) {
        const scored = arr.map(x => ({ item: x, score: T().score(query, textOf(x)) })).filter(x => x.score >= 0.45).sort((a, b) => b.score - a.score);
        if (scored.length === 1 || (scored.length > 1 && scored[0].score - scored[1].score >= 0.2)) return { item: scored[0].item };
        if (scored.length > 1) return { ambiguous: scored.slice(0, 4).map(x => x.item) };
      }
      return { none: true };
    }
    const nameOf = { budget: x => x.title, guests: x => x.name, vendors: x => x.name, tasks: x => x.title, timeline: x => x.title, ideas: x => x.title, couples: x => x.name, gifts: x => x.name };
    const notFound = (what, r, list) => r.ambiguous
      ? fail(`Encontrei mais de um ${what}: ${T().humanList(r.ambiguous.map(x => nameOf[list](x)))}. Qual deles?`, { ambiguous: r.ambiguous.map(x => nameOf[list](x)) })
      : fail(`Não achei ${what} com esse nome. Me diga o nome como está na lista.`);

    const totalsLine = () => { const s = H().sums(); return s.limit ? `Planejado ${fmt(s.planned)} de ${fmt(s.limit)} de teto.` : `Planejado ${fmt(s.planned)} (teto ainda não definido).`; };
    const mut = fn => ns.mutate(fn).result;

    const defs = [];
    const def = d => { defs.push(d); return d; };

    // ============================ LEITURA (R0) ============================
    def({
      name: 'getWeddingOverview', risk: 'R0', desc: 'Visão geral do casamento (data, local, números).',
      input: { type: 'object', properties: {} },
      run() {
        const d = D(), h = H(), g = h.guestsInfo(), t = h.complete(), s = h.sums(), days = h.daysUntil(), v = venue();
        const counts = guestCounts();
        const when = days === null ? 'A data ainda não foi definida' : days > 0 ? `Faltam ${T().plural(days, 'dia')} para ${T().fmtDateLong(d.settings.date)}, a data de referência` : `A data de referência, ${T().fmtDateLong(d.settings.date)}, ${days === 0 ? 'é hoje' : 'já passou'}`;
        const where = v ? `, ${v.name === 'Chácara Veneza' ? 'na Chácara Veneza, em Agudos' : 'em ' + v.name}` : '';
        return ok({
          speak: `${when}${where}. Hoje há ${counts.total} pessoas previstas, ${g.yes} confirmada${g.yes === 1 ? '' : 's'}, e ${t.done} de ${t.all} tarefas concluídas.`,
          lines: [`${d.settings.personA} & ${d.settings.personB}`, `Data de referência: ${T().fmtDateBR(d.settings.date)} (sem reserva confirmada)`, `Orçamento planejado: ${fmt(s.planned)}${s.limit ? ` de ${fmt(s.limit)}` : ' (teto não definido)'}`, `Fornecedores: ${d.vendors.length} pesquisados, ${d.vendors.filter(x => x.status === 'Fechado').length} fechados`],
          panel: 'overview', data: { days, guests: counts.total },
        });
      },
    });

    def({
      name: 'calculateDaysUntilWedding', risk: 'R0', desc: 'Dias até a data de referência.', input: { type: 'object', properties: {} },
      run() {
        const days = H().daysUntil(), d = D(), v = venue();
        if (days === null) return ok({ speak: 'A data do casamento ainda não foi definida. Quer que eu registre uma?' });
        const closed = v && v.status === 'Fechado';
        const weeks = Math.floor(Math.abs(days) / 7);
        const base = days > 0 ? `Faltam ${T().plural(days, 'dia')}, cerca de ${T().plural(weeks, 'semana')}, até ${T().fmtDateLong(d.settings.date)}` : days === 0 ? 'A data de referência é hoje' : `A data de referência passou há ${T().plural(-days, 'dia')}`;
        return ok({ speak: `${base}.${closed ? '' : ' Lembrando que é uma data de referência: ainda não há reserva confirmada.'}`, data: { days, weeks }, panel: 'countdown' });
      },
    });

    def({
      name: 'getBudgetSummary', risk: 'R0', desc: 'Resumo do orçamento (saldo sem/com hipóteses).', input: { type: 'object', properties: {} },
      run() {
        const s = H().sums(), n = s.realCount;
        const hyp = s.hypoCount ? ` Há ainda ${fmt(s.hypo)} em hipóteses (${s.hypoCount}), que ficam fora do total.` : '';
        let speak, saldoLines = [];
        if (!s.limit) {
          speak = `O teto do orçamento ainda não foi definido, então não calculo saldo. As previsões somam ${fmt(s.planned)} em ${T().plural(n, 'item', 'itens')}, com ${fmt(s.paid)} pagos e ${fmt(s.open)} em aberto.${hyp}`;
        } else {
          const comHip = s.remaining - s.hypo;
          speak = `Teto de ${fmt(s.limit)}, planejado ${fmt(s.planned)} e reserva de ${fmt(s.reserve)}. A margem é de ${fmt(s.remaining)}${s.hypoCount ? `; considerando as hipóteses, ${fmt(comHip)}` : ''}.${s.remaining < 0 ? ' Está acima do limite de segurança.' : ''}`;
          saldoLines = [`Saldo sem hipóteses: ${fmt(s.remaining)}`, `Saldo com hipóteses: ${fmt(comHip)}`];
        }
        return ok({ speak, lines: [`Planejado: ${fmt(s.planned)}`, `Pago: ${fmt(s.paid)}`, `Em aberto: ${fmt(s.open)}`, ...saldoLines, s.hypoCount ? `Hipóteses (fora dos totais): ${fmt(s.hypo)}` : ''].filter(Boolean), data: s, panel: 'budget' });
      },
    });

    def({
      name: 'listBudgetItems', risk: 'R0', desc: 'Lista itens do orçamento.',
      input: { type: 'object', properties: { category: S.str(40), text: S.str(80), hypothetical: { type: 'boolean' }, limit: { type: 'integer', min: 1, max: 50, default: 10 } } },
      run(a) {
        let items = D().budget.slice();
        if (a.category) items = items.filter(x => T().norm(x.category) === T().norm(a.category));
        if (a.text) items = items.filter(x => T().score(a.text, x.title) >= 0.45);
        if (a.hypothetical !== undefined) items = items.filter(x => !!x.hypothetical === a.hypothetical);
        if (!items.length) return ok({ speak: 'Não há itens de orçamento com esse filtro.', lines: [] });
        const shown = items.slice(0, a.limit || 10);
        return ok({ speak: `Encontrei ${T().plural(items.length, 'item', 'itens')}. ${shown.slice(0, 3).map(x => `${x.title}, ${fmt(x.estimate)}`).join('; ')}${items.length > 3 ? '; e mais na tela' : ''}.`, lines: shown.map(x => `• ${x.title} · ${x.category} · ${fmt(x.estimate)}${x.hypothetical ? ' (hipótese)' : ''}`), data: shown, panel: 'budget' });
      },
    });

    function guestCounts() {
      const d = D(), g = H().guestsInfo();
      const withFields = d.guests.filter(x => x.adults !== undefined && x.children !== undefined);
      const total = d.guests.reduce((n, x) => n + Math.max(1, H().int(x.qty)), 0);
      const adults = withFields.reduce((n, x) => n + H().int(x.adults), 0), children = withFields.reduce((n, x) => n + H().int(x.children), 0);
      const complete = withFields.length === d.guests.length;
      return { total, adults, children, fieldsComplete: complete, invites: d.guests.length, confirmed: g.yes, pending: g.pending, declined: g.no, goal: H().int(d.settings.guestGoal), mismatch: Iris.briefing.guestMismatch(d).length, bySide: ['Gabriel', 'Isabelle', 'Ambos'].map(sd => ({ side: sd, people: d.guests.filter(x => x.side === sd).reduce((n, x) => n + Math.max(1, H().int(x.qty)), 0) })) };
    }
    def({
      name: 'getGuestCounts', risk: 'R0', desc: 'Contagens de convidados (adultos, crianças, presença).', input: { type: 'object', properties: {} },
      run() {
        const c = guestCounts(), d = D();
        const split = c.fieldsComplete ? `${T().plural(c.adults, 'adulto')} e ${T().plural(c.children, 'criança')}` : null;
        const base = split ? `Estão previstos ${split}, ${c.total} pessoas no total` : `Estão previstas ${c.total} pessoas`;
        const warn = (d.sourceNotes || []).length ? ' Existem fontes anteriores com contagens diferentes, então trate como provisória.' : ' Trate como contagem provisória.';
        return ok({
          speak: `${base}, em ${T().plural(c.invites, 'convite')}. ${c.confirmed} confirmada${c.confirmed === 1 ? '' : 's'}, ${c.pending} sem resposta.${warn}`,
          lines: [`Total previsto: ${c.total}${c.goal ? ` (meta configurada: ${c.goal})` : ''}`, split ? `Adultos: ${c.adults} · Crianças: ${c.children}` : 'Adultos/crianças: preenchimento incompleto nos convites', `Confirmados: ${c.confirmed} · Sem resposta: ${c.pending} · Não vão: ${c.declined}`, ...c.bySide.map(x => `Lado ${x.side}: ${x.people} pessoas`), c.mismatch ? `⚠ ${c.mismatch} convite(s) com adultos + crianças ≠ total` : '', ...(d.sourceNotes || []).map(x => `⚠ ${x}`)].filter(Boolean),
          data: c, panel: 'guests',
        });
      },
    });

    def({
      name: 'listGuests', risk: 'R0', desc: 'Lista convidados (nomes só na tela).',
      input: { type: 'object', properties: { side: S.str(20), attendance: { type: 'string', enum: ATTENDANCE }, group: S.str(30), text: S.str(80), limit: { type: 'integer', min: 1, max: 60, default: 12 } } },
      run(a) {
        let l = D().guests.slice();
        if (a.side) l = l.filter(x => T().norm(x.side) === T().norm(a.side));
        if (a.attendance) l = l.filter(x => x.attendance === a.attendance);
        if (a.group) l = l.filter(x => T().norm(x.group || '').includes(T().norm(a.group)));
        if (a.text) l = l.filter(x => T().norm(x.name).includes(T().norm(a.text)));
        const people = l.reduce((n, x) => n + Math.max(1, H().int(x.qty)), 0);
        if (a.text) ns.setGuestQuery(a.text);
        return ok({ speak: `${T().plural(l.length, 'convite')} nesse filtro, somando ${T().plural(people, 'pessoa')}. Os nomes estão na tela.`, lines: l.slice(0, a.limit || 12).map(x => `• ${x.name} · ${x.qty} · ${x.attendance}`), data: { invites: l.length, people }, panel: 'guests' });
      },
    });

    def({
      name: 'listGodparents', risk: 'R0', desc: 'Padrinhos por lado, com indicação de fotos.',
      input: { type: 'object', properties: { side: S.str(20) } },
      run(a) {
        const d = D();
        const side = a.side ? (/noiv[ao]|gabriel/i.test(T().norm(a.side)) && !/noiva/.test(T().norm(a.side)) ? 'Gabriel' : 'Isabelle') : null;
        const pairs = d.couples.filter(x => x.role !== 'Entrada' && (!side || x.side === side));
        const photos = (d.padrinhoFotos || []).filter(p => pairs.some(c => c.id === p.coupleId));
        const names = pairs.map(x => x.name);
        const review = photos.filter(p => p.status === 'sugerido').length;
        return ok({
          speak: `${side ? `Padrinhos do ${side === 'Gabriel' ? 'noivo' : 'da noiva'}: ` : 'Padrinhos: '}${T().plural(pairs.length, 'par', 'pares')}${side ? `, ${T().humanList(names)}` : ''}. ${photos.length ? `${T().plural(photos.length, 'par')} com foto${review ? `, ${review} com vínculo a revisar` : ''}.` : 'Ainda não há fotos vinculadas.'}`,
          lines: pairs.map(x => `• ${x.name}${photos.find(p => p.coupleId === x.id) ? ' 📷' : ''}`), data: { pairs: pairs.length, withPhoto: photos.length }, panel: 'godparents',
        });
      },
    });

    def({
      name: 'openSection', risk: 'R0', desc: 'Abre uma seção do app.', input: { type: 'object', required: ['section'], properties: { section: { type: 'string', enum: SECTIONS }, side: S.str(20) } },
      run(a) {
        if (a.section === 'iris') return ok({ speak: 'Já estou aqui com você.' });
        ns.navigate(a.section);
        return ok({ speak: `Abri ${sectionLabel(a.section)}.`, ui: { opened: a.section }, data: { section: a.section } });
      },
    });

    def({
      name: 'listVendors', risk: 'R0', desc: 'Lista fornecedores por categoria.', input: { type: 'object', properties: { category: S.str(40) } },
      run(a) {
        let l = D().vendors.slice();
        if (a.category) l = l.filter(x => T().norm(x.kind).includes(T().norm(a.category)) || T().norm(x.name).includes(T().norm(a.category)));
        if (!l.length) return ok({ speak: 'Nenhum fornecedor cadastrado nessa categoria.', lines: [] });
        const closed = l.filter(x => x.status === 'Fechado').length, quoted = l.filter(x => H().int(x.quote) > 0).length;
        return ok({ speak: `${T().plural(l.length, 'fornecedor', 'fornecedores')} nessa lista, ${quoted} com cotação e ${closed} fechado${closed === 1 ? '' : 's'}. Pesquisar não é contratar.`, lines: l.map(x => `• ${x.name} · ${x.kind} · ${x.status}${H().int(x.quote) ? ' · ' + fmt(x.quote) : ' · sem cotação'}`), data: { n: l.length }, panel: 'vendors' });
      },
    });

    def({
      name: 'compareVendorQuotes', risk: 'R0', desc: 'Compara cotações de fornecedores.', input: { type: 'object', properties: { category: S.str(40), names: { type: 'array', maxItems: 6, items: S.str(60) } } },
      run(a) {
        let l = D().vendors.slice();
        if (a.names && a.names.length) l = a.names.map(n => (T().bestMatch(n, D().vendors, x => x.name, 0.4) || {}).item).filter(Boolean);
        else if (a.category) l = l.filter(x => T().norm(x.kind).includes(T().norm(a.category)));
        const quoted = l.filter(x => H().int(x.quote) > 0), missing = l.filter(x => H().int(x.quote) === 0);
        if (quoted.length < 2) {
          return ok({
            speak: `Ainda não dá para comparar: ${quoted.length ? 'só um tem cotação' : 'nenhum tem cotação cadastrada'}. Faltam valores de ${T().humanList(missing.slice(0, 4).map(x => x.name))}. Posso abrir o formulário para registrar.`,
            lines: ['Para comparar com justiça, registre para cada proposta: valor total, o que está incluso, forma de pagamento, taxas e regras de cancelamento.'], ui: { chips: [{ label: 'Abrir fornecedores', say: 'abre fornecedores' }] }, data: { quoted: quoted.length, missing: missing.length },
          });
        }
        const sorted = quoted.slice().sort((x, y) => x.quote - y.quote);
        return ok({ speak: `Entre as cotações cadastradas, a mais baixa é ${sorted[0].name}, com ${fmt(sorted[0].quote)}, e a mais alta é ${sorted[sorted.length - 1].name}, com ${fmt(sorted[sorted.length - 1].quote)}. Confira se o escopo é o mesmo antes de decidir.`, lines: sorted.map(x => `• ${x.name}: ${fmt(x.quote)} (${x.status})`), data: sorted, panel: 'vendors' });
      },
    });

    const catalog = () => ns.catalogs.sweetCatalog;
    def({
      name: 'getSweetsCatalog', risk: 'R0', desc: 'Consulta o catálogo Elizete Doces Finos 2026–2027.', input: { type: 'object', properties: { category: S.str(40), text: S.str(80), maxPrice: S.num(0, 10000), limit: { type: 'integer', min: 1, max: 40, default: 8 } } },
      run(a) {
        let l = catalog().slice();
        if (a.category) l = l.filter(x => T().norm(x.category).includes(T().norm(a.category)));
        if (a.text) l = l.filter(x => T().norm(x.name).includes(T().norm(a.text)));
        if (a.maxPrice) l = l.filter(x => x.price <= a.maxPrice);
        const cs = [...new Set(catalog().map(x => x.category))];
        if (!l.length) return ok({ speak: `Não achei esse item. As categorias do catálogo são ${T().humanList(cs)}.` });
        return ok({ speak: `${T().plural(l.length, 'item', 'itens')} no catálogo, de ${fmt(Math.min(...l.map(x => x.price)))} a ${fmt(Math.max(...l.map(x => x.price)))}. É catálogo, não contrato: confirmar disponibilidade e preço para a data.`, lines: l.slice(0, a.limit || 8).map(x => `• ${x.name} · ${x.category} · ${fmt(x.price)}/${x.unit}`), data: { n: l.length }, panel: 'sweets' });
      },
    });

    const minFor = it => (it.unit === 'kg' ? 2 : 25);
    def({
      name: 'calculateSweetsBasket', risk: 'R0', desc: 'Simula custo de doces (não grava, não contrata).',
      input: { type: 'object', properties: { qty: { type: 'integer', min: 1, max: 100000 }, unitPrice: S.num(0.01, 100000), flavors: { type: 'integer', min: 1, max: 200 }, items: { type: 'array', maxItems: 40, items: { type: 'object', properties: { id: S.str(40), query: S.str(80), qty: { type: 'number', min: 0, max: 100000 } } } } } },
      run(a) {
        const note = 'Simulação com o catálogo Elizete 2026–2027; não é orçamento nem contratação, e entrega/montagem ficam à parte.';
        if (a.items && a.items.length) {
          const lines = [], warns = []; let total = 0;
          for (const r of a.items) {
            const it = r.id ? catalog().find(x => x.id === r.id) : (T().bestMatch(r.query || '', catalog(), x => x.name, 0.5) || {}).item;
            if (!it) { warns.push(`Não achei "${r.query || r.id}" no catálogo.`); continue; }
            const q = Number(r.qty) || 0, sub = q * it.price; total += sub;
            lines.push(`• ${it.name}: ${q} ${it.unit} × ${fmt(it.price)} = ${fmt(sub)}`);
            if (q < minFor(it)) warns.push(`${it.name}: mínimo de ${minFor(it)} ${it.unit} por sabor/item (pedido: ${q}).`);
          }
          return ok({ speak: `Essa seleção soma ${fmt(total)}.${warns.length ? ` Atenção: ${warns[0]}` : ''} ${note}`, lines: [...lines, ...warns.map(w => '⚠ ' + w), note], data: { total, warns }, panel: 'sweets' });
        }
        if (!a.qty || !a.unitPrice) return fail('Para simular preciso da quantidade e do preço por unidade. Por exemplo: 250 doces de R$ 4,50.');
        const total = Math.round(a.qty * a.unitPrice * 100) / 100;
        const same = catalog().filter(x => x.unit === 'un.' && Math.abs(x.price - a.unitPrice) < 0.005);
        const maxFlavors = Math.floor(a.qty / 25);
        const lines = [`${a.qty} unidades × ${fmt(a.unitPrice)} = ${fmt(total)}`, `Mínimo de 25 unidades por sabor ⇒ no máximo ${maxFlavors} sabor${maxFlavors === 1 ? '' : 'es'} com ${a.qty} unidades.`];
        if (same.length) lines.push(`No catálogo a ${fmt(a.unitPrice)}: ${[...new Set(same.map(x => x.category))].join(', ')} (ex.: ${same.slice(0, 3).map(x => x.name).join(', ')}).`); else lines.push(`Nenhum item do catálogo custa exatamente ${fmt(a.unitPrice)} por unidade; confira os valores.`);
        let flavorWarn = '';
        if (a.flavors) { const per = a.qty / a.flavors; if (per < 25) flavorWarn = ` Com ${a.flavors} sabores seriam ${Math.floor(per)} de cada, abaixo do mínimo de 25.`; }
        lines.push(note);
        return ok({ speak: `${a.qty} doces a ${fmt(a.unitPrice)} custam ${fmt(total)}. Pelo mínimo de 25 por sabor, dá para até ${maxFlavors} sabores.${flavorWarn} ${note}`, lines, data: { total, maxFlavors }, panel: 'sweets' });
      },
    });

    def({
      name: 'getGiftRegistry', risk: 'R0', desc: 'Lista de presentes da casa nova.', input: { type: 'object', properties: { group: S.str(40), text: S.str(80), onlyPriced: { type: 'boolean' }, limit: { type: 'integer', min: 1, max: 40, default: 8 } } },
      run(a) {
        let l = D().gifts.slice();
        if (a.group) l = l.filter(x => T().norm(x.group || '').includes(T().norm(a.group)));
        if (a.text) l = l.filter(x => T().norm(x.name).includes(T().norm(a.text)));
        if (a.onlyPriced) l = l.filter(x => Number(x.price) > 0);
        const priced = l.filter(x => Number(x.price) > 0);
        return ok({ speak: `${T().plural(l.length, 'presente')} na lista, ${priced.length} com preço de referência. Os valores são pesquisas pontuais com fonte e data, não uma média entre lojas.`, lines: l.slice(0, a.limit || 8).map(x => `• ${x.name} · ${Number(x.price) > 0 ? fmt(x.price) : 'a cotar'} · ${x.store || 'sem fonte'}`), data: { n: l.length }, panel: 'gifts' });
      },
    });

    def({
      name: 'listCeremonySchedule', risk: 'R0', desc: 'Roteiro da cerimônia e tarefas.', input: { type: 'object', properties: {} },
      run() {
        const d = D(), tl = [...d.timeline].sort((a, b) => String(a.time).localeCompare(String(b.time))), pend = d.tasks.filter(x => !x.done);
        return ok({
          speak: tl.length ? `O roteiro tem ${T().plural(tl.length, 'momento')}, começando às ${tl[0].time} com ${tl[0].title}. Há ${T().plural(pend.length, 'tarefa')} pendente${pend.length === 1 ? '' : 's'}.` : `O roteiro da cerimônia ainda está em branco. Há ${T().plural(pend.length, 'tarefa')} pendente${pend.length === 1 ? '' : 's'}. Quer que eu proponha um primeiro momento?`,
          lines: [...tl.map(x => `${x.time} · ${x.title}`), ...pend.slice(0, 6).map(x => `☐ ${x.title}`)], data: { moments: tl.length, pending: pend.length }, panel: 'ceremony',
        });
      },
    });

    function votesView() {
      const d = D(), A = d.settings.personA, B = d.settings.personB, label = v => ({ sim: 'amou', talvez: 'talvez', nao: 'não curtiu' }[v] || 'sem opinião');
      return d.ideas.map(x => ({ id: x.id, title: x.title, a: x.votes && x.votes.a, b: x.votes && x.votes.b, text: `${x.title}: ${A} ${label(x.votes && x.votes.a)}, ${B} ${label(x.votes && x.votes.b)}` }));
    }
    def({
      name: 'getIdeaVotes', risk: 'R0', desc: 'Votos do casal nas ideias (sem misturar opiniões).', input: { type: 'object', properties: {} },
      run() {
        const v = votesView(); if (!v.length) return ok({ speak: 'Ainda não há ideias guardadas. Quer registrar a primeira?', chips: [] });
        const both = v.filter(x => x.a === 'sim' && x.b === 'sim'), diff = v.filter(x => x.a && x.b && x.a !== x.b);
        return ok({ speak: `${T().plural(v.length, 'ideia')} guardada${v.length === 1 ? '' : 's'}: ${T().plural(both.length, 'que os dois amaram', 'que os dois amaram')} e ${T().plural(diff.length, 'com opiniões diferentes', 'com opiniões diferentes')}. Mantenho as opiniões separadas.`, lines: v.map(x => '• ' + x.text), data: v, panel: 'ideas' });
      },
    });

    def({
      name: 'getVenueStatus', risk: 'R0', desc: 'Situação do local (sem inventar condições).', input: { type: 'object', properties: {} },
      run() {
        const v = venue(); if (!v) return ok({ speak: 'Não há local cadastrado ainda. Quer registrar a chácara?' });
        const gaps = ['contrato', 'valor/orçamento', 'data reservada', 'capacidade', 'cardápio incluso', 'plano B para chuva', 'regras de som e horário', 'fornecedores externos permitidos'];
        return ok({ speak: `${v.name} é o local planejado, mas está como "${v.status}": ${H().int(v.quote) ? `há cotação de ${fmt(v.quote)}` : 'sem orçamento'} e sem contrato registrado. Por isso não afirmo capacidade, cardápio, plano de chuva nem disponibilidade. Quando chegar a proposta, é só me ditar os valores e condições.`, lines: [`${v.name} · ${v.status}`, v.contact || '', 'O que ainda falta confirmar com o local:', ...gaps.map(g => '☐ ' + g)].filter(Boolean), data: v, panel: 'venue' });
      },
    });

    def({
      name: 'searchLocalProjectData', risk: 'R0', desc: 'Busca em todos os dados do projeto.', input: { type: 'object', required: ['query'], properties: { query: S.str(80, { minLength: 2 }) } },
      run(a) {
        const d = D(), out = [], q = a.query;
        const scan = (list, kind, textOf, section) => d[list].forEach(x => { if (T().score(q, textOf(x)) >= 0.5) out.push({ kind, label: textOf(x), section }); });
        scan('guests', 'convidado', x => x.name, 'convidados'); scan('couples', 'padrinho/entrada', x => x.name, 'padrinhos'); scan('vendors', 'fornecedor', x => x.name, 'fornecedores');
        scan('gifts', 'presente', x => x.name, 'presentes'); scan('ideas', 'ideia', x => x.title, 'ideias'); scan('tasks', 'tarefa', x => x.title, 'cerimonia'); scan('budget', 'orçamento', x => x.title, 'orcamento');
        catalog().forEach(x => { if (T().score(q, x.name) >= 0.6) out.push({ kind: 'doce', label: x.name, section: 'doces' }); });
        if (!out.length) return ok({ speak: `Não encontrei "${q}" nos dados do projeto.` });
        return ok({ speak: `Encontrei ${T().plural(out.length, 'resultado')}: ${out.slice(0, 3).map(x => `${x.label} (${x.kind})`).join('; ')}${out.length > 3 ? '; e mais na tela' : ''}.`, lines: out.slice(0, 12).map(x => `• ${x.label} — ${x.kind}`), data: out });
      },
    });

    def({
      name: 'getHistory', risk: 'R0', desc: 'Histórico de ações da Íris.', input: { type: 'object', properties: { actor: S.str(20), limit: { type: 'integer', min: 1, max: 50, default: 8 } } },
      run(a) {
        const l = audit.list({ actor: a.actor, limit: a.limit || 8 });
        if (!l.length) return ok({ speak: 'Ainda não fiz nenhuma alteração.' });
        const when = ts => new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        return ok({ speak: `Foram ${T().plural(l.length, 'ação registrada', 'ações registradas')}. A última foi: ${l[0].summary}.`, lines: l.map(e => `${when(e.ts)} · ${e.actor || '—'} · ${e.summary} · ${e.status}`), data: l.map(e => e.id) });
      },
    });

    def({
      name: 'remainingToOrganize', risk: 'R0', desc: 'Quanto ainda falta organizar (definição explícita).', input: { type: 'object', properties: {} },
      run() { const rem = Iris.briefing.remaining(ns), d = Iris.briefing.describeRemaining(rem); return ok({ speak: d.speak, lines: d.lines, data: rem, panel: 'remaining' }); },
    });

    def({
      name: 'simulateGuestScenarios', risk: 'R0', desc: 'Cenários de nº de convidados com hipóteses explícitas.',
      input: { type: 'object', required: ['counts'], properties: { counts: { type: 'array', maxItems: 6, items: { type: 'integer', min: 1, max: 5000 } }, sweetsPerGuest: S.num(0, 100), sweetUnitPrice: S.num(0, 1000) } },
      run(a) {
        const cur = guestCounts().total, spg = a.sweetsPerGuest ?? 5, price = a.sweetUnitPrice ?? 4.5;
        const limit = H().int(D().settings.budget);
        const rows = a.counts.map(n => ({ n, delta: n - cur, sweets: Math.round(n * spg * price * 100) / 100, perGuest: limit ? Math.round(limit / n * 100) / 100 : null }));
        const hyp = `Hipóteses (minhas, editáveis): ${spg} doces por pessoa a ${fmt(price)} (referência de catálogo). Só o item "doces" é simulado; buffet, espaço e demais custos dependem de cotações.`;
        return ok({
          speak: `Simulando ${T().humanList(rows.map(r => String(r.n)))} convidados com ${spg} doces por pessoa a ${fmt(price)}: ${T().humanList(rows.map(r => `${r.n} → ${fmt(r.sweets)}`))}. O número real continua ${cur}; não alterei nada.`,
          lines: [...rows.map(r => `${r.n} convidados (${r.delta >= 0 ? '+' : ''}${r.delta} vs. atual ${cur}): doces ${fmt(r.sweets)}${r.perGuest !== null ? ` · teto por pessoa ${fmt(r.perGuest)}` : ''}`), hyp], data: rows, panel: 'scenarios',
        });
      },
    });

    def({
      name: 'reviewNameEquivalences', risk: 'R0', desc: 'Possíveis equivalências de nomes (nunca mescla).', input: { type: 'object', properties: {} },
      run() {
        const eq = D().nameEquivalences || [], rev = (D().padrinhoFotos || []).filter(p => p.status === 'sugerido');
        if (!eq.length && !rev.length) return ok({ speak: 'Não há equivalências de nomes sinalizadas para revisar.' });
        return ok({ speak: `Há ${T().plural(eq.length, 'possível equivalência de nome', 'possíveis equivalências de nome')} e ${T().plural(rev.length, 'foto', 'fotos')} com vínculo sugerido. Nada foi mesclado nem trocado; é só para vocês conferirem.`, lines: [...eq.map(e => `• ${e.a} ⇄ ${e.b} — ${e.note}`), ...rev.map(p => `📷 ${p.label}: ${p.note}`)], data: { eq: eq.length, photos: rev.length }, ui: { chips: [{ label: 'Abrir padrinhos', say: 'abre padrinhos' }] } });
      },
    });

    def({
      name: 'explainPhoto', risk: 'R0', desc: 'Informa a legenda atribuída pelo casal a uma foto (sem reconhecimento facial).', input: { type: 'object', properties: { photoId: S.str(40) } },
      run(a, ctx) {
        const fotos = D().padrinhoFotos || [];
        const p = fotos.find(x => x.id === (a.photoId || (ctx && ctx.focusPhoto)));
        const refusal = 'Eu não identifico pessoas pelo rosto.';
        if (!p) return ok({ speak: `${refusal} Se abrir uma foto na lista de padrinhos, eu leio a legenda que vocês atribuíram a ela.`, ui: { chips: [{ label: 'Abrir padrinhos', say: 'abre padrinhos' }] } });
        const link = D().couples.find(c => c.id === p.coupleId);
        return ok({ speak: `${refusal} A legenda que vocês deram a esta foto é "${p.label}"${link ? `, vinculada ao par "${link.name}"` : ''}${p.status === 'sugerido' ? ', e esse vínculo ainda está para revisão' : ''}.`, lines: [p.note || ''].filter(Boolean) });
      },
    });

    // ============================ ESCRITA ============================
    const prepared = (summary, diff, execute, extra = {}) => ok({ prepared: true, summary, diff, execute, ...extra });
    const D2 = (label, from, to) => ({ label, from: from === undefined ? null : from, to });

    def({
      name: 'proposeBudgetItem', risk: 'R1b', riskFor: a => (H().int(a.paid) > 0 ? 'R2' : 'R1b'),
      desc: 'Propõe novo item/valor no orçamento (ou hipótese).',
      input: { type: 'object', required: ['title', 'estimate'], properties: { title: S.str(80, { minLength: 2 }), category: S.str(30), estimate: S.num(0.01, 1e8), paid: S.num(0, 1e8, ), hypothetical: { type: 'boolean' }, vendorId: S.str(60), existingId: S.str(60), mode: { type: 'string', enum: ['sum', 'replace', 'new'] } } },
      prepare(a) {
        const d = D();
        let category = a.category && cats().includes(a.category) ? a.category : (T().guessCategory(a.title, cats()) || 'Outros');
        const paid = a.hypothetical ? 0 : H().int(a.paid || 0);
        if (paid > a.estimate) return fail('O valor pago não pode ser maior que o planejado.');
        const dup = a.mode ? null : T().bestMatch(a.title, d.budget.filter(x => !!x.hypothetical === !!a.hypothetical), x => x.title, 0.7);
        if (dup) {
          const it = dup.item;
          return { ok: false, clarify: true, speak: `Já existe "${it.title}" no orçamento com ${fmt(it.estimate)}. Quer somar ${fmt(a.estimate)} (ficando ${fmt(it.estimate + a.estimate)}), substituir o valor ou criar um item novo?`,
            options: [{ key: 'somar', label: 'Somar', words: ['somar', 'soma', 'somando', 'acrescentar', 'adicionar'], args: { mode: 'sum' } }, { key: 'substituir', label: 'Substituir', words: ['substituir', 'substitui', 'trocar', 'troca', 'mudar'], args: { mode: 'replace' } }, { key: 'novo', label: 'Criar novo', words: ['novo', 'criar', 'outro', 'separado'], args: { mode: 'new' } }], existingId: it.id };
        }
        if (a.mode === 'sum' || a.mode === 'replace') {
          const it = (a.existingId && d.budget.find(x => x.id === a.existingId)) || (T().bestMatch(a.title, d.budget, x => x.title, 0.6) || {}).item;
          if (!it) return fail('Não achei o item para ajustar.');
          const to = a.mode === 'sum' ? it.estimate + a.estimate : a.estimate;
          return prepared(`${it.title}: ${fmt(it.estimate)} → ${fmt(to)}`, [D2('Item', it.title, it.title), D2('Previsão', fmt(it.estimate), fmt(to))], () => { const r = mut(dd => [OPS().update(dd, 'budget', it.id, { estimate: to })]); return { ops: r, speak: `Pronto: ${it.title} agora está em ${fmt(to)}. ${totalsLine()}`, ui: {} }; });
        }
        const item = { id: H().id(), title: a.title, category, estimate: a.estimate, paid, ...(a.hypothetical ? { hypothetical: true } : {}), ...(a.vendorId ? { vendorId: a.vendorId } : {}), origin: a.hypothetical ? 'hipótese registrada pela Íris' : 'previsão registrada pela Íris' };
        return prepared(`${a.hypothetical ? 'Hipótese' : 'Novo item'}: ${a.title} · ${category} · ${fmt(a.estimate)}`, [D2('Item', null, a.title), D2('Categoria', null, category), D2(a.hypothetical ? 'Valor (hipótese)' : 'Previsão', null, fmt(a.estimate)), D2('Entra nos totais?', null, a.hypothetical ? 'Não — fica à parte, como hipótese' : 'Sim'), ...(paid ? [D2('Já pago', null, fmt(paid))] : [])],
          () => { const r = mut(dd => [OPS().add(dd, 'budget', item)]); return { ops: r, speak: `Pronto: ${a.hypothetical ? 'hipótese de ' : ''}${a.title} em ${category}, ${fmt(a.estimate)}. ${a.hypothetical ? 'Ela fica fora dos totais. ' : ''}${totalsLine()}`, ui: { open: 'orcamento' } }; }, { warnings: [] });
      },
    });

    def({
      name: 'updateBudgetItem', risk: 'R1b', riskFor: a => (a.patch && a.patch.paid !== undefined ? 'R2' : 'R1b'),
      desc: 'Altera item do orçamento.', input: { type: 'object', properties: { id: S.str(60), query: S.str(80), patch: { type: 'object', properties: { title: S.str(80), category: S.str(30), estimate: S.num(0, 1e8), paid: S.num(0, 1e8), hypothetical: { type: 'boolean' } } } }, required: ['patch'] },
      prepare(a) {
        const r = resolve('budget', a, nameOf.budget); if (!r.item) return notFound('item de orçamento', r, 'budget');
        const it = r.item, p = { ...a.patch };
        if (p.category && !cats().includes(p.category)) return fail(`Categoria inválida. Use uma de: ${cats().join(', ')}.`);
        const est = p.estimate ?? it.estimate, paid = p.hypothetical ? 0 : (p.paid ?? it.paid);
        if (paid > est) return fail('O valor pago não pode ser maior que o planejado.');
        const diff = Object.entries(p).map(([k, v]) => D2({ title: 'Título', category: 'Categoria', estimate: 'Previsão', paid: 'Já pago', hypothetical: 'Hipótese' }[k] || k, k === 'estimate' || k === 'paid' ? fmt(it[k]) : it[k], k === 'estimate' || k === 'paid' ? fmt(v) : v));
        if (p.hypothetical === false && it.hypothetical) diff.push(D2('Efeito', 'fora dos totais', 'passa a entrar nos totais'));
        return prepared(`Alterar "${it.title}": ${diff.map(x => `${x.label} ${x.from ?? '—'} → ${x.to}`).join('; ')}`, diff, () => {
          const ops = mut(dd => [OPS().update(dd, 'budget', it.id, p)]);
          return { ops, speak: `Pronto, atualizei "${it.title}". ${totalsLine()}`, ui: { open: 'orcamento' } };
        });
      },
    });

    def({
      name: 'registerPayment', risk: 'R2', desc: 'Registra um pagamento JÁ feito pelo casal (a Íris não paga nada).',
      input: { type: 'object', required: ['amount'], properties: { id: S.str(60), query: S.str(80), amount: S.num(0.01, 1e8) } },
      prepare(a) {
        const r = resolve('budget', a, nameOf.budget); if (!r.item) return notFound('item de orçamento', r, 'budget');
        const it = r.item; if (it.hypothetical) return fail('Isso é uma hipótese; não registro pagamento em hipótese.');
        const to = H().int(it.paid) + a.amount; if (to > it.estimate) return fail(`O total pago passaria da previsão (${fmt(it.estimate)}). Ajuste a previsão antes.`);
        return prepared(`Registrar pagamento de ${fmt(a.amount)} em "${it.title}" (total pago ${fmt(it.paid)} → ${fmt(to)})`, [D2('Item', it.title, it.title), D2('Já pago', fmt(it.paid), fmt(to))],
          () => ({ ops: mut(dd => [OPS().update(dd, 'budget', it.id, { paid: to })]), speak: `Registrado. Lembrando que eu só anoto: não realizo pagamentos. ${it.title} agora tem ${fmt(to)} pagos.`, ui: { open: 'orcamento' } }),
          { notice: 'Eu apenas registro um pagamento que já aconteceu; não efetuo pagamentos.' });
      },
    });

    def({
      name: 'proposeGuestUpdate', risk: 'R1b', desc: 'Altera ou cria um convite (presença só por afirmação direta).',
      input: { type: 'object', properties: { id: S.str(60), query: S.str(80), create: { type: 'boolean' }, name: S.str(80), side: S.str(20), group: S.str(30), userStated: { type: 'boolean' }, patch: { type: 'object', properties: { attendance: { type: 'string', enum: ATTENDANCE }, qty: { type: 'integer', min: 1, max: 50 }, adults: { type: 'integer', min: 0, max: 50 }, children: { type: 'integer', min: 0, max: 50 }, notes: S.str(300) } } } },
      prepare(a) {
        const d = D();
        if (a.create) {
          if (!a.name) return fail('Qual o nome do convidado ou da família?');
          const p = a.patch || {}, qty = p.qty || Math.max(1, (p.adults || 0) + (p.children || 0)) || 1;
          if (p.adults !== undefined && p.children !== undefined && p.adults + p.children !== qty) return fail('Adultos mais crianças precisa dar o total de pessoas do convite.');
          const g = { id: H().id(), name: a.name, group: a.group || 'Outros', qty, ...(p.adults !== undefined ? { adults: p.adults, children: p.children || 0 } : {}), side: a.side || 'Ambos', attendance: 'Pendente', notes: p.notes || '', source: 'registrado pela Íris' };
          return prepared(`Novo convite: ${g.name} · ${g.qty} pessoa(s) · pendente`, [D2('Convite', null, g.name), D2('Pessoas', null, g.qty), D2('Presença', null, 'Pendente')], () => ({ ops: mut(dd => [OPS().add(dd, 'guests', g)]), speak: `Adicionei ${g.name} como pendente. O total previsto agora é ${guestCounts().total}.`, ui: { open: 'convidados' } }));
        }
        const r = resolve('guests', a, nameOf.guests); if (!r.item) return notFound('convite', r, 'guests');
        const g = r.item, p = { ...(a.patch || {}) };
        if (p.attendance === 'Confirmado' && !a.userStated) return fail('Só marco presença como confirmada quando vocês me dizem diretamente que a pessoa confirmou — nunca por foto ou planilha antiga.');
        const qty = p.qty ?? g.qty, ad = p.adults ?? g.adults, ch = p.children ?? g.children;
        if (ad !== undefined && ch !== undefined && ad + ch !== qty) return fail(`Adultos (${ad}) + crianças (${ch}) não dão ${qty} pessoas. Ajuste os três juntos.`);
        const L = { attendance: 'Presença', qty: 'Pessoas', adults: 'Adultos', children: 'Crianças', notes: 'Observações' };
        const diff = Object.entries(p).map(([k, v]) => D2(L[k], g[k], v));
        return prepared(`Convite "${g.name}": ${diff.map(x => `${x.label} ${x.from ?? '—'} → ${x.to}`).join('; ')}`, diff, () => ({ ops: mut(dd => [OPS().update(dd, 'guests', g.id, p)]), speak: `Atualizei ${g.name}. Total previsto: ${guestCounts().total} pessoas.`, ui: { open: 'convidados' } }),
          { warnings: p.qty !== undefined && (g.adults !== undefined) && (p.adults === undefined) ? ['O total mudou, mas adultos/crianças não foram ajustados.'] : [] });
      },
    });

    def({
      name: 'proposeVendor', risk: 'R1b', desc: 'Cadastra fornecedor pesquisado (não é contratação).',
      input: { type: 'object', required: ['name'], properties: { name: S.str(80, { minLength: 2 }), kind: S.str(30), quote: S.num(0, 1e8), contact: S.str(200), notes: S.str(400) } },
      prepare(a) {
        const exists = T().bestMatch(a.name, D().vendors, x => x.name, 0.6);
        if (exists) { const v = exists.item; return ok({ noop: true, speak: `${v.name} já está em fornecedores como "${v.status}"${H().int(v.quote) ? ` com cotação de ${fmt(v.quote)}` : ', sem cotação'}. Não dupliquei. Isso é pesquisa, não contratação.`, ui: { opened: 'fornecedores' } }); }
        const kinds = ns.catalogs.kinds; let kind = kinds.includes(a.kind) ? a.kind : null;
        if (!kind) {
          const txt = T().norm((a.kind || '') + ' ' + a.name);
          if (/doce|bolo|confeit/.test(txt) && kinds.includes('Doces e bolo')) kind = 'Doces e bolo';
          else { const g = T().guessCategory(txt, kinds); kind = g && kinds.includes(g) ? g : 'Outros'; }
        }
        const v = { id: H().id(), name: a.name, kind, quote: a.quote || 0, contact: a.contact || '', status: 'Pesquisando', rating: 'Ainda não avaliado', notes: a.notes || 'Cadastrado pela Íris. Pesquisa — sem contrato.' };
        return prepared(`Novo fornecedor: ${v.name} · ${kind} · Pesquisando`, [D2('Fornecedor', null, v.name), D2('Serviço', null, kind), D2('Status', null, 'Pesquisando (sem contrato)'), ...(v.quote ? [D2('Cotação informada', null, fmt(v.quote))] : [])], () => ({ ops: mut(dd => [OPS().add(dd, 'vendors', v)]), speak: `Cadastrei ${v.name} em fornecedores como pesquisando. Não marquei como contratado.`, ui: { open: 'fornecedores' } }));
      },
    });

    def({
      name: 'markVendorClosed', risk: 'R2', desc: 'Marca fornecedor como FECHADO (só se houve contrato).', input: { type: 'object', properties: { id: S.str(60), query: S.str(80) } },
      prepare(a) {
        const r = resolve('vendors', a, nameOf.vendors); if (!r.item) return notFound('fornecedor', r, 'vendors');
        const v = r.item; if (v.status === 'Fechado') return ok({ noop: true, speak: `${v.name} já está como fechado.` });
        return prepared(`Marcar "${v.name}" como FECHADO (contratado)`, [D2('Status', v.status, 'Fechado')], () => ({ ops: mut(dd => [OPS().update(dd, 'vendors', v.id, { status: 'Fechado' })]), speak: `Marquei ${v.name} como fechado. Se foi engano, é só desfazer.`, ui: { open: 'fornecedores' } }), { notice: 'Só confirme se já existe contrato assinado ou acordo fechado.' });
      },
    });

    def({
      name: 'changeWeddingDate', risk: 'R2', desc: 'Altera a data de referência do casamento.', input: { type: 'object', required: ['date'], properties: { date: S.str(10, { pattern: '^\\d{4}-\\d{2}-\\d{2}$' }) } },
      prepare(a) {
        const from = D().settings.date; if (from === a.date) return ok({ noop: true, speak: 'Essa já é a data cadastrada.' });
        return prepared(`Mudar a data: ${T().fmtDateBR(from)} → ${T().fmtDateBR(a.date)}`, [D2('Data de referência', T().fmtDateBR(from), T().fmtDateBR(a.date))], () => ({ ops: mut(dd => [OPS().setSetting(dd, 'date', a.date)]), speak: `Data de referência alterada para ${T().fmtDateLong(a.date)}.`, ui: {} }), { notice: 'Isso muda a contagem regressiva e os prazos.' });
      },
    });

    def({
      name: 'deleteRecord', risk: 'R2', desc: 'Exclui um registro (convidado, item, fornecedor...).', input: { type: 'object', required: ['list'], properties: { list: { type: 'string', enum: LISTS }, id: S.str(60), query: S.str(80) } },
      prepare(a) {
        const r = resolve(a.list, a, nameOf[a.list]); if (!r.item) return notFound('registro', r, a.list);
        const it = r.item, nm = nameOf[a.list](it);
        return prepared(`Excluir "${nm}" (${a.list})`, [D2('Registro', nm, 'excluído')], () => ({ ops: mut(dd => [OPS().remove(dd, a.list, it.id)]), speak: `Excluí "${nm}". Dá para desfazer logo em seguida.`, ui: {} }), { notice: 'Exclusão é uma ação sensível.' });
      },
    });

    def({
      name: 'proposeIdea', risk: 'R1a', desc: 'Registra uma ideia (apenas quando solicitado).', input: { type: 'object', required: ['title'], properties: { title: S.str(100, { minLength: 2 }), category: S.str(20), details: S.str(600), author: S.str(20) } },
      prepare(a, ctx) {
        const catsI = ['Decoração', 'Música', 'Buffet', 'Cerimônia', 'Roupas', 'Viagem', 'Convidados', 'Surpresa', 'Outros'];
        const author = a.author || (ctx && ctx.actor) || '';
        const guess = { 'Decoração': ['decoracao', 'altar', 'flores'], 'Música': ['danca', 'musica', 'banda', 'dj', 'playlist'], 'Buffet': ['doces', 'buffet', 'sorvete', 'bolo'], 'Cerimônia': ['cerimonia', 'votos', 'entrada'], 'Surpresa': ['surpresa'] };
        let category = catsI.includes(a.category) ? a.category : 'Outros';
        if (!a.category) for (const [c, ws] of Object.entries(guess)) if (ws.some(w => T().norm(a.title + ' ' + (a.details || '')).includes(w))) { category = c; break; }
        const idea = { id: H().id(), title: a.title, category, details: a.details || '', votes: { a: null, b: null }, author, origin: `registrada pela Íris a pedido de ${author || 'um dos dois'}` };
        return prepared(`Ideia: ${a.title} (${category}) · autor: ${author || '—'}`, [D2('Ideia', null, a.title), D2('Assunto', null, category), D2('Autor', null, author || '—')], () => ({ ops: mut(dd => [OPS().add(dd, 'ideas', idea)]), speak: `Guardei a ideia "${a.title}"${author ? ` em nome de ${author}` : ''}. Os votos continuam separados para cada um.`, ui: { open: 'ideias' } }));
      },
    });

    def({
      name: 'addGiftIdea', risk: 'R1a', desc: 'Adiciona item à lista de presentes (sem inventar preço).', input: { type: 'object', required: ['name'], properties: { name: S.str(100, { minLength: 2 }), group: S.str(30), price: S.num(0, 1e7), store: S.str(60), notes: S.str(300) } },
      prepare(a) {
        const g = { id: H().id(), name: a.name, group: a.group || 'Casa', price: a.price || 0, store: a.store || '', url: '', notes: a.notes || (a.price ? 'Valor informado por voz, sem fonte verificada.' : 'Sem preço pesquisado.'), status: 'Desejado', origin: a.price ? 'valor informado pelo usuário (sem fonte)' : 'ideia registrada pela Íris' };
        return prepared(`Presente: ${g.name}${g.price ? ' · ' + fmt(g.price) : ' · a cotar'}`, [D2('Presente', null, g.name), D2('Preço', null, g.price ? fmt(g.price) + ' (sem fonte)' : 'a cotar')], () => ({ ops: mut(dd => [OPS().add(dd, 'gifts', g)]), speak: `Adicionei ${g.name} à lista de presentes${g.price ? '' : ', ainda sem preço pesquisado'}.`, ui: { open: 'presentes' } }));
      },
    });

    def({
      name: 'proposeCeremonyTask', risk: 'R1a', desc: 'Cria tarefa no checklist.', input: { type: 'object', required: ['title'], properties: { title: S.str(120, { minLength: 2 }), phase: S.str(30), owner: S.str(20), due: S.str(10, { pattern: '^\\d{4}-\\d{2}-\\d{2}$' }) } },
      prepare(a, ctx) {
        const phases = ['Primeiros passos', 'Planejamento', 'Fornecedores', 'Cerimônia', 'Semana do casamento', 'Pós-casamento', 'Geral'];
        const t = { id: H().id(), title: a.title, phase: phases.includes(a.phase) ? a.phase : 'Geral', due: a.due || '', owner: a.owner || 'Juntos', done: false };
        return prepared(`Tarefa: ${t.title} · ${t.phase} · ${t.owner}`, [D2('Tarefa', null, t.title), D2('Fase', null, t.phase), D2('Responsável', null, t.owner)], () => ({ ops: mut(dd => [OPS().add(dd, 'tasks', t)]), speak: `Criei a tarefa "${t.title}" para ${t.owner}.`, ui: { open: 'cerimonia' } }));
      },
    });

    def({
      name: 'proposeCeremonyEvent', risk: 'R1b', desc: 'Adiciona momento ao roteiro da cerimônia.', input: { type: 'object', required: ['time', 'title'], properties: { time: S.str(5, { pattern: '^\\d{2}:\\d{2}$' }), title: S.str(100, { minLength: 2 }), details: S.str(400) } },
      prepare(a) {
        const e = { id: H().id(), time: a.time, title: a.title, details: a.details || '' };
        return prepared(`Roteiro: ${e.time} · ${e.title}`, [D2('Horário', null, e.time), D2('Momento', null, e.title)], () => ({ ops: mut(dd => [OPS().add(dd, 'timeline', e)]), speak: `Adicionei ${e.title} às ${e.time} no roteiro. Horários e ordem são sugestões até a cerimônia ser definida.`, ui: { open: 'cerimonia' } }));
      },
    });

    def({
      name: 'saveSweetsSimulation', risk: 'R1a', desc: 'Salva quantidades na simulação de doces (continua sendo simulação).', input: { type: 'object', required: ['items'], properties: { items: { type: 'array', maxItems: 40, items: { type: 'object', properties: { id: S.str(40), query: S.str(80), qty: { type: 'number', min: 0, max: 100000 } } } } } },
      prepare(a) {
        const rows = a.items.map(r => ({ it: r.id ? catalog().find(x => x.id === r.id) : (T().bestMatch(r.query || '', catalog(), x => x.name, 0.5) || {}).item, qty: r.qty })).filter(r => r.it);
        if (!rows.length) return fail('Não achei esses itens no catálogo.');
        return prepared(`Simulação de doces: ${rows.map(r => `${r.it.name} ×${r.qty}`).join(', ')}`, rows.map(r => D2(r.it.name, D().sweetsQty[r.it.id] || 0, r.qty)), () => ({ ops: mut(dd => rows.map(r => OPS().setMap(dd, 'sweetsQty', r.it.id, r.qty))), speak: 'Salvei na simulação de doces. Continua sendo só simulação: nada foi contratado nem entrou no orçamento.', ui: { open: 'doces' } }));
      },
    });

    def({
      name: 'linkPadrinhoPhoto', risk: 'R1b', desc: 'Vincula uma foto a um par de padrinhos (vínculo, nunca mescla).', input: { type: 'object', required: ['coupleId', 'src'], properties: { coupleId: S.str(60), src: S.str(200), label: S.str(80), status: { type: 'string', enum: ['exato', 'sugerido', 'revisado'] } } },
      prepare(a) {
        const c = D().couples.find(x => x.id === a.coupleId); if (!c) return fail('Não achei esse par de padrinhos.');
        const ex = (D().padrinhoFotos || []).find(p => p.coupleId === a.coupleId);
        const entry = { id: ex ? ex.id : H().id(), coupleId: a.coupleId, label: a.label || (ex && ex.label) || c.name, src: a.src, status: a.status || 'revisado', note: (ex && ex.note) || '', crop: (ex && ex.crop) || { x: 50, y: 38, zoom: 1 } };
        return prepared(`Foto → ${c.name}${a.label ? ` (legenda "${a.label}")` : ''}`, [D2('Par', c.name, c.name), D2('Foto', ex ? ex.src : null, a.src)], () => ({ ops: mut(dd => { dd.padrinhoFotos = dd.padrinhoFotos || []; return [ex ? OPS().update(dd, 'padrinhoFotos', ex.id, entry) : OPS().add(dd, 'padrinhoFotos', entry)]; }), speak: `Vinculei a foto a ${c.name}. Não mesclei nem renomeei ninguém.`, ui: { open: 'padrinhos' } }));
      },
    });

    def({
      name: 'confirmPhotoLink', risk: 'R1a', desc: 'Marca um vínculo de foto como revisado.', input: { type: 'object', required: ['id'], properties: { id: S.str(60) } },
      prepare(a) {
        const p = (D().padrinhoFotos || []).find(x => x.id === a.id); if (!p) return fail('Não achei esse vínculo de foto.');
        return prepared(`Marcar vínculo "${p.label}" como revisado`, [D2('Vínculo', p.status, 'revisado')], () => ({ ops: mut(dd => [OPS().update(dd, 'padrinhoFotos', p.id, { status: 'revisado' })]), speak: 'Marquei o vínculo como revisado.', ui: {} }));
      },
    });

    def({
      name: 'rememberNote', risk: 'R1a', desc: 'Guarda uma nota na memória da Íris (visível e apagável).', input: { type: 'object', required: ['text'], properties: { text: S.str(400, { minLength: 3 }), source: S.str(20) } },
      prepare(a, ctx) {
        return prepared(`Lembrar: ${a.text}`, [D2('Nota', null, a.text)], () => { const m = memory.add({ text: a.text, source: a.source || 'declarado', author: (ctx && ctx.actor) || '' }); return { ops: [], memId: m && m.id, speak: 'Anotado. Você vê e apaga isso em "O que a Íris lembra".', ui: {} }; });
      },
    });

    def({
      name: 'undoRecentAction', risk: 'R1a', desc: 'Desfaz a última alteração (ou a indicada).', input: { type: 'object', properties: { actionId: S.str(60) } },
      run(a) {
        const e = a.actionId ? audit.get(a.actionId) : audit.latestUndoable();
        if (!e || !e.undoable || e.status !== 'executed') return fail('Não há nada recente para desfazer.');
        if (e.memId) { memory.remove(e.memId); audit.setStatus(e.id, 'undone'); return ok({ speak: 'Desfeito: apaguei a nota da memória.' }); }
        const test = Iris.audit.undoOps(clone(D()), e.ops);
        if (!test.ok) return fail(`Não consigo desfazer sem estragar mudanças feitas depois (${test.conflicts[0]}). Dá para ajustar manualmente.`);
        ns.mutate(dd => Iris.audit.undoOps(dd, e.ops));
        audit.setStatus(e.id, 'undone');
        return ok({ speak: `Desfeito: ${e.summary}. ${totalsLine()}`, data: { id: e.id } });
      },
    });

    const byName = Object.fromEntries(defs.map(d => [d.name, d]));
    return {
      defs, byName, get: n => byName[n], names: () => defs.map(d => d.name),
      riskOf: (n, a) => { const d = byName[n]; return d ? (d.riskFor ? d.riskFor(a || {}) : d.risk) : 'R2'; },
      /** Descrição enxuta (para o backend/LLM): sem funções. */
      describe: () => defs.map(d => ({ name: d.name, risk: d.risk, description: d.desc, input_schema: d.input })),
      helpers: { guestCounts, sectionLabel },
    };
  }

  const api = { createTools, SECTIONS, LISTS };
  Iris.tools = api;
  return api;
});
