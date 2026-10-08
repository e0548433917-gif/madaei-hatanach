// #94 שלב ב׳ — חילוץ מחרוזות ממשק עבריות שעדיין אין להן תרגום ב-shell/i18n-en.js.
// מקורות: מחרוזות-ליטרל ב-shell/*.js (חוץ מקבצי דאטה/מנוע) וצמתי טקסט/תכונות ב-HTML.
'use strict';
const fs = require('fs'), path = require('path');
global.window = {}; require(path.resolve('shell/i18n-en.js'));
const have = window.TRANSLATIONS.en;
const SKIP = /^(core|refs|shas|parasha|i18n|i18n-en|.*-embedded|.*data.*)\.js$/;
const out = new Map();
const add = (s, f) => {
  s = s.replace(/\s+/g, ' ').trim();
  if (!/[א-ת]/.test(s) || s.length > 80 || s.length < 2) return;
  if (/[{}<>$]|\\u|https?:/.test(s)) return;
  if ((s.match(/[א-ת]+/g) || []).length > 10) return;          // משפט ארוך — לא תווית
  if (have[s]) return;
  if (!out.has(s)) out.set(s, f);
};
for (const f of fs.readdirSync('shell').filter(f => f.endsWith('.js') && !SKIP.test(f))) {
  const src = fs.readFileSync('shell/' + f, 'utf8').replace(/^\s*\/\/.*$/gm, '');
  for (const m of src.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g)) add(m[1] ?? m[2], f);
  for (const m of src.matchAll(/`([^`$]*)`/g)) add(m[1], f);
}
for (const f of ['index.html', ...fs.readdirSync('shell').filter(f => f.endsWith('.html')).map(f => 'shell/' + f)]) {
  if (!fs.existsSync(f)) continue;
  const src = fs.readFileSync(f, 'utf8').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, '');
  for (const m of src.matchAll(/>([^<>]+)</g)) add(m[1], f);
  for (const m of src.matchAll(/(?:placeholder|title|aria-label)="([^"]+)"/g)) add(m[1], f);
}
fs.writeFileSync(process.argv[2] || '/dev/stdout', JSON.stringify(Object.fromEntries(out), null, 1));
console.error('מחרוזות בלי תרגום:', out.size);
