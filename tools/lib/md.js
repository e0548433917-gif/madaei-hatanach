// עזרי עיצוב לדוח ה-Markdown — משימה ת.0. ר' tools/validate.js.
'use strict';

// ---------------------------------------------------------------------------
// כתיבת הדוח
// ---------------------------------------------------------------------------

function groupBy(rows, keyFn) {
  const m = new Map();
  rows.forEach((r) => {
    const k = keyFn(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  });
  return m;
}

function mdTable(headers, rows) {
  if (!rows.length) return '_אין ממצאים._\n';
  const esc = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  return [
    '| ' + headers.join(' | ') + ' |',
    '|' + headers.map(() => '---').join('|') + '|',
    ...rows.map((r) => '| ' + r.map(esc).join(' | ') + ' |'),
  ].join('\n') + '\n';
}

function catLabelMap(cats) {
  const m = new Map();
  (cats || []).forEach((c) => m.set(c.id, c.label || c.id));
  return m;
}


module.exports = { groupBy, mdTable, catLabelMap };
