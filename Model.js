var NODE_NAME = "omavoice"
var CAPTURE_NAME = "omavoice.capture"
var NODE_DESCRIPTION = "Omavoice"
var PRESETS = ["podcast", "clean"]
var QUALITIES = ["good", "better", "best"]
var EQ_CURVES = ["neutral", "warm", "clear", "bright"]

// The stored key stays "podcast"; the UI calls that mode Enhanced.
function normalizePreset(value) {
  var preset = String(value || "").toLowerCase()
  if (preset === "enhanced") return "podcast"
  if (PRESETS.indexOf(preset) >= 0) return preset
  return "podcast"
}

function normalizeQuality(value) {
  var quality = String(value || "").toLowerCase()
  if (QUALITIES.indexOf(quality) >= 0) return quality
  return "better"
}

function qualityIndex(value) {
  return QUALITIES.indexOf(normalizeQuality(value))
}

function qualityFromIndex(index) {
  var i = Math.round(Number(index))
  if (!isFinite(i) || i < 0) i = 1
  if (i > 2) i = 2
  return QUALITIES[i]
}

function qualityLabel(value) {
  var quality = normalizeQuality(value)
  if (quality === "good") return "Softer"
  if (quality === "best") return "Stronger"
  return "Balanced"
}

function qualityHint(quality) {
  var level = normalizeQuality(quality)
  if (level === "good") return "Light denoise. More of the room stays."
  if (level === "best") return "Heavier denoise. Less air, less noise."
  return "Speech that sounds finished."
}

function isOmavoiceName(name) {
  var value = String(name || "")
  return value === NODE_NAME
    || value.indexOf("omavoice.") === 0
    || value.indexOf("capture.omavoice") === 0
}

function isOmavoiceNode(node) {
  if (!node) return false
  var name = String(node.name || "")
  if (name === NODE_NAME) return true
  if (name) return false
  return String(node.description || node.nickname || "") === NODE_DESCRIPTION
}

function isUsbSourceName(name) {
  return String(name || "").indexOf("alsa_input.usb-") === 0
}

function isCaptureSourceName(name) {
  var value = String(name || "")
  if (!value || isOmavoiceName(value)) return false
  if (value.indexOf("alsa_input.") === 0) return true
  if (value.indexOf("bluez_input.") === 0) return true
  if (value.indexOf("bluez_capture") === 0) return false
  return false
}

function sourceKind(name) {
  var value = String(name || "")
  if (isOmavoiceName(value)) return "omavoice"
  if (isUsbSourceName(value)) return "usb"
  if (value.indexOf("bluez_input.") === 0) return "bluetooth"
  if (value.indexOf("alsa_input.") === 0) return "builtin"
  return "other"
}

function bluetoothAddress(name) {
  var value = String(name || "")
  if (value.indexOf("bluez_input.") !== 0) return ""
  var rest = value.slice("bluez_input.".length)
  var match = rest.match(/^([0-9A-Fa-f]{2}[:_]){5}[0-9A-Fa-f]{2}/)
  if (!match) return ""
  return match[0].toUpperCase().replace(/_/g, ":")
}

function dedupeCaptureSources(list, preferName) {
  var rows = Array.isArray(list) ? list : []
  var prefer = String(preferName || "")
  var out = []
  var slot = {}
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i]
    var addr = bluetoothAddress(row && row.name)
    if (!addr) {
      out.push(row)
      continue
    }
    if (slot[addr] === undefined) {
      slot[addr] = out.length
      out.push(row)
      continue
    }
    if (String(row.name || "") === prefer) out[slot[addr]] = row
  }
  return out
}

function friendlyDeviceLabel(text) {
  var label = String(text || "").trim()
  label = label.replace(/^sof-soundwire\s+/i, "")
  label = label.replace(/^built-?in audio\s+/i, "")
  label = label.replace(/\s+Analog Stereo$/i, "")
  label = label.replace(/\s+Mono$/i, "")
  label = label.replace(/\s+Input$/i, "")
  label = label.replace(/\s+Microphone[s]?$/i, "")
  label = label.replace(/^alsa_input\./, "")
  label = label.replace(/^usb-/, "")
  label = label.replace(/_/g, " ")
  return label || "Microphone"
}

function sourceSignature(list) {
  var parts = []
  var rows = Array.isArray(list) ? list : []
  for (var i = 0; i < rows.length; i++) {
    parts.push(String(rows[i].name || "") + "\t" + String(rows[i].description || ""))
  }
  return parts.join("\n")
}

function sourcesUnchanged(before, after) {
  return sourceSignature(before) === sourceSignature(after)
}

// Quickshell unbinds PwNode.name when the registry churns (host restart).
// An empty snapshot is a flicker, not "no microphones".
function shouldDeferSourcePick(currentName, hasUnboundNodes) {
  return !!String(currentName || "") && hasUnboundNodes === true
}

function pickFallbackName(defaultName, rememberedName) {
  if (isCaptureSourceName(defaultName)) return String(defaultName)
  if (isCaptureSourceName(rememberedName)) return String(rememberedName)
  return ""
}

function pickSource(sources, pinnedName, defaultName, preferredName) {
  var list = Array.isArray(sources) ? sources : []
  function findName(name) {
    var want = String(name || "")
    if (!want) return null
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].name || "") === want) return list[i]
    }
    return null
  }

  var pinned = findName(pinnedName)
  if (pinned && isCaptureSourceName(pinned.name)) return pinned

  var usb = []
  for (var j = 0; j < list.length; j++) {
    if (isUsbSourceName(list[j].name)) usb.push(list[j])
  }
  var fallback = findName(defaultName)
  if (fallback && isUsbSourceName(fallback.name)) return fallback
  var preferred = findName(preferredName)
  if (preferred && isUsbSourceName(preferred.name)) return preferred
  if (usb.length === 1) return usb[0]
  if (usb.length > 0) return usb[0]
  if (fallback && isCaptureSourceName(fallback.name)) return fallback
  for (var k = 0; k < list.length; k++) {
    if (sourceKind(list[k].name) === "builtin") return list[k]
  }
  var bluetooth = []
  for (var b = 0; b < list.length; b++) {
    if (sourceKind(list[b].name) === "bluetooth") bluetooth.push(list[b])
  }
  if (bluetooth.length > 0) return bluetooth[0]
  for (var n = 0; n < list.length; n++) {
    if (isCaptureSourceName(list[n].name)) return list[n]
  }
  return null
}

function restoreCaptureName(pinnedName, previousName, sources) {
  var list = Array.isArray(sources) ? sources : []
  function present(name) {
    var want = String(name || "")
    if (!want || !isCaptureSourceName(want) || isOmavoiceName(want)) return ""
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].name || "") === want) return want
    }
    return ""
  }
  return present(pinnedName) || present(previousName)
}

function presetLabel(preset) {
  if (normalizePreset(preset) === "clean") return "Clean"
  return "Enhanced"
}

function presetHint(preset) {
  if (normalizePreset(preset) === "clean") return "High-pass only — keeps music and program"
  return "DPDFNet denoise, voice EQ, compressor"
}

function hostSwitchReason(prevKey, nextKey, reloading) {
  if (reloading) return "reload"
  var old = String(prevKey || "").split("\0")
  var neu = String(nextKey || "").split("\0")
  if (!old[0] || old.length < 3) return "start"
  if (old[0] !== neu[0]) return "preset"
  if (old[1] !== neu[1]) return "target"
  return "start"
}

function busyStatusText(reason, preset) {
  if (reason === "target") return "Switching microphone…"
  if (reason === "reload") return "Reloading…"
  return "Starting " + presetLabel(preset) + "…"
}

function clampGainDb(value) {
  var n = Number(value)
  if (!isFinite(n)) return 0
  if (n < -12) return -12
  if (n > 12) return 12
  return n
}

function clampEqTrimDb(value) {
  var n = Number(value)
  if (!isFinite(n)) return 0
  if (n < -6) return -6
  if (n > 6) return 6
  return n
}

function snapEqTrimDb(value) {
  var n = clampEqTrimDb(value)
  if (Math.abs(n) <= 0.4) return 0
  return Math.round(n * 2) / 2
}

function clampEqBandDb(value) {
  var n = Number(value)
  if (!isFinite(n)) return 0
  if (n < -12) return -12
  if (n > 12) return 12
  return n
}

function aliasEqCurve(value) {
  var curve = String(value || "").toLowerCase()
  if (curve === "presence") return "clear"
  if (curve === "air") return "bright"
  return curve
}

function normalizeEqCurve(value, fallback) {
  var curve = aliasEqCurve(value)
  if (EQ_CURVES.indexOf(curve) >= 0) return curve
  var def = aliasEqCurve(fallback || "neutral")
  if (EQ_CURVES.indexOf(def) >= 0) return def
  return "neutral"
}

function eqCurveParams(curve) {
  var c = normalizeEqCurve(curve, "neutral")
  if (c === "warm") return { hpHz: 80, body: 2.0, pres: -1.5, air: 0 }
  if (c === "clear") return { hpHz: 80, body: -2.5, pres: 2.0, air: 0 }
  if (c === "bright") return { hpHz: 100, body: 0, pres: 1.0, air: 2.5 }
  return { hpHz: 80, body: 0, pres: 0, air: 0 }
}

function eqCurveForPreset(preset, values) {
  if (normalizePreset(preset) === "clean") return ""
  return normalizeEqCurve((values || {}).podcastEq, "clear")
}

function eqTrimForPreset(preset, values) {
  var src = values || {}
  if (normalizePreset(preset) === "clean") return { body: 0, pres: 0, air: 0 }
  return {
    body: clampEqTrimDb(src.podcastEqBodyDb),
    pres: clampEqTrimDb(src.podcastEqPresenceDb),
    air: clampEqTrimDb(src.podcastEqAirDb)
  }
}

function eqBandGains(curve, trim) {
  var c = eqCurveParams(curve)
  var t = trim || {}
  return {
    hpHz: c.hpHz,
    body: clampEqBandDb(c.body + clampEqTrimDb(t.body)),
    pres: clampEqBandDb(c.pres + clampEqTrimDb(t.pres)),
    air: clampEqBandDb(c.air + clampEqTrimDb(t.air))
  }
}

function eqBandBase(curve, band) {
  var c = eqCurveParams(curve)
  if (band === "pres") return c.pres
  if (band === "air") return c.air
  return c.body
}

function eqBandRange(curve, band) {
  var base = eqBandBase(curve, band)
  return {
    min: clampEqBandDb(base - 6),
    max: clampEqBandDb(base + 6)
  }
}

function snapEqBandDb(curve, band, value) {
  var r = eqBandRange(curve, band)
  var n = Number(value)
  if (!isFinite(n)) n = eqBandBase(curve, band)
  if (n < r.min) n = r.min
  if (n > r.max) n = r.max
  if (Math.abs(n) <= 0.4) n = 0
  n = Math.round(n * 2) / 2
  if (n < r.min) n = r.min
  if (n > r.max) n = r.max
  return n
}

function eqCurveHint(value) {
  var c = normalizeEqCurve(value, "neutral")
  if (c === "warm") return "A little low end. Less edge."
  if (c === "clear") return "Cut the box. Speech a bit forward."
  if (c === "bright") return "Higher high-pass and a gentle top."
  return "High-pass only. No color."
}

function snapGainDb(value) {
  var n = clampGainDb(value)
  if (Math.abs(n) <= 0.4) return 0
  return Math.round(n * 2) / 2
}

function gainDbToLinear(db) {
  return Math.pow(10, clampGainDb(db) / 20)
}

function hasGain(src, key) {
  return src && src[key] !== undefined && src[key] !== null && src[key] !== ""
}

function gainDbFromKeys(src, keys) {
  for (var i = 0; i < keys.length; i++) {
    if (hasGain(src, keys[i])) return clampGainDb(src[keys[i]])
  }
  return 0
}

function outputGainDbForPreset(preset, values) {
  var first = normalizePreset(preset) === "clean" ? "cleanOutputGainDb" : "podcastOutputGainDb"
  return gainDbFromKeys(values || {}, ["outputGainDb", first, "podcastOutputGainDb", "cleanOutputGainDb"])
}

function captureGainDbForPreset(preset, values) {
  var first = normalizePreset(preset) === "clean" ? "cleanCaptureGainDb" : "podcastCaptureGainDb"
  return gainDbFromKeys(values || {}, ["captureGainDb", first, "podcastCaptureGainDb", "cleanCaptureGainDb"])
}

function sharedGainPatch(kind, db) {
  var n = snapGainDb(db)
  if (kind === "capture") {
    return {
      captureGainDb: n,
      podcastCaptureGainDb: n,
      cleanCaptureGainDb: n
    }
  }
  return {
    outputGainDb: n,
    podcastOutputGainDb: n,
    cleanOutputGainDb: n
  }
}

// DPDFNet suppression cap in dB. Must match omavoice-run.
function dpAttenuation(quality) {
  var level = normalizeQuality(quality)
  if (level === "good") return 24
  if (level === "best") return 100
  return 48
}

function setupGuide(preset, haveDpdfnet) {
  if (normalizePreset(preset) === "clean" || haveDpdfnet) return { needed: false, hero: "", body: "" }
  return {
    needed: true,
    hero: "DPDFNet missing",
    body: "Copy the DPDFNet plugin, model and ONNX Runtime to ~/.local/share/omavoice/dpdfnet, then reload."
  }
}

function hostErrorText(kind, raw) {
  var t = String(raw || "")
  if (kind === "probe") return "Could not check audio plugins."
  if (t.indexOf("session PipeWire did not answer") >= 0) return "PipeWire did not answer."
  return "Could not start the microphone."
}

function statusText(state) {
  state = state || {}
  if (!state.enabled) return "Off"
  if (state.setupNeeded && normalizePreset(state.preset) !== "clean") {
    return String(state.setupHero || "Plugin not installed")
  }
  if (!state.targetName) return "No microphone"
  if (state.busyReason) return busyStatusText(state.busyReason, state.preset)
  if (state.running) return presetLabel(state.preset) + " · " + friendlyDeviceLabel(state.targetLabel || state.targetName)
  if (state.busy) return busyStatusText("start", state.preset)
  return "Idle"
}

if (typeof module !== "undefined") {
  module.exports = {
    NODE_NAME: NODE_NAME,
    CAPTURE_NAME: CAPTURE_NAME,
    NODE_DESCRIPTION: NODE_DESCRIPTION,
    PRESETS: PRESETS,
    QUALITIES: QUALITIES,
    EQ_CURVES: EQ_CURVES,
    normalizePreset: normalizePreset,
    normalizeQuality: normalizeQuality,
    qualityIndex: qualityIndex,
    qualityFromIndex: qualityFromIndex,
    qualityLabel: qualityLabel,
    qualityHint: qualityHint,
    isOmavoiceName: isOmavoiceName,
    isOmavoiceNode: isOmavoiceNode,
    isUsbSourceName: isUsbSourceName,
    isCaptureSourceName: isCaptureSourceName,
    sourceKind: sourceKind,
    bluetoothAddress: bluetoothAddress,
    dedupeCaptureSources: dedupeCaptureSources,
    friendlyDeviceLabel: friendlyDeviceLabel,
    sourceSignature: sourceSignature,
    sourcesUnchanged: sourcesUnchanged,
    shouldDeferSourcePick: shouldDeferSourcePick,
    pickFallbackName: pickFallbackName,
    pickSource: pickSource,
    restoreCaptureName: restoreCaptureName,
    presetLabel: presetLabel,
    presetHint: presetHint,
    hostSwitchReason: hostSwitchReason,
    busyStatusText: busyStatusText,
    clampGainDb: clampGainDb,
    clampEqTrimDb: clampEqTrimDb,
    snapEqTrimDb: snapEqTrimDb,
    clampEqBandDb: clampEqBandDb,
    normalizeEqCurve: normalizeEqCurve,
    eqCurveParams: eqCurveParams,
    eqCurveForPreset: eqCurveForPreset,
    eqTrimForPreset: eqTrimForPreset,
    eqBandGains: eqBandGains,
    eqBandBase: eqBandBase,
    eqBandRange: eqBandRange,
    snapEqBandDb: snapEqBandDb,
    eqCurveHint: eqCurveHint,
    snapGainDb: snapGainDb,
    gainDbToLinear: gainDbToLinear,
    outputGainDbForPreset: outputGainDbForPreset,
    captureGainDbForPreset: captureGainDbForPreset,
    sharedGainPatch: sharedGainPatch,
    dpAttenuation: dpAttenuation,
    setupGuide: setupGuide,
    hostErrorText: hostErrorText,
    statusText: statusText
  }
}
