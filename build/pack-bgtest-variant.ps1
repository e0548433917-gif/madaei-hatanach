<#
  קובץ .otzplugin שלישי, נפרד — לבדיקה בלבד: מחזיר את contributes.background.entrypoint
  (background.html) שהוסר מהבסיס ב-14.8.26 אחרי שמשתמש דיווח שהלחיצה הימנית לא
  הגיבה כלל ב-0.9.97 (ר' README, "תיקון דחוף" באותו תאריך). לא ידוע אם הבעיה
  הייתה השדה עצמו, או משהו אחר — הקובץ הזה מבודד בדיוק את המשתנה הזה, בלי שום
  שינוי נוסף (לא toolbarItems, לא minAppVersion), כדי שתוצאה שלילית/חיובית
  תגיד משהו ברור.

  ⚠️ לא לשלוח למשתמשים כברירת מחדל. זה לבדיקה על מכשיר אמיתי בלבד. אם זה
  עובד — מעבירים contributes.background חזרה לתוך manifest.json הראשי (ואז
  אין יותר צורך בקובץ הנפרד הזה); אם זה נכשל באותו אופן — יש לנו וידוא
  שהשדה עצמו הוא הבעיה, לא תופעת לוואי של משהו אחר.

  שימוש (אחרי pack.ps1 הרגיל):
    .\build\pack-bgtest-variant.ps1
#>

param(
  [switch]$Release
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $root "manifest.json"
$distDir = Join-Path $root "dist"

$manifest = Get-Content $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$version = $manifest.version
$baseZip = Join-Path $distDir "$($manifest.id)-$version.otzplugin"

if (-not (Test-Path $baseZip)) {
  throw "לא נמצא $baseZip — הרץ קודם .\build\pack.ps1."
}

Write-Host "בונה וריאנט בדיקה (background.html) מתוך: $baseZip" -ForegroundColor Cyan

$tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ("madaei-bgtest-" + [System.Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmpDir | Out-Null
try {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::ExtractToDirectory($baseZip, $tmpDir)

  $variantManifestPath = Join-Path $tmpDir "manifest.json"
  $m = Get-Content $variantManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json

  # המשתנה היחיד שנבדק. שום דבר אחר לא משתנה מהבסיס.
  $m.contributes | Add-Member -NotePropertyName background -NotePropertyValue ([PSCustomObject]@{ entrypoint = "background.html" })

  $json = $m | ConvertTo-Json -Depth 10
  $json = [System.Text.RegularExpressions.Regex]::Unescape($json)
  [System.IO.File]::WriteAllText($variantManifestPath, $json, [System.Text.UTF8Encoding]::new($false))

  if (-not (Test-Path (Join-Path $tmpDir "background.html"))) {
    throw "background.html לא נמצא בחבילה הבסיסית — .otzignore מחריג אותו? חובה שייכלל."
  }

  $variantZip = Join-Path $distDir "$($manifest.id)-$version-bgtest.otzplugin"
  if (Test-Path $variantZip) { Remove-Item $variantZip -Force }
  [System.IO.Compression.ZipFile]::CreateFromDirectory($tmpDir, $variantZip, [System.IO.Compression.CompressionLevel]::Optimal, $false)

  Write-Host "נוצר: $variantZip" -ForegroundColor Green
  Write-Host "  זהה לבסיס + contributes.background.entrypoint=background.html בלבד"
}
finally {
  Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
}

if ($Release) {
  Push-Location $root
  try {
    & gh release upload "v$version" $variantZip --clobber
    if ($LASTEXITCODE -ne 0) { throw "gh release upload נכשל (קוד $LASTEXITCODE)" }
    Write-Host "הועלה ל-GitHub Release v$version." -ForegroundColor Green
  }
  finally { Pop-Location }
}
