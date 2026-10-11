# Security

Omavoice runs unsandboxed inside `omarchy-shell`, like every Omarchy plugin.

It:

- Starts a user `pipewire -c` client from a **0600** config under `$XDG_RUNTIME_DIR/omavoice/host.<pid>.conf`, removed when the host stops. `--target` must be a PipeWire `node.name` matching `[A-Za-z0-9._:-]+`.
- Runs that client as a transient `systemd --user` service `omavoice-host-<pid>.service` (`systemd-run --user`), so it gets the session's realtime limits. A start stops leftover `omavoice-host-*` units. Without systemd it runs the client directly.
- Leftover `omavoice*` nodes are destroyed with `pw-cli` as a fixed argv
  and a non-negative integer id from `pw-dump`. IDs are not interpolated
  into a shell.
- Loads `libdpdfnet_ladspa.so` and `libonnxruntime.so` from `~/.local/share/omavoice/dpdfnet` (else HushMic's system install) into that client. These are prebuilt binaries from HushMic; keep that folder user-owned.
- While the panel is open, starts a silent `pw-cat` capture of `omavoice` so the After meter can move. That hold is named `omavoice.meter.hold` and stops when the panel closes.
- Calls `omarchy-audio-input-set-default` to make `omavoice` the default mic, and restores the pinned capture (else `previousAudioSource`) when disabled while the default is still `omavoice`. It never stores `omavoice` as that previous source.
- Reads PipeWire node names already visible to the session.
- Uses the network only for **Download DPDFNet** (`scripts/omavoice-fetch`): one pinned HushMic release from GitHub over HTTPS, checked against a fixed sha256.
- Does not run as root. **Install rtkit** (`scripts/omavoice-rtkit`) opens a terminal where you run `sudo pacman -S rtkit` yourself, then restarts your user's `xdg-desktop-portal` service.

Review `Service.qml` and `scripts/omavoice-run` before enabling it.

## Reporting a problem

Report anything that could let other programs or users abuse Omavoice privately, through GitHub's [security advisories](https://github.com/heast13/omarchy-omavoice-dpdfnet/security/advisories/new), not as a public issue. Problems with upstream Omavoice itself belong to [gigasolo/omavoice](https://github.com/gigasolo/omavoice).
