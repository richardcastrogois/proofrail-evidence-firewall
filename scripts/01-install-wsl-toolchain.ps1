param(
    [ValidateSet("Local", "Midnight")]
    [string]$Mode = "Local",
    [string]$Distro = "Ubuntu"
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "wsl-common.ps1")
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$WslRoot = ConvertTo-WslPath -WindowsPath $ProjectRoot -Distro $Distro
$WslScript = "$WslRoot/scripts/wsl-install-toolchain.sh"

Write-Host "Instalando ferramentas do modo $Mode dentro de $Distro..." -ForegroundColor Cyan
wsl -d $Distro -- bash "$WslScript" "$Mode"
