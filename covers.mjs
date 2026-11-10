export async function fetchImage(url, signal) {
  const response = await fetch(url, { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  if (!blob.type.startsWith('image/') || blob.size === 0) {
    throw new Error('Die Antwort enthält kein Bild.');
  }
  return blob;
}

async function fetchGoogleBooksCover(isbn, signal, requireBlob) {
  const searchURL = new URL('https://www.googleapis.com/books/v1/volumes');
  searchURL.searchParams.set('q', `isbn:${isbn}`);
  const response = await fetch(searchURL, { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Google Books: HTTP ${response.status}`);
  const data = await response.json();
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
