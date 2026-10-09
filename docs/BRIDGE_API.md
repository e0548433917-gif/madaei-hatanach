# גשר אוצריא (Otzaria Bridge) — חוזה API v1

שירות Windows מקומי שהתוספים "סייר קבצים" ו"הגדרות מערכת" פונים אליו דרך
`Otzaria.call('network.fetchStream', ...)` עם ההרשאה `network.localhost`.

## חיבור

- כתובת: `http://127.0.0.1:<port>` — פורט ברירת מחדל **47917**. אם תפוס, הגשר מנסה
  47918..47921 ומשתמש בראשון הפנוי. התוסף סורק 47917..47921 ב-`GET /health`.
- **כל בקשה** חייבת לכלול את הכותרת `X-Otzaria-Bridge: 1`. בקשה עם כותרת `Origin`
  שאינה `null`/ריקה — נדחית ב-403 (הגנה מפני אתרי אינטרנט שפונים ל-localhost).
  בקשות OPTIONS (preflight) נדחות ב-403.
- כל הגופים JSON (`Content-Type: application/json; charset=utf-8`). בקשות POST בלבד,
  חוץ מ-`GET /health`.
- תשובה: `{ "ok": true, "data": ... }` או `{ "ok": false, "error": { "code": "...", "message": "הודעה בעברית" } }`
  עם סטטוס HTTP מתאים. קודי שגיאה: `bad_request`, `not_found`, `forbidden`, `exists`,
  `locked` (הפעולה חסומה במצב נעילה), `wrong_password`, `unsupported`, `internal`.
- נתיבים: נתיבי Windows מלאים (`C:\Users\...`). מחרוזת UTF-8 רגילה.

## /health (GET)
`data = { name: "otzaria-bridge", version: "1.0.0", port, kioskActive: bool, platform: "windows" }`

## קבצים — /fs/*

| נתיב | גוף | data |
|---|---|---|
| `/fs/roots` | `{}` | `{ drives: [{path, label, type, totalBytes, freeBytes}], known: [{id, name, path}] }` — known: desktop, documents, downloads, pictures, music, videos, home |
| `/fs/list` | `{ path, showHidden?: false }` | `{ path, parent: string\|null, entries: [{ name, path, type: "dir"\|"file", size, modified (ISO UTC), ext, hidden }] }` — תיקיות קודם, אח"כ קבצים, לפי שם |
| `/fs/stat` | `{ path }` | `{ name, path, type, size, created, modified, readOnly, hidden, itemCount? }` |
| `/fs/mkdir` | `{ path }` | `{ path }` — `exists` אם קיים |
| `/fs/rename` | `{ path, newName }` | `{ path }` |
| `/fs/copy` | `{ sources: [path], destDir, conflict: "skip"\|"overwrite"\|"rename" }` | `{ copied: n, skipped: n, failed: [{path, message}] }` — תיקיות רקורסיבית. `rename` = "שם (2).ext" |
| `/fs/move` | אותו גוף כמו copy | `{ moved, skipped, failed }` |
| `/fs/delete` | `{ paths: [path], permanent?: false }` | `{ deleted, failed }` — ברירת מחדל לסל המיחזור |
| `/fs/read` | `{ path, maxBytes?: 5242880 }` | `{ name, size, mime, encoding: "utf8"\|"base64", content, truncated }` — טקסט (txt, md, json, csv, xml, html, js, css, log, ini) כ-utf8, תמונות ו-pdf כ-base64 |
| `/fs/write-text` | `{ path, content, overwrite?: false }` | `{ path, size }` |
| `/fs/open` | `{ path }` | `{ opened: true }` — פתיחה ביישום ברירת המחדל של Windows. **חסום (`locked`) במצב נעילה**, אלא אם הסיומת ב-`kiosk.allowOpenExtensions` |
| `/fs/reveal` | `{ path }` | פתיחת סייר Windows על הקובץ. חסום במצב נעילה |
| `/fs/clipboard-get` | `{}` | `{ paths: [path], cut: bool }` — רשימת קבצים מלוח Windows (FileDropList) |
| `/fs/clipboard-set` | `{ paths, cut }` | `{ ok: true }` — כדי שהעתקה בתוסף תהיה זמינה גם בסייר Windows ולהפך |
| `/fs/search` | `{ root, query, extensions?: [], maxResults?: 500, includeDirs?: true, contentQuery?: string }` | **NDJSON זורם** (Content-Type `application/x-ndjson`): שורה לכל תוצאה `{ "type":"hit", name, path, type, size, modified }`, שורות התקדמות `{ "type":"progress", scanned, current }` כל ~300ms, ובסוף `{ "type":"done", scanned, hits, truncated, cancelled }`. `query` תומך ב-`*` ו-`?`; בלי תווים מיוחדים = "מכיל" ללא תלות ברישיות. `contentQuery` = חיפוש בתוך קבצי טקסט עד 2MB. מדלג על תיקיות מערכת ועל שגיאות הרשאה |

אזורים מוגנים: מחיקה/העברה/שינוי שם של `C:\Windows`, `C:\Program Files*`, `C:\ProgramData`,
שורש כונן, ותיקיית הגשר עצמה — `forbidden`.

## מערכת — /sys/*

| נתיב | גוף | data |
|---|---|---|
| `/sys/info` | `{}` | `{ computerName, userName, os, battery: {percent, charging} \| null, time }` |
| `/sys/audio/get` | `{}` | `{ volume: 0-100, muted, deviceName }` |
| `/sys/audio/set` | `{ volume?, muted? }` | אותו מבנה כמו get |
| `/sys/audio/devices` | `{}` | `{ devices: [{ id, name, isDefault }] }` |
| `/sys/audio/set-default` | `{ id }` | `{ ok }` (אם נכשל — `unsupported`) |
| `/sys/display/get` | `{}` | `{ brightness: 0-100 \| null, supported: bool }` — WMI, במחשבים ניידים |
| `/sys/display/set` | `{ brightness }` | אותו מבנה |
| `/sys/radios/get` | `{}` | `{ radios: [{ kind: "bluetooth"\|"wifi"\|"other", name, state: "on"\|"off"\|"disabled"\|"unknown" }] }` |
| `/sys/radios/set` | `{ kind, on }` | `{ radios }` |
| `/sys/bluetooth/devices` | `{ scan?: false }` | `{ devices: [{ id, name, paired, connected, kind }] }` — `scan:true` מחפש גם מכשירים לא מוצמדים (עד ~10 שניות) |
| `/sys/bluetooth/pair` | `{ id }` | `{ paired }` |
| `/sys/bluetooth/unpair` | `{ id }` | `{ unpaired }` |
| `/sys/wifi/networks` | `{}` | `{ connected: string\|null, networks: [{ ssid, signal (0-100), secured, connected, known }] }` |
| `/sys/wifi/connect` | `{ ssid, password? }` | `{ connected }` |
| `/sys/wifi/disconnect` | `{}` | `{ ok }` |
| `/sys/power` | `{ action: "sleep"\|"restart"\|"shutdown"\|"lock" }` | `{ ok }` |

## נעילה (קיוסק) — /kiosk/*

| נתיב | גוף | data |
|---|---|---|
| `/kiosk/status` | `{}` | `{ active, hasPassword, strict, autoStartBridge, otzariaPath, blockTaskManager, allowOpenExtensions: [] }` |
| `/kiosk/set-password` | `{ oldPassword?, newPassword }` | `{ ok, recoveryCode? }` — בהגדרה הראשונה מוחזר **קוד שחזור** חד-פעמי (12 תווים) להצגה פעם אחת. סיסמה ≥ 4 תווים. hash: PBKDF2-SHA256, 200k איטרציות, salt אקראי. אחרי 5 ניסיונות שגויים — השהיה של 60 שניות |
| `/kiosk/enable` | `{ password, strict?: false, blockTaskManager?: true }` | `{ active: true }` |
| `/kiosk/disable` | `{ password }` (או קוד שחזור) | `{ active: false }` |
| `/kiosk/settings` | `{ password, allowOpenExtensions?, otzariaPath? }` | סטטוס |

נעילה רכה (תמיד): סגירת explorer.exe (שורת המשימות ותפריט התחל), hook מקלדת שחוסם
Win / Alt+Tab / Alt+Esc / Ctrl+Esc / Alt+F4 על חלון אוצריא, מעקב שמחזיר את אוצריא לחזית
ומפעיל אותה מחדש אם נסגרה, וחסימת מנהל המשימות (HKCU Policies DisableTaskMgr).
נעילה קפדנית (`strict`): בנוסף מחליפה את מעטפת Windows של המשתמש באוצריא
(HKCU Winlogon Shell) — תקף מהכניסה הבאה. הנעילה נשמרת ומופעלת מחדש בכל הפעלת הגשר.
שחזור חירום: `OtzariaBridge.exe --unlock <recoveryCode>` מחלון פקודה, או Safe Mode
(הגשר לא עולה ב-Safe Mode, ולכן הנעילה הרכה לא חלה שם).

## הפעלה

- `OtzariaBridge.exe` בהפעלה הראשונה: מעתיק את עצמו ל-`%LOCALAPPDATA%\OtzariaBridge\`,
  רושם הפעלה אוטומטית (HKCU Run, ארגומנט `--background`), ועולה עם אייקון במגש.
- `--uninstall`: מבטל נעילה (דורש `--password` אם יש), מסיר Run ותיקייה.
- קובץ הגדרות: `%LOCALAPPDATA%\OtzariaBridge\config.json`.
