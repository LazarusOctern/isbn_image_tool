import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { insertCovers, readEntries } from '../excel.mjs';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9XkAAAAASUVORK5CYII=',
  'base64'
);
const image = { buffer: png, extension: 'png', width: 100, height: 140 };

function makeWorkbook(rows) {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Produkte').addRows(rows);
  return workbook;
}

test('reads numeric scientific notation, text, rich text and cached formulas from A without losing row positions', () => {
  const workbook = makeWorkbook([
    ['GTIN'],
    [9.780140328721e12],
    [null, null, 'Other data'],
    ['0-8044-2957-x'],
    [{ formula: 'A2', result: 9780140328721 }],
    [{ richText: [{ text: '978' }, { text: '0140328721' }] }],
    ['4006381333931'],
    [9780140328722],
    [9780140328721.5],
  ]);
  assert.deepEqual(readEntries(workbook.worksheets[0]).map(({ row, isbn, valid }) => ({ row, isbn, valid })), [
    { row: 2, isbn: '9780140328721', valid: true },
    { row: 4, isbn: '080442957X', valid: true },
    { row: 5, isbn: '9780140328721', valid: true },
    { row: 6, isbn: '9780140328721', valid: true },
    { row: 7, isbn: '4006381333931', valid: false },
    { row: 8, isbn: '9780140328722', valid: false },
    { row: 9, isbn: '', valid: false },
  ]);
});

test('embeds real images in B, caches duplicates and preserves other data across an xlsx round trip', async () => {
  const workbook = makeWorkbook([
    ['GTIN', null, 'Title'],
    [9780140328721, null, 'Book', 11.9, { formula: 'D2*2', result: 23.8 }],
    [],
    ['9780140328721', null, 'Duplicate'],
  ]);
  const worksheet = workbook.worksheets[0];
  worksheet.getCell('C2').font = { bold: true };
  worksheet.getRow(4).height = 200;
  workbook.addWorksheet('Other sheet').getCell('A1').value = 'Keep me';
  const calls = [];
  const progress = [];
  const outcome = await insertCovers(workbook, {
    loadImage: async isbn => { calls.push(isbn); return image; },
    onProgress: update => progress.push(update),
  });
  assert.equal(outcome.found, 2);
  assert.deepEqual(calls, ['9780140328721']);
  assert.equal(progress.at(-1).completed, 2);
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(await workbook.xlsx.writeBuffer());
  const sheet = restored.worksheets[0];
  const images = sheet.getImages();
  assert.deepEqual(images.map(item => [item.range.tl.nativeCol, item.range.tl.nativeRow]), [[1, 1], [1, 3]]);
  assert.deepEqual(Buffer.from(restored.getImage(images[0].imageId).buffer), png);
  assert.equal(sheet.getCell('A2').value, 9780140328721);
  assert.equal(sheet.getCell('C2').value, 'Book');
  assert.equal(sheet.getCell('D2').value, 11.9);
  assert.deepEqual(sheet.getCell('E2').value, { formula: 'D2*2', result: 23.8 });
  assert.equal(sheet.getCell('C2').font.bold, true);
  assert.equal(sheet.getRow(2).height, 111);
  assert.equal(sheet.getRow(4).height, 200);
  assert.equal(restored.worksheets[1].getCell('A1').value, 'Keep me');
});

test('reports invalid, missing, occupied and failed rows without shifting images', async () => {
  const workbook = makeWorkbook([
    ['ISBN'],
    ['bad'],
    ['9780140328721'],
    ['080442957X', 'Do not overwrite'],
    ['9791090636071'],
    ['9791090636071'],
    ['0140328726'],
  ]);
  const calls = [];
  const outcome = await insertCovers(workbook, {
    loadImage: async isbn => {
      calls.push(isbn);
      if (isbn === '9791090636071') throw new Error('HTTP 429');
      return isbn === '9780140328721' ? null : image;
    },
  });
  assert.deepEqual(outcome.results.map(result => result.status), [
    'invalid', 'missing', 'occupied', 'error', 'error', 'found',
  ]);
  assert.match(outcome.results[3].message, /HTTP 429/);
  assert.deepEqual(calls, ['9780140328721', '9791090636071', '0140328726']);
  assert.equal(workbook.worksheets[0].getCell('B4').value, 'Do not overwrite');
  assert.equal(workbook.worksheets[0].getImages()[0].range.tl.nativeRow, 6);
});

test('keeps existing images in B and rejects merged destination cells', async () => {
  const workbook = makeWorkbook([['9780140328721']]);
  const sheet = workbook.worksheets[0];
  sheet.addImage(workbook.addImage(image), {
    tl: { col: 1, row: 0 }, ext: { width: 100, height: 140 },
  });
  const outcome = await insertCovers(workbook, {
    loadImage: () => assert.fail('Occupied image must not be fetched'),
  });
  assert.equal(outcome.results[0].status, 'occupied');
  assert.equal(sheet.getImages().length, 1);
  sheet.mergeCells('B1:C1');
  await assert.rejects(insertCovers(workbook, { loadImage: async () => image }), /verbundene Zellen/);
});

test('rejects empty workbooks and sheets with only headers or empty A cells', async () => {
  for (const workbook of [
    new ExcelJS.Workbook(),
    makeWorkbook([['GTIN'], [null, null, 'No ISBN'], ['   ']]),
  ]) {
    await assert.rejects(insertCovers(workbook, { loadImage: async () => image }), /kein/);
  }
});

test('uses the first row as data when there is no header', async () => {
  const workbook = makeWorkbook([['9780140328721']]);
  const outcome = await insertCovers(workbook, { loadImage: async () => image });
  assert.equal(outcome.found, 1);
  assert.equal(workbook.worksheets[0].getImages()[0].range.tl.nativeRow, 0);
});
