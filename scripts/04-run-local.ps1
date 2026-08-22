param(
    [string]$Distro = "Ubuntu"
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "wsl-common.ps1")
Assert-ProofrailPortsAvailable
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$WslRoot = ConvertTo-WslPath -WindowsPath $ProjectRoot -Distro $Distro

Write-Host "Iniciando Proofrail em modo local..." -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173"
Write-Host "API:      http://localhost:3333/api/health"
Write-Host ""

wsl -d $Distro -- bash -lc "source ~/.nvm/nvm.sh && cd '$WslRoot' && bash scripts/run-dev-ordered.sh local"
