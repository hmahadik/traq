# Traq shell integration for fish.

if set -q __TRAQ_LOADED
    return
end
set -g __TRAQ_LOADED 1

set -g __traq_dir (test -n "$XDG_DATA_HOME"; and echo "$XDG_DATA_HOME/traq/shell"; or echo "$HOME/.local/share/traq/shell")
set -g __traq_marker "$__traq_dir/enabled"
set -g __traq_log "$__traq_dir/history.log"
set -g __traq_overflow "$__traq_dir/overflowed"
set -g __traq_max_bytes 10485760

function __traq_preexec --on-event fish_preexec
    set -g __traq_cmd $argv[1]
    set -g __traq_start (date +%s%N)
end

function __traq_postexec --on-event fish_postexec
    set -l exit_code $status
    test -f $__traq_marker; or return

    if test -f $__traq_log
        set -l size (wc -c < $__traq_log 2>/dev/null | string trim)
        if test -n "$size"; and test $size -gt $__traq_max_bytes
            touch $__traq_overflow
            return
        end
    end

    set -l duration_ms 0
    if set -q __traq_start
        set -l end (date +%s%N)
        set duration_ms (math "($end - $__traq_start) / 1000000")
    end

    # Format: session:window_idx/window_name:pane_idx/pane_cmd
    # e.g. "main:2/logs:1/vim" or "0:0/fish:0/fish"
    set -l tmux_ctx "-"
    if set -q TMUX
        set -l ctx (tmux display-message -p '#S:#I/#W:#P/#{pane_current_command}' 2>/dev/null)
        test -n "$ctx"; and set tmux_ctx "$ctx"
    end

    set -l hostname (hostname -s 2>/dev/null; or echo "-")

    # Escape: \ -> \\, then tab -> \t, newline -> \n
    set -l cmd $__traq_cmd
    set cmd (string replace -a '\\' '\\\\' -- $cmd)
    set cmd (string replace -a \t '\\t' -- $cmd)
    set cmd (string replace -a \n '\\n' -- $cmd)
    if test (string length -- $cmd) -gt 4000
        set cmd (string sub -l 4000 -- $cmd)"…"
    end

    mkdir -p $__traq_dir
    printf '1\t%s\t%s\t%s\t%s\t%s\t%s\tfish\t%s\n' \
        (date +%s) $exit_code $duration_ms $PWD $tmux_ctx $hostname $cmd \
        >> $__traq_log
end
