param([string]$RepoRoot = ".")
$ErrorActionPreference = "Continue"
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
node (Join-Path $ScriptRoot "discover-upstream.mjs") $RepoRoot
$upstreamExit = $LASTEXITCODE
node (Join-Path $ScriptRoot "audit-original-promotion.mjs") $RepoRoot
$auditExit = $LASTEXITCODE
Write-Host "Upstream discovery exit: $upstreamExit"
Write-Host "Promotion audit exit: $auditExit (1 means matches require review)"
exit 0
