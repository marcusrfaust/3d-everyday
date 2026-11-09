// Comportamental: rotuloCategoria de verdade (via bundle esbuild _rotulos.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotuloCategoria } from './_rotulos.mjs';

test('categorias do acervo ganham rótulo PT-BR', () => {
  assert.equal(rotuloCategoria('collectibles', 'Collectibles'), 'Colecionáveis');
  assert.equal(rotuloCategoria('keychains', 'Keychains'), 'Chaveiros');
  assert.equal(rotuloCategoria('miniatures', 'Miniatures'), 'Miniaturas');
  assert.equal(rotuloCategoria('home-decor', 'Home Decor'), 'Decoração');
});
test('slug desconhecido usa o nome original; vazio vira Categoria', () => {
  assert.equal(rotuloCategoria('foo', 'Foo'), 'Foo');
  assert.equal(rotuloCategoria(null, null), 'Categoria');
});
