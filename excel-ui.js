import { findCover } from './covers.mjs';
import { insertCovers } from './excel.mjs';

const form = document.querySelector('#excel-form');
const fileInput = document.querySelector('#excel-file');
const button = document.querySelector('#excel-submit');
const status = document.querySelector('#excel-status');
const report = document.querySelector('#excel-report');
const download = document.querySelector('#excel-download');
let downloadURL;

async function loadImage(isbn) {
  const cover = await findCover(isbn, { requireBlob: true, signal: AbortSignal.timeout(20000) });
  if (!cover) return null;
  const bitmap = await createImageBitmap(cover.blob);
  try {
    const scale = Math.min(140 / bitmap.width, 140 / bitmap.height, 1);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Bilder können in diesem Browser nicht verarbeitet werden.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!png) throw new Error('Das Cover konnte nicht in ein PNG umgewandelt werden.');
    return {
      buffer: await png.arrayBuffer(),
      extension: 'png',
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    bitmap.close();
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const file = fileInput.files[0];
  if (!file) return;
  if (downloadURL) URL.revokeObjectURL(downloadURL);
  downloadURL = undefined;
  download.hidden = true;
  download.removeAttribute('href');
  report.replaceChildren();
  status.textContent = 'Excel-Datei wird gelesen …';
  button.disabled = true;
  fileInput.disabled = true;
  try {
    if (!/\.xlsx$/i.test(file.name)) throw new Error('Bitte eine .xlsx-Datei auswählen.');
    await import('./vendor/exceljs.min.js');
    const workbook = new globalThis.ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const outcome = await insertCovers(workbook, {
      loadImage,
      onProgress({ completed, total, found, result }) {
        status.textContent = `${completed} von ${total} Zeilen bearbeitet. ${found} Cover eingefügt.`;
        if (result.status !== 'found') {
          const item = document.createElement('li');
          item.textContent = `Zeile ${result.row} (${result.original}): ${result.message}`;
          report.append(item);
        }
      },
    });
    if (!outcome.found) {
      status.textContent = 'Keine Cover eingefügt. Es wurde keine neue Excel-Datei erstellt. Details siehe unten.';
      return;
    }
    status.textContent = 'Excel-Datei mit eingebetteten Bildern wird erstellt …';
    const buffer = await workbook.xlsx.writeBuffer();
    downloadURL = URL.createObjectURL(new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }));
    download.href = downloadURL;
    download.download = `${file.name.replace(/\.xlsx$/i, '')}-mit-covern.xlsx`;
    download.hidden = false;
    status.textContent = `${outcome.found} von ${outcome.total} Zeilen mit Cover. Die Excel-Datei ist bereit zum Herunterladen.`;
  } catch (error) {
    console.error('Excel-Verarbeitung fehlgeschlagen:', error);
    status.textContent = `Excel-Datei konnte nicht verarbeitet werden: ${error.message}`;
  } finally {
    button.disabled = false;
    fileInput.disabled = false;
  }
});
