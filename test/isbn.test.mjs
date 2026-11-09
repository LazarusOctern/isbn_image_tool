import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidISBN, normalizeISBN, parseISBNs } from '../isbn.mjs';

test('normalizes spaces, hyphens and lowercase x', () => {
  assert.equal(normalizeISBN(' 0-8044-2957-x '), '080442957X');
});

test('checks ISBN-10 and ISBN-13 including their check digits', () => {
  for (const isbn of ['080442957X', '0140328726', '9780140328721', '9791090636071']) {
    assert.equal(isValidISBN(isbn), true, isbn);
  }
  for (const isbn of ['0804429570', '014032872X', '9780140328722', '1234567890128', '978014032872', '08044295X7']) {
    assert.equal(isValidISBN(isbn), false, isbn);
  }
});

test('splits entries and removes duplicates after normalization', () => {
  assert.deepEqual(parseISBNs('978-0-14-032872-1; 0 8044 2957 x\r\n9780140328721, nope\n\n'), [
    { original: '978-0-14-032872-1', isbn: '9780140328721', valid: true },
    { original: '0 8044 2957 x', isbn: '080442957X', valid: true },
    { original: 'nope', isbn: 'NOPE', valid: false },
  ]);
  assert.deepEqual(parseISBNs(' \n; , '), []);
});
