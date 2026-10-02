# dump.ps1 - run a page of this project in headless Chrome and print the
# test output (#testout) and any logged errors. Same rules as shot_page.ps1:
# a fresh profile every time, and a virtual-time budget.
#
#   tools\dump.ps1 -Url "/?script=kitchen"
param(
  [Parameter(Mandatory = $true)][string]$Url,
  [int]$Budget = 30000
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$live = $false
try { Invoke-WebRequest -Uri "http://127.0.0.1:8742/" -UseBasicParsing -TimeoutSec 3 | Out-Null; $live = $true } catch { }
$srv = $null
if (-not $live) {
  $srv = Start-Process -FilePath 'python' -ArgumentList '-m', 'http.server', '8742' -WorkingDirectory $root -PassThru -WindowStyle Hidden
  Start-Sleep -Milliseconds 900
}
$ud = Join-Path $env:TEMP ("pu_dd_" + [guid]::NewGuid().ToString('N').Substring(0, 8))
$outf = Join-Path $env:TEMP ("pu_dom_" + [guid]::NewGuid().ToString('N').Substring(0, 8) + ".html")
try {
  $a = @('--headless=new', "--user-data-dir=$ud", '--no-first-run', '--incognito',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    "--virtual-time-budget=$Budget", '--window-size=1280,720', '--dump-dom', "http://127.0.0.1:8742$Url")
  Start-Process -FilePath $chrome -ArgumentList $a -NoNewWindow -Wait -RedirectStandardOutput $outf | Out-Null
  $html = Get-Content $outf -Raw
  $m = [regex]::Match($html, '<pre id="testout"[^>]*>([\s\S]*?)</pre>')
  if ($m.Success) { [System.Net.WebUtility]::HtmlDecode($m.Groups[1].Value) } else { "no #testout. length=$($html.Length)"; ($html -split "`n" | Select-String 'ERR|REJ|UPDATE' | Select-Object -First 10) }
} finally {
  if ($srv) { try { Stop-Process -Id $srv.Id -Force -ErrorAction Stop } catch { } }
  foreach ($f in @($ud, $outf)) { if (Test-Path $f) { try { Remove-Item $f -Recurse -Force -ErrorAction Stop } catch { } } }
}
