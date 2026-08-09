// מאורעות התנ״ך לפי תאריך (2.10א) — עבודת חילוץ וסינון, לא מחקר.
// המקור העיקרי: "לוח אירועים" שבתוסף "ביוגרפיות v2.2.3.otzplugin" (window.EVENTS
// ב-data/events-data.js), רק הרשומות שתויגו שם category:"תנ״ך" - 37 מתוך 46.
// "יומא דהילולא" (שדרוג 3.8\-יומא-דהילולא1.0.1.otzplugin) נבדק ולא נכלל: הוא
// כולו ימי הילולא של רבנים, ואינו כולל אנשים/מאורעות תנ״ך בכלל (בדיוק כמו
// שתואר בהערה של הכותב).
// מ.4.0-ו.1: כמה רשומות נוספו ממקורות חז״ל/הלכה חיצוניים (לא מ"ביוגרפיות"),
// כדי שהרשימה תפסיק להיות העתק בלעדי של מקור יחיד - ר׳ ה"source" של כל רשומה
// כזו. חלקן (כמו א׳ אלול) הן מאורע תנ״כי שתאריכו אינו מפורש בפסוק עצמו,
// ולכן ה-source שלהן לא נפרש ע"י parseColonVerseRef (אין קישור לספרייה, וזה
// תקין - התאריך נקבע במקור חוץ-מקראי, לא בפסוק). 2.10ב (סריקת כל התנ״ך אחר
// תאריכים - עבודת מחקר, אינה בסבב הזה) יוסיף עוד רשומות לאותו מערך
// TANAKH_DATE_EVENTS, בלי שינוי מבנה: כל צרכני הדאטה (eventsForToday, הפאנל
// ב-home.js) קוראים מהמערך עצמו.
// אין להפוך ל-type="module" — כל הקבצים חולקים scope גלובלי אחד.
const TANAKH_DATE_EVENTS = [
  { day:"א", month:"תשרי", event:"עולי בבל החלו להעלות עולות לה'", source:"עזרה ג:ו" },
  { day:"י", month:"תשרי", event:"יחזקאל מתנבא על הבית השלישי", source:"יחזקאל מ:א" },
  { day:"כא", month:"תשרי", event:"נבואת חגי השניה", source:"חגי ב:א" },
  { day:"כד", month:"תשרי", event:"נבואת חגי השלישית", source:"חגי ב:כ" },
  { day:"כד", month:"תשרי", event:"עולי בבל נאספו בצום ובשקים והתוודו על עוונותיהם", source:"נחמיה ט:א" },
  { day:"כ", month:"כסלו", event:"כל עולי בבל נקבצו לכינוס תשובה עם עזרא הסופר", source:"עזרא י:ט" },
  { day:"א", month:"טבת", event:"הושיבו בית דין לגרש הנשים הנכריות מעולי בבל", source:"עזרא י:טז" },
  { day:"ה", month:"טבת", event:"בא הפליט לומר ליחזקאל שהוכתה העיר", source:"יחזקאל לג:כא" },
  { day:"יב", month:"טבת", event:"יחזקאל מתנבא על מצרים", source:"יחזקאל כט:א" },
  { day:"א", month:"שבט", event:"הואיל משה באר את התורה הזאת לאמר", source:"דברים א:ג" },
  { day:"א", month:"אדר", event:"יחזקאל התנבא קינה על פרעה", source:"יחזקאל לב:א" },
  { day:"ז", month:"אדר", event:"יום לידתו ופטירתו של משה רבנו", source:"תלמוד בבלי, מגילה יג ע\"ב" },
  { day:"כז-כה", month:"אדר", event:"נשא אויל מרודך את ראש יהויכין מבית הכלא", source:"מלכים ב כה:כז ירמיהו נב:לא" },
  { day:"א", month:"ניסן", event:"הקב\"ה דיבר עם משה החודש הזה לכם", source:"" },
  { day:"א", month:"ניסן", event:"הוקם המשכן", source:"שמות מ:יז" },
  { day:"א", month:"ניסן", event:"יחזקאל התנבא על צור", source:"יחזקאל כו:א" },
  { day:"א", month:"ניסן", event:"יחזקאל מתנבא על פורענות מצרים ע\"י נבוכדנצר", source:"יחזקאל כט:יז" },
  { day:"א", month:"ניסן", event:"עזרא וחבריו יוצאים מבבל", source:"עזרא ז:ט" },
  { day:"א", month:"ניסן", event:"עזרא ובית דינו סיימו לגרש הנשים הנכריות מעולי בבל", source:"עזרא י:טז" },
  { day:"א", month:"ניסן", event:"שלוחי חזקיהו מתחילים לקדש את בית ה'", source:"ד\"ה ב כט:יז" },
  { day:"ז", month:"ניסן", event:"נבואה נגד פרעה ע\"י יחזקאל", source:"יחזקאל ל:כ" },
  { day:"ח", month:"ניסן", event:"שלוחי חזקיהו מתחילים לקדש את האולם", source:"ד\"ה ב כט:יז" },
  { day:"י", month:"ניסן", event:"העם עלו מן הירדן", source:"יהושע ד:יט" },
  { day:"יב", month:"ניסן", event:"עזרא וחבריו נוסעים מנהר אהוא בדרכם לירושלים", source:"עזרא ח:לא" },
  { day:"טז", month:"ניסן", event:"שלוחי חזקיהו סיימו לקדש את בית ה'", source:"ד\"ה ב כט:יז" },
  { day:"כד", month:"ניסן", event:"דניאל רואה את המלאכים", source:"דניאל י:ד" },
  { day:"א", month:"אייר", event:"נצטוה משה למנות את ישראל", source:"במדבר א:א" },
  { day:"יד", month:"אייר", event:"החל המן לרדת במדבר", source:"שמות טז:א" },
  { day:"כ", month:"אייר", event:"בני ישראל נוסעים בראשונה", source:"שמות י:יא" },
  { day:"א", month:"סיון", event:"נבואה נגד פרעה ע\"י יחזקאל", source:"יחזקאל לא:א" },
  { day:"א", month:"סיון", event:"בני ישראל באים למדבר סיני", source:"שמות יט:א" },
  { day:"ו", month:"סיון", event:"מתן תורה", source:"תלמוד בבלי, שבת פו ע\"ב" },
  { day:"כג", month:"סיון", event:"התאספו סופרי אחשוורוש לכתוב אגרות שניות", source:"אסתר" },
  { day:"ה", month:"תמוז", event:"נפתחו השמים וראה יחזקאל מראות אלקים", source:"יחזקאל א:א" },
  { day:"א", month:"אב", event:"עזרא וחבריו מגיעים לירושלים", source:"עזרא ז:ט" },
  { day:"ט", month:"אב", event:"ליל בכיה לדורות בעקבות חטא המרגלים", source:"תלמוד בבלי, תענית כט ע\"א" },
  { day:"י", month:"אב", event:"באו אנשים מזקני ישראל לדרוש את ה' מאת יחזקאל", source:"יחזקאל כ:א" },
  { day:"א", month:"אלול", event:"משה רבנו עלה להר סיני לקבל לוחות שניים", source:"חיי אדם, הלכות אלול וראש השנה" },
  { day:"א", month:"אלול", event:"נבואת חגי", source:"חגי א:א" },
  { day:"ה", month:"אלול", event:"נפלה על יחזקאל יד ה' וראה המלאכים", source:"יחזקאל ח:א" },
  { day:"כד", month:"אלול", event:"העם באו לעשות מלאכה לבניית בית שני", source:"חגי א:טו" },
];
const HEBREW_MONTHS_ORDER = ["תשרי","חשון","כסלו","טבת","שבט","אדר","ניסן","אייר","סיון","תמוז","אב","אלול"];

// ---- המרת תאריך לועזי->עברי ----
// אלגוריתם יומן יוליאני סטנדרטי לחישוב תאריך עברי - הועתק כמעט מילה במילה
// מ"יומא דהילולא" (js/app.js שם), שכבר משתמש בו בפועל בתוך אוצריא ונבדק שם.
function isHebrewLeapYear(y){ return (7*y+1)%19<7; }
function hebElapsedDays(y){
  const mo=Math.floor((235*y-234)/19);
  const parts=12084+13753*mo;
  let day=mo*29+Math.floor(parts/25920);
  if((3*(day+1))%7<3)day++;
  return day;
}
function daysInHebYear(y){ return hebElapsedDays(y+1)-hebElapsedDays(y); }
function hebMonthLengths(y){
  const isLeap=isHebrewLeapYear(y);
  const days=daysInHebYear(y);
  let ch=29,ksl=30;
  if(!isLeap){ if(days===353)ksl=29; else if(days===355)ch=30; }
  else{ if(days===383)ksl=29; else if(days===385)ch=30; }
  return isLeap
    ? [30,ch,ksl,29,30,30,29,30,29,30,29,30,29]
    : [30,ch,ksl,29,30,29,30,29,30,29,30,29];
}
function gregToJD(y,m,d){
  const a=Math.floor((14-m)/12),yy=y+4800-a,mm=m+12*a-3;
  return d+Math.floor((153*mm+2)/5)+365*yy+Math.floor(yy/4)-Math.floor(yy/100)+Math.floor(yy/400)-32045;
}
function gregToHebDate(year,month,day){
  const jd=gregToJD(year,month,day),ep=347998;
  let hy=Math.floor((jd-ep)/365.25)+1;
  while(hebElapsedDays(hy+1)+ep<=jd)hy++;
  while(hebElapsedDays(hy)+ep>jd)hy--;
  let doy=jd-(hebElapsedDays(hy)+ep);
  const ml=hebMonthLengths(hy);
  let hm=0,hd=0;
  for(let i=0;i<ml.length;i++){ if(doy<ml[i]){ hm=i+1; hd=doy+1; break; } doy-=ml[i]; }
  return { year:hy, month:hm, day:hd };
}
const HEB_MONTH_NAMES = ['תשרי','חשון','כסלו','טבת','שבט','אדר','ניסן','אייר','סיון','תמוז','אב','אלול'];
const HEB_MONTH_NAMES_LEAP = ['תשרי','חשון','כסלו','טבת','שבט','אדר א׳','אדר ב׳','ניסן','אייר','סיון','תמוז','אב','אלול'];
function hebMonthNameOf(m, isLeap){ return isLeap ? HEB_MONTH_NAMES_LEAP[m-1] : HEB_MONTH_NAMES[m-1]; }

// היום הלועזי, כתאריך עברי לתצוגה: {dayLetters, monthName, raw:{year,month,day}}.
// numToHeb (co-mentions.js) הופך מספר לאותיות עבריות - לא בונים המרה שנייה.
function todayHebrew(){
  const now = new Date();
  const raw = gregToHebDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const isLeap = isHebrewLeapYear(raw.year);
  return { dayLetters: numToHeb(raw.day), monthName: hebMonthNameOf(raw.month, isLeap), raw: raw };
}

// אדר בשנה מעוברת הוא "אדר א׳"/"אדר ב׳" - באירועי התנ״ך תמיד "אדר" סתם, ולכן
// מתאימים לשניהם. gematriaValue (co-mentions.js) הופך אותיות ליום מספרי.
function monthMatchesEventMonth(monthName, eventMonth){
  if (monthName === eventMonth) return true;
  return eventMonth === 'אדר' && monthName.indexOf('אדר') === 0;
}
function dayMatchesEventDay(dayNum, eventDay){
  if (eventDay.indexOf('-') !== -1){
    const bounds = eventDay.split('-').map(gematriaValue);
    const lo = Math.min(bounds[0], bounds[1]), hi = Math.max(bounds[0], bounds[1]);
    return dayNum >= lo && dayNum <= hi;
  }
  return gematriaValue(eventDay) === dayNum;
}
function eventsForToday(){
  const t = todayHebrew();
  return TANAKH_DATE_EVENTS.filter(ev => monthMatchesEventMonth(t.monthName, ev.month) && dayMatchesEventDay(t.raw.day, ev.day));
}

// ---- מקור המאורע -> קישור לפתיחה בספרייה ----
// המקורות ב-TANAKH_DATE_EVENTS כתובים "ספר פרק:פסוק" (נקודתיים, לא פסיק כמו
// ב-parseVerseRef של refs.js) - פורמט ציטוט שונה, ולכן פרסינג נפרד וקטן, לא
// הרחבה של parseVerseRef. שני כינויים לתיקון טעויות כתיב/קיצור במקור החילוץ
// ("עזרה" במקום "עזרא", "ד״ה א/ב" קיצור מקובל לדברי הימים). מקור משולב
// ("... כה:כז ירמיהו נב:לא") - נלקח רק הראשון, לא נבנה פרסינג לרב-מקור.
const DATE_EVENT_BOOK_ALIASES = { 'עזרה':'עזרא', 'ד"ה א':'דברי הימים א', 'ד"ה ב':'דברי הימים ב' };
function parseColonVerseRef(source){
  if (!source) return null;
  const m = String(source).trim().match(/^([א-ת" ]+?)\s+([א-ת]{1,3}):([א-ת]{1,3})/);
  if (!m) return null;
  const book = DATE_EVENT_BOOK_ALIASES[m[1].trim()] || m[1].trim();
  if (TANAKH_BOOKS.indexOf(book) === -1) return null;
  return { bookId: book, ref: 'פרק ' + m[2] };
}
