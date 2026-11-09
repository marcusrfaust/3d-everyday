// Comportamental: regex driveId do fonte contra URLs reais do acervo (N1/N6 r2).
// Extrai a regex literal de src/lib/catalog.ts e avalia de verdade — CI verde
// com regex quebrada nunca mais passa aqui.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = readFileSync(path.join(root, 'src/lib/catalog.ts'), 'utf8');
const m = src.match(/export function driveId[\s\S]*?\.match\((\/.*?\/)\);/);
assert.ok(m, 'driveId com .match(regex) deve existir no fonte');
const re = eval(m[1]);

test('driveId casa file/d do acervo', () => {
  const r = 'https://drive.google.com/file/d/10akpKfvHyKqwZsvNmAIx0xH7y1V/view'.match(re);
  assert.ok(r, 'file/d deve casar');
  assert.equal(r[1], '10akpKfvHyKqwZsvNmAIx0xH7y1V');
});
test('driveId casa open?id e uc?id', () => {
  assert.ok('https://drive.google.com/open?id=ABCdef1234567890'.match(re), 'open?id casa');
  assert.ok('https://drive.google.com/uc?export=download&id=ABCdef1234567890'.match(re), 'uc?id casa');
  assert.ok('https://drive.google.com/uc?id=ABCdef1234567890'.match(re), 'uc?id nu casa');
});
test('driveId rejeita folders, dominios estranhos e ids curtos', () => {
  assert.equal('https://drive.google.com/drive/folders/xyz1234567890'.match(re), null);
  assert.equal('https://example.com/file/d/10akpKfvHyKqwZsvNmAIx0xH7y1V/view'.match(re), null);
  assert.equal('https://drive.google.com/file/d/short/view'.match(re), null);
  assert.equal(''.match(re), null);
});
test('driveThumb monta thumbnail público só com id válido', () => {
  assert.ok(src.includes('drive.google.com/thumbnail'), 'driveThumb usa endpoint de miniatura');
});
