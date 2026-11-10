import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findCover } from '../covers.mjs';

const imageResponse = () => new Response(new Blob(['image'], { type: 'image/png' }));
const booksResponse = () => Response.json({
  items: [{ volumeInfo: { imageLinks: { thumbnail: 'http://example.test/cover.png' } } }],
});

test('returns Open Library blobs without querying Google Books', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => imageResponse());
  const cover = await findCover('9780140328721', { requireBlob: true });
  assert.equal(cover.source, 'Open Library');
  assert.equal(cover.blob.type, 'image/png');
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('uses Google Books and upgrades thumbnail URLs to HTTPS', async t => {
  const responses = [new Response(null, { status: 404 }), booksResponse(), imageResponse()];
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => responses.shift());
  const cover = await findCover('9780140328721', { requireBlob: true });
  assert.equal(cover.source, 'Google Books');
  assert.equal(fetchMock.mock.calls[2].arguments[0], 'https://example.test/cover.png');
});

test('adds the configured API key to Google Books requests', async t => {
  const previousKey = globalThis.GOOGLE_BOOKS_API_KEY;
  globalThis.GOOGLE_BOOKS_API_KEY = 'test-key';
  t.after(() => {
    if (previousKey === undefined) delete globalThis.GOOGLE_BOOKS_API_KEY;
    else globalThis.GOOGLE_BOOKS_API_KEY = previousKey;
  });
  const fetchMock = t.mock.method(globalThis, 'fetch', async url => {
    if (String(url).includes('openlibrary')) return new Response(null, { status: 404 });
    if (String(url).includes('googleapis')) {
      assert.equal(new URL(url).searchParams.get('key'), 'test-key');
      return booksResponse();
    }
    return imageResponse();
  });

  const cover = await findCover('9780140328721', { requireBlob: true });
  assert.equal(cover.source, 'Google Books');
  assert.equal(fetchMock.mock.callCount(), 3);
});

test('retains the display-only fallback but rejects inaccessible images for Excel', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    if (String(url).includes('openlibrary')) return new Response(null, { status: 404 });
    if (String(url).includes('googleapis')) return booksResponse();
    throw new TypeError('Image download blocked');
  });
  const cover = await findCover('9780140328721');
  assert.equal(cover.imageURL, 'https://example.test/cover.png');
  await assert.rejects(findCover('9780140328721', { requireBlob: true }), /Image download blocked/);
});

test('distinguishes no cover from provider errors', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 404 }));
  assert.equal(await findCover('9780140328721'), null);
});

test('reports provider failures rather than declaring a missing cover', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 429 }));
  await assert.rejects(findCover('9780140328721'), /HTTP 429/);
});

test('falls back to Google Books on a 429 and honors Retry-After for the limited source', async t => {
  const calls = [];
  const responses = [
    new Response(null, { status: 429, headers: { 'Retry-After': '1' } }),
    booksResponse(),
    imageResponse(),
    new Response(null, { status: 404 }),
    new Response(null, { status: 404 }),
  ];
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push({ url: String(url), time: Date.now() });
    return responses.shift();
  });

  const cover = await findCover('9780140328721', { requireBlob: true });
  assert.equal(cover.source, 'Google Books');
  await findCover('9780140328721');

  const secondOpenLibraryRequest = calls.findLast(call => call.url.includes('openlibrary'));
  assert.ok(secondOpenLibraryRequest.time - calls[0].time >= 900);
});

test('serializes requests from concurrent cover searches', async t => {
  let activeRequests = 0;
  let maxActiveRequests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    activeRequests++;
    maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
    await new Promise(resolve => setTimeout(resolve, 5));
    activeRequests--;
    return new Response(null, { status: 404 });
  });

  await Promise.all([
    findCover('9780140328721'),
    findCover('9780804429573'),
    findCover('9783257230289'),
  ]);
  assert.equal(maxActiveRequests, 1);
});
