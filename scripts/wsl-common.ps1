function ConvertTo-WslPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$WindowsPath,
        [Parameter(Mandatory = $true)]
        [string]$Distro
    )

    # Backslashes can be consumed while wsl.exe forwards arguments to Linux.
    # wslpath accepts the Windows drive syntax with forward slashes intact.
    $normalizedPath = $WindowsPath.Replace("\", "/")
    if ($normalizedPath.Contains("'")) {
        throw "O caminho do projeto nao pode conter apostrofo: '$WindowsPath'."
    }

    # Some current WSL builds fail with WSL_E_DISTRO_NOT_FOUND when wslpath is
    # invoked directly after `--`. Running it through bash is reliable and is
    # also consistent with every other project script.
    $command = "wslpath -a -u '$normalizedPath'"
    # Prefer the Windows system binary explicitly. Some machines also expose a
    # Microsoft Store shim earlier in PATH; that shim intermittently reports
    # WSL_E_DISTRO_NOT_FOUND even while the distro is running.
    $wslExe = Join-Path $env:WINDIR "System32\wsl.exe"
    $output = @(& $wslExe -d $Distro -- bash -lc $command 2>&1)

    if ($LASTEXITCODE -ne 0) {
        if ($normalizedPath -match '^([A-Za-z]):/(.*)$') {
            $drive = $Matches[1].ToLowerInvariant()
            $relativePath = $Matches[2]
            return "/mnt/$drive/$relativePath"
        }
        throw "Nao foi possivel converter '$WindowsPath' para um caminho WSL em '$Distro'. $($output -join ' ')"
    }

    $convertedPath = ($output | Select-Object -Last 1).ToString().Trim()

    if ([string]::IsNullOrWhiteSpace($convertedPath)) {
        throw "wslpath nao retornou um caminho para '$WindowsPath' em '$Distro'."
    }

    return $convertedPath
}

function Assert-ProofrailPortsAvailable {
    $requiredPorts = @(3333, 5173)
    $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $_.LocalPort -in $requiredPorts })

    if ($listeners.Count -gt 0) {
        $busy = ($listeners | Select-Object -ExpandProperty LocalPort -Unique | Sort-Object) -join ", "
        throw "O Proofrail ja esta rodando nas portas $busy. Volte ao terminal que o iniciou e pressione Ctrl+C antes de iniciar outra copia."
    }
}
