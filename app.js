import { parseISBNs } from './isbn.mjs';

const form = document.querySelector('#search-form');
const input = document.querySelector('#isbns');
const results = document.querySelector('#results');
const emptyState = document.querySelector('#empty-state');
const count = document.querySelector('#results-count');
const status = document.querySelector('#search-status');
let currentSearch;
let imageURLs = [];

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
  try {
    const response = await fetch(
      `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(entry.isbn)}-L.jpg?default=false`,
      { signal }
    );
    if (response.status === 404) {
      card.preview.firstElementChild.textContent = 'Kein Cover gefunden';
      card.action.textContent = 'Für diese ISBN ist kein Cover verfügbar.';
      return false;
    }
    if (!response.ok) throw new Error(`Open Library: HTTP ${response.status}`);
    const blob = await response.blob();
    if (!blob.type.startsWith('image/') || blob.size === 0) {
      throw new Error('Die Antwort enthält kein Bild.');
    }
    if (signal.aborted) return false;
    const url = URL.createObjectURL(blob);
    imageURLs.push(url);
    const image = document.createElement('img');
    image.src = url;
    image.alt = `Buchcover zur ISBN ${entry.isbn}`;
    image.loading = 'lazy';
    card.preview.replaceChildren(image);
    const download = document.createElement('a');
    download.className = 'download-link';
    download.href = url;
    download.download = `${entry.isbn}.jpg`;
    download.textContent = 'Cover herunterladen ↓';
    card.action.replaceChildren(download);
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
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));
});

input.addEventListener('input', () => input.setCustomValidity(''));
