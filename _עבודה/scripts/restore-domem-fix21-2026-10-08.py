#!/usr/bin/env python3
"""המשך restore-domem: 21 הערכים שלא נמצא להם מקור בחיפוש הראשון — חיפוש שני בספריא
(naive_lemmatizer, כתיב מלא/חסר, סיומת ה/ת/א). הכרעה לפי בקשת בעלת הפרויקט: מוחקים רק
ערך שהמושג עצמו לא נמצא בשום מקום, או שהוא כפול לערך קיים."""
import json
FILE = 'guides/domem/data/domem-data.js'
ADD = {'אימום': 'משנה כלים ט״ז:ז׳', 'זמורה': 'משנה כלים י׳:ו׳', 'דיוטא': 'משנה עירובין ח׳:י״א', 'פנכה': 'תענית כ״ד ב:י׳'}
DUP = {'צפחה': 'צפחת', 'כישור של טוות': 'כישור', 'קערית של סממנין': 'קערה'}
NOTFOUND = ['ספלור', 'אספלטון', 'כסכסת', 'אספניות', 'כסיסה', 'דרכון', 'טבלת כתיבה', 'מרטש', 'קרוסטלין',
            'תרבד', 'פכפך', 'חמורה', 'קוז', 'בוכייר']
src = open(FILE, encoding='utf8').read(); st = src.index('const DATA = ') + 13
D, end = json.JSONDecoder().raw_decode(src, st)
out = []
for e in D:
    if e['name'] in DUP or e['name'] in NOTFOUND: continue
    if e['name'] in ADD and not e.get('makorot'): e['makorot'] = [{'ref': ADD[e['name']], 'text': ''}]
    out.append(e)
open(FILE, 'w', encoding='utf8').write(src[:st] + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + src[end:])
print('נוסף מקור:', len(ADD), '· נמחקו כפולים:', len(DUP), '· נמחקו (המושג לא נמצא):', len(NOTFOUND), '· סה״כ ערכים:', len(out))
