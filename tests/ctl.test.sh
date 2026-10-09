#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ctl="$root/scripts/omavoice-ctl"
fail() { echo "ctl.test: $*" >&2; exit 1; }

tmpdir=$(mktemp -d)
trap 'rm -rf -- "$tmpdir"' EXIT
log="$tmpdir/pw-cli.log"

cat >"$tmpdir/pw-cli" <<EOF
#!/usr/bin/env bash
if [[ \${1:-} == ls && \${2:-} == Node ]]; then
  cat <<'NODES'
	id 10, type PipeWire:Interface:Node/3
		node.name = "omavoice"
	id 11, type PipeWire:Interface:Node/3
		node.name = "omavoice.capture"
NODES
  exit 0
fi
printf '%s\n' "\$@" > "$log"
EOF
chmod +x "$tmpdir/pw-cli"

export PATH="$tmpdir:$PATH"

set +e
"$ctl" set "preamp:Gain 1" >/dev/null 2>&1
odd=$?
set -e
[[ $odd -eq 2 ]] || fail "odd argc must exit 2, got $odd"

"$ctl" set "preamp:Gain 1" 2.0 "denoise:Attenuation Limit (dB)" 48
[[ -f $log ]] || fail "pw-cli was not invoked"
mapfile -t args < "$log"
[[ ${args[0]} == s ]] || fail "pw-cli must set-param, got ${args[0]:-}"
[[ ${args[1]} == 11 ]] || fail "must target omavoice.capture id 11, got ${args[1]:-}"
[[ ${args[2]} == Props ]] || fail "must write Props, got ${args[2]:-}"
[[ ${args[3]} == *'"preamp:Gain 1"'* ]] || fail "must quote preamp:Gain 1: ${args[3]:-}"
[[ ${args[3]} == *'"denoise:Attenuation Limit (dB)"'* ]] || fail "must quote the DPDFNet key: ${args[3]:-}"
[[ ${args[3]} != *' id 10 '* && ${args[1]} != 10 ]] || fail "must not target published omavoice"

rm -f -- "$log"
"$ctl" set --id 99 "preamp:Gain 1" 2.0
mapfile -t args < "$log"
[[ ${args[1]} == 99 ]] || fail "--id must skip ls, got ${args[1]:-}"

set +e
"$ctl" set --id 11 "preamp:Gain 1" '1.0}' >/dev/null 2>&1
bad_val=$?
"$ctl" set --id 11 "nope" 1 >/dev/null 2>&1
bad_key=$?
set -e
[[ $bad_val -eq 2 ]] || fail "non-numeric value must exit 2, got $bad_val"
[[ $bad_key -eq 2 ]] || fail "unknown key must exit 2, got $bad_key"

set +e
"$ctl" set --id 11 "denoise:VAD Threshold (%)" 80 >/dev/null 2>&1
old_key=$?
"$ctl" aec-sync >/dev/null 2>&1
old_cmd=$?
set -e
[[ $old_key -eq 2 ]] || fail "RNNoise VAD key is gone and must exit 2, got $old_key"
[[ $old_cmd -eq 2 ]] || fail "aec-sync is gone and must exit 2, got $old_cmd"

# A host that never ran drops writes: report 75 and write nothing.
cat >"$tmpdir/pw-cli" <<EOF
#!/usr/bin/env bash
if [[ \${1:-} == ls && \${2:-} == Node ]]; then
  printf '\tid 11, type PipeWire:Interface:Node/3\n\t\tnode.name = "omavoice.capture"\n'
  exit 0
fi
if [[ \${1:-} == info ]]; then
  printf '*\tstate: "suspended"\n'
  exit 0
fi
printf '%s\n' "\$@" > "$log"
EOF
rm -f "$log"
set +e
"$ctl" set "hp:Freq" 80 >/dev/null 2>&1
suspended=$?
set -e
[[ $suspended -eq 75 ]] || fail "a suspended host must report 75, got $suspended"
[[ ! -f $log ]] || fail "a suspended host must not get a write"

echo "ctl.test: ok"
