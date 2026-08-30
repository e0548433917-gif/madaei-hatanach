<#
  בונה קובץ .otzplugin שלישי, "עינים למקרא+" — זהה לחלוטין לחבילה הרגילה,
  רק עם תיקיית guides/places/tiles/ (אריחי OSM אופליין) מוטמעת בפנים, כך
  שהמפה המפורטת עובדת בלי אינטרנט וגם בלי להתקין את "מקומות+" בנפרד.

  לא בונה שום דבר מאפס: לוקח את dist\<id>-<version>.otzplugin שכבר נבנה
  ע"י pack.ps1, ומוסיף לו תיקייה אחת. אריחי המקור מגיעים מהתוסף "מקומות+"
  (com.chadbedera.placeguideplus) - מבנה {z}/{x}/{y}.png זהה, ר' map.js
  (OSM_LOCAL_URL). המשקל הנוסף (~44MB) הוא הסיבה שזו חבילה נפרדת ולא
  ברירת המחדל - ר' ROADMAP.md ת.5 לדיון המלא בחלופות שנבדקו.

  שימוש:
    .\build\pack.ps1                                    # קודם: חבילת הבסיס
    .\build\pack-offline-maps-variant.ps1 -TilesSource <נתיב לתיקיית tiles>
#>

param(
  [Parameter(Mandatory=$true)][string]$TilesSource,   # תיקיית tiles/ מחולצת (z/x/y.png)
  # -From997: בונה מעל וריאנט ה-0.9.97 (-toolbar997) במקום מעל חבילת הבסיס,
  # וכך "עינים למקרא+" יוצא עם minAppVersion 0.9.97, reader.toolbar
  # ו-contributes.startup (כפתור בסרגל הקורא + פריט תפריט ההקשר המוצהר).
  # דורש שהריצה של build\pack-997-variant.ps1 כבר יצרה את הקובץ הזה.
  [switch]$From997,
  [switch]$Release
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $root "manifest.json"
$distDir = Join-Path $root "dist"

if (-not (Test-Path $TilesSource)) { throw "לא נמצא $TilesSource" }

$manifest = Get-Content $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$version = $manifest.version
$baseZip = if ($From997) {
  Join-Path $distDir "$($manifest.id)-$version-toolbar997.otzplugin"
} else {
  Join-Path $distDir "$($manifest.id)-$version.otzplugin"
}

if (-not (Test-Path $baseZip)) {
  if ($From997) {
    throw "לא נמצא $baseZip — הרץ קודם .\build\pack-997-variant.ps1 (ולפניו pack.ps1) כדי לבנות את וריאנט ה-0.9.97 שממנו נגזרת חבילת ה+."
  }
  throw "לא נמצא $baseZip — הרץ קודם .\build\pack.ps1 כדי לבנות את חבילת הבסיס."
}

Write-Host "בונה וריאנט מפות-אופליין מתוך: $baseZip" -ForegroundColor Cyan

$tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ("madaei-plus-" + [System.Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmpDir | Out-Null
try {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::ExtractToDirectory($baseZip, $tmpDir)

  # ---- הטמעת האריחים ----
  $destTiles = Join-Path $tmpDir "guides\places\tiles"
  Copy-Item -Path $TilesSource -Destination $destTiles -Recurse -Force
  $tileCount = (Get-ChildItem $destTiles -Recurse -File).Count
  Write-Host "  הוטמעו $tileCount אריחים ל-guides/places/tiles/" -ForegroundColor Cyan

  # ---- overlay על manifest.json: שם/תיאור בלבד, אותו id וגרסה בדיוק ----
  $variantManifestPath = Join-Path $tmpDir "manifest.json"
  $m = Get-Content $variantManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
  # ⚠️ 26/08: description המקורי כבר על סף מגבלת 150 התווים (148) - הוספה
  # במקום הוחלפה, גרמה לחריגה ולכשל אמיתי בהתקנה. כל שינוי עתידי כאן חייב
  # להישאר מתחת ל-150 תווים כולל.
  # ⚠️ 26/08 (סבב ב'): name ו-contributes.toolTab.title חייבים להיות זהים
  # מילה-במילה - אוצריא דוחה התקנה אם הם שונים ("שם התוסף שונה מכותרת
  # הטאב"). כל שינוי ל-name כאן חייב תמיד להתלוות בעדכון זהה ל-toolTab.title.
  # ⚠️ 28/08: id נפרד. עד כה הווריאנט נשא את **אותו id** של חבילת הבסיס —
  # מה שמתאים להתקנה ידנית מגיטהאב (הוא פשוט מחליף את הרגיל), אבל **חוסם
  # רישום כתוסף נפרד בחנות**: החנות מזהה תוסף לפי id, ולכן העלאה תחתיו
  # הייתה דורסת את "עינים למקרא" הרגיל במקום ליצור ערך חדש.
  # המשמעות של id נפרד: התוסף מותקן **לצד** הרגיל ולא משדרג אותו, ולכן מי
  # שרוצה לעבור צריך להסיר את הרגיל — זו התנהגות מכוונת.
  # אייקון וכותרת נבדלים, כדי שמי שמותקנות אצלו שתי החבילות יבחין ביניהן
  # בלשונית ובסרגל הקורא. eye_24_filled (עין מלאה) מול eye_24_regular (קו
  # מתאר) — שתיהן קיימות ב-FluentUI. ⚠️ לא ניחשנו שם כמו "עין עם פלוס":
  # ICONS.md מונה ~4,500 אייקוני FluentUI בלי לפרט אותם, ושם שאינו קיים
  # מתורגם לאייקון פאזל ברירת מחדל.
  if ($m.contributes -and $m.contributes.toolTab) { $m.contributes.toolTab.iconName = "eye_24_filled" }
  if ($m.contributes -and $m.contributes.startup -and $m.contributes.startup.toolbarItems) {
    foreach ($ti in $m.contributes.startup.toolbarItems) {
      $ti.icon  = "eye_24_filled"
      $ti.title = "עינים למקרא+"
    }
  }
  $m.id = "com.chadbedera.madaeihatanachplus"
  $newName = $m.name + "+"
  $m.name = $newName
  if ($m.contributes -and $m.contributes.toolTab) { $m.contributes.toolTab.title = $newName }
  $m.description = "מדריך מאוחד לתנ״ך ומשנה/תלמוד עם מפת OpenStreetMap מפורטת מוטמעת (בלי אינטרנט) - אישים, מקומות, בע״ח, צומח, דומם, בית המקדש, מסכתות."
  if ($m.description.Length -gt 150) { throw "description עדיין חורג מ-150 תווים ($($m.description.Length)) - תקן ידנית לפני אריזה." }
  if ($m.contributes.toolTab.title -ne $m.name) { throw "name/toolTab.title לא זהים - זו בדיוק התקלה שתוקנה, תקן ידנית." }
  $json = $m | ConvertTo-Json -Depth 10
  $json = [System.Text.RegularExpressions.Regex]::Unescape($json)
  [System.IO.File]::WriteAllText($variantManifestPath, $json, [System.Text.UTF8Encoding]::new($false))

  # ---- אריזה מחדש ----
  $variantZip = Join-Path $distDir "$($manifest.id)-$version-offlinemaps.otzplugin"
  if (Test-Path $variantZip) { Remove-Item $variantZip -Force }
  [System.IO.Compression.ZipFile]::CreateFromDirectory($tmpDir, $variantZip, [System.IO.Compression.CompressionLevel]::Optimal, $false)

  $sizeMB = [math]::Round((Get-Item $variantZip).Length / 1MB, 1)
  Write-Host "נוצר: $variantZip ($sizeMB MB)" -ForegroundColor Green
}
finally {
  Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
}

if ($Release) {
  Push-Location $root
  try {
    & gh release upload "v$version" "$distDir\$($manifest.id)-$version-offlinemaps.otzplugin" --clobber
    if ($LASTEXITCODE -ne 0) { throw "gh release upload נכשל (קוד $LASTEXITCODE)" }
    Write-Host "הועלה ל-GitHub Release v$version." -ForegroundColor Green
  }
  finally { Pop-Location }
}
