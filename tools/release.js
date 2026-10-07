#!/usr/bin/env node
/**
 * שחרור גרסה בלי PowerShell — שלבים 1–1ה של build/pack.ps1, ב-Node.
 *
 *   שימוש:  node tools/release.js --minor --title "כותרת" [--note "תבליט"]... [--dry]
 *           (--patch ברירת מחדל · --major · --minor)
 *
 * למה: build/pack.ps1 רץ רק ב-Windows. מסביבת ענן/לינוקס אי אפשר היה לשחרר,
 * ועריכה של CHANGELOG/ROADMAP בלי הטבעה מחדש מפילה את ה-CI (verify-embedded.js).
 *
 * מה הסקריפט עושה — בדיוק כמו pack.ps1:
 *   1   העלאת הגרסה ב-manifest.json
 *   1ב  ערך חדש בראש CHANGELOG.md (״## <גרסה> — <תאריך עברי> (<dd/MM/yyyy>)״)
 *   1ג–1ה הטבעת CHANGELOG.md, ROADMAP.md ומספר הגרסה ב-guides/_shared/*-embedded.js
 *
 * מה הוא **לא** עושה: אינו אורז .otzplugin ואינו מפרסם. אחרי הקומיט והתג,
 * הדחיפה ל-main מפעילה את .github/workflows/publish.yml — הוא מקפל את החבילה,
 * יוצר GitHub Release ומפרסם לחנות. הקומיט, התג והדחיפה נשארים בידי המריץ:
 *
 *   git add manifest.json CHANGELOG.md guides/_shared/*-embedded.js
 *   git commit -m "<גרסה> — אריזה" && git tag -a v<גרסה> -m <גרסה>
 *   git push && git push origin v<גרסה>
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const p = (rel) => path.join(root, rel);
const args = process.argv.slice(2);
const flag = (n) => args.includes('--' + n);
const opt = (n) => { const i = args.indexOf('--' + n); return i !== -1 ? args[i + 1] : null; };
const notesArg = args.reduce((a, v, i) => (v === '--note' && args[i + 1] ? a.concat(args[i + 1]) : a), []);
const dry = flag('dry');

// ---- 1. גרסה ----
const manifestRaw = fs.readFileSync(p('manifest.json'), 'utf8');
const manifest = JSON.parse(manifestRaw);
if (manifest.description.length > 150) throw new Error('תיאור המניפסט חורג מ-150 תווים — אוצריא דוחה התקנה.');
const [maj, min, pat] = manifest.version.split('.').map(Number);
const newVersion = flag('major') ? `${maj + 1}.0.0` : flag('minor') ? `${maj}.${min + 1}.0` : `${maj}.${min}.${pat + 1}`;
const tags = execSync('git tag --list', { cwd: root, encoding: 'utf8' }).split('\n');
if (tags.includes('v' + newVersion)) throw new Error(`התג v${newVersion} כבר קיים (כלל 2.11.6).`);
// עריכה נקודתית של שורת הגרסה — שומרת על העיצוב המקורי של הקובץ
const manifestNew = manifestRaw.replace(/("version"\s*:\s*")[^"]+(")/, `$1${newVersion}$2`);

// ---- 1ב. תאריך עברי כמו בקובץ: ״כ״ז בתשרי תשפ״ז״ ----
function gematria(n){
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const hund = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];
  let s = hund[Math.floor(n / 100)] || '';
  const r = n % 100;
  if (r === 15) s += 'טו'; else if (r === 16) s += 'טז';
  else s += tens[Math.floor(r / 10)] + ones[r % 10];
  return s.length > 1 ? s.slice(0, -1) + '״' + s.slice(-1) : s + '׳';
}
const now = new Date();
const tz = 'Asia/Jerusalem';
const heParts = Object.fromEntries(new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { timeZone: tz, day: 'numeric', month: 'long', year: 'numeric' })
  .formatToParts(now).map(x => [x.type, x.value]));
const heDate = `${gematria(Number(heParts.day))} ב${heParts.month} ${gematria(Number(heParts.year) % 1000)}`;
const enDate = new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric' }).format(now);

function defaultNotes(){
  const last = execSync('git tag --list "v*" --sort=-v:refname', { cwd: root, encoding: 'utf8' }).split('\n')[0];
  const range = last ? `${last}..HEAD` : '-n15';
  return execSync(`git log --format=%s ${range}`, { cwd: root, encoding: 'utf8' })
    .split('\n').filter(s => s && !/^(תוכניות|docs?|תיעוד):/.test(s));
}
const body = notesArg.length ? notesArg : defaultNotes();
const title = opt('title') || (body.length ? `${body.length} שינויים בגרסה זו.` : 'אריזה מחדש.');
let packer = '';
try { packer = execSync('git config user.name', { cwd: root, encoding: 'utf8' }).trim(); } catch(e){}

const entry = [`## ${newVersion} — ${heDate} (${enDate})`, '', `**${title}**`]
  .concat(body.length ? [''].concat(body.map(n => '* ' + n)) : [])
  .concat(packer ? ['', `_נארז על ידי ${packer}._`] : [])
  .concat(['', '']).join('\n');

const cl = fs.readFileSync(p('CHANGELOG.md'), 'utf8');
if (new RegExp('^##\\s+' + newVersion.replace(/\./g, '\\.') + '\\s', 'm').test(cl)) throw new Error(`כבר קיים ערך ל-${newVersion} ב-CHANGELOG.md.`);
const idx = cl.indexOf('\n## ');
const clNew = idx < 0 ? cl.trimEnd() + '\n\n' + entry : cl.slice(0, idx + 1) + entry + cl.slice(idx + 1);

// ---- 1ג–1ה. הטבעה ----
const rm = fs.existsSync(p('ROADMAP.md')) ? fs.readFileSync(p('ROADMAP.md'), 'utf8') : null;
const embeds = {
  'guides/_shared/changelog-embedded.js': `// נוצר אוטומטית על ידי build/pack.ps1 מתוך CHANGELOG.md - אל תערכו ביד, זה יידרס.\r\nconst EMBEDDED_CHANGELOG_MD = ${JSON.stringify(clNew)};\r\n`,
  'guides/_shared/version-embedded.js': `// נוצר אוטומטית על ידי build/pack.ps1 מתוך manifest.json - אל תערכו ביד, זה יידרס.\r\nconst EMBEDDED_PLUGIN_VERSION = ${JSON.stringify(newVersion)};\r\n`
};
if (rm !== null) embeds['guides/_shared/roadmap-embedded.js'] = `// נוצר אוטומטית על ידי build/pack.ps1 מתוך ROADMAP.md - אל תערכו ביד, זה יידרס.\r\nconst EMBEDDED_ROADMAP_MD = ${JSON.stringify(rm)};\r\n`;

console.log(`גרסה: ${manifest.version} → ${newVersion}`);
console.log(entry);
if (dry){ console.log('(--dry: לא נכתב דבר)'); process.exit(0); }
fs.writeFileSync(p('manifest.json'), manifestNew);
fs.writeFileSync(p('CHANGELOG.md'), clNew);
for (const [rel, content] of Object.entries(embeds)) fs.writeFileSync(p(rel), content);
console.log('נכתבו: manifest.json, CHANGELOG.md, ' + Object.keys(embeds).join(', '));
console.log('הבא: node tools/verify-embedded.js, ואז commit + tag v' + newVersion + ' + push.');
