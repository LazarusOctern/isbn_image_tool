import { parseISBNs } from './isbn.mjs';
import { createZipBlob } from './zip.mjs';
import { fetchImage, findCover } from './covers.mjs';

const form = document.querySelector('#search-form');
const input = document.querySelector('#isbns');
const results = document.querySelector('#results');
const emptyState = document.querySelector('#empty-state');
const count = document.querySelector('#results-count');
const status = document.querySelector('#search-status');
const zipButton = document.querySelector('#download-all');
const zipStatus = document.querySelector('#zip-status');
let currentSearch;
let imageURLs = [];
let coverFiles = new Map();

function makeCard(entry) {
  const card = document.createElement('article');
  card.className = 'cover-card';
  const preview = document.createElement('div');
  preview.className = 'cover-preview';
  const message = document.createElement('span');
  message.className = 'preview-message';
  message.textContent = entry.valid ? 'Cover wird gesucht …' : 'Ungültige ISBN';
  preview.append(message);
  const details = document.createElement('div');
  details.className = 'card-details';
  const label = document.createElement('span');
  label.className = 'card-label';
  label.textContent = 'ISBN';
  const isbn = document.createElement('strong');
  isbn.className = 'card-isbn';
  isbn.textContent = entry.valid ? entry.isbn : entry.original;
  const action = document.createElement('div');
  action.className = 'card-action';
  action.textContent = entry.valid ? 'Suche läuft …' : 'Bitte Eingabe und Prüfziffer prüfen.';
  details.append(label, isbn, action);
  card.append(preview, details);
  return { preview, action, card };
}

async function loadCover(entry, card, signal) {
  let cover;
  let searchError;
  try {
    cover = await findCover(entry.isbn, { signal });
  } catch (error) {
    if (signal.aborted) return false;
    searchError = error;
  }

  if (signal.aborted) return false;
  if (!cover) {
    if (searchError) {
      card.preview.firstElementChild.textContent = 'Suche fehlgeschlagen';
      card.action.textContent = 'Verbindung fehlgeschlagen. Bitte später erneut versuchen.';
    } else {
      card.preview.firstElementChild.textContent = 'Kein Cover gefunden';
      card.action.textContent = 'Für diese ISBN ist bei Open Library und Google Books kein Cover verfügbar.';
    }
    return false;
  }

  try {
    const url = cover.blob ? URL.createObjectURL(cover.blob) : cover.imageURL;
    if (cover.blob) {
      imageURLs.push(url);
      coverFiles.set(entry.isbn, { blob: cover.blob });
    } else {
      coverFiles.set(entry.isbn, { url });
    }
    const image = document.createElement('img');
    image.src = url;
    image.alt = `Buchcover zur ISBN ${entry.isbn}`;
    image.loading = 'lazy';
    card.preview.replaceChildren(image);
    const download = document.createElement('a');
    download.className = 'download-link';
    download.href = url;
    if (cover.blob) {
      download.download = `${entry.isbn}.jpg`;
      download.textContent = `Cover herunterladen ↓ (${cover.source})`;
    } else {
      download.target = '_blank';
      download.rel = 'noopener noreferrer';
      download.textContent = `Cover öffnen / herunterladen ↗ (${cover.source})`;
    }
    card.action.replaceChildren(download);
    if (!cover.blob) {
      image.addEventListener('error', () => {
        card.preview.textContent = 'Cover konnte nicht geladen werden';
        card.action.textContent = 'Das Bild ist bei Google Books derzeit nicht erreichbar.';
      }, { once: true });
    }
    return true;
  } catch (error) {
    if (signal.aborted) return false;
    console.error('Cover konnte nicht geladen werden:', error);
    card.preview.firstElementChild.textContent = 'Suche fehlgeschlagen';
    card.action.textContent = 'Verbindung fehlgeschlagen. Bitte später erneut versuchen.';
    return false;
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const entries = parseISBNs(input.value);
  if (!entries.length) {
    input.setCustomValidity('Bitte mindestens eine ISBN eingeben.');
    input.reportValidity();
    return;
  }
  input.setCustomValidity('');
  currentSearch?.abort();
  const controller = new AbortController();
  currentSearch = controller;
  imageURLs.forEach(url => URL.revokeObjectURL(url));
  imageURLs = [];
  coverFiles = new Map();
  zipButton.hidden = true;
  zipButton.disabled = false;
  zipButton.textContent = 'Alle Cover als ZIP herunterladen ↓';
  zipStatus.textContent = '';
  zipStatus.hidden = true;
  results.replaceChildren();
  emptyState.hidden = true;
  const pending = entries.map(entry => ({ entry, ...makeCard(entry) }));
  pending.forEach(({ card }) => results.append(card));
  let completed = pending.filter(({ entry }) => !entry.valid).length;
  let found = 0;
  const updateStatus = () => {
    count.textContent = `${found} Cover gefunden`;
    status.textContent = `${completed} von ${entries.length} Einträgen bearbeitet. ${found} Cover gefunden.`;
  };
  updateStatus();
  const queue = pending.filter(({ entry }) => entry.valid);
  let next = 0;
  async function worker() {
    while (next < queue.length && !controller.signal.aborted) {
      const { entry, preview, action } = queue[next++];
      const success = await loadCover(entry, { preview, action }, controller.signal);
      if (controller.signal.aborted) return;
      if (success) found++;
      completed++;
      updateStatus();
    }
  }
  await worker();
  if (!controller.signal.aborted) zipButton.hidden = found === 0;
});

input.addEventListener('input', () => input.setCustomValidity(''));

zipButton.addEventListener('click', async () => {
  if (!coverFiles.size) return;

  zipButton.disabled = true;
  zipButton.textContent = 'ZIP wird erstellt …';
  zipStatus.hidden = true;
  try {
    const files = [];
    for (const [isbn, cover] of coverFiles) {
      const blob = cover.blob ?? await fetchImage(cover.url);
      if (!blob) throw new Error(`Kein Bild für ISBN ${isbn} gefunden.`);
      files.push({ name: `${isbn}.jpg`, blob });
    }
    const archive = await createZipBlob(files);
    const url = URL.createObjectURL(archive);
    const download = document.createElement('a');
    download.href = url;
    download.download = 'buchcover.zip';
    download.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    console.error('ZIP-Download fehlgeschlagen:', error);
    zipStatus.textContent = `ZIP konnte nicht erstellt werden: ${error.message}`;
    zipStatus.hidden = false;
  } finally {
    zipButton.disabled = false;
    zipButton.textContent = 'Alle Cover als ZIP herunterladen ↓';
  }
});
