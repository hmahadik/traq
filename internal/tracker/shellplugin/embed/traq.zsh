# Traq shell integration for zsh.

[[ -n "${__TRAQ_LOADED:-}" ]] && return 0
__TRAQ_LOADED=1

__traq_dir="${XDG_DATA_HOME:-$HOME/.local/share}/traq/shell"
__traq_marker="$__traq_dir/enabled"
__traq_log="$__traq_dir/history.log"
__traq_overflow="$__traq_dir/overflowed"
__traq_max_bytes=10485760

__traq_start=0

__traq_preexec() {
    __traq_cmd="$1"
    __traq_start=$EPOCHREALTIME
}

__traq_escape() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//$'\t'/\\t}"
    s="${s//$'\n'/\\n}"
    if (( ${#s} > 4000 )); then
        s="${s:0:4000}…"
    fi
    print -rn -- "$s"
}

__traq_precmd() {
    local exit_code=$?
    [[ -z "${__traq_cmd:-}" ]] && return
    [[ -f "$__traq_marker" ]] || { __traq_cmd=""; return; }

    if [[ -f "$__traq_log" ]]; then
        local size
        size=$(wc -c < "$__traq_log" 2>/dev/null | tr -d ' ')
        if [[ -n "$size" && "$size" -gt "$__traq_max_bytes" ]]; then
            : > "$__traq_overflow"
            __traq_cmd=""
            return
        fi
    fi

    local end duration_ms=0
    end=$EPOCHREALTIME
    duration_ms=$(awk -v s="$__traq_start" -v e="$end" 'BEGIN{printf "%.0f", (e - s) * 1000}')

    # Format: session:window_idx/window_name:pane_idx/pane_cmd
    # e.g. "main:2/logs:1/vim" or "0:0/zsh:0/zsh"
    local tmux_ctx="-"
    if [[ -n "${TMUX:-}" ]]; then
        local ctx
        ctx=$(tmux display-message -p '#S:#I/#W:#P/#{pane_current_command}' 2>/dev/null)
        [[ -n "$ctx" ]] && tmux_ctx="$ctx"
    fi

    local hostname
    hostname=$(hostname -s 2>/dev/null || echo "-")

    mkdir -p "$__traq_dir" 2>/dev/null
    printf '1\t%s\t%s\t%s\t%s\t%s\t%s\tzsh\t%s\n' \
        "$(date +%s)" "$exit_code" "$duration_ms" "$PWD" "$tmux_ctx" "$hostname" \
        "$(__traq_escape "$__traq_cmd")" \
        >> "$__traq_log"
    __traq_cmd=""
}

autoload -Uz add-zsh-hook
zmodload zsh/datetime 2>/dev/null
add-zsh-hook preexec __traq_preexec
add-zsh-hook precmd  __traq_precmd
