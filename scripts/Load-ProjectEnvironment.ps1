[CmdletBinding()]
param()

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $scriptDirectory '..'))
$environmentFile = Join-Path $projectRoot '.env.local'

if (-not (Test-Path -LiteralPath $environmentFile -PathType Leaf)) {
    Write-Error "Project environment file was not found: $environmentFile"
    $global:LASTEXITCODE = 1
    return
}

foreach ($rawLine in [System.IO.File]::ReadAllLines($environmentFile)) {
    $line = $rawLine.Trim()

    if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith('#')) {
        continue
    }

    if ($line.StartsWith('export ')) {
        $line = $line.Substring(7).TrimStart()
    }

    $separatorIndex = $line.IndexOf('=')
    if ($separatorIndex -lt 1) {
        continue
    }

    $name = $line.Substring(0, $separatorIndex).Trim()
    if ($name -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
        continue
    }

    $value = $line.Substring($separatorIndex + 1).Trim()
    if ($value.Length -ge 2) {
        $firstCharacter = $value.Substring(0, 1)
        $lastCharacter = $value.Substring($value.Length - 1, 1)
        if (($firstCharacter -eq '"' -and $lastCharacter -eq '"') -or
            ($firstCharacter -eq "'" -and $lastCharacter -eq "'")) {
            $value = $value.Substring(1, $value.Length - 2)
        }
    }

    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
}

if ([string]::IsNullOrWhiteSpace($env:GITHUB_TOKEN)) {
    Write-Error 'GITHUB_TOKEN is unavailable or empty. Its value was not displayed.'
    $global:LASTEXITCODE = 1
    return
}

$requiredRepositoryVariables = @(
    'GITHUB_REPO',
    'GITHUB_OWNER',
    'GITHUB_REPO_NAME',
    'GITHUB_DEFAULT_BRANCH',
    'GITHUB_API_URL'
)

$missingVariables = @(
    foreach ($variableName in $requiredRepositoryVariables) {
        $variableValue = [Environment]::GetEnvironmentVariable($variableName, 'Process')
        if ([string]::IsNullOrWhiteSpace($variableValue)) {
            $variableName
        }
    }
)

if ($missingVariables.Count -gt 0) {
    Write-Error "Missing required project settings: $($missingVariables -join ', ')"
    $global:LASTEXITCODE = 1
    return
}

$result = [pscustomobject]@{
    Success        = $true
    TokenAvailable = $true
    Repository     = $env:GITHUB_REPO
    Owner          = $env:GITHUB_OWNER
    RepositoryName = $env:GITHUB_REPO_NAME
    DefaultBranch  = $env:GITHUB_DEFAULT_BRANCH
    ApiUrl         = $env:GITHUB_API_URL
    ProjectRoot    = $projectRoot
}

Write-Host 'Project environment loaded successfully.'
Write-Host 'GitHub token: available (value hidden).'
Write-Host "Repository: $($result.Repository)"
Write-Host "Default branch: $($result.DefaultBranch)"
Write-Host "GitHub API: $($result.ApiUrl)"

$global:LASTEXITCODE = 0
return $result
