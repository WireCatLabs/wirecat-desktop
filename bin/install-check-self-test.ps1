# bin/install-check-self-test for Windows: the installed app's self-test, first with no Node.js, so the app sets up
# its own, then with the runner's. It renames node.exe, so run it only on a machine that is thrown away afterwards.
# Usage: pwsh bin/install-check-self-test.ps1 <app exe> <out dir> [tool]
param(
  [Parameter(Mandatory)] [string] $App,
  [Parameter(Mandatory)] [string] $Out,
  [string] $Tool = "whatsapp"
)
$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force $Out | Out-Null
$failed = $false

function Invoke-SelfTest([string] $Name, [string] $Source, [string[]] $Extra) {
  $root = Join-Path $env:RUNNER_TEMP "self-test-$Name"
  $saved = @{}
  # The app reads the profile folders from these; a new set per run keeps the two runs apart.
  $folders = @{
    USERPROFILE  = $root
    APPDATA      = Join-Path $root "AppData\Roaming"
    LOCALAPPDATA = Join-Path $root "AppData\Local"
  }
  foreach ($var in $folders.Keys) {
    New-Item -ItemType Directory -Force $folders[$var] | Out-Null
    $saved[$var] = [Environment]::GetEnvironmentVariable($var)
    [Environment]::SetEnvironmentVariable($var, $folders[$var])
  }
  [Environment]::SetEnvironmentVariable("WIRECAT_SELF_TEST", "1")
  $json = Join-Path $Out "$Name.json"
  $log = Join-Path $Out "$Name.log"
  try {
    # The app is a GUI program: only a redirect gives it a stdout, and -Wait waits for it to exit.
    $p = Start-Process $App -ArgumentList (@("--self-test", "install-tool", $Tool) + $Extra) -NoNewWindow -Wait `
      -PassThru -RedirectStandardOutput $json -RedirectStandardError $log
  } finally {
    foreach ($var in $saved.Keys) { [Environment]::SetEnvironmentVariable($var, $saved[$var]) }
    [Environment]::SetEnvironmentVariable("WIRECAT_SELF_TEST", $null)
  }
  Write-Output "$Name (exit $($p.ExitCode)):"
  Get-Content $json
  $line = $null
  try { $line = Get-Content $json -Raw | ConvertFrom-Json } catch { }
  if (-not $line -or -not $line.ok -or $line.node.source -ne $Source) {
    $why = if ($line.failure) { "$($line.failure.step): $($line.failure.message) $($line.failure.hint)" }
      elseif ($line) { "Node.js came from $($line.node.source)" } else { "no JSON line" }
    Write-Output "::error::Self-test $Name (Node.js expected from $Source): $why"
    Get-Content $log -Tail 40 -ErrorAction SilentlyContinue
    $script:failed = $true
  }
}

$hidden = @()
$dirs = @($env:Path -split ";") + @(Join-Path $env:ProgramFiles "nodejs") | Where-Object { $_ }
foreach ($dir in $dirs) {
  $node = Join-Path $dir "node.exe"
  if (Test-Path -LiteralPath $node) {
    Write-Output "Hiding $node"
    Rename-Item -LiteralPath $node "node.exe.hidden"
    $hidden += $node
  }
}
try {
  Invoke-SelfTest "own-node" "own" @("--own-node")
} finally {
  foreach ($node in $hidden) { Rename-Item -LiteralPath "$node.hidden" "node.exe" }
}
if (Get-Command node -ErrorAction SilentlyContinue) {
  Invoke-SelfTest "system-node" "system" @()
} else {
  Write-Output "::notice::No Node.js on this machine, so the self-test ran only with WireCat's own."
}
if ($failed) { exit 1 }
