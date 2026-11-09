export function normalizeISBN(value) {
  return value.replace(/[\s-]/g, '').toUpperCase();
}

export function isValidISBN(isbn) {
  if (/^\d{9}[\dX]$/.test(isbn)) {
    const sum = [...isbn].reduce((total, digit, index) =>
      total + (digit === 'X' ? 10 : Number(digit)) * (10 - index), 0);
    return sum % 11 === 0;
  }

  if (/^(978|979)\d{10}$/.test(isbn)) {
    const sum = [...isbn].reduce((total, digit, index) =>
      total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
    return sum % 10 === 0;
  }

  return false;
}

export function parseISBNs(input) {
  const seen = new Set();
  return input.split(/[\n\r,;]+/)
    .map(value => value.trim())
    .filter(Boolean)
    .map(value => ({ original: value, isbn: normalizeISBN(value) }))
    .filter(({ isbn }) => {
      if (seen.has(isbn)) return false;
      seen.add(isbn);
      return true;
    })
    .map(entry => ({ ...entry, valid: isValidISBN(entry.isbn) }));
}
