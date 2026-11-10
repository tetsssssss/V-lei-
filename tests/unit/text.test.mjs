import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const T = require('../../iris/core/text.js');

test('norm: sem acento, minúsculas, pontuação de frase fora', () => {
  assert.equal(T.norm('Íris, quanto falta?'), 'iris quanto falta');
  assert.equal(T.norm('R$1.800,50!'), 'r$ 1.800,50');
});
test('números: dígitos pt-BR', () => {
  assert.equal(T.parseDigits('1.800,50'), 1800.5);
  assert.equal(T.parseDigits('1800'), 1800);
  assert.equal(T.parseDigits('4,5'), 4.5);
  assert.equal(T.parseDigits('4.50'), 4.5);
  assert.equal(T.parseDigits('1.125'), 1125);
});
test('números por extenso', () => {
  const v = s => T.findNumbers(s).numbers[0]?.value;
  assert.equal(v('mil e oitocentos reais'), 1800);
  assert.equal(v('dois mil e quinhentos'), 2500);
  assert.equal(v('trezentos reais'), 300);
  assert.equal(v('cento e vinte e cinco'), 125);
  assert.equal(v('oitenta e três'), 83);
  assert.equal(v('duzentos e cinquenta doces'), 250);
  assert.equal(v('1 mil reais'), 1000);
});
test('"um/uma" solto não vira número (artigo)', () => {
  assert.equal(T.findNumbers('adiciona uma despesa de 300 reais').numbers.length, 1);
});
test('dinheiro', () => {
  const m = s => T.findMoney(s)?.value;
  assert.equal(m('adiciona R$ 1.800 na previsão do DJ'), 1800);
  assert.equal(m('despesa hipotética R$ 300'), 300);
  assert.equal(m('250 doces de R$ 4,50'), 4.5);
  assert.equal(m('quatro reais e cinquenta centavos cada'), 4.5);
  assert.equal(m('doces de quatro e cinquenta cada'), 4.5);
  assert.equal(m('mil e oitocentos reais'), 1800);
  assert.equal(T.findMoney('adicione 100'), null, '"adicione 100" não pode virar reais');
});
test('quantidade com unidade', () => {
  assert.equal(T.findQuantity('250 doces de R$ 4,50', ['doces', 'doce']).value, 250);
  assert.equal(T.findQuantity('quero duzentos e cinquenta doces', ['doces']).value, 250);
  assert.equal(T.findQuantity('adicione 100', ['convidados', 'doces']), null);
});
test('datas', () => {
  assert.equal(T.parseDate('13/11/2027'), '2027-11-13');
  assert.equal(T.parseDate('13 de novembro de 2027'), '2027-11-13');
  assert.equal(T.parseDate('treze de novembro de 2027'), '2027-11-13');
  assert.equal(T.parseDate('31/02/2027'), null);
});
test('toSpeech', () => {
  assert.equal(T.toSpeech('Total R$ 1.125,00'), 'Total 1125 reais');
  assert.equal(T.toSpeech('R$ 4,50 cada'), '4 reais e 50 centavos cada');
  assert.equal(T.toSpeech('13/11/2027'), '13 de novembro de 2027');
});
test('stripWake e composto', () => {
  assert.equal(T.stripWake('Íris, quantos dias faltam?'), 'quantos dias faltam');
  assert.equal(T.stripWake('Oi Íris, abre padrinhos'), 'abre padrinhos');
  assert.deepEqual(T.splitCompound('Mostra nossos padrinhos e me diga quanto ainda falta organizar'), ['mostra nossos padrinhos', 'me diga quanto ainda falta organizar']);
  assert.deepEqual(T.splitCompound('coloca a Elizete em fornecedores para doces finos e me mostra quanto custam 250 doces de R$ 4,50'), ['coloca a elizete em fornecedores para doces finos', 'me mostra quanto custam 250 doces de r$ 4,50']);
  assert.equal(T.splitCompound('mesa e cadeiras').length, 1);
});
test('categoria', () => {
  const cats = ['Música', 'Buffet', 'Decoração', 'Outros'];
  assert.equal(T.guessCategory('previsão do DJ', cats), 'Música');
  assert.equal(T.guessCategory('doces finos', cats), 'Buffet');
  assert.equal(T.guessCategory('arranjo do altar', cats), 'Decoração');
});
test('casamento de nomes', () => {
  const items = [{ t: 'Elizete Doces Finos' }, { t: 'Zammer Celebra' }];
  assert.equal(T.bestMatch('a elizete', items, x => x.t)?.item.t, 'Elizete Doces Finos');
  assert.equal(T.bestMatch('banana', items, x => x.t), null);
});
test('lista de números por extenso não soma palavras soltas', () => {
  const v = T.findNumbers('oitenta, cem e cento e vinte convidados').numbers.map(n => n.value);
  assert.deepEqual(v, [80, 100, 120]);
  assert.deepEqual(T.findNumbers('80, 100 e 120 convidados').numbers.map(n => n.value), [80, 100, 120]);
  assert.equal(T.findNumbers('dois mil quinhentos e dez').numbers[0].value, 2510);
});
