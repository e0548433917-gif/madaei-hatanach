<#
  סקריפט אריזה למדעי התנ״ך.
  בכל הרצה: מעלה את מספר הגרסה במניפסט ב-0.0.1 (patch), ואז אורז שתי תוצרים:
    1. .otzplugin  - קובץ zip רגיל בשם החבילה, להתקנה בתוך אוצריא (חנות התוספים / התקנה מקובץ).
    2. standalone .zip - אותם קבצים בדיוק, לשימוש עצמאי (פתיחת index.html בדפדפן רגיל, בלי אוצריא).
  אין צורך לערוך את הסקריפט הזה בשביל לעדכן תוכן - עורכים רק את קובץ ה-data הרלוונטי בתוך guides/<תחום>/data/
  ומריצים מחדש את הסקריפט הזה כדי לארוז מחדש.
#>

param(
  # -NoBump: אורז בדיוק את הגרסה שכתובה כרגע במניפסט, בלי להעלות ב-0.0.1.
  # שימושי לשחרור גרסה גדולה (למשל 2.0.0) שכתבתם ידנית במניפסט.
  [switch]$NoBump
)

$root = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $root "manifest.json"
$distDir = Join-Path $root "dist"

if (-not (Test-Path $distDir)) { New-Item -ItemType Directory -Path $distDir | Out-Null }

# ---- 1. העלאת גרסה ב-0.0.1 (אלא אם הועבר -NoBump) ----
$manifestRaw = Get-Content $manifestPath -Raw -Encoding UTF8
$manifest = $manifestRaw | ConvertFrom-Json
$parts = $manifest.version -split '\.'
if ($parts.Count -ne 3) { throw "פורמט גרסה לא תקין במניפסט: $($manifest.version)" }
if ($NoBump) {
  $newVersion = $manifest.version
} else {
  $newPatch = [int]$parts[2] + 1
  $newVersion = "$($parts[0]).$($parts[1]).$newPatch"
}
$manifest.version = $newVersion

# שמירה בפורמט JSON תקין, עם הזחה של 2 רווחים ותווים בעברית ללא escape
$json = $manifest | ConvertTo-Json -Depth 10
$json = [System.Text.RegularExpressions.Regex]::Unescape($json)
[System.IO.File]::WriteAllText($manifestPath, $json, [System.Text.UTF8Encoding]::new($false))

if ($NoBump) { Write-Host "אורז את הגרסה שבמניפסט ללא העלאה: $newVersion" }
else { Write-Host "גרסה עודכנה: $($parts -join '.') -> $newVersion" }

# ---- 2. הכנת תיקיית staging נקייה (בלי קבצי build/debug) ----
$stageDir = Join-Path $env:TEMP "madaei-hatanach-stage"
if (Test-Path $stageDir) { Remove-Item $stageDir -Recurse -Force }
New-Item -ItemType Directory -Path $stageDir | Out-Null

$excludeDirs = @('build', 'dist', '.git', '.claude')
$excludeFiles = @('_serve.ps1')

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

Write-Host ""
Write-Host "סיום. גרסה חדשה: $newVersion"
Write-Host "  - להתקנה באוצריא: $otzpluginPath"
Write-Host "  - לשימוש עצמאי (חילוץ ופתיחת index.html בדפדפן): $standalonePath"
