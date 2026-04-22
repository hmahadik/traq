# Shell Plugin Integration — Manual Verification Checklist

Run each item before merging `feat/shell-plugin-integration` into `master`.

1. **Bash + tmux on Ubuntu:** install via Settings → Data Sources → Shell History → Install plugin. Open two tmux panes, run different commands in each. Confirm both appear in Traq's Shell History within ~10 seconds and the tmux context column distinguishes the panes.
2. **Zsh on macOS:** same flow as above, selecting zsh as the shell type.
3. **Fish:** same flow with fish.
4. **PowerShell on Windows:** install, run a few commands in a fresh PowerShell session, verify capture.
5. **Upgrade path:** with Shell History already enabled via the file-reading code path, install the plugin. Run 3 distinct commands. Confirm no duplicates appear in Traq (spot-check by timestamp + command in the Shell History view).
6. **Uninstall:** `sha256sum ~/.bashrc` before install, install, uninstall, re-hash. Confirm byte-identical. Confirm `~/.local/share/traq/shell/plugin.bash` is gone.
7. **Toggle capture:** install, disable Shell History in Settings, run 5 commands, re-enable. Confirm those 5 commands are NOT captured (marker-gating works).
8. **Overflow:** disable Shell History but keep plugin installed, write more than 10 MB of junk to `~/.local/share/traq/shell/history.log` (loop `printf '1\t...\n' >> ...`), re-enable Shell History. Confirm the yellow "Shell log hit size limit" banner appears in Settings. Click Dismiss — banner disappears.

Any failure: file a follow-up issue and do not merge.
