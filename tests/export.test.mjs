import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { quoteFilename, quoteWorkbook } from '../dist/quote.js';
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../dist/vendor/xlsx-0.20.3.min.js', import.meta.url), 'utf8'), context);
const XLSX = context.XLSX;

test('Excel export round-trips numbers, formula, links and untrusted text', () => {
  const items = [
    { categoryName: 'RAM', name: '=HYPERLINK("bad")', store: 'Tienda', price: 12000, inStock: true, captureLabel: '18-oct-2026', url: 'https://example.com/ram' },
    { categoryName: 'CPU', name: 'Procesador', store: 'Tienda', price: 99000, inStock: true, stale: true, captureLabel: '17-oct-2026', url: 'https://example.com/cpu' }
  ];
  const book = quoteWorkbook(XLSX, items, 150000, '18-oct-2026');
  const bytes = XLSX.write(book, { type: 'array', bookType: 'xlsx' });
  const result = XLSX.read(bytes, { type: 'array' }).Sheets['Cotización PC'];
  assert.equal(result.B5.t, 's');
  assert.equal(result.B5.f, undefined);
  assert.equal(result.D5.v, 12000);
  assert.equal(result.D7.f, 'SUM(D5:D6)');
  assert.equal(result.D7.v, 111000);
  assert.equal(result.D8.v, 150000);
  assert.equal(result.G5.l.Target, items[0].url);
  assert.match(result.E6.v, /Lectura anterior/);
  assert.equal(quoteFilename('xlsx'), 'pc cotizacion tupc.labs.xlsx');
  assert.equal(quoteFilename('txt'), 'pc cotizacion tupc.labs.txt');
  assert.throws(() => quoteWorkbook(XLSX, [], 0, ''), /Añade componentes/);
});
