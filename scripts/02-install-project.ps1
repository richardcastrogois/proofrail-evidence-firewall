param(
    [string]$Distro = "Ubuntu"
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "wsl-common.ps1")
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$WslRoot = ConvertTo-WslPath -WindowsPath $ProjectRoot -Distro $Distro

Write-Host "Instalando dependencias Node dentro do WSL..." -ForegroundColor Cyan
wsl -d $Distro -- bash -lc "source ~/.nvm/nvm.sh && cd '$WslRoot' && npm ci"
