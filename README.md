# Omavoice DPDFNet

<p align="center">
  <img src="docs/omavoice.svg" alt="Omavoice — your voice, better heard" width="720">
</p>

<p align="center">
  <strong>Your voice, better heard.</strong><br>
  A virtual microphone with DPDFNet noise suppression. One source. Three modes. Noise stays on this side of the call.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-22c55e?style=flat-square" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/omarchy-4%20Quattro-0ea5e9?style=flat-square" alt="Omarchy 4 Quattro">
  <img src="https://img.shields.io/badge/pipewire-filter--chain-a3e635?style=flat-square" alt="PipeWire filter-chain">
  <img src="https://img.shields.io/badge/version-0.7.1-111827?style=flat-square" alt="Version 0.7.1">
</p>

<p align="center">
  <img src="preview.png" alt="Omavoice DPDFNet panel: Denoise, Natural and Clean, selected mic with live level" width="380">
  <img src="docs/preview-tune.png" alt="Mode settings: Voice looks, Body / Presence / Air, Strength, Model" width="380">
</p>

A fork of [Omavoice](https://github.com/gigasolo/omavoice) by GigaSolo for [Omarchy](https://omarchy.org/) 4 (Quattro). It swaps RNNoise and DeepFilterNet for **DPDFNet**, which cleaned speech best in a side-by-side test, and drops the rest: no Meeting preset, no echo cancel, no engine picker.

Pick **Omavoice** in a call app, OBS, or a browser. The plugin sits under those apps as a PipeWire source, so you do not configure each one. USB mics attach themselves when you plug them in.

Not affiliated with or endorsed by GigaSolo, Ceva, or 37signals.

---

## Modes

| | Denoise | Natural | Clean |
| --- | --- | --- | --- |
| **For** | Calls, OBS, interviews, recording | Quiet rooms, voice with ambience | Program mixes, music beds |
| **Does** | High-pass + DPDFNet + voice EQ + compressor | High-pass + voice EQ + compressor | High-pass only |
| **Keeps** | Speech that sounds finished | The room around your voice | Applause, keys, and music |

Natural uses the same Voice look as Denoise, so you tune your voice once.

Right-click the mark to toggle. Open the panel to switch the mode and pick a microphone. The selected mic row shows a live level and a hairline of what Omavoice is sending. Other rows stay quiet so a Bluetooth headset is not grabbed. The settings on MODE set a Voice look (Neutral / Warm / Clear / Bright / Custom) with Body / Presence / Air knobs (Custom keeps your own values when you switch looks), a High-pass switch, the Strength of the denoise, and the DPDFNet Model. High-pass works in every mode; Strength and Model only apply to Denoise; on Clean, Voice is disabled too.

In the app itself, choose **Omavoice** as the microphone and turn *its* noise cancellation off. Two denoisers stacked sound hollow.

## Install

```sh
omarchy plugin add https://github.com/heast13/omarchy-omavoice-dpdfnet.git --enable
```

Open the panel. It says **DPDFNet missing**. Click **Download DPDFNet** (or press `i`). That is it.

DPDFNet comes from [HushMic](https://github.com/Fovty/hushmic), which ships it as a LADSPA plugin. The button downloads one pinned HushMic release from GitHub (62 MB, once), checks its sha256, and keeps only the files Omavoice loads (73 MB) in `~/.local/share/omavoice/dpdfnet/`. No root, no AUR package, no HushMic app. From a terminal it is `scripts/omavoice-fetch` in the plugin folder.

> [!IMPORTANT]
> This fork replaces upstream Omavoice. Both publish a PipeWire source called `omavoice`, so never enable them together. Remove `gigasolo.omavoice` first.

> [!IMPORTANT]
> Plugins run as unsandboxed code inside `omarchy-shell`. Only add repos you trust, and read the source before you enable one.

### With the HushMic package instead

If you already use `hushmic-bin`, Omavoice finds it on its own. It looks in `~/.local/share/omavoice/dpdfnet/` first, then in the package paths. The folder holds:

```
libdpdfnet_ladspa.so            # /usr/lib/ladspa/
dpdfnet8_48khz_hr.onnx          # /usr/share/hushmic/models/
dpdfnet8_48khz_hr.weights.f32   # /usr/share/hushmic/models/ (optional: faster native engine)
dpdfnet2_48khz_hr.onnx          # /usr/share/hushmic/models/ (light fallback, see below)
dpdfnet2_48khz_hr.weights.f32   # /usr/share/hushmic/models/ (optional: faster native engine)
libonnxruntime.so               # /usr/lib/hushmic/libonnxruntime.so.1.*, renamed
```

Copy all of them from the same release if you fill the folder by hand. Without DPDFNet, Denoise falls back to the Natural chain, and the panel says **DPDFNet missing**. Click **reload** after installing or copying.

Softer / Balanced / Stronger cap the suppression at 24 / 48 / 100 dB. DPDFNet adds about 40 ms of latency.

Model picks the DPDFNet network:

| Model | What it does |
| --- | --- |
| **Auto** (default) | Large model. When the CPU cannot keep up, it steps down to Small, and only then to unfiltered audio. |
| **Large** | Always the large model. A CPU that cannot keep up drops out instead of letting noise through. |
| **Small** | Always the small model, about a third of the CPU. A little less clean. Good for old dual-cores. |

Without `dpdfnet2_48khz_hr.onnx`, Auto skips the Small step, so a slow laptop lets room noise through, sometimes for minutes. The panel asks you to download again if the small model is missing.

On slow machines, also install `rtkit`. PipeWire and DPDFNet then run with realtime priority, and a busy shell no longer starves the denoiser. If it is missing, Denoise shows **Install rtkit**: it opens a terminal for your password, and Omavoice restarts with realtime once rtkit is there. Log out and back in once so PipeWire itself runs realtime too.

## Use

| Action | How |
| --- | --- |
| Open or close the panel | Left-click the mark |
| Tune Denoise | Settings on MODE: Voice look, High-pass, Softer / Balanced / Stronger, Auto / Large / Small |
| Realtime audio | **Install rtkit** in the panel, when rtkit is missing |
| Automatic microphone | AUTOMATIC on the MICROPHONE header |
| Toggle Omavoice | Right-click, or `o` |
| Download DPDFNet | The button under **DPDFNet missing**, or `i` |
| Reload processing | Reload next to on/off, or `r` |
| Denoise / Natural / Clean | `d` / `n` / `c` |
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
   Denoise · Natural · Clean
        │
        ▼
  call app · OBS · browser
```

The host is a dedicated PipeWire client, the same isolation Omarchy uses for speaker tuning. It does not write into that tuning, and it does not load stock `filter-chain.conf.d`. Disable the plugin and the chain stops. With no listener the host suspends. Restore goes back to the microphone Omavoice replaced, not to Omavoice itself.

## Update and remove

```sh
omarchy plugin update heast13.omavoice-dpdfnet
omarchy restart shell
omarchy plugin remove heast13.omavoice-dpdfnet
```

`omarchy plugin update` shows the diff and fast-forwards the git checkout. Removing the plugin does not change your other audio devices.

## If something is wrong

**The mark is missing.** Confirm it is enabled:

```sh
omarchy plugin list | grep omavoice
omarchy plugin enable heast13.omavoice-dpdfnet --section right
```

**The panel says DPDFNet missing.** Click **Download DPDFNet**. If the download fails, the panel says why. Or install `hushmic-bin`, then **reload**.

**Omavoice is silent.** WirePlumber remembers a mute on the source. Check `pactl get-source-mute omavoice`. If it is not muted, the DPDFNet files may not match: the plugin emits silence when ONNX Runtime or the model fails to load. Copy all files from the same HushMic release.

**The app still hears the raw USB mic.** Select **Omavoice** inside the app, not the hardware device.

**The voice sounds hollow.** The app is probably denoising too. Turn that off.

## Develop

```sh
git clone https://github.com/heast13/omarchy-omavoice-dpdfnet.git
cd omarchy-omavoice-dpdfnet
./tests/run
```

That runs the Model tests, the graph and script tests, and `omarchy plugin validate .`, the same check Omarchy runs before it installs a plugin.

## Credits

- [Omavoice](https://github.com/gigasolo/omavoice) by GigaSolo LLC (MIT): the plugin this fork is built on, including the logo and the tagline.
- [DPDFNet](https://github.com/ceva-ip/DPDFNet) by Ceva (Apache-2.0): the speech-enhancement model ([paper](https://arxiv.org/abs/2512.16420)).
- [HushMic](https://github.com/Fovty/hushmic) by Fovty (MIT OR Apache-2.0): the LADSPA plugin, the native engine, and the bundled ONNX Runtime (Microsoft, MIT).

This repo contains no binaries, models, or weights. The download button fetches them from HushMic's own GitHub release.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE). Copyright (c) 2026 GigaSolo LLC, Copyright (c) 2026 heast13.

```
SPDX-License-Identifier: MIT
```

Omarchy is a trademark of its respective owners.
