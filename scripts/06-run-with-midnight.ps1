param(
    [string]$Distro = "Ubuntu"
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "wsl-common.ps1")
Assert-ProofrailPortsAvailable
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$WslRoot = ConvertTo-WslPath -WindowsPath $ProjectRoot -Distro $Distro
$WslChain = "$WslRoot/midnight-chain"

if (-not (Test-Path (Join-Path $ProjectRoot "midnight-chain\.midnight-state.json"))) {
    throw "Contrato Midnight nao implantado. Execute scripts\05-scaffold-midnight.ps1 primeiro."
}

Write-Host "Iniciando Proofrail com ancora na rede Midnight selecionada..." -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173"
Write-Host "API:      http://localhost:3333/api/health"
Write-Host ""

wsl -d $Distro -- bash -lc "source ~/.nvm/nvm.sh && cd '$WslRoot' && bash scripts/run-dev-ordered.sh cli '$WslChain'"
