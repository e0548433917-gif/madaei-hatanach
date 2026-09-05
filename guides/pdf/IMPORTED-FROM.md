# guides/pdf — קוד מיובא, אין לערוך ידנית

הקבצים כאן מיוצרים על ידי `tools/import-pdf-viewer.js`. **כל עריכה ידנית תידרס
בייבוא הבא.** שינוי נדרש ⇒ להוסיף טלאי ל-`PATCHES` בסקריפט ולהריץ מחדש.

| | |
|---|---|
| מקור | `com.chadbedera.pdfviewer` — https://github.com/e0548433917-gif/pdf-viewer |
| גרסת מקור | 2.6.3 |
| commit | b8ec4c0 |
| יובא בתאריך | 2026-09-05 |
| פנייה | #65 |

## מה לא יובא ולמה

`vendor/ocr-worker-loader.js` (10MB, מנוע OCR עברי), `tesseract.min.js`,
`jszip.min.js` (docx/pptx/epub) ו-`UTIF.js` (TIFF) — יחד 10.2MB שהיו כמעט
מכפילים את משקל החבילה. הקורא כאן הוא PDF בלבד; חילוץ טקסט **מוטבע** (📝)
עובד רגיל, כי הוא pdf.js טהור.

## קבצים

* `vendor/pdf.min.js` — 377,116 bytes · sha256 `978fd1b2d134a98e…`
* `vendor/pdf.worker.min.js` — 1,133,660 bytes · sha256 `38cde5311957b86b…`
* `viewer.html` — 86,993 bytes · sha256 `4bebbcfb1d5fcb44…`

pdf.js הוא של Mozilla תחת Apache-2.0 (הרישיון מוטבע בראש `vendor/pdf.min.js`).
