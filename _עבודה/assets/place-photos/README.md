# תמונות למקומות (#73, ת.5.2)

תמונה לכל מקום (בעיקר ערים בנויות ונופים), נאספה מוויקישיתוף לפי קואורדינטות הזיהוי.
**הוטמעו בתוסף ב-4.20.1** (`node _עבודה/scripts/embed-place-photos.js`, ואחריו `node tools/compress-embedded-images.js guides/places/data/places.js`). הקבצים כאן הם המקור לאיסוף מחדש.

* `credits.json`: שם הערך ← קובץ, קרדיט ורישיון, וקישור למקור.
* `rejected.json`: ערכים שהתמונה שנמצאה להם נפסלה בבדיקה בעין. הסקריפט לא יאסוף להם שוב.
* כל הקבצים כבר מכווצים (WebP, 520px, q78).
* איסוף מחדש או השלמה: `node _עבודה/scripts/place-site-photos.js --collect` (נדרש `sharp`).
