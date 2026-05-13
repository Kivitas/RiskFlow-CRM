$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
$logPath = Join-Path $projectRoot 'riskflow-start.log'
"$(Get-Date -Format o) Starting RiskFlow CRM from $projectRoot" | Set-Content -Path $logPath -Encoding ASCII

if (-not (Test-Path (Join-Path $projectRoot 'node_modules'))) {
  "$(Get-Date -Format o) node_modules missing; running npm install" | Add-Content -Path $logPath -Encoding ASCII
  npm install
  if ($LASTEXITCODE -ne 0) {
    "$(Get-Date -Format o) npm install failed with exit code $LASTEXITCODE" | Add-Content -Path $logPath -Encoding ASCII
    exit $LASTEXITCODE
  }
}

$viteCache = Join-Path $projectRoot 'node_modules\.vite'
$packageLock = Join-Path $projectRoot 'package-lock.json'
$cacheStamp = Join-Path $viteCache '.riskflow-cache-stamp'
if (Test-Path $viteCache) {
  $packageStamp = if (Test-Path $packageLock) { (Get-Item $packageLock).LastWriteTimeUtc.Ticks } else { 0 }
  $previousStamp = if (Test-Path $cacheStamp) { Get-Content $cacheStamp -ErrorAction SilentlyContinue } else { '' }
  if ([string]$packageStamp -ne [string]$previousStamp) {
    Remove-Item -LiteralPath $viteCache -Recurse -Force -ErrorAction SilentlyContinue
  }
}

$appUrl = 'http://127.0.0.1:5173/'
$serverReady = $false
try {
  Invoke-WebRequest -Uri $appUrl -UseBasicParsing -TimeoutSec 1 | Out-Null
  $serverReady = $true
} catch {
  $serverReady = $false
}

if (-not $serverReady) {
  New-Item -ItemType Directory -Force -Path $viteCache | Out-Null
  $packageStamp = if (Test-Path $packageLock) { (Get-Item $packageLock).LastWriteTimeUtc.Ticks } else { 0 }
  Set-Content -Path $cacheStamp -Value $packageStamp -Encoding ASCII
  Start-Process -FilePath 'npm.cmd' `
    -ArgumentList @('run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173', '--strictPort') `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden
  "$(Get-Date -Format o) Started Vite server process" | Add-Content -Path $logPath -Encoding ASCII
}

for ($i = 0; $i -lt 120; $i++) {
  try {
    Invoke-WebRequest -Uri $appUrl -UseBasicParsing -TimeoutSec 1 | Out-Null
    $serverReady = $true
    "$(Get-Date -Format o) App reachable at $appUrl" | Add-Content -Path $logPath -Encoding ASCII
    break
  } catch {
    Start-Sleep -Milliseconds 500
  }
}

if (-not $serverReady) {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show("RiskFlow CRM could not start on http://127.0.0.1:5173/. Close any old RiskFlow windows and run Riskflow.bat again.", "RiskFlow CRM")
  "$(Get-Date -Format o) App failed to become reachable" | Add-Content -Path $logPath -Encoding ASCII
  exit 1
}

function Open-RiskFlowWindow {
  param([string]$Url)

  $browserCandidates = @(
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe"
  )

  foreach ($browser in $browserCandidates) {
    if (Test-Path $browser) {
      "$(Get-Date -Format o) Opening browser: $browser $Url" | Add-Content -Path $logPath -Encoding ASCII
      Start-Process -FilePath $browser -ArgumentList @('--new-window', $Url)
      return
    }
  }

  "$(Get-Date -Format o) Opening default browser: $Url" | Add-Content -Path $logPath -Encoding ASCII
  Start-Process $Url
}

Open-RiskFlowWindow -Url $appUrl
