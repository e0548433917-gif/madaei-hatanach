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
}

# ---- 1ג. הטמעת CHANGELOG.md כקבוע JS (guides/_shared/changelog-embedded.js) ----
# הלשונית "מה חדש" (4.7) הסתמכה על fetch('CHANGELOG.md') בזמן ריצה, ונכשלה
# בפועל בתוך ה-WebView של אוצריא. הפתרון: מטביעים את התוכן כקבוע JS באותו
# רגע שבו CHANGELOG.md עצמו מתעדכן, כך שהוא אף פעם לא "לא מסונכרן" עם מה
# שבפועל נארז - ואין שום תלות ב-fetch/רשת בזמן ריצה.
$changelogEmbedPath = Join-Path $root "guides\_shared\changelog-embedded.js"
$clFinal = Get-Content $changelogPath -Raw -Encoding UTF8
$clJson = $clFinal | ConvertTo-Json -Compress
$embedContent = "// נוצר אוטומטית על ידי build/pack.ps1 מתוך CHANGELOG.md - אל תערכו ביד, זה יידרס.`r`nconst EMBEDDED_CHANGELOG_MD = $clJson;`r`n"
[System.IO.File]::WriteAllText($changelogEmbedPath, $embedContent, [System.Text.UTF8Encoding]::new($false))
Write-Host "הוטמע CHANGELOG.md כקבוע JS: guides/_shared/changelog-embedded.js"

# ---- 2. הכנת תיקיית staging נקייה (בלי קבצי build/debug) ----
$stageDir = Join-Path $env:TEMP "madaei-hatanach-stage"
if (Test-Path $stageDir) { Remove-Item $stageDir -Recurse -Force }
New-Item -ItemType Directory -Path $stageDir | Out-Null

# מה לא נשלח למשתמשים. שים לב: assets/ ו-docs/ נכנסו לריפו ב-2.11.3 והחבילה קפצה
# מ-12MB ל-50MB, כי הם לא היו ברשימה הזו. הם חומרי פיתוח בלבד — אין אליהם שום
# הפניה מ-index.html או מ-shell/. אותו דבר tools/ (סקריפט ולידציה שרץ ב-node).
# mishna-talmud-addons/ הוא גיבוי קוד-מקור בלבד (המניפסטים והאיקונים של 3 התוספים
# העצמאיים). מה שנטען בפועל הוא guides/talmud-tools/ — ר׳ ט.2 בתוכנית.
$excludeDirs = @('build', 'dist', '.git', '.claude', 'assets', 'docs', 'tools', 'mishna-talmud-addons')
$excludeFiles = @('_serve.ps1', 'README.md', 'למפתחים.md', 'פוסט-לפורום.md', '.gitignore', '.gitattributes')

Get-ChildItem -Path $root -Force | Where-Object {
  $_.Name -notin $excludeDirs -and $_.Name -notin $excludeFiles -and $_.Name -ne (Split-Path $stageDir -Leaf)
} | ForEach-Object {
  Copy-Item $_.FullName -Destination (Join-Path $stageDir $_.Name) -Recurse -Force
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
# 2.11.2 שקל 12.2MB. אם החבילה חצתה 16MB כנראה שנכנסה אליה תיקייה חדשה שאמורה
# להיות ב-$excludeDirs — בדיוק מה שקרה ב-2.11.3 עם assets/ ו-docs/ (50MB).
$sizeMB = [math]::Round((Get-Item $otzpluginPath).Length / 1MB, 1)
Write-Host ""
Write-Host "גודל החבילה: $sizeMB MB"
if ($sizeMB -gt 16) {
  Write-Warning "החבילה גדולה מהצפוי ($sizeMB MB, הרף 16MB). בדוק אם נוספה תיקייה שצריכה להיכנס ל-`$excludeDirs ב-build\pack.ps1."
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
