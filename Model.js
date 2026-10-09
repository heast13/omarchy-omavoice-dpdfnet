var NODE_NAME = "omavoice"
var CAPTURE_NAME = "omavoice.capture"
var NODE_DESCRIPTION = "Omavoice"
var PRESETS = ["podcast", "natural", "clean"]
var QUALITIES = ["good", "better", "best"]
var MODELS = ["auto", "large", "small"]
// High-pass "off" is a 10 Hz corner, not a missing node, so the switch
// writes live without a host restart. Must match omavoice-run.
var HP_OFF_HZ = 10
var DEESSER_LEVELS = ["off", "light", "medium", "strong"]
var EQ_CURVES = ["neutral", "warm", "clear", "bright", "custom"]

// The stored key stays "podcast"; the UI calls that mode Denoise.
function normalizePreset(value) {
  var preset = String(value || "").toLowerCase()
  if (preset === "denoise") return "podcast"
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

function normalizeModel(value) {
  var model = String(value || "").toLowerCase()
  if (MODELS.indexOf(model) >= 0) return model
  return "auto"
}

function modelLabel(value) {
  var model = normalizeModel(value)
  if (model === "large") return "Large"
  if (model === "small") return "Small"
  return "Auto"
}

function modelHint(value) {
  var model = normalizeModel(value)
  if (model === "large") return "Always the large model. A busy CPU drops out instead of letting noise through."
  if (model === "small") return "Always the small model. A third of the CPU, a little less clean."
  return "Large model, steps down to Small when the CPU is busy."
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
  var value = normalizePreset(preset)
  if (value === "clean") return "Clean"
  if (value === "natural") return "Natural"
  return "Denoise"
}

function presetHint(preset) {
  var value = normalizePreset(preset)
  if (value === "clean") return "High-pass only — keeps music and program"
  if (value === "natural") return "Voice EQ and compressor, no denoise — the room stays"
  return "DPDFNet denoise, voice EQ, compressor"
}

function hostSwitchReason(prevKey, nextKey, reloading) {
  if (reloading) return "reload"
  var old = String(prevKey || "").split("\0")
  var neu = String(nextKey || "").split("\0")
  if (!old[0] || old.length < 3) return "start"
  if (old[0] !== neu[0]) return "preset"
  if (old[1] !== neu[1]) return "target"
  if (old[3] !== neu[3]) return "model"
  return "start"
}

function busyStatusText(reason, preset) {
  if (reason === "target") return "Switching microphone…"
  if (reason === "reload") return "Reloading…"
  if (reason === "model") return "Switching model…"
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
  // Neutral and Custom: Custom starts flat and lives on its own trims.
  return { hpHz: 80, body: 0, pres: 0, air: 0 }
}

// Custom keeps its own three values, so a trip to another look and back
// finds them unchanged. Named looks share the podcastEq trims and reset them.
function eqTrimKey(curve, band) {
  var prefix = normalizeEqCurve(curve, "neutral") === "custom" ? "customEq" : "podcastEq"
  if (band === "pres") return prefix + "PresenceDb"
  if (band === "air") return prefix + "AirDb"
  return prefix + "BodyDb"
}

function eqCurveForPreset(preset, values) {
  if (normalizePreset(preset) === "clean") return ""
  return normalizeEqCurve((values || {}).podcastEq, "clear")
}

function eqTrimForPreset(preset, values) {
  var src = values || {}
  if (normalizePreset(preset) === "clean") return { body: 0, pres: 0, air: 0 }
  var curve = eqCurveForPreset(preset, src)
  return {
    body: clampEqTrimDb(src[eqTrimKey(curve, "body")]),
    pres: clampEqTrimDb(src[eqTrimKey(curve, "pres")]),
    air: clampEqTrimDb(src[eqTrimKey(curve, "air")])
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

// Clean has no Voice look and keeps the default 80 Hz corner.
function hpFreq(on, curve) {
  if (on === false) return HP_OFF_HZ
  return curve ? eqCurveParams(curve).hpHz : 80
}

function hpHint(on, curve) {
  if (on === false) return "Off. Rumble, wind and desk bumps pass through."
  return "Cuts rumble below " + hpFreq(true, curve) + " Hz."
}

function normalizeDeesser(value) {
  var level = String(value || "").toLowerCase()
  if (DEESSER_LEVELS.indexOf(level) >= 0) return level
  return "off"
}

function deesserLabel(value) {
  var level = normalizeDeesser(value)
  return level.charAt(0).toUpperCase() + level.slice(1)
}

// Linear thresholds -24 / -30 / -36 dB. Off is the bypassed node, so the
// level writes live. Must match omavoice-run's deesser_node.
function deesserParams(value) {
  var level = normalizeDeesser(value)
  if (level === "light") return { enabled: 1, thresh: 0.0631, ratio: 2 }
  if (level === "medium") return { enabled: 1, thresh: 0.0316, ratio: 4 }
  if (level === "strong") return { enabled: 1, thresh: 0.0158, ratio: 8 }
  return { enabled: 0, thresh: 0.0316, ratio: 4 }
}

function deesserHint(value) {
  var level = normalizeDeesser(value)
  if (level === "light") return "Takes the edge off sharp S sounds."
  if (level === "medium") return "Tames S and SH clearly. Good for bright mics."
  if (level === "strong") return "Heavy. Can lisp if you push the mic."
  return "Off. S sounds pass as they are."
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
  if (c === "custom") return "Your own Body, Presence and Air. Kept when you switch looks."
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

function setupGuide(preset, haveDpdfnet, haveLight) {
  // Only Denoise runs DPDFNet.
  if (normalizePreset(preset) !== "podcast") return { needed: false, hero: "", body: "" }
  if (!haveDpdfnet) {
    return {
      needed: true,
      hero: "DPDFNet missing",
      body: "Download it once from the HushMic release (62 MB, no root), or install hushmic-bin from the AUR and reload."
    }
  }
  // Older downloads lack the light model: a busy CPU then passes raw room noise.
  if (haveLight === false) {
    return {
      needed: true,
      hero: "DPDFNet light model missing",
      body: "Without it, a busy CPU lets room noise through. Download again once (62 MB, no root)."
    }
  }
  return { needed: false, hero: "", body: "" }
}

function hostErrorText(kind, raw) {
  var t = String(raw || "")
  if (kind === "probe") return "Could not check audio plugins."
  if (kind === "fetch") {
    var lines = t.split("\n")
    return lines[lines.length - 1].trim() || "DPDFNet download failed."
  }
  if (t.indexOf("session PipeWire did not answer") >= 0) return "PipeWire did not answer."
  return "Could not start the microphone."
}

function statusText(state) {
  state = state || {}
  if (!state.enabled) return "Off"
  if (state.setupNeeded && normalizePreset(state.preset) === "podcast") {
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
    eqTrimKey: eqTrimKey,
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
    MODELS: MODELS,
    HP_OFF_HZ: HP_OFF_HZ,
    DEESSER_LEVELS: DEESSER_LEVELS,
    normalizeDeesser: normalizeDeesser,
    deesserLabel: deesserLabel,
    deesserParams: deesserParams,
    deesserHint: deesserHint,
    hpFreq: hpFreq,
    hpHint: hpHint,
    normalizeModel: normalizeModel,
    modelLabel: modelLabel,
    modelHint: modelHint,
    setupGuide: setupGuide,
    hostErrorText: hostErrorText,
    statusText: statusText
  }
}
