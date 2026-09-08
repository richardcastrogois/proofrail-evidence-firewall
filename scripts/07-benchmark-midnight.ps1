param(
    [ValidateSet("Inventory", "ProofIdle", "Command")]
    [string]$Scenario = "Inventory",
    [ValidateSet("Unrestricted", "Micro", "Small", "Medium", "A1")]
    [string]$Profile = "Unrestricted",
    [ValidateRange(1, 86400)]
    [int]$DurationSeconds = 60,
    [ValidateRange(1, 86400)]
    [int]$TimeoutSeconds = 1200,
    [switch]$WithProofServer,
    [string]$Command,
    [string]$Distro = "Ubuntu"
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "wsl-common.ps1")

if ($Scenario -eq "Command" -and [string]::IsNullOrWhiteSpace($Command)) {
    throw "Scenario Command requires -Command."
}

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$WslRoot = ConvertTo-WslPath -WindowsPath $ProjectRoot -Distro $Distro
$ScenarioValue = $Scenario.ToLowerInvariant()
if ($ScenarioValue -eq "proofidle") {
    $ScenarioValue = "proof-idle"
}
$ProfileValue = $Profile.ToLowerInvariant()

$arguments = @(
    "-d", $Distro,
    "--", "bash", "$WslRoot/scripts/midnight-resource-benchmark.sh",
    "--scenario", $ScenarioValue,
    "--profile", $ProfileValue,
    "--duration-seconds", $DurationSeconds.ToString(),
    "--timeout-seconds", $TimeoutSeconds.ToString()
)
if ($WithProofServer) {
    $arguments += "--with-proof-server"
}
if ($Scenario -eq "Command") {
    $arguments += @("--", "bash", "-lc", "cd '$WslRoot/midnight-chain' && source ~/.nvm/nvm.sh && $Command")
}

Write-Host "Executando benchmark Midnight: $Scenario / $Profile" -ForegroundColor Cyan
& wsl.exe @arguments
if ($LASTEXITCODE -ne 0) {
    throw "Benchmark Midnight falhou com codigo $LASTEXITCODE. Consulte .tmp\midnight-benchmark."
}

Write-Host "Resultados: $ProjectRoot\.tmp\midnight-benchmark" -ForegroundColor Green
