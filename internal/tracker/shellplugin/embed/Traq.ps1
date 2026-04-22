# Traq shell integration for PowerShell.

if ($global:__TRAQ_LOADED) { return }
$global:__TRAQ_LOADED = $true

$script:__traq_dir = if ($env:XDG_DATA_HOME) {
    Join-Path $env:XDG_DATA_HOME 'traq\shell'
} else {
    Join-Path $env:APPDATA 'traq\shell'
}
$script:__traq_marker  = Join-Path $__traq_dir 'enabled'
$script:__traq_log     = Join-Path $__traq_dir 'history.log'
$script:__traq_overflow = Join-Path $__traq_dir 'overflowed'
$script:__traq_max_bytes = 10485760
$script:__traq_start = 0
$script:__traq_cmd = $null

function __Traq-PreInvoke {
    param($Command)
    $script:__traq_cmd = $Command
    $script:__traq_start = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
}

function __Traq-Escape([string]$s) {
    $s = $s -replace '\\', '\\'
    $s = $s -replace "`t", '\t'
    $s = $s -replace "`n", '\n'
    if ($s.Length -gt 4000) { $s = $s.Substring(0, 4000) + '…' }
    return $s
}

function __Traq-Record {
    param([int]$ExitCode)
    if (-not (Test-Path $script:__traq_marker)) { return }

    if (Test-Path $script:__traq_log) {
        $size = (Get-Item $script:__traq_log).Length
        if ($size -gt $script:__traq_max_bytes) {
            New-Item -Path $script:__traq_overflow -ItemType File -Force | Out-Null
            return
        }
    }

    $end = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $durationMs = if ($script:__traq_start) { $end - $script:__traq_start } else { 0 }

    $tmuxCtx = '-'
    if ($env:TMUX) {
        $s = (tmux display-message -p '#S') 2>$null
        $w = (tmux display-message -p '#I') 2>$null
        if ($s -and $w) { $tmuxCtx = "${s}:${w}" }
    }

    $hostName = try { [System.Net.Dns]::GetHostName() } catch { '-' }
    $cwd = (Get-Location).Path
    $ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $cmdEscaped = __Traq-Escape $script:__traq_cmd

    if (-not (Test-Path $script:__traq_dir)) {
        New-Item -Path $script:__traq_dir -ItemType Directory -Force | Out-Null
    }
    $line = "1`t${ts}`t${ExitCode}`t${durationMs}`t${cwd}`t${tmuxCtx}`t${hostName}`tpowershell`t${cmdEscaped}"
    Add-Content -Path $script:__traq_log -Value $line -Encoding UTF8
}

# Hook via prompt function override (simplest cross-version approach).
$__traq_prompt_original = (Get-Item function:prompt).ScriptBlock
function global:prompt {
    $ec = $LASTEXITCODE
    if ($script:__traq_cmd) {
        __Traq-Record -ExitCode ([int]($ec -is [int] ? $ec : 0))
        $script:__traq_cmd = $null
    }
    $hist = Get-History -Count 1
    if ($hist) {
        __Traq-PreInvoke $hist.CommandLine
    }
    & $__traq_prompt_original
}
