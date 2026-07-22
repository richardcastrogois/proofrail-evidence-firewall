param(
    [string]$Distro = "Ubuntu"
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "wsl-common.ps1")
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$WslRoot = ConvertTo-WslPath -WindowsPath $ProjectRoot -Distro $Distro

wsl -d $Distro -- bash -lc "cd '$WslRoot' && code proofrail.code-workspace"
