let requestQueue = Promise.resolve();
const retryAfterByOrigin = new Map();

function getRetryAfterMs(response) {
  const value = response.headers.get('Retry-After')?.trim();
  if (!value) return null;
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value) * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

function abortError(signal) {
  return signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
}

function request(url, signal, handleResponse) {
  const queued = requestQueue.then(async () => {
    if (signal?.aborted) throw abortError(signal);
    const origin = new URL(url).origin;
    const retryAt = retryAfterByOrigin.get(origin) ?? 0;
    if (retryAt > Date.now()) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          signal?.removeEventListener('abort', onAbort);
          resolve();
        }, retryAt - Date.now());
        const onAbort = () => {
          clearTimeout(timer);
          signal?.removeEventListener('abort', onAbort);
          reject(abortError(signal));
        };
        signal?.addEventListener('abort', onAbort, { once: true });
        if (signal?.aborted) onAbort();
      });
    }
    if (signal?.aborted) throw abortError(signal);
    const response = await fetch(url, { signal });
    if (response.status === 429) {
      const delay = getRetryAfterMs(response);
      if (delay !== null) retryAfterByOrigin.set(origin, Date.now() + delay);
    }
    return handleResponse(response);
  });
  requestQueue = queued.then(() => undefined, () => undefined);
  return queued;
}

function httpError(response, source) {
  const error = new Error(`${source ? `${source}: ` : ''}HTTP ${response.status}`);
  error.status = response.status;
  return error;
}

export async function fetchImage(url, signal) {
  return request(url, signal, async response => {
    if (response.status === 404) return null;
    if (!response.ok) throw httpError(response);
    const blob = await response.blob();
    if (!blob.type.startsWith('image/') || blob.size === 0) {
      throw new Error('Die Antwort enthält kein Bild.');
    }
    return blob;
  });
}

async function fetchGoogleBooksCover(isbn, signal, requireBlob) {
  const searchURL = new URL('https://www.googleapis.com/books/v1/volumes');
  searchURL.searchParams.set('q', `isbn:${isbn}`);
  const data = await request(searchURL, signal, async response => {
    if (response.status === 404) return null;
    if (!response.ok) throw httpError(response, 'Google Books');
    return response.json();
  });
  if (!data) return null;
  const imageURL = data.items?.[0]?.volumeInfo?.imageLinks?.thumbnail
    ?? data.items?.[0]?.volumeInfo?.imageLinks?.smallThumbnail;
  if (!imageURL) return null;
  const secureImageURL = imageURL.replace(/^http:/, 'https:');
  try {
    const blob = await fetchImage(secureImageURL, signal);
    return blob ? { blob } : null;
  } catch (error) {
    if (signal?.aborted || requireBlob) throw error;
    return { imageURL: secureImageURL };
  }
}

export async function findCover(isbn, { signal, requireBlob = false } = {}) {
  let searchError;
  try {
    const blob = await fetchImage(
      `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg?default=false`,
      signal
    );
    if (blob) return { blob, source: 'Open Library' };
  } catch (error) {
    if (signal?.aborted) throw error;
    searchError = error;
    console.warn('Open-Library-Suche fehlgeschlagen:', error);
  }

  try {
    const cover = await fetchGoogleBooksCover(isbn, signal, requireBlob);
    if (cover) return { ...cover, source: 'Google Books' };
  } catch (error) {
    if (signal?.aborted) throw error;
    searchError = error;
    console.warn('Google-Books-Suche fehlgeschlagen:', error);
  }
  if (searchError) throw searchError;
  return null;
}
