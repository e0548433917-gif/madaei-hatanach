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
  [switch]$Release
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $root "manifest.json"
$distDir = Join-Path $root "dist"

if (-not (Test-Path $TilesSource)) { throw "לא נמצא $TilesSource" }

$manifest = Get-Content $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$version = $manifest.version
$baseZip = Join-Path $distDir "$($manifest.id)-$version.otzplugin"

if (-not (Test-Path $baseZip)) {
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
  $m.name = $m.name + "+"
  $m.description = $m.description + " גרסה זו כוללת מפת OpenStreetMap מפורטת מוטמעת (ללא צורך באינטרנט או בתוסף נפרד)."
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
