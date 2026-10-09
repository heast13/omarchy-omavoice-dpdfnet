#!/usr/bin/env bash
# Failure paths of omavoice-fetch, offline. The happy path needs the real
# 62 MB release, so it is checked by hand: XDG_DATA_HOME=<tmp> scripts/omavoice-fetch
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fail() { echo "fetch.test: $*" >&2; exit 1; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
data="$tmp/data"
dest="$data/omavoice/dpdfnet"
mkdir -p "$dest"
echo keep > "$dest/libdpdfnet_ladspa.so"

run() {
  XDG_DATA_HOME="$data" OMAVOICE_FETCH_URL="$1" "$root/scripts/omavoice-fetch" 2>&1 && return 1 || true
}

out=$(run "file://$tmp/missing.tar.gz") || fail "missing download must fail"
[[ $out == *"Download failed"* ]] || fail "missing download: $out"

echo "not hushmic" > "$tmp/bad.tar.gz"
out=$(run "file://$tmp/bad.tar.gz") || fail "wrong file must fail"
[[ $out == *"expected checksum"* ]] || fail "wrong file: $out"

[[ $(cat "$dest/libdpdfnet_ladspa.so") == keep ]] || fail "a failed fetch must keep the old files"
leftover=$(find "$data/omavoice" -maxdepth 1 -name '.dpdfnet-fetch.*')
[[ -z $leftover ]] || fail "temp dir left behind: $leftover"

echo "fetch.test: ok"
