# Traq shell integration for bash. Managed by Traq.
# Do not edit in place — reinstall via the Traq UI to update.

[[ -n "${__TRAQ_LOADED:-}" ]] && return 0
__TRAQ_LOADED=1

__traq_dir="${XDG_DATA_HOME:-$HOME/.local/share}/traq/shell"
__traq_marker="$__traq_dir/enabled"
__traq_log="$__traq_dir/history.log"
__traq_overflow="$__traq_dir/overflowed"
__traq_max_bytes=10485760  # 10 MiB

# Baseline history number. Set lazily on the first hook call because
# bash loads $HISTFILE into memory *after* rc files run, so snapshotting
# here would see an empty history and still log the stale last entry.
__traq_last_histnum=""

# Capture command start time via DEBUG trap (fires before each command).
# Using PS0 would print the timestamp to the terminal; DEBUG is silent.
__traq_preexec() {
    [[ -n "${COMP_LINE:-}" ]] && return
    [[ "$BASH_COMMAND" == "__traq_hook" ]] && return
    __traq_start="${EPOCHREALTIME:-$(date +%s)}"
}
trap '__traq_preexec' DEBUG

__traq_escape() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//$'\t'/\\t}"
    s="${s//$'\n'/\\n}"
    if [[ ${#s} -gt 4000 ]]; then
        s="${s:0:4000}…"
    fi
    printf '%s' "$s"
}

__traq_hook() {
    local exit_code=$?

    # Read the current history entry and its number.
    local hist_line hist_num cmd
    hist_line=$(HISTTIMEFORMAT= builtin history 1 2>/dev/null)
    hist_num=$(printf '%s' "$hist_line" | awk '{print $1}')
    cmd=$(printf '%s' "$hist_line" | sed 's/^ *[0-9]* *//')

    # First call: establish baseline without logging. HISTFILE is loaded
    # by now, so $hist_num reflects the last pre-existing history entry.
    if [[ -z "$__traq_last_histnum" ]]; then
        __traq_last_histnum="${hist_num:-0}"
        unset __traq_start
        return
    fi

    # Skip if the history number hasn't advanced.
    if [[ -z "$hist_num" || "$hist_num" == "$__traq_last_histnum" ]]; then
        unset __traq_start
        return
    fi
    __traq_last_histnum="$hist_num"

    [[ -f "$__traq_marker" ]] || { unset __traq_start; return; }
    [[ -z "$cmd" ]] && { unset __traq_start; return; }

    # Overflow check
    if [[ -f "$__traq_log" ]]; then
        local size
        size=$(wc -c < "$__traq_log" 2>/dev/null | tr -d ' ')
        if [[ -n "$size" && "$size" -gt "$__traq_max_bytes" ]]; then
            : > "$__traq_overflow"
            unset __traq_start
            return
        fi
    fi

    local ts
    ts=$(date +%s)

    local duration_ms=0
    if [[ -n "${__traq_start:-}" ]]; then
        local end now
        if [[ -n "${EPOCHREALTIME:-}" ]]; then
            end="$EPOCHREALTIME"
            duration_ms=$(awk -v s="$__traq_start" -v e="$end" 'BEGIN{printf "%.0f", (e - s) * 1000}')
        else
            now=$(date +%s)
            duration_ms=$(( (now - __traq_start) * 1000 ))
        fi
    fi

    local tmux_ctx="-"
    if [[ -n "${TMUX:-}" ]]; then
        local session window
        session=$(tmux display-message -p '#S' 2>/dev/null)
        window=$(tmux display-message -p '#I' 2>/dev/null)
        [[ -n "$session" && -n "$window" ]] && tmux_ctx="${session}:${window}"
    fi

    local hostname
    hostname=$(hostname -s 2>/dev/null || echo "-")

    mkdir -p "$__traq_dir" 2>/dev/null
    printf '1\t%s\t%s\t%s\t%s\t%s\t%s\tbash\t%s\n' \
        "$ts" "$exit_code" "$duration_ms" "$PWD" "$tmux_ctx" "$hostname" \
        "$(__traq_escape "$cmd")" \
        >> "$__traq_log"

    unset __traq_start
}

# Prepend to PROMPT_COMMAND so we run first (and don't clobber existing hooks).
case "${PROMPT_COMMAND:-}" in
    *"__traq_hook"*) ;;
    "") PROMPT_COMMAND="__traq_hook" ;;
    *) PROMPT_COMMAND="__traq_hook; $PROMPT_COMMAND" ;;
esac
