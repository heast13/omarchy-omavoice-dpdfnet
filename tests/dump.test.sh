#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
run="$root/scripts/omavoice-run"
target="alsa_input.usb-TEST_MIC-00.analog-stereo"
live="${XDG_RUNTIME_DIR:-/tmp}/omavoice/host.conf"

dump() {
  "$run" --dump --preset "$1" --target "$target" --dir "$root" "${@:2}"
}

fail() { echo "dump.test: $*" >&2; exit 1; }

mkdir -p "$(dirname "$live")"
backup=""
if [[ -f $live ]]; then
  backup=$(mktemp)
  cp "$live" "$backup"
fi
printf 'SENTINEL_LIVE_CONF\n' > "$live"
dump podcast >/dev/null
grep -qx 'SENTINEL_LIVE_CONF' "$live" || fail "--dump must not overwrite the live host conf"
if [[ -n $backup ]]; then
  mv "$backup" "$live"
else
  rm -f "$live"
fi

have_dp=0
[[ $("$root/scripts/omavoice-probe") == *'"dpdfnet":true'* ]] && have_dp=1

podcast="$(dump podcast)"
podcast_good="$(dump podcast --quality good)"
podcast_best="$(dump podcast --quality best)"
clean="$(dump clean)"

set +e
"$run" --dump --preset meeting --target "$target" --dir "$root" >/dev/null 2>&1
gone_preset=$?
"$run" --dump --preset podcast --engine rnnoise --target "$target" --dir "$root" >/dev/null 2>&1
gone_engine=$?
set -e
[[ $gone_preset -eq 2 ]] || fail "--preset meeting is gone and must be rejected, got $gone_preset"
[[ $gone_engine -eq 2 ]] || fail "--engine is gone and must be rejected, got $gone_engine"

for conf in "$podcast" "$clean"; do
  echo "$conf" | grep -qE 'noise_suppressor|deep_filter|monitor.mode|echo-cancel|audio.aec|omavoice.aec' \
    && fail "RNNoise, DeepFilterNet and Meeting AEC must be gone"
done

echo "$podcast" | grep -A2 'name = libpipewire-module-filter-chain' | grep -q nofail \
  && fail "filter-chain must not nofail or an empty host stays up without omavoice"
echo "$podcast" | grep -A16 'node.name = "omavoice.capture"' | grep -q 'node.dont-fallback' \
  && fail "podcast capture dont-fallback destroys omavoice when the mic is not visible yet"
echo "$clean" | grep -A16 'node.name = "omavoice.capture"' | grep -q 'node.dont-fallback' \
  && fail "clean capture dont-fallback destroys omavoice when the mic is not visible yet"
echo "$podcast" | grep -q "target.object = \"$target\"" || fail "capture must target the picked mic"
echo "$podcast" | grep -A16 'media.class = Audio/Source' | grep -q 'node.virtual = true' \
  || fail "omavoice source must be node.virtual"
echo "$podcast" | grep -A16 'media.class = Audio/Source' | grep -q 'media.role = Communication' \
  || fail "omavoice source must be Communication"
echo "$podcast" | grep -A16 'media.class = Audio/Source' | grep -q 'session.suspend-timeout-seconds = 3' \
  || fail "omavoice source must suspend when nothing is listening"
echo "$podcast" | grep -A16 'media.class = Audio/Source' | grep -q 'node.always-process' \
  && fail "always-process makes capture fail target-not-found and destroys After"
echo "$podcast" | grep -A16 'media.class = Audio/Source' | grep -q 'stream.dont-remix = true' \
  || fail "omavoice source must not remix"
echo "$podcast" | awk '/node.name = "omavoice.capture"/,/playback.props/' | grep -q 'stream.dont-remix = true' \
  && fail "podcast capture must remix stereo USB into MONO"
echo "$podcast" | grep -q 'audio.position = \[ MONO \]' || fail "podcast must be mono"
echo "$podcast" | grep -q 'node.latency = 256/48000' || fail "podcast must pin 256/48000"
echo "$podcast" | grep -q 'bq_highpass' || fail "podcast must high-pass before NS"

if [[ $have_dp -eq 1 ]]; then
  echo "$podcast" | grep -q 'label = dpdfnet_mono' || fail "podcast must run DPDFNet"
  echo "$podcast" | grep -q 'denoise:Input' || fail "DPDFNet ports are Input/Output"
  echo "$podcast" | grep -q '"Mode" = 0' || fail "DPDFNet must run in suppress mode"
  echo "$podcast" | grep -q '"Attenuation Limit (dB)" = 48' || fail "DPDFNet better cap must be 48 dB"
  echo "$podcast_good" | grep -q '"Attenuation Limit (dB)" = 24' || fail "DPDFNet good cap must be 24 dB"
  echo "$podcast_best" | grep -q '"Attenuation Limit (dB)" = 100' || fail "DPDFNet best cap must be 100 dB"
  echo "$podcast" | grep -q 'lsp-plug.in/plugins/lv2/compressor_mono' || fail "podcast needs compressor_mono"
  echo "$podcast" | grep -q 'lsp-plug.in/plugins/lv2/limiter_mono' || fail "podcast needs limiter_mono"
else
  echo "$podcast" | grep -q 'dpdfnet' && fail "podcast without DPDFNet must stay high-pass only"
fi

echo "$podcast" | grep -q 'name = eq_body' || fail "podcast must emit eq_body"
echo "$podcast" | grep -q 'name = eq_pres' || fail "podcast must emit eq_pres"
echo "$podcast" | grep -q 'name = eq_air' || fail "podcast must emit eq_air"
echo "$podcast" | grep -q 'bq_peaking' || fail "podcast voice EQ uses peaking bands"
echo "$podcast" | grep -q 'bq_highshelf' || fail "podcast air band must be highshelf"
echo "$podcast" | grep -A5 'name = eq_body' | grep -q '"Freq" = 250' || fail "eq_body must peak at 250 Hz"
echo "$podcast" | grep -A5 'name = eq_body' | grep -q '"Q" = 0.9' || fail "eq_body Q must be 0.9"
echo "$podcast" | grep -A5 'name = eq_pres' | grep -q '"Freq" = 3000' || fail "eq_pres must peak at 3000 Hz"
echo "$podcast" | grep -A5 'name = eq_pres' | grep -q '"Q" = 1.0' || fail "eq_pres Q must be 1.0"
echo "$podcast" | grep -A5 'name = eq_air' | grep -q '"Freq" = 8000' || fail "eq_air must shelf at 8000 Hz"
echo "$podcast" | grep -A5 'name = eq_air' | grep -q '"Q" = 0.707' || fail "eq_air Q must be 0.707"
echo "$podcast" | grep -A5 'name = eq_body' | grep -q '"Gain" = -2.5' || fail "podcast Clear body must be -2.5"
echo "$podcast" | grep -A5 'name = eq_pres' | grep -q '"Gain" = 2.0' || fail "podcast Clear mid must be +2.0"
podcast_neutral="$(dump podcast --eq neutral)"
echo "$podcast_neutral" | grep -A4 'name = hp' | grep -q '"Freq" = 80.0' || fail "Neutral look must high-pass at 80 Hz"
echo "$podcast_neutral" | grep -A5 'name = eq_body' | grep -q '"Gain" = 0.0' || fail "Neutral body must be 0 dB"
echo "$podcast_neutral" | grep -A5 'name = eq_pres' | grep -q '"Gain" = 0.0' || fail "Neutral presence must be 0 dB"
echo "$podcast_neutral" | grep -A5 'name = eq_air' | grep -q '"Gain" = 0.0' || fail "Neutral air must be 0 dB"
podcast_warm="$(dump podcast --eq warm)"
echo "$podcast_warm" | grep -A5 'name = eq_body' | grep -q '"Gain" = 2.0' || fail "Warm body must be +2.0"
echo "$podcast_warm" | grep -A5 'name = eq_pres' | grep -q '"Gain" = -1.5' || fail "Warm presence must be -1.5"
podcast_bright="$(dump podcast --eq bright)"
echo "$podcast_bright" | grep -A4 'name = hp' | grep -q '"Freq" = 100.0' || fail "Bright look must raise HPF to 100 Hz"
echo "$podcast_bright" | grep -A5 'name = eq_air' | grep -q '"Gain" = 2.5' || fail "Bright look air gain must be +2.5"
dump podcast --eq air | grep -A5 'name = eq_air' | grep -q '"Gain" = 2.5' || fail "old --eq air must map to Bright"
dump podcast --eq presence | grep -A5 'name = eq_body' | grep -q '"Gain" = -2.5' || fail "old --eq presence must map to Clear"
dump podcast --eq warm --eq-body-db 1 | grep -A5 'name = eq_body' | grep -q '"Gain" = 3.0' || fail "Warm --eq-body-db 1 must bake +3.0"
dump podcast --eq warm --eq-body-db 12 | grep -A5 'name = eq_body' | grep -q '"Gain" = 8.0' || fail "Warm --eq-body-db 12 must clamp trim to +8.0"

echo "$clean" | awk '/node.name = "omavoice.capture"/,/playback.props/' | grep -q 'stream.dont-remix = true' \
  && fail "clean capture must remix stereo USB into MONO"
echo "$clean" | grep -q 'bq_highpass' || fail "clean must high-pass"
echo "$clean" | grep -q 'audio.position = \[ MONO \]' || fail "clean must be mono"
echo "$clean" | grep -q 'node.latency = 256/48000' || fail "clean must pin 256/48000"
echo "$clean" | grep -q 'dpdfnet' && fail "clean must not denoise"
echo "$clean" | grep -q 'name = eq_body' && fail "clean must not emit voice EQ"
echo "$clean" | grep -q 'bq_peaking' && fail "clean must not emit peaking EQ"
echo "$clean" | grep -q 'bq_highshelf' && fail "clean must not emit highshelf EQ"
echo "$clean" | grep -q 'compressor_mono' && fail "clean must not compress"

for kind in podcast clean; do
  conf=""
  case $kind in
    podcast) conf=$podcast ;;
    clean) conf=$clean ;;
  esac
  echo "$conf" | grep -q 'name = preamp' || fail "$kind must emit a named preamp node"
  echo "$conf" | grep -q 'name = outgain' || fail "$kind must emit a named outgain node"
  echo "$conf" | grep -A2 'name = preamp' | grep -q 'label = mixer' || fail "$kind preamp must be mixer"
  echo "$conf" | grep -A2 'name = outgain' | grep -q 'label = mixer' || fail "$kind outgain must be mixer"
  echo "$conf" | grep -A3 'name = preamp' | grep -q '"Gain 1"' || fail "$kind preamp must expose Gain 1"
  echo "$conf" | grep -A3 'name = outgain' | grep -q '"Gain 1"' || fail "$kind outgain must expose Gain 1"
  echo "$conf" | grep -q 'inputs = \[ "preamp:In 1" \]' || fail "$kind must enter at preamp"
  echo "$conf" | grep -q 'outputs = \[ "outgain:Out" \]' || fail "$kind must exit at outgain"
done

gained="$(dump podcast --capture-gain-db 6 --output-gain-db -6)"
echo "$gained" | grep -A3 'name = preamp' | grep -q '"Gain 1" = 1.99526231' \
  || fail "capture +6 dB must bake linear ~2 on preamp"
echo "$gained" | grep -A3 'name = outgain' | grep -q '"Gain 1" = 0.50118723' \
  || fail "output -6 dB must bake linear ~0.5 on outgain"

set +e
"$run" --dump --preset podcast --target 'foo"bar' --dir "$root" >/dev/null 2>&1
evil=$?
set -e
[[ $evil -eq 2 ]] || fail "quoted --target must be rejected, got $evil"

echo "dump.test: ok"
