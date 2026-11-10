import { isValidISBN, normalizeISBN } from './isbn.mjs';

function cellText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? String(value) : '';
  }
  if (typeof value === 'object') {
    if ('result' in value) return cellText(value.result);
    if ('richText' in value) return value.richText.map(part => part.text).join('').trim();
  }
  return '';
}

export function readEntries(worksheet) {
  const entries = [];
  worksheet.eachRow(row => {
    const cell = row.getCell(1);
    const original = cellText(cell.value);
    if (cell.value === null || cell.value === undefined
      || (typeof cell.value === 'string' && !original)) return;
    if (row.number === 1 && /^(GTIN|EAN|ISBN(?:-1[03])?)$/i.test(original)) return;
    const isbn = normalizeISBN(original);
    entries.push({ row: row.number, isbn, original: original || cell.text, valid: isValidISBN(isbn) });
  });
  return entries;
}

export async function insertCovers(workbook, { loadImage, onProgress = () => {} }) {
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('Die Datei enthält kein Tabellenblatt.');
  const entries = readEntries(worksheet);
  if (!entries.length) throw new Error('Im ersten Tabellenblatt stehen keine ISBNs in Spalte A.');
  if (entries.some(entry => worksheet.getCell(entry.row, 2).isMerged)) {
    throw new Error('Spalte B enthält verbundene Zellen. Bitte die Verbindungen zuerst aufheben.');
  }
  const imagesInB = new Set(worksheet.getImages()
    .filter(image => (image.range.tl.nativeCol <= 1 && image.range.br?.nativeCol >= 1)
      || image.range.tl.nativeCol === 1)
    .map(image => image.range.tl.nativeRow + 1));
  const cache = new Map();
  const results = [];
  let found = 0;
  for (const entry of entries) {
    let message;
    let status;
    const target = worksheet.getCell(entry.row, 2);
    if (!entry.valid) {
      status = 'invalid';
      message = 'Keine gültige Buch-ISBN (ISBN-10 oder ISBN-13).';
    } else if ((target.value !== null && target.value !== undefined) || imagesInB.has(entry.row)) {
      status = 'occupied';
      message = 'Spalte B ist bereits belegt; vorhandener Inhalt bleibt erhalten.';
    } else {
      if (!cache.has(entry.isbn)) {
        try {
          cache.set(entry.isbn, { image: await loadImage(entry.isbn) });
        } catch (error) {
          console.warn(`Excel-Coversuche für ${entry.isbn} fehlgeschlagen:`, error);
          cache.set(entry.isbn, { error });
        }
      }
      const { image, error } = cache.get(entry.isbn);
      if (error) {
        status = 'error';
        message = `Cover nicht einfügbar: ${error.message}`;
      } else if (!image) {
        status = 'missing';
        message = 'Kein Cover bei Open Library oder Google Books gefunden.';
      } else {
        const id = workbook.addImage({ buffer: image.buffer, extension: image.extension });
        worksheet.getColumn(2).width = Math.max(worksheet.getColumn(2).width || 0, 22);
        const row = worksheet.getRow(entry.row);
        row.height = Math.max(row.height || worksheet.properties.defaultRowHeight || 15, image.height * 0.75 + 6);
        worksheet.addImage(id, {
          tl: { col: 1, row: entry.row - 1 },
          ext: { width: image.width, height: image.height },
          editAs: 'oneCell',
        });
        status = 'found';
        message = 'Cover eingefügt.';
        found++;
      }
    }
    results.push({ ...entry, status, message });
    onProgress({ completed: results.length, total: entries.length, found, result: results.at(-1) });
  }
  return { found, total: entries.length, results };
}
