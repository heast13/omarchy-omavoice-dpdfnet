# Omavoice

<p align="center">
  <img src="docs/omavoice.svg" alt="Omavoice — your voice, better heard" width="720">
</p>

<p align="center">
  <strong>Your voice, better heard.</strong><br>
  A virtual microphone with DPDFNet noise suppression. One source. Two presets. Noise stays on this side of the recording.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-22c55e?style=flat-square" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/omarchy-4%20Quattro-0ea5e9?style=flat-square" alt="Omarchy 4 Quattro">
  <img src="https://img.shields.io/badge/pipewire-filter--chain-a3e635?style=flat-square" alt="PipeWire filter-chain">
  <img src="https://img.shields.io/badge/version-0.3.2-111827?style=flat-square" alt="Version 0.3.2">
</p>

> [!NOTE]
> Local build (`0.3.2-dpdfnet.2`): Meeting, echo cancel, RNNoise, DeepFilterNet and the engine picker are removed. Podcast always runs DPDFNet. The screenshots still show the upstream 0.3.2 panel.

Pick **Omavoice** in OBS, a browser, or a call app. The plugin sits under those apps as a PipeWire source, so you do not configure each one. USB mics attach themselves when you plug them in.

An independent [MIT](LICENSE)-licensed plugin by [GigaSolo](https://github.com/gigasolo) for [Omarchy](https://omarchy.org/) 4 (Quattro). Not affiliated with or endorsed by 37signals.

---

## Modes

| | Podcast | Clean |
| --- | --- | --- |
| **For** | OBS, interviews, calls, local record | Program mixes, music beds |
| **Does** | High-pass + DPDFNet + voice EQ + compressor | High-pass only |
| **Keeps** | Speech that sounds finished | Applause, keys, and music |

Right-click the mark to toggle. Open the panel to switch the mode and pick a microphone. The selected mic row shows a live level and a hairline of what Omavoice is sending. Other rows stay quiet so a Bluetooth headset is not grabbed. MODE settings set a Voice look (Neutral / Warm / Clear / Bright) with Body / Presence / Air knobs, and the Denoise strength. On Clean, Voice is visible and disabled.

In the app itself, choose **Omavoice** as the microphone and turn *its* noise cancellation off. Two denoisers stacked sound hollow.

## DPDFNet

DPDFNet (Ceva, a DeepFilterNet2 descendant) runs as a LADSPA plugin. Omavoice loads these files from `~/.local/share/omavoice/dpdfnet/`:

```
libdpdfnet_ladspa.so            # plugin, from HushMic
dpdfnet8_48khz_hr.onnx          # model
dpdfnet8_48khz_hr.weights.f32   # optional: faster native engine
libonnxruntime.so               # ONNX Runtime the plugin was built against
```

If that folder is incomplete, Omavoice falls back to a system install of `hushmic-bin`. Without either, Podcast skips denoise and the compressor (high-pass and voice EQ stay) and the panel says **DPDFNet missing**. Copy the files, then click **reload**.

Softer / Balanced / Stronger cap the suppression at 24 / 48 / 100 dB. DPDFNet adds about 40 ms of latency.

## Install

From a local checkout:

```sh
omarchy plugin add "$PWD" --enable
```

Do not symlink the checkout into `~/.config/omarchy/plugins` — Omarchy refuses plugins that contain symlinks.

> [!IMPORTANT]
> Plugins run as unsandboxed code inside `omarchy-shell`. Only add repos you trust.

## Use

| Action | How |
| --- | --- |
| Open or close the panel | Left-click the mark |
| Tune Podcast | Settings on MODE: Voice look, then Softer / Balanced / Stronger |
| Automatic microphone | AUTOMATIC on the MICROPHONE header |
| Toggle Omavoice | Right-click, or `o` |
| Reload processing | Reload next to on/off, or `r` |
| Podcast / Clean | `p` / `c` |
| Move | Arrow keys or `h` `j` `k` `l` |
| Activate | Enter |
| Close | Escape |

USB capture is preferred when it appears, and stereo USB is mixed down to mono. Laptop mics and Bluetooth headsets stay in the picker. Auto stays on the USB you are using if several are plugged in; pin one if you want a specific device.

## How it sits in the graph

```
USB / laptop / BT mic
        │
        ▼
  Omavoice  (pipewire -c, its own client)
   Podcast · Clean
        │
        ▼
  OBS · browser · call app
```

The host is a dedicated PipeWire client, the same isolation Omarchy uses for speaker tuning. It does not write into that tuning, and it does not load stock `filter-chain.conf.d`. Disable the plugin and the chain stops. With no listener the host suspends. Restore goes back to the microphone Omavoice replaced, not to Omavoice itself.

## Update and remove

```sh
omarchy plugin update gigasolo.omavoice
omarchy plugin remove gigasolo.omavoice
```

`omarchy plugin update` shows the diff and fast-forwards the git checkout. Removing the plugin does not change your other audio devices.

## If something is wrong

**The mark is missing.** Confirm it is enabled:

```sh
omarchy plugin list | grep omavoice
omarchy plugin enable gigasolo.omavoice --section right
```

**The panel says DPDFNet missing.** Check the four files in `~/.local/share/omavoice/dpdfnet/`, then **reload**.

**Omavoice is silent.** WirePlumber remembers a mute on the source. Check `pactl get-source-mute omavoice`. If it is not muted, the DPDFNet files may not match: the plugin emits silence when ONNX Runtime or the model fails to load. Copy all files from the same HushMic release.

**The app still hears the raw USB mic.** Select **Omavoice** inside the app, not the hardware device.

**The voice sounds hollow.** The app is probably denoising too. Turn that off.

## Develop

```sh
./tests/run
```

That runs the Model tests and `omarchy plugin validate .`, the same checks Omarchy uses before it will install a plugin.

## Sharing

Omarchy distributes third-party plugins as public git repos. Anyone can run `omarchy plugin add` against this URL.

To help people find it, list it at [plugins.omarchy.org](https://plugins.omarchy.org).

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE). Copyright (c) 2026 GigaSolo LLC.

```
SPDX-License-Identifier: MIT
```

Omarchy is a trademark of its respective owners.
