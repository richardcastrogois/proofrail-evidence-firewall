param(
    [string]$Distro = "Ubuntu",
    [ValidateSet("undeployed", "preview", "preprod")]
    [string]$Network = "undeployed"
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "wsl-common.ps1")
$CreateMnAppVersion = "0.4.3"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ChainRoot = Join-Path $ProjectRoot "midnight-chain"
$WslRoot = ConvertTo-WslPath -WindowsPath $ProjectRoot -Distro $Distro
$WslChain = "$WslRoot/midnight-chain"

if (-not (Test-Path $ChainRoot)) {
    Write-Host "Criando scaffold oficial Midnight com create-mn-app $CreateMnAppVersion..." -ForegroundColor Cyan
    wsl -d $Distro -- bash -lc "source ~/.nvm/nvm.sh && cd '$WslRoot' && npx --yes create-mn-app@$CreateMnAppVersion midnight-chain --template hello-world --use-npm --skip-git -y"
} else {
    Write-Host "midnight-chain ja existe; mantendo o projeto." -ForegroundColor Yellow
}

$ContractTarget = Join-Path $ChainRoot "contracts\hello-world.compact"
$CliTarget = Join-Path $ChainRoot "src\cli.ts"
$DeployTarget = Join-Path $ChainRoot "src\deploy.ts"
$NetworkTarget = Join-Path $ChainRoot "src\network.ts"
$SetupTarget = Join-Path $ChainRoot "src\setup.ts"
$CheckBalanceTarget = Join-Path $ChainRoot "src\check-balance.ts"
$E2eTarget = Join-Path $ChainRoot "scripts\e2e-check.ts"
$ComposeOverrideTarget = Join-Path $ChainRoot "docker-compose.override.yml"

if (-not (Test-Path (Split-Path -Parent $ContractTarget))) {
    throw "Scaffold incompativel: pasta contracts nao encontrada. Confirme create-mn-app $CreateMnAppVersion."
}

if (-not (Test-Path (Split-Path -Parent $CliTarget))) {
    throw "Scaffold incompativel: pasta src nao encontrada. Confirme create-mn-app $CreateMnAppVersion."
}

Copy-Item `
    (Join-Path $ProjectRoot "midnight\contract\hello-world.compact") `
    $ContractTarget `
    -Force

Copy-Item `
    (Join-Path $ProjectRoot "midnight\overrides\cli.ts") `
    $CliTarget `
    -Force

Copy-Item `
    (Join-Path $ProjectRoot "midnight\overrides\deploy.ts") `
    $DeployTarget `
    -Force

Copy-Item `
    (Join-Path $ProjectRoot "midnight\overrides\network.ts") `
    $NetworkTarget `
    -Force

Copy-Item `
    (Join-Path $ProjectRoot "midnight\overrides\setup.ts") `
    $SetupTarget `
    -Force

Copy-Item `
    (Join-Path $ProjectRoot "midnight\overrides\check-balance.ts") `
    $CheckBalanceTarget `
    -Force

Copy-Item `
    (Join-Path $ProjectRoot "midnight\overrides\e2e-check.ts") `
    $E2eTarget `
    -Force

Copy-Item `
    (Join-Path $ProjectRoot "midnight\docker-compose.override.yml") `
    $ComposeOverrideTarget `
    -Force

$SetupCommand = "npm run setup -- --network $Network"

Write-Host "Compilando e implantando na rede Midnight '$Network'..." -ForegroundColor Cyan
wsl -d $Distro -- bash -lc "source ~/.nvm/nvm.sh && cd '$WslChain' && $SetupCommand"
if ($LASTEXITCODE -ne 0) {
    throw "Falha ao compilar ou implantar na rede Midnight '$Network'. Veja o erro acima."
}

Write-Host "`nContrato implantado. Consulte:" -ForegroundColor Green
Write-Host "$ChainRoot\.midnight-state.json"
