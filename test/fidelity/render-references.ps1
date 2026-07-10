<#
.SYNOPSIS
  Render true-Microsoft-Office reference PDFs for the Patram fidelity corpus.

.DESCRIPTION
  Drives Word, Excel and PowerPoint through COM (ExportAsFixedFormat) to
  convert every document in corpus\ into references\<name>.pdf. These are the
  gold-standard references (plan.md section 7): Word's own layout engine is the
  definition of "pixel-perfect" for OOXML.

  Requirements:
    - Windows with Microsoft Office (desktop) installed and activated
    - Run from Windows PowerShell (NOT from inside WSL); COM is Windows-only.
      From WSL you can invoke it as:
        powershell.exe -ExecutionPolicy Bypass -File render-references.ps1

.USAGE
  cd <repo>\test\fidelity
  powershell -ExecutionPolicy Bypass -File render-references.ps1
  # optional: -CorpusDir / -OutDir to override locations
  powershell -ExecutionPolicy Bypass -File render-references.ps1 -OutDir references-word

.NOTES
  - Runs each app invisibly and quits it afterwards; documents open read-only.
  - Skips files whose reference PDF already exists and is newer than the source
    (delete references\ to force a full re-render).
  - LibreOffice references (render-references.mjs) and Word references differ;
    keep them in separate output dirs if you want both.
#>
param(
    [string]$CorpusDir = (Join-Path $PSScriptRoot "corpus"),
    [string]$OutDir    = (Join-Path $PSScriptRoot "references")
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path $CorpusDir)) { throw "Corpus dir not found: $CorpusDir  (run 'node gen-corpus.mjs' first)" }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$CorpusDir = (Resolve-Path $CorpusDir).Path
$OutDir    = (Resolve-Path $OutDir).Path

function Get-Targets([string]$pattern) {
    Get-ChildItem -Path $CorpusDir -Filter $pattern |
        Where-Object { $_.Name -notlike '~$*' } |
        Where-Object {
            $pdf = Join-Path $OutDir ($_.BaseName + ".pdf")
            -not (Test-Path $pdf) -or (Get-Item $pdf).LastWriteTime -lt $_.LastWriteTime
        }
}

$rendered = 0
$failed = @()

# ------------------------------------------------------------------ Word ----
$docs = @(Get-Targets "*.docx")
if ($docs.Count -gt 0) {
    Write-Host "Word: $($docs.Count) document(s)" -ForegroundColor Cyan
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0    # wdAlertsNone
    try {
        foreach ($f in $docs) {
            $pdf = Join-Path $OutDir ($f.BaseName + ".pdf")
            try {
                $doc = $word.Documents.Open($f.FullName, $false, $true)  # confirmConversions, readOnly
                $doc.ExportAsFixedFormat($pdf, 17)                       # 17 = wdExportFormatPDF
                $doc.Close($false)
                Write-Host "  ok  $($f.Name) -> $(Split-Path $pdf -Leaf)"
                $rendered++
            } catch { $failed += $f.Name; Write-Warning "  FAIL $($f.Name): $_" }
        }
    } finally { $word.Quit(); [Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null }
}

# ----------------------------------------------------------------- Excel ----
$sheets = @(Get-Targets "*.xlsx")
if ($sheets.Count -gt 0) {
    Write-Host "Excel: $($sheets.Count) workbook(s)" -ForegroundColor Cyan
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    try {
        foreach ($f in $sheets) {
            $pdf = Join-Path $OutDir ($f.BaseName + ".pdf")
            try {
                $wb = $excel.Workbooks.Open($f.FullName, 0, $true)       # updateLinks=0, readOnly
                $wb.ExportAsFixedFormat(0, $pdf)                         # 0 = xlTypePDF
                $wb.Close($false)
                Write-Host "  ok  $($f.Name) -> $(Split-Path $pdf -Leaf)"
                $rendered++
            } catch { $failed += $f.Name; Write-Warning "  FAIL $($f.Name): $_" }
        }
    } finally { $excel.Quit(); [Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null }
}

# ------------------------------------------------------------ PowerPoint ----
$decks = @(Get-Targets "*.pptx")
if ($decks.Count -gt 0) {
    Write-Host "PowerPoint: $($decks.Count) deck(s)" -ForegroundColor Cyan
    $ppt = New-Object -ComObject PowerPoint.Application
    try {
        foreach ($f in $decks) {
            $pdf = Join-Path $OutDir ($f.BaseName + ".pdf")
            try {
                # msoTrue=-1 msoFalse=0: ReadOnly, Untitled, WithWindow
                $pres = $ppt.Presentations.Open($f.FullName, -1, 0, 0)
                $pres.ExportAsFixedFormat($pdf, 2)                       # 2 = ppFixedFormatTypePDF
                $pres.Close()
                Write-Host "  ok  $($f.Name) -> $(Split-Path $pdf -Leaf)"
                $rendered++
            } catch { $failed += $f.Name; Write-Warning "  FAIL $($f.Name): $_" }
        }
    } finally { $ppt.Quit(); [Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null }
}

[GC]::Collect(); [GC]::WaitForPendingFinalizers()

Write-Host ""
Write-Host "$rendered reference PDF(s) rendered into $OutDir" -ForegroundColor Green
if ($failed.Count -gt 0) {
    Write-Warning ("Failed: " + ($failed -join ", "))
    exit 1
}
