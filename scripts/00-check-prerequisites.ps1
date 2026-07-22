param(
    [ValidateSet("Local", "Midnight")]
    [string]$Mode = "Local",
    [string]$Distro = "Ubuntu"
)

$ErrorActionPreference = "Continue"
$script:Failures = 0
$ExpectedCompactCompiler = "0.31.1"

Write-Host "`n=== Proofrail: verificacao do ambiente ($Mode) ===" -ForegroundColor Cyan

function Write-CheckResult {
    param(
        [bool]$Success,
        [string]$Name,
        [string]$Details = ""
    )

    $suffix = if ($Details) { ": $Details" } else { "" }

    if ($Success) {
        Write-Host "[OK] ${Name}${suffix}" -ForegroundColor Green
    } else {
        Write-Host "[AUSENTE/INVALIDO] ${Name}${suffix}" -ForegroundColor Yellow
        $script:Failures++
    }
}

function Test-WindowsCommand {
    param(
        [string]$Name,
        [string]$Command
    )

    $found = Get-Command $Command -ErrorAction SilentlyContinue
    $details = if ($found) { $found.Source } else { "comando '$Command' nao encontrado" }
    Write-CheckResult ([bool]$found) $Name $details
    return [bool]$found
}

function Invoke-WslCheck {
    param([string]$Command)

    $output = @(& wsl.exe -d $Distro -- bash -lc $Command 2>&1)
    return [pscustomobject]@{
        Success = ($LASTEXITCODE -eq 0)
        Output = ($output -join "`n").Trim()
    }
}

$hasWsl = Test-WindowsCommand "WSL" "wsl.exe"
$hasCode = Test-WindowsCommand "VS Code" "code"

if ($hasWsl) {
    $wslList = ((@(& wsl.exe --list --verbose 2>$null) -join "`n") -replace "`0", "")
    $distroPattern = "(?m)^\s*\*?\s*" + [regex]::Escape($Distro) + "\s+.*?\s+(\d+)\s*$"
    $distroMatch = [regex]::Match($wslList, $distroPattern)
    $distroInstalled = $distroMatch.Success
    $distroDetails = if ($distroInstalled) { "instalada" } else { "execute wsl --install -d $Distro" }
    Write-CheckResult $distroInstalled "Distribuicao WSL '$Distro'" $distroDetails

    if ($distroInstalled) {
        $wslVersion = [int]$distroMatch.Groups[1].Value
        Write-CheckResult ($wslVersion -eq 2) "WSL 2 para '$Distro'" "versao $wslVersion"

        $node = Invoke-WslCheck 'source ~/.nvm/nvm.sh 2>/dev/null || true; node --version'
        $nodeMajor = 0
        if ($node.Output -match '^v(\d+)') {
            $nodeMajor = [int]$Matches[1]
        }
        $nodeDetails = if ($node.Output) { $node.Output } else { "requer 22 ou superior" }
        Write-CheckResult ($node.Success -and $nodeMajor -ge 22) "Node.js no WSL" $nodeDetails

        $npm = Invoke-WslCheck 'source ~/.nvm/nvm.sh 2>/dev/null || true; npm --version'
        Write-CheckResult $npm.Success "npm no WSL" $npm.Output

        if ($Mode -eq "Midnight") {
            foreach ($tool in @("git", "curl")) {
                $result = Invoke-WslCheck "command -v $tool"
                Write-CheckResult $result.Success "$tool no WSL" $result.Output
            }

            $compact = Invoke-WslCheck 'source ~/.local/bin/env 2>/dev/null || true; compact --version && compact compile --version'
            Write-CheckResult ($compact.Success -and $compact.Output.Contains($ExpectedCompactCompiler)) "Compact e compilador $ExpectedCompactCompiler" $compact.Output

            $dockerCli = Invoke-WslCheck 'command -v docker'
            Write-CheckResult $dockerCli.Success "Docker CLI no WSL" $dockerCli.Output

            $dockerEngine = Invoke-WslCheck 'docker info >/dev/null 2>&1'
            Write-CheckResult $dockerEngine.Success "Docker Engine acessivel no WSL" "abra o Docker Desktop e ative a integracao WSL"

            $compose = Invoke-WslCheck 'docker compose version'
            Write-CheckResult $compose.Success "Docker Compose v2" $compose.Output
        }
    }
}

if ($hasCode) {
    $extensions = @(& code --list-extensions 2>$null)
    $hasWslExtension = $extensions -contains "ms-vscode-remote.remote-wsl"
    Write-CheckResult $hasWslExtension "Extensao WSL do VS Code" "ms-vscode-remote.remote-wsl"
}

if ($Mode -eq "Midnight") {
    Test-WindowsCommand "Docker Desktop CLI" "docker" | Out-Null
}

if ($script:Failures -gt 0) {
    Write-Host "`nResultado: $($script:Failures) requisito(s) ausente(s) ou invalido(s)." -ForegroundColor Yellow
    exit 1
}

Write-Host "`nResultado: ambiente $Mode pronto." -ForegroundColor Green
