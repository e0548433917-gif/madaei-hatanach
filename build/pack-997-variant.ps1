<#
  בונה קובץ .otzplugin שני, ייעודי לאוצריא 0.9.97 ומעלה, מתוך חבילת ה-0.9.96
  שכבר נבנתה על ידי pack.ps1 — לא בונה שום דבר מאפס.

  רקע (13.8.26): ניסינו לצרף contributes.startup.toolbarItems (כפתור בסרגל
  הקורא, ROADMAP 4.11) לתוך המניפסט ה-**משותף**. זה שבר את ההתקנה על 0.9.96:
  שדה/הרשאה שהיישום לא מכיר גרם לו לדחות את החבילה כולה במקום להתעלם מהן
  בשקט. אין ערובה ש-minAppVersion לבדו מונע זאת בפועל בכל בנייה של אוצריא —
  ולכן במקום קובץ אחד "חכם", יש כאן שני קבצים נפרדים לגמרי: אחד שאף פעם לא
  נוגע בתכונות 0.9.97, ואחד שכן. באג בשני לא יכול לגעת בראשון.

  שני התוצרים חולקים בדיוק את אותו קוד (JS/HTML/CSS/דאטה) — ההבדל היחיד
  הוא manifest.json. זה מבטיח שאין סטייה בין הגרסאות מלבד מה שבאמת משתנה.

  שימוש:
    .\build\pack.ps1                    # קודם: בונה/מעדכן את חבילת ה-0.9.96 הרגילה
    .\build\pack-997-variant.ps1         # ואז: גוזר ממנה את חבילת ה-0.9.97

  אם dist\com.chadbedera.madaeihatanach-<version>.otzplugin לא קיים (עדיין
  לא רץ pack.ps1 לגרסה הנוכחית) — הסקריפט נעצר עם הודעה ברורה במקום לבנות
  לבד ולסטות מהמקור.
#>

param(
  [switch]$Release   # commit + push + GitHub Release, כמו -Release ב-pack.ps1
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $root "manifest.json"
$distDir = Join-Path $root "dist"

$manifest = Get-Content $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$version = $manifest.version
$baseZip = Join-Path $distDir "$($manifest.id)-$version.otzplugin"

if (-not (Test-Path $baseZip)) {
  throw "לא נמצא $baseZip — הרץ קודם .\build\pack.ps1 (בלי -NoBump אם רוצים גרסה חדשה) כדי לבנות את חבילת ה-0.9.96 הבסיסית, ורק אז את הסקריפט הזה."
}

Write-Host "בונה וריאנט 0.9.97+ מתוך: $baseZip" -ForegroundColor Cyan

# ---- 1. חילוץ החבילה הבסיסית לתיקייה זמנית ----
$tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ("madaei-997-" + [System.Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmpDir | Out-Null
try {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::ExtractToDirectory($baseZip, $tmpDir)

  # ---- 2. Overlay על manifest.json: רק מה שדורש בפועל 0.9.97+ ----
  $variantManifestPath = Join-Path $tmpDir "manifest.json"
  $m = Get-Content $variantManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json

  $m.minAppVersion = "0.9.97"

  # reader.toolbar ו-app.startup_contributions: לפי API_REFERENCE.md (הרשאת
  # תחום ל-toolbarItems) ולפי שגיאת התקנה אמיתית על מכשיר 0.9.97 (13.8.26).
  # ⚠️ לא מאומתות מול otzaria pack-plugin המקומי — הוא עצמו 0.9.95 ודוחה כל
  # הרשאה שהוא לא מכיר, כולל את שתי אלה. ר' otzaria_dev_docs_vs_shipped.md.
  #
  # feedback.report (3.1.0): מסלול הדיווח הרשמי של אוצריא, 0.9.97 ומעלה.
  # מוצהר **רק כאן** ולא בחבילת הבסיס — הרשאה שאינה מוכרת ל-0.9.96 שוברת שם
  # את ההתקנה כולה. הקוד עצמו משותף לשתי החבילות וקורא דרך callIfSupported
  # (shell/core.js), כך שב-0.9.96 הקריאה פשוט לא נשלחת והדיווח נופל חזרה
  # לממסר הישן. ר' postViaOtzariaFeedback ב-shell/personal.js.
  $newPerms = @($m.permissions) + @("reader.toolbar", "app.startup_contributions", "feedback.report") | Select-Object -Unique
  $m.permissions = $newPerms

  # ---- contributes.startup — כאן, ולא בחבילת הבסיס ----
  # מ-2.20.3 הסעיף הזה חי רק בווריאנט. הסיבה מדויקת ומאומתת מול קוד אוצריא:
  #   • PluginExtendedValidator._validateStartupContributions מוסיף **שגיאה
  #     חוסמת** ("contributes.startup דורש את ההרשאה app.startup_contributions")
  #     והוולידציה הזו רצה גם ב-PluginInstallerService.prepareInstall — כלומר
  #     סעיף בלי ההרשאה חוסם **התקנה**, לא רק אריזה.
  #   • ובכיוון ההפוך: בנייה ישנה של אוצריא שאינה מכירה את ההרשאה דוחה אותה
  #     כ"הרשאה לא חוקית" (זה מה שקרה ב-2.17.1).
  # אין מניפסט אחד שעובר בשתי הבניות, ולכן: בסיס בלי הסעיף, וריאנט אִתו.
  $contextMenuItem = [PSCustomObject]@{
    id       = "madaei-hatanach-identify"
    type     = "item"
    title    = "זיהוי בעינים למקרא"
    icon     = "search_24_regular"
    contexts = @("reader-selection")
  }
  $toolbarItem = [PSCustomObject]@{
    id       = "madaei-hatanach-open"
    type     = "button"
    title    = "עינים למקרא"
    icon     = "book_24_regular"
    contexts = @("reader-text", "reader-pdf")
    openPlugin = $true
  }
  $startup = [PSCustomObject]@{
    contextMenuItems = @($contextMenuItem)
    toolbarItems     = @($toolbarItem)
    activationEvents = @("app.startup")
    keepAlive        = $false
  }
  $m.contributes | Add-Member -NotePropertyName startup -NotePropertyValue $startup -Force

  $json = $m | ConvertTo-Json -Depth 10
  $json = [System.Text.RegularExpressions.Regex]::Unescape($json)
  [System.IO.File]::WriteAllText($variantManifestPath, $json, [System.Text.UTF8Encoding]::new($false))

  # ---- 3. אריזה מחדש ----
  $variantZip = Join-Path $distDir "$($manifest.id)-$version-toolbar997.otzplugin"
  if (Test-Path $variantZip) { Remove-Item $variantZip -Force }
  [System.IO.Compression.ZipFile]::CreateFromDirectory($tmpDir, $variantZip, [System.IO.Compression.CompressionLevel]::Optimal, $false)

  Write-Host "נוצר: $variantZip" -ForegroundColor Green
  Write-Host "  minAppVersion: 0.9.97  |  + reader.toolbar, app.startup_contributions, feedback.report  |  + contributes.startup (contextMenuItems + toolbarItems + activationEvents)"
}
finally {
  Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
}

if ($Release) {
  $tag = "v$version-toolbar997"
  Push-Location $root
  try {
    & gh release upload "v$version" $variantZip --clobber
    if ($LASTEXITCODE -ne 0) { throw "gh release upload נכשל (קוד $LASTEXITCODE)" }
    Write-Host "הועלה ל-GitHub Release v$version." -ForegroundColor Green
  }
  finally { Pop-Location }
}
