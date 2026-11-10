/* Íris · text.js — utilidades de texto pt-BR (puro, sem DOM). Testável em Node. */
(function (root, factory) {
  const api = factory(root.Iris || (root.Iris = {}));
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Iris) {
  'use strict';

  const strip = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');

  /** minúsculas, sem acento, pontuação de frase removida (mantém . , / $ % - dentro de números). */
  function norm(s) {
    return strip(s).toLowerCase()
      .replace(/r\$\s*/g, 'r$ ')
      .replace(/[“”"'`´()[\]{}!?;:…]/g, ' ')
      .replace(/([.,])(?=\s|$)/g, ' ')
      .replace(/[^a-z0-9$%,./\s-]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  const UNITS = { zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19 };
  const TENS = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90 };
  const HUND = { cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300, quatrocentos: 400, quatrocentas: 400, quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600, setecentos: 700, setecentas: 700, oitocentos: 800, oitocentas: 800, novecentos: 900, novecentas: 900 };
  const isNumWord = t => t in UNITS || t in TENS || t in HUND || t === 'mil' || t === 'milhao' || t === 'milhoes';

  /** "mil e oitocentos" → {value:1800,next}. tokens = palavras normalizadas. */
  function parseWordNumber(tokens, i) {
    // Ordem decrescente: o "e" só liga mil→centena/dezena/unidade, centena→dezena/unidade, dezena→unidade (1–9).
    // Assim "cinquenta e quatro" = 54, mas "quatro e cinquenta" NÃO é 54 (é preço falado: 4,50).
    let total = 0, cur = 0, j = i, any = false, last = null; // last: 'M' | 'H' | 'T' | 'U'
    const kindOf = t => (t in HUND ? 'H' : t in TENS ? 'T' : t in UNITS ? 'U' : t === 'mil' || t === 'milhao' || t === 'milhoes' ? 'M' : null);
    const canJoin = (a, t) => {
      const b = kindOf(t);
      if (a === 'M') return b === 'H' || b === 'T' || b === 'U';
      if (a === 'H') return b === 'T' || b === 'U';
      if (a === 'T') return b === 'U' && UNITS[t] >= 1 && UNITS[t] <= 9;
      return false;
    };
    let joined = true; // o primeiro token sempre pode entrar; depois só com "e" ou logo após "mil"
    while (j < tokens.length) {
      const t = tokens[j];
      const k = kindOf(t);
      if ((k === 'U' || k === 'T' || k === 'H') && any && !joined && last !== 'M') break; // "oitenta cem" são DOIS números, não 180
      if (k === 'U') { cur += UNITS[t]; any = true; last = 'U'; joined = false; j++; continue; }
      if (k === 'T') { cur += TENS[t]; any = true; last = 'T'; joined = false; j++; continue; }
      if (k === 'H') { cur += HUND[t]; any = true; last = 'H'; joined = false; j++; continue; }
      if (k === 'M') {
        if (t === 'mil') total += (cur || 1) * 1000; else total += (cur || 1) * 1e6;
        cur = 0; any = true; last = 'M'; joined = false; j++; continue;
      }
      if (t === 'e' && any && j + 1 < tokens.length && canJoin(last, tokens[j + 1])) { j++; joined = true; continue; }
      break;
    }
    return any ? { value: total + cur, next: j } : null;
  }

  /** "1.800,50" → 1800.5 · "1800" · "4,5" · "4.50". Retorna null se não for número. */
  function parseDigits(tok) {
    const t = String(tok).replace(/^r\$/, '');
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.'));
    if (/^\d+,\d+$/.test(t)) return Number(t.replace(',', '.'));
    if (/^\d+\.\d{1,2}$/.test(t)) return Number(t);
    if (/^\d+$/.test(t)) return Number(t);
    return null;
  }

  const CURRENCY_AFTER = new Set(['reais', 'real', 'conto', 'contos', 'pila', 'pilas']);

  /** Todos os números do texto (dígitos ou por extenso) com posição e flag de moeda. */
  function findNumbers(text, opts = {}) {
    const tokens = norm(text).split(' ').filter(Boolean);
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      let value = null, next = i + 1, kind = 'digits';
      const prevCur = tokens[i - 1] === 'r$';
      if (/^r\$\d/.test(t)) value = parseDigits(t);
      else if (/^\d/.test(t)) value = parseDigits(t);
      if (value !== null) {
        if (tokens[i + 1] === 'mil' && value < 1000) { value *= 1000; next = i + 2; }
      } else if (isNumWord(t)) {
        if ((t === 'um' || t === 'uma') && !opts.allowBareOne && !(tokens[i + 1] === 'mil' || CURRENCY_AFTER.has(tokens[i + 1]) || tokens[i + 1] === 'milhao')) continue;
        const r = parseWordNumber(tokens, i);
        if (!r) continue;
        value = r.value; next = r.next; kind = 'words';
      } else continue;
      const currency = prevCur || /^r\$/.test(t) || CURRENCY_AFTER.has(tokens[next]);
      out.push({ value, start: i, end: next, kind, currency, raw: tokens.slice(i, next).join(' ') });
      i = next - 1;
    }
    return { tokens, numbers: out };
  }

  /** Procura um valor em R$ ("R$ 1.800,50", "1800 reais", "mil e oitocentos reais", "quatro reais e cinquenta centavos"). */
  function findMoney(text) {
    const { tokens, numbers } = findNumbers(text);
    const hasCue = /(^|\s)(r\$|reais|real|cada|unidade|preco|custa|custam|valor)(\s|$)/.test(tokens.join(' '));
    let cand = numbers.find(n => n.currency);
    if (!cand && hasCue) {
      // "quatro e cinquenta" (preço falado): X e Y, X<1000, Y<100
      for (let k = 0; k < numbers.length - 1; k++) {
        const a = numbers[k], b = numbers[k + 1];
        if (b.start === a.end + 1 && tokens[a.end] === 'e' && a.value < 1000 && b.value < 100 && a.kind === 'words' && b.kind === 'words') {
          return { value: a.value + b.value / 100, start: a.start, end: b.end, raw: `${a.raw} e ${b.raw}`, currency: true };
        }
      }
      cand = numbers.length === 1 ? numbers[0] : null;
    }
    if (!cand) return null;
    let value = cand.value, end = cand.end;
    // "X reais e Y centavos"
    if (CURRENCY_AFTER.has(tokens[end]) && tokens[end + 1] === 'e') {
      const r = parseWordNumber(tokens, end + 2) || (parseDigits(tokens[end + 2] || '') !== null ? { value: parseDigits(tokens[end + 2]), next: end + 3 } : null);
      if (r && /^centavos?$/.test(tokens[r.next] || '')) { value += r.value / 100; end = r.next + 1; }
    }
    return { value, start: cand.start, end, raw: tokens.slice(cand.start, end).join(' '), currency: true };
  }

  /** Quantidade antes de uma unidade: findQuantity("250 doces de ...", ['doce','doces']) → 250. */
  function findQuantity(text, unitWords) {
    const { tokens, numbers } = findNumbers(text, { allowBareOne: true });
    const units = new Set(unitWords.map(norm));
    for (const n of numbers) {
      if (n.currency) continue;
      if (units.has(tokens[n.end]) || units.has(tokens[n.end + 1])) return { value: n.value, start: n.start, end: n.end };
    }
    return null;
  }

  const MESES = { janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
  const MESES_NOME = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const pad = n => String(n).padStart(2, '0');

  /** "13/11/2027", "13 de novembro de 2027", "treze de novembro" → 'YYYY-MM-DD' (ou null). */
  function parseDate(text, now = new Date()) {
    const t = norm(text);
    let m = t.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (m) { const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]); return valid(y, Number(m[2]), Number(m[1])); }
    m = t.match(/(\d{1,2}|[a-z]+(?: e [a-z]+)?) de ([a-z]+)(?: de (\d{4}))?/);
    if (m && MESES[m[2]]) {
      const day = /^\d/.test(m[1]) ? Number(m[1]) : (parseWordNumber(m[1].split(' '), 0) || {}).value;
      if (!day) return null;
      return valid(m[3] ? Number(m[3]) : now.getFullYear(), MESES[m[2]], day);
    }
    return null;
    function valid(y, mo, d) {
      const dt = new Date(Date.UTC(y, mo - 1, d));
      return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? `${y}-${pad(mo)}-${pad(d)}` : null;
    }
  }

  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
  const fmtBRL = v => BRL.format(Number(v) || 0).replace(/ /g, ' ');
  const fmtDateBR = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || ''); };
  const fmtDateLong = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${Number(m[3])} de ${MESES_NOME[Number(m[2]) - 1]} de ${m[1]}` : String(iso || ''); };

  /** Texto da tela → texto para o sintetizador (evita "R cifrão", lê datas e porcentagens). */
  function toSpeech(text) {
    return String(text ?? '')
      .replace(/R\$\s*(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?/g, (_, i, c) => {
        const n = i.replace(/\./g, '');
        const cents = c ? Number(c.padEnd(2, '0')) : 0;
        return `${n} ${Number(n) === 1 && !cents ? 'real' : 'reais'}${cents ? ` e ${cents} centavos` : ''}`;
      })
      .replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g, (_, d, m, y) => MESES_NOME[Number(m) - 1] ? `${Number(d)} de ${MESES_NOME[Number(m) - 1]} de ${y}` : _)
      .replace(/(\d+(?:,\d+)?)\s*%/g, '$1 por cento')
      .replace(/\s*[&+]\s*/g, ' e ')
      .replace(/[•·▪◦]/g, ',')
      .replace(/[\u{1F300}-\u{1FAFF}☀-➿♡✧✦◈◇]/gu, '')
      .replace(/\s+/g, ' ').trim();
  }

  /** Remove o chamado ("Íris,", "oi íris", "ei iris"). `names` = nomes configurados da assistente. */
  function stripWake(text, names = ['iris']) {
    const n = norm(text);
    const alt = [...new Set(names.map(norm).filter(Boolean).concat('iris'))].join('|');
    return n.replace(new RegExp(`^(?:(?:oi|ola|ei|hey|ok|e ai|fala|opa)\\s+)?(?:${alt})(?=\\s|$)\\s*`), '').trim();
  }

  const STOP = new Set(['a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'nas', 'nos', 'para', 'pra', 'pro', 'com', 'um', 'uma', 'que', 'por', 'ao', 'aos', 'se']);
  const tokensOf = s => norm(s).split(' ').filter(t => t && !STOP.has(t));

  /** Pontuação 0..1 de quão bem `query` casa com `candidate` (sobreposição de tokens + prefixos). */
  function score(query, candidate) {
    const q = tokensOf(query), c = tokensOf(candidate);
    if (!q.length || !c.length) return 0;
    let hit = 0;
    for (const t of q) if (c.some(x => x === t || (t.length >= 4 && (x.startsWith(t) || t.startsWith(x))))) hit++;
    const base = hit / Math.max(q.length, 1) * Math.min(1, hit / Math.min(c.length, 3) + 0.25);
    // todos os termos da consulta aparecem no candidato e são específicos (≥5 letras): casamento forte
    if (hit === q.length && q.join('').length >= 5) return Math.max(base, 0.75);
    return base;
  }
  function bestMatch(query, items, textOf = x => x, min = 0.45) {
    let best = null;
    for (const it of items) { const s = score(query, textOf(it)); if (s >= min && (!best || s > best.score)) best = { item: it, score: s }; }
    return best;
  }

  const COMMAND_STARTS = '(?:me )?(?:diga|diz|fale|fala|conte|conta|mostre|mostra|mostrar|calcule|calcula|abra|abre|quanto|quantos|quantas|qual|quais|liste|lista|compare|compara|adicione|adiciona|coloca|registre|registra|salva|salve|simule|simula)';
  /** "mostra padrinhos e me diga quanto falta" → ['mostra padrinhos','me diga quanto falta'] */
  function splitCompound(text) {
    const n = norm(text);
    const parts = n.split(new RegExp(`\\s+(?:e|depois|tambem)\\s+(?=${COMMAND_STARTS}\\b)`)).map(s => s.trim()).filter(Boolean);
    return parts.length ? parts : [n];
  }

  const humanList = arr => arr.length <= 1 ? (arr[0] || '') : arr.slice(0, -1).join(', ') + ' e ' + arr[arr.length - 1];
  const plural = (n, s, p) => `${n} ${Number(n) === 1 ? s : (p || s + 's')}`;

  /** Sinônimos de categoria do orçamento (categorias reais do app). */
  const CATEGORY_SYNONYMS = {
    'Música': ['dj', 'banda', 'musica', 'som', 'cantor', 'musico', 'sonorizacao', 'playlist'],
    'Fotografia': ['fotografo', 'fotografia', 'fotos', 'ensaio', 'album'],
    'Filmagem': ['filmagem', 'video', 'videomaker', 'filme', 'drone'],
    'Buffet': ['buffet', 'comida', 'jantar', 'almoco', 'cardapio', 'doces', 'doce', 'bolo', 'bem-casado', 'confeitaria', 'sorvete', 'salgados'],
    'Bebidas': ['bebida', 'bebidas', 'drinks', 'drink', 'open bar', 'chopp', 'cerveja', 'vinho'],
    'Decoração': ['decoracao', 'flores', 'floral', 'altar', 'arranjo', 'ambientacao', 'iluminacao', 'mesa'],
    'Espaço': ['espaco', 'chacara', 'salao', 'local', 'aluguel', 'sitio'],
    'Trajes': ['vestido', 'terno', 'traje', 'trajes', 'roupa', 'noiva', 'noivo', 'sapato'],
    'Beleza': ['maquiagem', 'cabelo', 'penteado', 'beleza', 'make', 'cabeleireiro', 'manicure'],
    'Cerimonial': ['cerimonial', 'cerimonialista', 'assessoria', 'assessor', 'celebrante', 'ensaio da cerimonia'],
    'Convites': ['convite', 'convites', 'save the date', 'papelaria', 'lembrancinha', 'lembrancinhas'],
    'Alianças': ['alianca', 'aliancas', 'joia', 'joias'],
    'Transporte': ['transporte', 'carro', 'limusine', 'van', 'onibus', 'translado'],
    'Lua de mel': ['lua de mel', 'viagem', 'passagem', 'hotel', 'hospedagem'],
  };
  function guessCategory(text, validList) {
    const n = ' ' + norm(text) + ' ';
    let best = null;
    for (const [cat, words] of Object.entries(CATEGORY_SYNONYMS)) {
      if (validList && !validList.includes(cat)) continue;
      for (const w of words) if (n.includes(' ' + w + ' ') || n.includes(' ' + w + 's ')) { if (!best || w.length > best.len) best = { cat, len: w.length }; }
    }
    return best ? best.cat : null;
  }

  const api = { strip, norm, parseWordNumber, parseDigits, findNumbers, findMoney, findQuantity, parseDate, fmtBRL, fmtDateBR, fmtDateLong, toSpeech, stripWake, score, bestMatch, splitCompound, humanList, plural, guessCategory, CATEGORY_SYNONYMS, MESES_NOME };
  Iris.text = api;
  return api;
});
