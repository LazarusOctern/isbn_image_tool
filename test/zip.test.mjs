import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createZipBlob } from '../zip.mjs';

test('creates a ZIP archive with image files and valid CRC32 values', async () => {
  const contents = new TextEncoder().encode('cover image data');
  const archive = new Uint8Array(await (await createZipBlob([
    { name: '9780140328721.jpg', blob: new Blob([contents]) },
  ])).arrayBuffer());
  const view = new DataView(archive.buffer);
  const nameLength = view.getUint16(26, true);
  const dataLength = view.getUint32(22, true);
  const name = new TextDecoder().decode(archive.slice(30, 30 + nameLength));
  const image = archive.slice(30 + nameLength, 30 + nameLength + dataLength);

  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(name, '9780140328721.jpg');
  assert.deepEqual(image, contents);
  assert.equal(view.getUint32(14, true), 0x62d9f3c9);
  assert.equal(view.getUint32(archive.length - 22, true), 0x06054b50);
  assert.equal(view.getUint16(archive.length - 14, true), 1);
});
