<#
  סקריפט אריזה למדעי התנ״ך (״עינים למקרא״).
  בכל הרצה: בדיקת שפיות → העלאת מספר הגרסה במניפסט → ערך חדש ב-CHANGELOG →
  אריזת שני תוצרים:
    1. .otzplugin  - קובץ zip רגיל בשם החבילה, להתקנה בתוך אוצריא (חנות התוספים / התקנה מקובץ).
    2. standalone .zip - אותם קבצים בדיוק, לשימוש עצמאי (פתיחת index.html בדפדפן רגיל, בלי אוצריא).
  אין צורך לערוך את הסקריפט הזה בשביל לעדכן תוכן - עורכים רק את קובץ ה-data הרלוונטי בתוך guides/<תחום>/data/
  ומריצים מחדש את הסקריפט הזה כדי לארוז מחדש.

  שימוש נפוץ:
    .\build\pack.ps1                                   # patch: 2.12.2 -> 2.12.3
    .\build\pack.ps1 -Minor                            # 2.12.2 -> 2.13.0
    .\build\pack.ps1 -Title "סבב 2 נסגר" -Notes "…","…"  # טקסט ה-CHANGELOG
    .\build\pack.ps1 -Release                          # + commit, tag, push ו-GitHub Release

  ⚠️ כלל מחייב (נקבע ב-2.11.6): כל אריזה מקבלת מספר גרסה טרי. אוצריא **אינה**
  מחליפה קבצים בהתקנה־מחדש של אותו מספר, ותיקון שנארז מחדש תחת אותו מספר
  פשוט לא יגיע למי שכבר התקין. לכן -NoBump הוא חריג, לא ברירת מחדל.
#>

param(
  # ---- בחירת סוג ה-bump. ברירת המחדל, בלי שום דגל, היא patch. ----
  [switch]$Major,        # 2.12.2 -> 3.0.0
  [switch]$Minor,        # 2.12.2 -> 2.13.0
  [switch]$Patch,        # 2.12.2 -> 2.12.3 (ברירת מחדל)
  # -NoBump: אורז בדיוק את הגרסה שכתובה כרגע במניפסט, בלי להעלות.
  # שימושי לשחרור גרסה גדולה (למשל 3.0.0) שנכתבה ידנית במניפסט.
  [switch]$NoBump,

  # ---- ערך ה-CHANGELOG ----
  [string]$Title,        # שורת הכותרת המודגשת. ריק = נגזרת מכותרות הקומיטים
  [string[]]$Notes,      # תבליטי הערך. ריק = כותרות הקומיטים שמאז התג האחרון
  [switch]$NoChangelog,  # לדלג על כתיבת הערך (למשל כשכותבים אותו ביד)

  # ---- שחרור ----
  # בלי הדגל הזה הסקריפט **לא נוגע בגיט בכלל** — אורז בלבד. עם הדגל:
  # commit ל-manifest.json + CHANGELOG.md, תג v<version>, push, ו-GitHub Release
  # עם ה-.otzplugin מצורף (דרך gh CLI).
  [switch]$Release,

  # מעקף מודע לבדיקת השפיות. ר' ההסבר בסעיף 0.
  [switch]$AllowValidationErrors
)

$ErrorActionPreference = 'Stop'
# ב-PowerShell 7.4 ומעלה, קוד יציאה שאינו 0 מתוכנית חיצונית זורק שגיאה כש-
# ErrorActionPreference הוא Stop. כאן זה בדיוק לא מה שרוצים: את קוד היציאה של
# node/git/gh בודקים ידנית ומגיבים לו בהודעה מובנת. (בגרסאות ישנות זו סתם
# השמה למשתנה שלא קיים — לא מזיק.)
$PSNativeCommandUseErrorActionPreference = $false

$root = Split-Path -Parent $PSScriptRoot
$manifestPath  = Join-Path $root "manifest.json"
$changelogPath = Join-Path $root "CHANGELOG.md"
# מוגדר כאן ולא ליד סעיף 1ד שמשתמש בו: סעיף 1ב2 (סנכרון ROADMAP) רץ *לפניו*
# וקורא אותו, וכשהוא היה מוגדר רק למטה הערך שם היה $null ו-Test-Path נפל.
$roadmapPath = Join-Path $root "ROADMAP.md"
$distDir = Join-Path $root "dist"

if (-not (Test-Path $distDir)) { New-Item -ItemType Directory -Path $distDir | Out-Null }

# ---- 0. בדיקת שפיות: הוולידציה של הדאטה, לפני שנוגעים במניפסט ----
# רצה **לפני** ה-bump בכוונה: אריזה שנעצרת לא משאירה אחריה מניפסט מבומפּ
# וערך CHANGELOG יתום שצריך לנקות ביד.
#
# ⚠️ מצב הדברים היום: `--strict` מחזיר 1 גם על ממצאי **תוכן** ידועים שת.0 גילה
# (בני זוג לא הדדיים, ילד בלי הורה מקביל וכו') — 474 ממצאים שממתינים לת.1א
# ומוקפאים במכוון. עד שת.1א תיסגר, אריזה תדרוש -AllowValidationErrors, וזה
# מכוון: כל אריזה מחייבת מבט אמיתי בפלט למטה, כדי לראות שלא נשבר משהו חדש.
$validateJs = Join-Path $root "tools\validate.js"
if (Test-Path $validateJs) {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "node אינו מותקן/בנתיב, ולכן אי אפשר להריץ את בדיקת השפיות (tools\validate.js). התקן Node, או הרץ עם -AllowValidationErrors אם אתה יודע מה אתה עושה."
  }
  Write-Host "בדיקת שפיות: node tools/validate.js --strict" -ForegroundColor Cyan
  Push-Location $root
  try { & node "tools/validate.js" "--strict"; $validateExit = $LASTEXITCODE }
  finally { Pop-Location }
  if ($validateExit -ne 0) {
    if ($AllowValidationErrors) {
      Write-Warning "הוולידציה יצאה בקוד $validateExit — ממשיכים בגלל -AllowValidationErrors. ודא שהמספרים למעלה הם הממצאים המוכרים ולא רגרסיה חדשה."
    } else {
      throw "בדיקת השפיות נכשלה (קוד יציאה $validateExit). האריזה נעצרה ושום קובץ לא שונה. הדוח המלא: tools\validation-report.md. אם אלה הממצאים המוכרים של ת.0 — הרץ מחדש עם -AllowValidationErrors."
    }
  } else {
    Write-Host "הוולידציה עברה נקי." -ForegroundColor Green
  }
} else {
  Write-Warning "tools\validate.js לא נמצא — מדלגים על בדיקת השפיות."
}

# ---- 1. העלאת מספר הגרסה ----
$bumpFlags = @($Major, $Minor, $Patch, $NoBump) | Where-Object { $_ }
if ($bumpFlags.Count -gt 1) { throw "אפשר לבחור רק אחד מ: -Major / -Minor / -Patch / -NoBump." }

$manifestRaw = Get-Content $manifestPath -Raw -Encoding UTF8
$manifest = $manifestRaw | ConvertFrom-Json
# 2.19.4 חסמה התקנה בפועל: אוצריא דוחה description מעל 150 תווים, ולולידציה/פקג'
# אין בדיקה כזו. נכשל כאן, לפני שמייצרים חבילה שאי-אפשר להתקין.
if ($manifest.description.Length -gt 150) {
  throw "תיאור המניפסט ($($manifest.description.Length) תווים) חורג מ-150 - אוצריא דוחה התקנה. קצרו לפני האריזה."
}
$parts = $manifest.version -split '\.'
if ($parts.Count -ne 3) { throw "פורמט גרסה לא תקין במניפסט: $($manifest.version)" }
$oldVersion = $manifest.version
$maj = [int]$parts[0]; $min = [int]$parts[1]; $pat = [int]$parts[2]

if     ($NoBump) { $newVersion = $oldVersion }
elseif ($Major)  { $newVersion = "$($maj + 1).0.0" }
elseif ($Minor)  { $newVersion = "$maj.$($min + 1).0" }
else             { $newVersion = "$maj.$min.$($pat + 1)" }   # patch = ברירת המחדל
$manifest.version = $newVersion

# שמירה בפורמט JSON תקין, עם הזחה של 2 רווחים ותווים בעברית ללא escape
$json = $manifest | ConvertTo-Json -Depth 10
$json = [System.Text.RegularExpressions.Regex]::Unescape($json)
[System.IO.File]::WriteAllText($manifestPath, $json, [System.Text.UTF8Encoding]::new($false))

if ($NoBump) { Write-Host "אורז את הגרסה שבמניפסט ללא העלאה: $newVersion" }
else { Write-Host "גרסה עודכנה: $oldVersion -> $newVersion" }

# ---- 1ב. ערך חדש ב-CHANGELOG.md ----
# הפורמט זהה לערכים הקיימים בקובץ:
#     ## <גרסה> — <תאריך עברי> (<dd/MM/yyyy>)
#
#     **<כותרת>**
#
#     * <תבליט>
function Get-HebrewDateString([datetime]$date) {
  # לוח השנה העברי של .NET. הגרשיים שהוא מפיק הם ASCII, וכאן מומרים לגרש
  # ולגרשיים העבריים (׳ ״) שבהם משתמש הקובץ.
  $ci = [System.Globalization.CultureInfo]::GetCultureInfo('he-IL').Clone()
  $ci.DateTimeFormat.Calendar = New-Object System.Globalization.HebrewCalendar
  $s = $date.ToString('d בMMMM yyyy', $ci)
  return $s.Replace('"', [char]0x05F4).Replace("'", [char]0x05F3)
}

function Get-DefaultNotes {
  # כותרות הקומיטים שמאז תג הגרסה האחרון. בלי תג — 15 האחרונים.
  # קומיטי תיעוד (״תוכניות: …״) אינם שינוי מוצר ולכן יורדים.
  $lastTag = (& git -C $root tag --list "v*" --sort=-v:refname | Select-Object -First 1)
  $range = if ($lastTag) { "$lastTag..HEAD" } else { "-n15" }
  $subjects = & git -C $root log --format=%s $range 2>$null
  return @($subjects | Where-Object { $_ -and $_ -notmatch '^(תוכניות|docs?):' })
}

if (-not $NoChangelog) {
  $heDate  = Get-HebrewDateString (Get-Date)
  $enDate  = (Get-Date).ToString('dd/MM/yyyy')
  $body    = if ($Notes -and $Notes.Count) { $Notes } else { Get-DefaultNotes }
  $headline = if ($Title) { $Title } elseif ($body.Count) { "$($body.Count) שינויים בגרסה זו." } else { "אריזה מחדש." }

  $entry = New-Object System.Text.StringBuilder
  [void]$entry.AppendLine("## $newVersion — $heDate ($enDate)")
  [void]$entry.AppendLine("")
  [void]$entry.AppendLine("**$headline**")
  if ($body.Count) {
    [void]$entry.AppendLine("")
    foreach ($n in $body) { [void]$entry.AppendLine("* $n") }
  }
  # מי ארז (בקשת בעל הפרויקט, 04/09/2026): בריפו עובדים כמה מפתחים במקביל,
  # וכשמשהו בגרסה מסוימת מתנהג מוזר צריך לדעת את מי לשאול. השם נלקח מ-
  # git config user.name של מי שמריץ את האריזה בפועל.
  $packer = (& git -C $root config user.name 2>$null)
  if ($packer) {
    [void]$entry.AppendLine("")
    [void]$entry.AppendLine("_נארז על ידי $packer._")
  }
  [void]$entry.AppendLine("")

  $clRaw = if (Test-Path $changelogPath) { Get-Content $changelogPath -Raw -Encoding UTF8 } else { "# CHANGELOG — עינים למקרא`r`n`r`n" }
  if ($clRaw -match ("(?m)^##\s+" + [regex]::Escape($newVersion) + "\s")) {
    Write-Warning "כבר קיים ערך ל-$newVersion ב-CHANGELOG.md — לא נכתב ערך נוסף."
  } else {
    # ההוספה היא מיד לפני הערך הראשון הקיים, מתחת לכותרת הראשית
    $idx = $clRaw.IndexOf("`n## ")
    if ($idx -lt 0) { $clNew = $clRaw.TrimEnd() + "`r`n`r`n" + $entry.ToString() }
    else { $clNew = $clRaw.Substring(0, $idx + 1) + $entry.ToString() + $clRaw.Substring($idx + 1) }
    [System.IO.File]::WriteAllText($changelogPath, $clNew, [System.Text.UTF8Encoding]::new($false))
    Write-Host "נכתב ערך CHANGELOG: $newVersion — $heDate ($enDate), $($body.Count) תבליטים"
  }

  # ---- 1ב2. סנכרון ROADMAP.md מול הערך החדש ----
  # כל סעיף ב-ROADMAP.md מתחיל בקוד מודגש (**ד**, **ג**, **2.7ב** וכו׳) - אותה
  # מוסכמה בדיוק שמשמשת לתייג תבליטי CHANGELOG (ר׳ "ד.1א — כרטסת..." וכו׳).
  # כשתבליט חדש ב-CHANGELOG פותח באותו קוד בדיוק כמו סעיף קיים ב-ROADMAP - הסעיף
  # שם מסומן "✅ שוחרר ב-<גרסה>", לא נמחק: קוד "טווח" (כמו ב.2–ב.4) או "אב" (ד)
  # עלול לכסות כמה תבליטים חלקיים ולא באמת להיסגר במלואו מתבליט בודד, ומחיקה
  # עיוורת הייתה עלולה לאבד משימות שעדיין פתוחות. הסימון רק מוסיף - מישהו
  # (מפתח או Claude בסבב הבא) עדיין צריך להחליט אם למחוק בפועל.
  if ((Test-Path $roadmapPath) -and $body.Count) {
    function Get-ItemCode([string]$line, [switch]$Bold) {
      $pat = if ($Bold) { '^\*\s+(?:\S+\s+)?\*\*([^\*—]+?)\s*—' } else { '^\s*([^\s—]+)\s*[׳״]?\s*—' }
      if ($line -match $pat) { return ($Matches[1] -replace '[׳״]', '').Trim() }
      return $null
    }
    $newCodes = @($body | ForEach-Object { Get-ItemCode $_ } | Where-Object { $_ })
    if ($newCodes.Count) {
      $rmLines = Get-Content $roadmapPath -Encoding UTF8
      $rmChanged = $false
      for ($i = 0; $i -lt $rmLines.Count; $i++) {
        $code = Get-ItemCode $rmLines[$i] -Bold
        if ($code -and ($newCodes -contains $code) -and ($rmLines[$i] -notmatch '✅')) {
          $rmLines[$i] = $rmLines[$i] -replace '^(\*\s+)', "`$1✅ שוחרר ב-$newVersion`: "
          Write-Host ("ROADMAP.md: סומן כבוצע ($code)") -ForegroundColor Green
          $rmChanged = $true
        }
      }
      if ($rmChanged) {
        [System.IO.File]::WriteAllText($roadmapPath, (($rmLines -join "`r`n") + "`r`n"), [System.Text.UTF8Encoding]::new($false))
      }
    }
  }
}

# ---- 1ג. הטמעת CHANGELOG.md כקבוע JS (guides/_shared/changelog-embedded.js) ----
# הלשונית "מה חדש" (4.7) הסתמכה על fetch('CHANGELOG.md') בזמן ריצה, ונכשלה
# בפועל בתוך ה-WebView של אוצריא. הפתרון: מטביעים את התוכן כקבוע JS באותו
# רגע שבו CHANGELOG.md עצמו מתעדכן, כך שהוא אף פעם לא "לא מסונכרן" עם מה
# שבפועל נארז - ואין שום תלות ב-fetch/רשת בזמן ריצה.
$changelogEmbedPath = Join-Path $root "guides\_shared\changelog-embedded.js"
$clFinal = Get-Content $changelogPath -Raw -Encoding UTF8
# -InputObject ([string]...) ולא pipe: ב-PowerShell 5.1 מחרוזת של Get-Content -Raw
# שמוזרמת ב-pipe נעטפת כ-{"value":...} — אובייקט במקום מחרוזת, ששבר את 3.3.0
# (הלשונית "מה חדש" הייתה קורסת) ונתפס ע"י verify-embedded.js ב-CI.
$clJson = ConvertTo-Json -InputObject ([string]$clFinal) -Compress
$embedContent = "// נוצר אוטומטית על ידי build/pack.ps1 מתוך CHANGELOG.md - אל תערכו ביד, זה יידרס.`r`nconst EMBEDDED_CHANGELOG_MD = $clJson;`r`n"
[System.IO.File]::WriteAllText($changelogEmbedPath, $embedContent, [System.Text.UTF8Encoding]::new($false))
Write-Host "הוטמע CHANGELOG.md כקבוע JS: guides/_shared/changelog-embedded.js"

# ---- 1ד. הטמעת ROADMAP.md כקבוע JS (guides/_shared/roadmap-embedded.js) ----
# אותו דפוס בדיוק כמו 1ג, עבור "מה מתוכנן בהמשך" (personal.js). ROADMAP.md
# עצמו נערך ביד מול docs/ (אינו נגזר אוטומטית מהן) — כאן רק מטביעים את מה
# שכתוב בו כרגע, כדי שהתוסף הארוז לעולם לא יציג גרסה ישנה יותר משהריפו עצמו.
if (Test-Path $roadmapPath) {
  $roadmapEmbedPath = Join-Path $root "guides\_shared\roadmap-embedded.js"
  $rmFinal = Get-Content $roadmapPath -Raw -Encoding UTF8
  $rmJson = ConvertTo-Json -InputObject ([string]$rmFinal) -Compress   # ר' ההערה ב-1ג
  $rmEmbedContent = "// נוצר אוטומטית על ידי build/pack.ps1 מתוך ROADMAP.md - אל תערכו ביד, זה יידרס.`r`nconst EMBEDDED_ROADMAP_MD = $rmJson;`r`n"
  [System.IO.File]::WriteAllText($roadmapEmbedPath, $rmEmbedContent, [System.Text.UTF8Encoding]::new($false))
  Write-Host "הוטמע ROADMAP.md כקבוע JS: guides/_shared/roadmap-embedded.js"
} else {
  Write-Warning "ROADMAP.md לא נמצא בשורש הריפו — guides/_shared/roadmap-embedded.js לא עודכן."
}

# ---- 1ה. הטמעת מספר הגרסה כקבוע JS (guides/_shared/version-embedded.js) ----
# אותה בעיה בדיוק כמו 1ג/1ד: fetch('manifest.json') מתוך bridge.js/personal.js
# נכשל בפועל בתוך ה-WebView של אוצריא (בדיוק כמו fetch('CHANGELOG.md') לפני 1ג) -
# ולכן "הגרסה המותקנת אצלך" בלשונית "מה חדש" הציגה "לא ידועה" בכל התקנה אמיתית,
# אף שהיא ממש הגרסה שנארזת כאן. מטביעים את המספר כקבוע, בלי fetch בזמן ריצה.
$versionEmbedPath = Join-Path $root "guides\_shared\version-embedded.js"
$versionEmbedContent = "// נוצר אוטומטית על ידי build/pack.ps1 מתוך manifest.json - אל תערכו ביד, זה יידרס.`r`nconst EMBEDDED_PLUGIN_VERSION = " + (ConvertTo-Json -InputObject ([string]$newVersion) -Compress) + ";`r`n"
[System.IO.File]::WriteAllText($versionEmbedPath, $versionEmbedContent, [System.Text.UTF8Encoding]::new($false))
Write-Host "הוטמע מספר הגרסה כקבוע JS: guides/_shared/version-embedded.js"

# ---- 2. הכנת תיקיית staging נקייה (בלי קבצי build/debug) ----
$stageDir = Join-Path $env:TEMP "madaei-hatanach-stage"
if (Test-Path $stageDir) { Remove-Item $stageDir -Recurse -Force }
New-Item -ItemType Directory -Path $stageDir | Out-Null

# ---- 2ג. העתקת פריטי המוצר בלבד (whitelist) ----
# רשימה לבנה, לא שחורה. עד 3.3.6 העתקנו את *כל* השורש חוץ מ-$excludeDirs/
# $excludeFiles — וכל תיקיית עבודה חדשה בשורש שנשכחה מהרשימה נשלחה למשתמשים
# (assets/ + docs/: 12MB→50MB ב-2.11.3; תיקיית עבודה 860MB: 757MB ב-3.3.4).
# עכשיו מעתיקים רק את מה שבאמת נטען בזמן ריצה — הוודא מול index.html,
# background.html ו-manifest.json. שום קובץ נשלח אחר לא מפנה ל-assets/docs/tools.
# הרשימה הזו חייבת להישאר זהה ל-!/-entries ב-.otzignore (ר' בדיקה 2ד למטה).
$includeItems = @('manifest.json', 'index.html', 'background.html', 'icon', 'shell', 'guides')
foreach ($item in $includeItems) {
  $src = Join-Path $root $item
  if (-not (Test-Path $src)) { throw "פריט מוצר חובה חסר מהשורש: $item" }
  Copy-Item $src -Destination (Join-Path $stageDir $item) -Recurse -Force
}

# ---- 2ד. אימות סנכרון מול .otzignore ----
# .otzignore הוא המסלול של הכלי הרשמי / ה-GitHub Action של החנות. הוא מנוסח
# כ-whitelist מקבילה (/*‎ + ‎!/<item>). כאן רק מוודאים ששתי הרשימות לא נפרדו.
$otzignorePath = Join-Path $root ".otzignore"
if (Test-Path $otzignorePath) {
  $wl = Get-Content $otzignorePath -Encoding UTF8 |
        ForEach-Object { if ($_ -match '^\s*!/([^\s/]+)/?\s*$') { $Matches[1] } }
  $diff = Compare-Object -ReferenceObject ($includeItems | Sort-Object) `
                         -DifferenceObject (@($wl) | Sort-Object)
  if ($diff) {
    Write-Warning "הרשימה הלבנה ב-pack.ps1 לא תואמת ל-!/-entries ב-.otzignore. סנכרן ידנית:"
    $diff | ForEach-Object { Write-Warning "  $($_.SideIndicator) $($_.InputObject)" }
  }
}

# ---- 2ב. הסרת קבצים שאינם בשימוש מהחבילה ----
# guides/<cat>/view.html ו-guides/places/css|js/app.* הם המדריכים העצמאיים הישנים.
# מאז שהרינדור עבר להיות ילידי בתוך index.html (shell/*.js) הם לא נטענים כלל -
# הם נשארים בתיקיית הפיתוח כארכיון, אבל אין סיבה לשלוח אותם למשתמשים:
#   • ~8.6MB פחות בחבילה
#   • הם היחידים שנופלים בבדיקת תאימות-העיצוב של החנות (צבעי hex קשיחים)
# רוצים להחזיר אותם לחבילה? פשוט מוחקים/מרוקנים את הרשימה הזו.
$deadPatterns = @(
  'guides\*\view.html',
  'guides\places\css\app.css',
  'guides\places\js\app.js',
  'guides\places\README.md'
)
$removedBytes = 0
foreach ($pat in $deadPatterns) {
  Get-ChildItem -Path (Join-Path $stageDir $pat) -ErrorAction SilentlyContinue | ForEach-Object {
    $removedBytes += $_.Length
    Remove-Item $_.FullName -Force
  }
}
if ($removedBytes -gt 0) {
  Write-Host ("הוסרו מהחבילה קבצים שאינם בשימוש: {0:N1} MB" -f ($removedBytes / 1MB))
}

# ---- 3. אריזת .otzplugin (zip רגיל בשינוי סיומת) ----
$pluginId = $manifest.id
$otzpluginName = "$pluginId-$newVersion.otzplugin"
$otzpluginPath = Join-Path $distDir $otzpluginName
if (Test-Path $otzpluginPath) { Remove-Item $otzpluginPath -Force }

$tmpZip = Join-Path $env:TEMP "madaei-hatanach-$newVersion.zip"
if (Test-Path $tmpZip) { Remove-Item $tmpZip -Force }
Compress-Archive -Path (Join-Path $stageDir '*') -DestinationPath $tmpZip -CompressionLevel Optimal
Move-Item $tmpZip $otzpluginPath

Write-Host "נוצר קובץ תוסף: $otzpluginPath"

# ---- 4. אריזת גרסה עצמאית (standalone .zip - אותו תוכן, לשימוש ללא אוצריא) ----
$standaloneName = "madaei-hatanach-standalone-$newVersion.zip"
$standalonePath = Join-Path $distDir $standaloneName
if (Test-Path $standalonePath) { Remove-Item $standalonePath -Force }

$tmpZip2 = Join-Path $env:TEMP "madaei-hatanach-standalone-$newVersion.zip"
if (Test-Path $tmpZip2) { Remove-Item $tmpZip2 -Force }
Compress-Archive -Path (Join-Path $stageDir '*') -DestinationPath $tmpZip2 -CompressionLevel Optimal
Move-Item $tmpZip2 $standalonePath

Write-Host "נוצרה גרסה עצמאית: $standalonePath"

Remove-Item $stageDir -Recurse -Force

# ---- 5. שומר גודל ----
# מאז המעבר ל-whitelist (2ג) תיקיית עבודה חדשה בשורש כבר לא יכולה להיכנס לחבילה,
# והרף הישן (16MB) לא היה רלוונטי: החבילה הרגילה ~18MB בגלל התמונות המוטבעות,
# וריאנט המפות ~63MB — שניהם תקינים. הרגיל והמורחב עולים עוד ~40MB כשמצורפים
# אריחי מפה. הרף כאן הוא רק רשת ביטחון רופפת לקפיצה חריגה באמת.
$sizeMB = [math]::Round((Get-Item $otzpluginPath).Length / 1MB, 1)
Write-Host ""
Write-Host "גודל החבילה: $sizeMB MB"
if ($sizeMB -gt 40) {
  Write-Warning "החבילה גדולה מהצפוי ($sizeMB MB, הרף 40MB). בדוק מה תפח בתוך guides/ (דאטה/תמונות)."
}

Write-Host ""
Write-Host "סיום. גרסה חדשה: $newVersion"
Write-Host "  - להתקנה באוצריא: $otzpluginPath"
Write-Host "  - לשימוש עצמאי (חילוץ ופתיחת index.html בדפדפן): $standalonePath"

# ---- 6. שחרור: commit + tag + push + GitHub Release ----
# **הכל מאחורי -Release בלבד.** הרצה רגילה של הסקריפט אורזת ולא נוגעת בגיט,
# כדי שאריזת ניסיון לא תדחוף גרסה בטעות.
if (-not $Release) {
  Write-Host ""
  Write-Host "(לא שוחרר. להוספת commit, תג v$newVersion, push ו-GitHub Release — הרץ שוב עם -Release.)" -ForegroundColor DarkGray
  return
}

Write-Host ""
Write-Host "=== שחרור $newVersion ===" -ForegroundColor Cyan

# רק manifest.json ו-CHANGELOG.md נכנסים לקומיט הזה. אם נשארו שינויים אחרים
# בעץ העבודה — עוצרים: הם היו אמורים להיות מחויבים לפני האריזה, והחבילה שכבר
# נוצרה מכילה אותם בלי שיש להם commit.
$dirty = @(& git -C $root status --porcelain | Where-Object { $_ -notmatch '(manifest\.json|CHANGELOG\.md)$' })
if ($dirty.Count) {
  Write-Warning "יש שינויים לא-מחויבים מעבר ל-manifest/CHANGELOG:"
  $dirty | ForEach-Object { Write-Warning "  $_" }
  throw "השחרור נעצר. החבילה נוצרה בהצלחה, אבל תוכן שאין לו commit לא יתועד בתג. חייב אותם ונסה שוב עם -NoBump."
}

$tag = "v$newVersion"
if (& git -C $root tag --list $tag) { throw "התג $tag כבר קיים. כל אריזה מקבלת מספר גרסה טרי (2.11.6)." }

& git -C $root add -- manifest.json CHANGELOG.md
& git -C $root commit -m "$newVersion — אריזה" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "git commit נכשל." }
& git -C $root tag -a $tag -m "$newVersion"
if ($LASTEXITCODE -ne 0) { throw "git tag נכשל." }
& git -C $root push
if ($LASTEXITCODE -ne 0) { throw "git push נכשל." }
& git -C $root push origin $tag
if ($LASTEXITCODE -ne 0) { throw "דחיפת התג נכשלה." }
Write-Host "נדחפו commit ותג $tag." -ForegroundColor Green

# GitHub Release עם ה-.otzplugin מצורף. gh חסר = אזהרה בלבד: הקוד והתג כבר
# בגיטהאב, ואת ה-Release אפשר לפתוח ביד מדף ה-Releases.
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Warning "gh CLI אינו מותקן — ה-Release לא נוצר. הקובץ לצירוף ידני: $otzpluginPath"
  return
}
# גוף ה-Release = ערך ה-CHANGELOG של הגרסה הזו בלבד (עד הכותרת ## הבאה)
$clText = Get-Content $changelogPath -Raw -Encoding UTF8
$m = [regex]::Match($clText, "(?ms)^##\s+" + [regex]::Escape($newVersion) + "\s.*?(?=^##\s|\z)")
$relNotes = if ($m.Success) { $m.Value.Trim() } else { "עינים למקרא $newVersion" }
$notesFile = Join-Path $env:TEMP "madaei-release-$newVersion.md"
[System.IO.File]::WriteAllText($notesFile, $relNotes, [System.Text.UTF8Encoding]::new($false))

& gh release create $tag $otzpluginPath $standalonePath --title "עינים למקרא $newVersion" --notes-file $notesFile
if ($LASTEXITCODE -ne 0) { Write-Warning "gh release create נכשל. התג כבר נדחף — אפשר ליצור את ה-Release ידנית ולצרף: $otzpluginPath" }
else { Write-Host "נוצר GitHub Release $tag עם החבילה מצורפת." -ForegroundColor Green }
Remove-Item $notesFile -Force -ErrorAction SilentlyContinue
