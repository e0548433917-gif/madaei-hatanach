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
  { day:"א", month:"תשרי", event:"ראש השנה למעשר בהמה, לדעת רבי אלעזר ורבי שמעון", source:"משנה, בכורות ט, ה" },
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
  { day:"ז", month:"אדר", event:"יום לידתו ופטירתו של משה רבנו", source:"בבלי, מגילה יג ע\"ב" },
  { day:"כז-כה", month:"אדר", event:"נשא אויל מרודך את ראש יהויכין מבית הכלא", source:"מלכים ב כה:כז ירמיהו נב:לא" },
  // שלוש רשומות ר' עקיבא (כט אדר / כ אייר / כט אלול, למטה) ותאריך בן עזאי לפסח
  // (כט אדר) - המשנה עצמה (בכורות ט,ה) נותנת לר"ע רק לשון יחסית ("בפרוס
  // הפסח/העצרת/החג"), לא תאריך. התאריכים כאן מחושבים מפירוש ברטנורא שם, שכתב
  // במפורש (מצוטט מילה במילה, ספריא Bartenura_on_Mishnah_Bekhorot.9.5):
  // "ולשון פרוס, פלגא, חצי הזמן ששואלין בהלכות הפסח, דתניא שואלין בהלכות
  // הפסח קודם לפסח שלשים יום. וכן פרוס עצרת חמשה עשר יום קודם. וכן פרוס החג".
  // כלומר: פרוס=חצי מ-30 יום=15 יום לפני החג. פסח(טו בניסן)-15 יום=כט אדר
  // (אדר הסמוך לניסן קבוע ב-29 יום בלוח העברי הנוכחי, ר' תוי"ט שם על בן עזאי -
  // ברטנורא עצמו קורא לזה "היום האחרון של אדר"); חג/סוכות(טו בתשרי)-15 יום=
  // כט אלול (אלול קבוע 29 יום תמיד - "היום האחרון של אלול"). עצרת/שבועות
  // (ו בסיון)-15 יום=כ אייר - זה חושב ע"י הכותב (איננו מצוטט במפורש כתאריך
  // אצל ברטנורא, רק "חמשה עשר יום קודם"; אייר קבוע 29 יום תמיד, כך שהחישוב
  // אינו תלוי-שנה) - כדאי לאמת מול מקור מודפס לפני הסתמכות מלאה.
  { day:"כט", month:"אדר", event:"ראש גורן ראשון למעשר בהמה, לדעת רבי עקיבא ובן עזאי", source:"משנה, בכורות ט, ה" },
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
  { day:"כ", month:"אייר", event:"ראש גורן שני למעשר בהמה, לדעת רבי עקיבא", source:"משנה, בכורות ט, ה" },
  { day:"א", month:"סיון", event:"נבואה נגד פרעה ע\"י יחזקאל", source:"יחזקאל לא:א" },
  { day:"א", month:"סיון", event:"בני ישראל באים למדבר סיני", source:"שמות יט:א" },
  { day:"א", month:"סיון", event:"ראש גורן שני למעשר בהמה, לדעת בן עזאי", source:"משנה, בכורות ט, ה" },
  { day:"ו", month:"סיון", event:"מתן תורה", source:"בבלי, שבת פו ע\"ב" },
  { day:"כג", month:"סיון", event:"התאספו סופרי אחשוורוש לכתוב אגרות שניות", source:"אסתר ח:ט" },
  { day:"ה", month:"תמוז", event:"נפתחו השמים וראה יחזקאל מראות אלקים", source:"יחזקאל א:א" },
  { day:"א", month:"אב", event:"עזרא וחבריו מגיעים לירושלים", source:"עזרא ז:ט" },
  { day:"ט", month:"אב", event:"ליל בכיה לדורות בעקבות חטא המרגלים", source:"בבלי, תענית כט ע\"א" },
  { day:"י", month:"אב", event:"באו אנשים מזקני ישראל לדרוש את ה' מאת יחזקאל", source:"יחזקאל כ:א" },
  { day:"כט", month:"אב", event:"ראש גורן שלישי למעשר בהמה, לדעת בן עזאי", source:"משנה, בכורות ט, ה" },
  { day:"א", month:"אלול", event:"משה רבנו עלה להר סיני לקבל לוחות שניים", source:"חיי אדם, הלכות אלול וראש השנה" },
  { day:"א", month:"אלול", event:"ראש השנה למעשר בהמה, לדעת רבי מאיר", source:"משנה, בכורות ט, ה" },
  { day:"א", month:"אלול", event:"נבואת חגי", source:"חגי א:א" },
  { day:"ה", month:"אלול", event:"נפלה על יחזקאל יד ה' וראה המלאכים", source:"יחזקאל ח:א" },
  { day:"כד", month:"אלול", event:"העם באו לעשות מלאכה לבניית בית שני", source:"חגי א:טו" },
  { day:"כט", month:"אלול", event:"ראש גורן שלישי למעשר בהמה, לדעת רבי עקיבא", source:"משנה, בכורות ט, ה" },
  // --- גל: מקורות תלמודיים/מדרשיים ממסמך שהעלה המשתמש (docx) + הודעת המשך ---
  { day:"א", month:"תשרי", event:"ראש השנה — בריאת האדם (לדעת ר׳ אליעזר); נפקדו שרה, רחל וחנה; יצא יוסף מבית האסורים", source:"ראש השנה יא." },
  { day:"ג", month:"תשרי", event:"צום גדליה — הריגת גדליה בן אחיקם", source:"ראש השנה יח:" },
  { day:"י", month:"תשרי", event:"יום הכיפורים — מחילת חטא העגל ונתינת לוחות שניים", source:"תענית כו:" },
  { day:"כב", month:"תשרי", event:"שמיני עצרת; שלמה המלך חנך את בית המקדש הראשון", source:"מועד קטן ט." },
  { day:"ז", month:"חשון", event:"מתחילים לשאול גשמים בארץ ישראל", source:"תענית י." },
  { day:"יז", month:"חשון", event:"תחילת ירידת מי המבול (לדעת ר׳ אליעזר)", source:"ראש השנה יא:" },
  { day:"כג", month:"חשון", event:"פורקו אבני המזבח שטמאו יוונים בימי החשמונאים", source:"מגילת תענית" },
  { day:"כה", month:"כסלו", event:"תחילת חג החנוכה — נס פך השמן", source:"שבת כא:" },
  { day:"ח", month:"טבת", event:"נכתבה התורה יוונית בימי תלמי המלך, והיה חושך בעולם ג׳ ימים", source:"מגילת תענית" },
  { day:"ט", month:"טבת", event:"נפטר עזרא הסופר", source:"מגילת תענית" },
  { day:"י", month:"טבת", event:"נבוכדנצר מלך בבל החל במצור על ירושלים", source:"ערכין יא:" },
  { day:"א", month:"שבט", event:"ראש השנה לאילן לבית שמאי; משה החל לבאר את התורה", source:"ראש השנה ב." },
  { day:"טו", month:"שבט", event:"ראש השנה לאילן לבית הלל", source:"ראש השנה ב." },
  { day:"כח", month:"שבט", event:"בטלה גזירת שמד בימי החשמונאים", source:"מגילת תענית" },
  { day:"ז", month:"אדר", event:"לידתו ופטירתו של משה רבינו", source:"קידושין לח." },
  { day:"יג", month:"אדר", event:"תענית אסתר; יום ניקנור — מפלת ניקנור בימי החשמונאים", source:"תענית יח:" },
  { day:"טז", month:"אדר", event:"התחילו לבנות חומת ירושלים בימי נחמיה", source:"מגילת תענית" },
  { day:"כח", month:"אדר", event:"ביטול גזירות רומי — בשורה טובה ליהודים", source:"תענית יח." },
  { day:"א", month:"ניסן", event:"הקמת המשכן במדבר; מות נדב ואביהוא; ראש השנה למלכים", source:"ראש השנה ז." },
  { day:"ז", month:"ניסן", event:"בכה יהושע על עכן (או אבל על מות אהרן, לפי חלק מהמדרשים)", source:"סנהדרין מד." },
  { day:"י", month:"ניסן", event:"מרים הנביאה נפטרה; בני ישראל עברו את הירדן בימי יהושע", source:"תענית ט." },
  { day:"יד", month:"ניסן", event:"שחיטת קרבן פסח; בדיקת חמץ בלילו", source:"פסחים ב." },
  { day:"א", month:"אייר", event:"המפקד הראשון של בני ישראל במדבר סיני", source:"יומא ז." },
  { day:"יד", month:"אייר", event:"פסח שני", source:"פסחים צב." },
  { day:"יח", month:"אייר", event:"ל״ג בעומר — פסיקת מות תלמידי רבי עקיבא; הילולת רשב״י", source:"יבמות סב:" },
  { day:"ו", month:"סיון", event:"מתן תורה בהר סיני (לדעת חכמים)", source:"שבת פו." },
  { day:"כה", month:"סיון", event:"נהרגו רבן שמעון בן גמליאל, רבי ישמעאל כהן גדול ורבי חנינא סגן הכהנים", source:"מדרש אלה אזכרה" },
  { day:"יז", month:"תמוז", event:"הובקעה העיר בימי בית שני; נשתברו הלוחות; בטל התמיד; שרף אפוסטמוס את התורה", source:"תענית כו." },
  { day:"א", month:"אב", event:"נפטר אהרן הכהן בהר ההר", source:"תענית כט." },
  { day:"טו", month:"אב", event:"ט״ו באב — כלו מתי מדבר; הותר שבט לבוא בשבט; ניתנו הרוגי ביתר לקבורה", source:"תענית ל:" },
  { day:"כה", month:"אלול", event:"יום בריאת העולם (לדעת רבי אליעזר); נשלמה חומת ירושלים בימי נחמיה", source:"ראש השנה כז." },
  { day:"טז", month:"ניסן", event:"הקרבת קרבן העומר; תחילת ספירת העומר; משתה אסתר השני ותליית המן", source:"מגילה טו:" },
  { day:"יז", month:"ניסן", event:"תיבת נח נחה על הרי אררט (לדעת ר׳ אליעזר)", source:"ראש השנה יא:" },
  { day:"יח", month:"ניסן", event:"סיום טיהור בית ה׳ והמזבח בימי חזקיהו המלך", source:"דברי הימים ב ל:א" },
  { day:"יט", month:"ניסן", event:"חזון יחזקאל בבקעת העצמות היבשות ותחייתן", source:"סנהדרין צב:" },
  { day:"כ", month:"ניסן", event:"תחילת הקפת חומות יריחו בימי יהושע בן נון", source:"יהושע ו:א" },
  { day:"כא", month:"ניסן", event:"קריעת ים סוף וטביעת המצרים; אמירת שירת הים", source:"סוטה ל:" },
  { day:"ד", month:"תשרי", event:"צום גדליה לשיטת ר׳ עקיבא — נהרג גדליה בן אחיקם", source:"ראש השנה יח." },
  { day:"יא", month:"חשון", event:"פטירת רחל אמנו בדרך אפרת (מסורת)", source:"סדר עולם רבה ג" },
  { day:"כ", month:"כסלו", event:"כינוס עזרא הסופר בירושלים בגשמים", source:"עזרא י:ט; תענית יט:" },
  { day:"כח", month:"טבת", event:"שמעון בן שטח וביטול הצדוקים מהסנהדרין", source:"סנהדרין נב." },
  { day:"ג", month:"אדר", event:"סיום בניין בית המקדש השני", source:"עזרא ו:טו; ערכין יב." },
  { day:"טז", month:"ניסן", event:"נפסק המן במדבר, למחרת אכילת עבור הארץ בגלגל", source:"קידושין לח." },
  { day:"כ", month:"אייר", event:"נסע הענן מעל המשכן — נסיעת בני ישראל הראשונה מהר סיני", source:"שבת פז.; במדבר י:יא" },
  { day:"א", month:"תמוז", event:"לידת יוסף הצדיק (מסורת); התחלת המצור על ביתר", source:"תענית כט." },
  { day:"יז", month:"אב", event:"מות המרגלים במגפה (לשיטות מסוימות)", source:"סוטה לה." },
  { day:"ז", month:"אלול", event:"מות המרגלים שהוציאו דיבת הארץ, לפי מגילת תענית", source:"מגילת תענית" },

  // --- גל 30/08/26: 4 קבצי "ערך היום — מאורעות" מ-
  // docs/תוכן-ממתין-25-08-26/ערך-היום-מאורעות-1..4.txt, אחרי דה-דופ פנימי
  // ומול המערך הקיים (tools/merge-pending.js). עמודות ה"ציטוט"/"הסבר קצר"
  // שבמקור אינן שדה ברשומה כאן - הן נשמרו בנפרד ב-
  // docs/תוכן-ממתין-25-08-26/מאורעות-ציטוט-והסבר.json.
  { day:"ב", month:"ניסן", event:"שריפת פרה אדומה הראשונה", source:"בבלי, יומא טז." },
  { day:"יד", month:"ניסן", event:"שחיטת קרבן פסח במצרים ובמדבר", source:"שמות יב:ו" },
  { day:"טו", month:"ניסן", event:"יציאת מצרים ומכת בכורות", source:"שמות יב:נא" },
  { day:"טו", month:"ניסן", event:"ברית בין הבתרים", source:"פרקי דרבי אליעזר, פרק כח" },
  { day:"טז", month:"ניסן", event:"הבאת עומר התנופה", source:"ויקרא כג:יא" },
  { day:"כו", month:"ניסן", event:"פטירת יהושע בן נון", source:"יהושע כד:כט" },
  { day:"ז", month:"אייר", event:"חנוכת חומת ירושלים", source:"מגילת תענית, אייר" },
  { day:"כ", month:"אייר", event:"נסיעת המחנות מסיני", source:"במדבר י:יא" },
  { day:"א", month:"תמוז", event:"עמידת השמש בגבעון", source:"יהושע י:יב" },
  { day:"ט", month:"תמוז", event:"הבקעת חומת ירושלים (בית ראשון)", source:"מלכים ב כה:ג" },
  { day:"יז", month:"תמוז", event:"שבירת הלוחות וביטול התמיד", source:"משנה, תענית ד, ו" },
  { day:"ט", month:"אב", event:"חורבן בית ראשון ובית שני", source:"משנה, תענית ד, ו" },
  { day:"י", month:"אב", event:"שריפת רוב ההיכל", source:"בבלי, תענית כט." },
  { day:"טו", month:"אב", event:"כלו מתי מדבר והתרת השבטים", source:"בבלי, תענית ל:" },
  { day:"א", month:"אלול", event:"עליית משה לקבלת לוחות שניים", source:"פרקי דרבי אליעזר, פרק מו" },
  { day:"יז", month:"אלול", event:"מות המרגלים במגיפה", source:"במדבר יד:לז" },
  { day:"כה", month:"אלול", event:"סיום בניית חומת ירושלים", source:"נחמיה ו:טו" },
  { day:"א", month:"תשרי", event:"בריאת אדם הראשון ויום הדין", source:"בבלי, ראש השנה כז." },
  { day:"טו", month:"תשרי", event:"חנוכת בית המקדש הראשון", source:"מלכים א ח:סה" },
  { day:"יז", month:"חשון", event:"התחלת המבול בימי נח", source:"בראשית ז:יא" },
  { day:"כז", month:"חשון", event:"יציאת נח מן התיבה", source:"בראשית ח:יד" },
  { day:"כד", month:"כסלו", event:"יסוד היכל ה' בבית שני", source:"חגי ב:יח" },
  { day:"כה", month:"כסלו", event:"טיהור המקדש ונס פך השמן", source:"בבלי, שבת כא:" },
  { day:"ח", month:"טבת", event:"תרגום התורה ליוונית (השבעים)", source:"מסכת סופרים א, ז" },
  { day:"ט", month:"טבת", event:"פטירת עזרא הסופר ונחמיה", source:"שולחן ערוך, אורח חיים תקח" },
  { day:"י", month:"טבת", event:"תחילת המצור על ירושלים", source:"יחזקאל כד:ב" },
  { day:"א", month:"שבט", event:"נאום משה רבנו בספר דברים", source:"דברים א:ג" },
  { day:"ז", month:"אדר", event:"לידת ומות משה רבנו", source:"בבלי, קידושין לח." },
  { day:"יב", month:"אדר", event:"חנוכת בית המקדש השני", source:"עזרא ו:טו" },
  { day:"יג", month:"אדר", event:"מלחמת הקהל באויביהם", source:"אסתר ט:א" },
  { day:"יד", month:"אדר", event:"יום פורים בכל הערים", source:"אסתר ט:יז" },
  { day:"טו", month:"אדר", event:"פורים שושן בערים המוקפות", source:"אסתר ט:יח" },
  { day:"ז", month:"ניסן", event:"אבל בני ישראל על משה", source:"סדר עולם רבה, י" },
  { day:"ז", month:"ניסן", event:"שליחת המרגלים ליריחו", source:"יהושע ב:א" },
  { day:"ח", month:"ניסן", event:"תחילת חנוכת המשכן (שבעת ימי המילואים)", source:"סדר עולם רבה, ז" },
  { day:"א", month:"אייר", event:"תחילת בניין בית המקדש הראשון", source:"מלכים א ו:א" },
  { day:"ג", month:"סיון", event:"תחילת שלושת ימי ההגבלה", source:"שמות יט:י" },
  { day:"יז", month:"סיון", event:"נחיתת התיבה על הרי אררט", source:"בראשית ח:ד" },
  { day:"כט", month:"תמוז", event:"חזרת המרגלים מתוכן הארץ", source:"תנחומא, שלח ז" },
  { day:"יז", month:"אב", event:"ביטול יום טוב של בני עלי", source:"מגילת תענית, אב" },
  { day:"ז", month:"אלול", event:"יום טוב על שזכו לחומה", source:"מגילת תענית, אלול" },
  { day:"ז", month:"תשרי", event:"חנוכת חומת ירושלים בימי נחמיה", source:"נחמיה יב" },
  { day:"ח", month:"תשרי", event:"תחילת ימי חנוכת המקדש הראשון", source:"בבלי, מועד קטן ט." },
  { day:"ז", month:"חשון", event:"תחילת שאלת גשמים בארץ ישראל", source:"משנה, תענית א, ב" },
  { day:"ז", month:"כסלו", event:"יום טוב על מות הורדוס המלך", source:"מגילת תענית, כסלו" },
  { day:"כח", month:"טבת", event:"ביטול משפט צדוקים והודאת חכמים", source:"מגילת תענית, טבת" },
  { day:"כג", month:"שבט", event:"התקבצות השבטים למלחמת גבעה", source:"שופטים כ" },
  { day:"א", month:"אדר", event:"משמיעין על השקלים ועל הכלאיים", source:"משנה, שקלים א, א" },
  { day:"ח", month:"אדר", event:"יום טוב על ביטול גזירת הגשמים", source:"מגילת תענית, אדר" },
  { day:"א", month:"ניסן", event:"לידת יצחק אבינו", source:"ירושלמי, ראש השנה א, א" },
  { day:"ג", month:"ניסן", event:"סיום בניית המשכן בימי משה", source:"רד\"ק על שמות מ, ב" },
  { day:"יד", month:"ניסן", event:"ברית בין הבתרים", source:"רש\"י על שמות יב, מ" },
  { day:"טו", month:"ניסן", event:"עקדת יצחק", source:"פסיקתא זוטרתא" },
  { day:"ז", month:"אייר", event:"תחילת המילואים של שלמה המלך", source:"רד\"ק על מלכים א ו, א" },
  { day:"כח", month:"אייר", event:"פטירת שמואל הנביא", source:"סדר עולם רבה, יג" },
  { day:"כג", month:"סיון", event:"כתיבת אגרות מרדכי ואסתר", source:"אסתר ה:ט" },
  { day:"ג", month:"תמוז", event:"עמידת השמש ליהושע", source:"ירושלמי, ראש השנה ב, ה" },
  { day:"יז", month:"תמוז", event:"העמדת צלם בהיכל", source:"ירושלמי, תענית ד, ה" },
  { day:"כג", month:"תמוז", event:"ביטול קרבן התמיד בבית שני", source:"ירושלמי, תענית ד, ה" },
  { day:"יח", month:"אב", event:"כיבוי נר המערבי בימי אחז", source:"שולחן ערוך" },
  { day:"ז", month:"אלול", event:"מיתת המרגלים", source:"רש\"י על במדבר יד, לז" },
  { day:"יז", month:"אלול", event:"הנף העומר בימי חזקיהו", source:"ירושלמי, פסחים ד, א" },
  { day:"א", month:"תשרי", event:"עקידת יצחק (דעה שנייה)", source:"פסיקתא דרב כהנא" },
  { day:"יז", month:"חשון", event:"פטירת מתושלח הצדיק", source:"רש\"י על בראשית ז, י" },
  { day:"כ", month:"כסלו", event:"התאספות העם בימי עזרא", source:"עזרא י:ט" },
  { day:"א", month:"טבת", event:"לקיחת אסתר לבית המלכות", source:"אסתר ב:טז" },
  { day:"ח", month:"שבט", event:"פטירת זקנים שבימי יהושע", source:"סדר עולם רבה, יב" },
  { day:"ז", month:"אדר", event:"נפילת המן שירד במדבר", source:"רש\"י על שמות טז, לה" },
  { day:"כג", month:"אדר", event:"תחילת ימי המילואים", source:"רש\"י על ויקרא ח, א" },
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

// שנות מאורעות התנ״ך/תלמוד ברשימה הן חוזרות (יום+חודש בלבד, לא שנה מסוימת),
// ולכן "שנים מאז החורבן" מחושב תמיד מול השנה העברית הנוכחית - אותו מספר
// לכל השורות (משתנה רק בראש השנה). מחושב פעם אחת מ-ט' באב ע' לספירה,
// תאריך ט' באב 70 לספירה = חורבן הבית השני. gregToHebDate(70,7,4) נותן חודש 11
// (אב) יום 9 - לא (70,8,4) כפי שהיה קודם, שנפל בטעות בחודש 12 (אלול) יום 11
// (מרחק חודש שלם, ואפילו לא באב בכלל). אותו תאריך יסוד כמו הטיימר בפאנל
// (shell/home.js:updateTempleTimer) - יש לתקן שם באותו אופן אם עדיין (70,8,4).
let _churbanHebYear = null;
let _churbanHebDate = null;
function yearsSinceChurban(){
  if (_churbanHebYear == null) _churbanHebYear = gregToHebDate(70, 7, 4).year;
  return todayHebrew().raw.year - _churbanHebYear;
}

// גל: שנה+חודשים+ימים (לא רק שנה) - אלגוריתם "גיל" רגיל על תאריך עברי: מחסרים
// יום/חודש/שנה ומלווים (borrow) מהחודש/שנה הקודמים לפי hebMonthLengths של אותה
// שנה עברית - אותה פונקציה ש-gregToHebDate עצמה משתמשת בה, כדי שהאורכים תמיד יתאימו.
// גל: שנה+חודשים+ימים ל-raw {year,month,day} עברי כלשהו (לא רק היום) - נשלפה
// מ-elapsedSinceChurban כדי ש-publishUpcomingEvents תוכל להשתמש בה לכל יום עתידי.
function elapsedSinceChurbanRaw(raw){
  if (_churbanHebDate == null) _churbanHebDate = gregToHebDate(70, 7, 4);
  const c = _churbanHebDate;
  let years = raw.year - c.year, months = raw.month - c.month, days = raw.day - c.day;
  if (days < 0){
    months -= 1;
    const bm = ((raw.month - 2 + 12) % 12) + 1;
    days += hebMonthLengths(raw.year)[bm - 1];
  }
  if (months < 0){
    years -= 1;
    months += hebMonthLengths(raw.year - 1).length;
  }
  return { years, months, days };
}
function elapsedSinceChurban(){
  return elapsedSinceChurbanRaw(todayHebrew().raw);
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
  return allDateEvents().filter(ev => monthMatchesEventMonth(t.monthName, ev.month) && dayMatchesEventDay(t.raw.day, ev.day));
}

// ---- הוספה/עריכה מקומית של מאורעות (2.19, ב"ערך היום") ----
// אותו דגם בדיוק כמו readStoredEdits/saveEntryEdit ב-data.js (localStorage סינכרוני,
// לא storage.get/set האסינכרוני של אוצריא) - "נשמר במכשיר זה בלבד". לרשומות מובנות
// (TANAKH_DATE_EVENTS) יש רק עריכה+שחזור למקור (כמו openGenericEditForm, בלי מחיקה -
// "הסתרה" בלי דרך לראות/לבטל אותה היא מלכודת UX); לתוספות של המשתמש יש גם מחיקה,
// כי אין שם "מקור" לחזור אליו ומחיקה שם היא פעולה חד-משמעית.
const DATE_EVENTS_EDITS_KEY = 'date_events_edits_v1';
const DATE_EVENTS_ADDED_KEY = 'date_events_added_v1';

// מפתח הזהות של רשומה מובנית הוא תוכנה המקורי (יום+חודש+טקסט), לא אינדקס במערך -
// כך שעדכון גרסה שמוסיף/מזיז רשומות ב-TANAKH_DATE_EVENTS לא "ינתק" עריכה קיימת
// מהרשומה שלה (אותו עיקרון בדיוק כמו origName ב-editsKey, data.js).
function dateEventKey(ev){ return ev.day + '|' + ev.month + '|' + ev.event; }

function readDateEventsEdits(){ try { return JSON.parse(localStorage.getItem(DATE_EVENTS_EDITS_KEY) || '{}'); } catch(e){ return {}; } }
function readDateEventsAdded(){ try { return JSON.parse(localStorage.getItem(DATE_EVENTS_ADDED_KEY) || '[]'); } catch(e){ return []; } }

// כל המאורעות בפועל: TANAKH_DATE_EVENTS אחרי עריכות מקומיות, ועוד מה שהמשתמש הוסיף.
// __origKey/__addedIdx מזהים את הרשומה לצורך עריכה חוזרת (dateEventRow, home.js);
// __edited/__custom הם רק לתצוגה (סימון "נערך/מותאם אישית").
function allDateEvents(){
  const edits = readDateEventsEdits();
  const base = TANAKH_DATE_EVENTS.map(ev => {
    const key = dateEventKey(ev);
    const edit = edits[key];
    return edit
      ? { day: edit.day, month: edit.month, event: edit.event, source: edit.source || '', __origKey: key, __edited: true }
      : { day: ev.day, month: ev.month, event: ev.event, source: ev.source || '', __origKey: key };
  });
  const added = readDateEventsAdded().map((ev, i) =>
    ({ day: ev.day, month: ev.month, event: ev.event, source: ev.source || '', __addedIdx: i, __custom: true }));
  return base.concat(added);
}

function saveDateEventEdit(origKey, ev){
  try {
    const edits = readDateEventsEdits();
    edits[origKey] = { day: ev.day, month: ev.month, event: ev.event, source: ev.source || '' };
    localStorage.setItem(DATE_EVENTS_EDITS_KEY, JSON.stringify(edits));
    return true;
  } catch(e){ return false; }
}
function restoreBuiltinDateEvent(origKey){
  try {
    const edits = readDateEventsEdits();
    delete edits[origKey];
    localStorage.setItem(DATE_EVENTS_EDITS_KEY, JSON.stringify(edits));
    return true;
  } catch(e){ return false; }
}
function addCustomDateEvent(ev){
  try {
    const added = readDateEventsAdded();
    added.push({ day: ev.day, month: ev.month, event: ev.event, source: ev.source || '' });
    localStorage.setItem(DATE_EVENTS_ADDED_KEY, JSON.stringify(added));
    return true;
  } catch(e){ return false; }
}
function saveCustomDateEvent(idx, ev){
  try {
    const added = readDateEventsAdded();
    if (!added[idx]) return false;
    added[idx] = { day: ev.day, month: ev.month, event: ev.event, source: ev.source || '' };
    localStorage.setItem(DATE_EVENTS_ADDED_KEY, JSON.stringify(added));
    return true;
  } catch(e){ return false; }
}
function deleteCustomDateEvent(idx){
  try {
    const added = readDateEventsAdded();
    added.splice(idx, 1);
    localStorage.setItem(DATE_EVENTS_ADDED_KEY, JSON.stringify(added));
    return true;
  } catch(e){ return false; }
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

// ---- גל 2.20.3: "ערך היום" ליומן של אוצריא — גם מהטאב הפעיל, לא רק ממנוע הרקע ----
// עברה הנה מ-shell/background.js. שם היא רצה *רק* דרך Otzaria.on('plugin.boot')
// בתוך background.html, שתלוי לגמרי בהפעלת app.startup ע"י אוצריא למנוע הרקע.
// בבדיקה מול "עיון ההלכה" (שהמאורע שלו ללוח השנה כן מגיע בפועל אצל המשתמש)
// התברר שהוא כלל לא תלוי במנוע רקע - publishedData.upsert שם נקרא ישירות
// מתוך הטאב הפעיל של התוסף עצמו. הפונקציה הועברה לכאן (dates.js, נטען גם
// ב-index.html וגם ב-background.html) כדי שנוכל לקרוא לה גם מ-bridge.js
// (ר' שם, plugin.boot) כמסלול גיבוי זהה לזה שמוכח כעובד - בלי לגעת בהרשאות
// או בהצהרת המניפסט. מנוע הרקע נשאר כמסלול נוסף (אם וכשהוא כן רץ), לא הוחלף.
const PUBLISHED_KEYS_KEY = 'madaei_hatanach_published_event_keys_v1';
const PUBLISH_LAST_RUN_KEY = 'madaei_hatanach_publish_last_run_v1';
const PUBLISH_LOOKAHEAD_DAYS = 365; // שנה מראש - כדי לא להזדקק לעדכון תכוף
const PUBLISH_LOOKBACK_DAYS = 7; // שבוע אחורה - כדי שהלוח לא יהיה ריק כשמסתכלים אחורה

// גל: מגן מפני הרצה כפולה *בו-זמנית* באותו מופע (למשל plugin.boot וטיימר גיבוי
// שקוראים כמעט ביחד, לפני שהראשון הספיק לכתוב PUBLISH_LAST_RUN_KEY) - רעיון
// שנלקח מ-shell/daily-publish.js (גרסה מקבילה ישנה יותר שהמשתמש העלה).
// ה-throttle היומי למעלה מטפל בהרצות עתידיות; זה מטפל רק בחפיפה הרגעית.
let _publishInFlight = false;
async function publishUpcomingEvents(){
  if (_publishInFlight) return;
  _publishInFlight = true;
  try { await publishUpcomingEventsInner(); }
  finally { _publishInFlight = false; }
}

async function publishUpcomingEventsInner(){
  if (!(window.Otzaria && Otzaria.call)) return;
  if (typeof eventsForToday !== 'function' || typeof todayHebrew !== 'function') return;

  // מריצים לכל היותר פעם ביום: פתיחת התוסף קוראת לפונקציה הזו בכל plugin.boot
  // (גם ברקע וגם בטאב הפעיל, ר' bridge.js/background.js) - בלי המגבלה הזו כל
  // פתיחה הייתה מוחקת ובונה מחדש את כל השנה מול היומן של אוצריא, גם כשכלום
  // לא השתנה. הרצה נכשלת (או ראשונה אי-פעם) לא נכתבת ל-PUBLISH_LAST_RUN_KEY,
  // כך שהיא תנסה שוב בפעם הבאה.
  const todayIso = (() => { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth()+1).padStart(2,'0') + '-' + String(n.getDate()).padStart(2,'0'); })();
  const lastRun = await storageGetJson(PUBLISH_LAST_RUN_KEY);
  if (lastRun === todayIso) return;

  if (_churbanHebYear == null) _churbanHebYear = gregToHebDate(70, 7, 4).year;

  const pad = (n) => String(n).padStart(2, '0');
  const isoOf = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const startsAtOf = (d) => {
    const tzMin = -d.getTimezoneOffset();
    const tz = (tzMin >= 0 ? '+' : '-') + pad(Math.floor(Math.abs(tzMin) / 60)) + ':' + pad(Math.abs(tzMin) % 60);
    return isoOf(d) + 'T00:00:00' + tz;
  };

  const items = []; // {key, payload}
  const base = new Date();
  for (let off = -PUBLISH_LOOKBACK_DAYS; off < PUBLISH_LOOKAHEAD_DAYS; off++){
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + off);
    const raw = gregToHebDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const isLeap = isHebrewLeapYear(raw.year);
    const monthName = hebMonthNameOf(raw.month, isLeap);
    const dayLetters = numToHeb(raw.day);
    const churbanEl = elapsedSinceChurbanRaw(raw);
    const churbanTxt = churbanEl.years + ' שנה ' + churbanEl.months + ' חודשים ' + churbanEl.days + ' ימים לחורבן';
    const iso = isoOf(d), startsAt = startsAtOf(d);
    const dayLabel = dayLetters + '׳ ' + monthName + ' ' + hebYearStr(raw.year) + ' (' + gregDateStr(d) + ')';

    // אין קשר בין מאורעות התנ״ך/התלמוד לזמן שעבר מהחורבן - לכן churbanTxt לא
    // מופיע בתיאור שלהם (בניגוד לגרסה קודמת). מפתח ה"חורבן" מתחיל ב-z כדי
    // שיישאר אחרון בסדר לקסיקוגרפי אם היומן ממיין לפי key בין אירועי אותו יום.
    // 3.2.8 — שתי ההעדפות נקראות בתוך הלולאה ולא בכניסה לפונקציה, כי כיבוי
    // חייב עדיין להריץ את הפרסום: ההרצה היא מה שמוחק מהיומן את מה שכבר פורסם
    // (הלולאה על prev למטה מסירה כל מפתח שאינו ב-items החדש).
    const wantEvents  = !(typeof uiPrefs === 'object' && uiPrefs && uiPrefs.pubEvents  === false);
    const wantChurban = !(typeof uiPrefs === 'object' && uiPrefs && uiPrefs.pubChurban === false);
    const events = wantEvents ? allDateEvents().filter(ev => monthMatchesEventMonth(monthName, ev.month) && dayMatchesEventDay(raw.day, ev.day)) : [];
    events.forEach((ev, i) => items.push({
      key: 'madaei:dailyEvent:' + iso + ':' + i,
      payload: { title: ev.event, startsAt, source: 'עינים למקרא', importance: 'low',
        description: dayLabel + (ev.source ? ' · ' + ev.source : '') }
    }));
    if (wantChurban) items.push({
      key: 'madaei:zChurban:' + iso,
      payload: { title: churbanTxt, startsAt, source: 'עינים למקרא', importance: 'low',
        description: dayLabel }
    });
  }

  const newKeys = items.map(it => it.key);
  const newKeySet = new Set(newKeys);
  const prev = await storageGetJson(PUBLISHED_KEYS_KEY);
  if (Array.isArray(prev)){
    for (const key of prev){
      if (!newKeySet.has(key)){
        await Otzaria.call('publishedData.remove', { type: 'calendar.event', scope: 'global', key }).catch(()=>{});
      }
    }
  }

  const kept = [];
  for (const it of items){
    const res = await Otzaria.call('publishedData.upsert', {
      type: 'calendar.event', scope: 'global', key: it.key, payload: it.payload
    }).catch(() => null);
    if (res && res.success) kept.push(it.key);
  }
  await storageSetJson(PUBLISHED_KEYS_KEY, kept);
  await storageSetJson(PUBLISH_LAST_RUN_KEY, todayIso);
}
