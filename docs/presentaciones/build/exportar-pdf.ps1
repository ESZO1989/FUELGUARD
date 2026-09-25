# Convierte .pptx a .pdf con PowerPoint (COM). Uso: powershell -File exportar-pdf.ps1 archivo.pptx [otro.pptx ...]
$ErrorActionPreference = 'Stop'
$pp = New-Object -ComObject PowerPoint.Application
try {
  foreach ($f in $args) {
    $src = (Resolve-Path $f).Path
    $dst = [System.IO.Path]::ChangeExtension($src, '.pdf')
    $pres = $pp.Presentations.Open($src, $true, $false, $false)   # ReadOnly, Untitled, WithWindow
    $pres.SaveAs($dst, 32)   # 32 = ppSaveAsPDF
    $pres.Close()
    Write-Host "PDF: $dst"
  }
} finally { $pp.Quit() }
