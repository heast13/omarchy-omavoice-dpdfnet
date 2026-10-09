# Security

Omavoice runs unsandboxed inside `omarchy-shell`, like every Omarchy plugin.

It:

- Starts a user `pipewire -c` client from a **0600** config under `$XDG_RUNTIME_DIR/omavoice/host.<pid>.conf`. `--target` must be a PipeWire `node.name` matching `[A-Za-z0-9._:-]+`.
- Leftover `omavoice*` nodes are destroyed with `pw-cli` as a fixed argv
  and a non-negative integer id from `pw-dump`. IDs are not interpolated
  into a shell.
- Loads `libdpdfnet_ladspa.so` and `libonnxruntime.so` from `~/.local/share/omavoice/dpdfnet` (else HushMic's system install) into that client. These are prebuilt binaries from HushMic; keep that folder user-owned.
- While the panel is open, starts a silent `pw-cat` capture of `omavoice` so the After meter can move. That hold is named `omavoice.meter.hold` and stops when the panel closes.
- Calls `omarchy-audio-input-set-default` to make `omavoice` the default mic, and restores the pinned capture (else `previousAudioSource`) when disabled. It never stores `omavoice` as that previous source.
- Reads PipeWire node names already visible to the session.
- Does not use the network.
- Does not run as root.

Review `Service.qml` and `scripts/omavoice-run` before enabling it.
