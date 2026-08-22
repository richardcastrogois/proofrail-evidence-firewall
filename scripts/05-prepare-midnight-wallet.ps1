param(
    [string]$Distro = "Ubuntu",
    [Parameter(Mandatory = $true)]
    [ValidateSet("preview", "preprod")]
    [string]$Network
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "wsl-common.ps1")
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$WslRoot = ConvertTo-WslPath -WindowsPath $ProjectRoot -Distro $Distro
$WslChain = "$WslRoot/midnight-chain"

if (-not (Test-Path (Join-Path $ProjectRoot "midnight-chain\package.json"))) {
    throw "midnight-chain nao existe. Implante primeiro a Devnet local com scripts\05-scaffold-midnight.ps1."
}

Write-Host "Preparando carteira publica '$Network' sem aguardar sincronizacao..." -ForegroundColor Cyan
wsl -d $Distro -- bash -lc "source ~/.nvm/nvm.sh && cd '$WslChain' && npm run prepare-wallet -- --network '$Network'"
if ($LASTEXITCODE -ne 0) {
    throw "Falha ao preparar a carteira publica da rede '$Network'. Confirme o WSL e veja o erro acima."
}
