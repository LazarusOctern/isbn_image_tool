const encoder = new TextEncoder();
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeHeader(length, fields) {
  const bytes = new Uint8Array(length);
  const view = new DataView(bytes.buffer);
  for (const [offset, value, size] of fields) {
    if (size === 2) view.setUint16(offset, value, true);
    else view.setUint32(offset, value, true);
  }
  return bytes;
}

export async function createZipBlob(files) {
  const localRecords = [];
  const centralRecords = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = new Uint8Array(await file.blob.arrayBuffer());
    const checksum = crc32(data);
    if (name.length > 0xffff || data.length > 0xffffffff || offset > 0xffffffff) {
      throw new Error('Das ZIP-Archiv ist zu groß.');
    }

    const localHeader = writeHeader(30, [
      [0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2],
      [10, 0, 2], [12, 0x21, 2], [14, checksum, 4],
      [18, data.length, 4], [22, data.length, 4], [26, name.length, 2],
      [28, 0, 2],
    ]);
    localRecords.push(localHeader, name, data);

    const centralHeader = writeHeader(46, [
      [0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2],
      [10, 0, 2], [12, 0, 2], [14, 0x21, 2], [16, checksum, 4],
      [20, data.length, 4], [24, data.length, 4], [28, name.length, 2],
      [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 4],
      [38, offset, 4],
    ]);
    centralRecords.push(centralHeader, name);
    offset += localHeader.length + name.length + data.length;
  }

  if (files.length > 0xffff || offset > 0xffffffff) {
    throw new Error('Das ZIP-Archiv ist zu groß.');
  }
  const centralSize = centralRecords.reduce((size, record) => size + record.length, 0);
  const endRecord = writeHeader(22, [
    [0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2],
    [8, files.length, 2], [10, files.length, 2],
    [12, centralSize, 4], [16, offset, 4], [20, 0, 2],
  ]);
  return new Blob([...localRecords, ...centralRecords, endRecord], {
    type: 'application/zip',
  });
}
