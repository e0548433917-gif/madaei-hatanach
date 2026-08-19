// פרסום ״ערך היום״ ליומן של אוצריא (publishedData.upsert, ROADMAP 4.12).
// נטען גם ב-index.html וגם ב-background.html — אין להפוך ל-type="module".
//
// ⚠️ למה הקובץ הזה קיים בנפרד: עד 2.20.2 הקוד ישב **רק** ב-shell/background.js,
// שנטען רק מ-background.html. אבל contributes.background.entrypoint הוסר
// מהמניפסט ב-13.8.26, ולכן מנוע הרקע טוען את index.html — כלומר background.js
// לא נטען בשום מסלול, והפיצ׳ר ״ערך היום ביומן אוצריא״ (2.18.0) פשוט לא רץ.
// כאן הוא משותף לשני המסלולים, ולכן עובד בשניהם.
//
// תלוי ב-guides/_shared/dates.js (eventsForToday/todayHebrew/yearsSinceChurban)
// וב-shell/data.js (storageGetJson/storageSetJson) — שניהם נטענים לפניו.

// הרשומות שפורסמו אתמול חייבות לרדת, אחרת היומן מצטבר בלי סוף. שומרים את
// המפתחות שפורסמו, ומנקים אותם בהרצה הבאה לפני שמפרסמים את של היום.
const PUBLISHED_KEYS_KEY = 'madaei_hatanach_published_event_keys_v1';
// חותמת היום העברי שכבר פורסם. בלעדיה הפרסום היה רץ בכל פתיחת לשונית מחדש:
// מחיקת כל הרשומות ופרסומן מחדש, עשרות קריאות RPC על לא כלום.
const PUBLISHED_DAY_KEY = 'madaei_hatanach_published_event_day_v1';

// שומר מפני ריצה כפולה **בתוך אותו מופע**: bridge.js קורא גם מ-plugin.boot וגם
// מטיימר-הגיבוי (למקרה שה-boot ירה לפני שהספקנו להירשם). חותמת היום שבאחסון
// מטפלת בריצות עתידיות, אבל היא נכתבת רק בסוף — ובלי הדגל הזה שתי הקריאות
// היו רצות במקביל ומפרסמות פעמיים.
let dailyPublishInFlight = false;

async function publishTodayEvents(){
  if (!(window.Otzaria && Otzaria.call)) return;
  if (typeof eventsForToday !== 'function' || typeof todayHebrew !== 'function') return;
  if (dailyPublishInFlight) return;
  dailyPublishInFlight = true;
  try { await publishTodayEventsInner(); }
  finally { dailyPublishInFlight = false; }
}

async function publishTodayEventsInner(){
  const t = todayHebrew();
  const dayStamp = t.dayLetters + '|' + t.monthName;
  const lastDay = await storageGetJson(PUBLISHED_DAY_KEY);
  if (lastDay === dayStamp) return;   // כבר פורסם היום

  // ניקוי הקודמות
  const prev = await storageGetJson(PUBLISHED_KEYS_KEY);
  if (Array.isArray(prev)){
    for (const key of prev){
      await Otzaria.call('publishedData.remove', {
        type: 'calendar.event', scope: 'global', key: key
      }).catch(()=>{});
    }
  }

  const events = eventsForToday();
  if (!events.length){
    await storageSetJson(PUBLISHED_KEYS_KEY, []);
    await storageSetJson(PUBLISHED_DAY_KEY, dayStamp);
    return;
  }

  // היום הלועזי בחצות, מקומי. אלה מאורעות של יום שלם ולא של שעה מסוימת, ולכן
  // אין endsAt ואין שעה משמעותית.
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const tzMin = -now.getTimezoneOffset();
  const tz = (tzMin >= 0 ? '+' : '-') + pad(Math.floor(Math.abs(tzMin) / 60)) + ':' + pad(Math.abs(tzMin) % 60);
  const startsAt = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
    + 'T00:00:00' + tz;

  const keys = [];
  for (let i = 0; i < events.length; i++){
    const ev = events[i];
    // כלל המפתח שב-README: <pluginId>:<type>:<identifier> — מונע התנגשויות.
    const key = 'madaei:dailyEvent:' + i;
    const res = await Otzaria.call('publishedData.upsert', {
      type: 'calendar.event',
      scope: 'global',
      key: key,
      payload: {
        title: ev.event,
        startsAt: startsAt,
        source: 'עינים למקרא',
        importance: 'low',
        description: t.dayLetters + '׳ ' + t.monthName
          + (typeof yearsSinceChurban === 'function' ? ' · ' + yearsSinceChurban() + ' שנה לחורבן' : '')
          + (ev.source ? ' · ' + ev.source : '')
      }
    }).catch(() => null);
    if (res && res.success) keys.push(key);
  }
  await storageSetJson(PUBLISHED_KEYS_KEY, keys);
  await storageSetJson(PUBLISHED_DAY_KEY, dayStamp);
}
