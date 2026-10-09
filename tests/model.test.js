const test = require("node:test")
const assert = require("node:assert/strict")
const Model = require("../Model.js")

const usb = {
  name: "alsa_input.usb-QUALCOMM_QCS_KALAMAP-HDK-00.analog-stereo",
  description: "QUALCOMM QCS KALAMAP Analog Stereo"
}
const usb2 = {
  name: "alsa_input.usb-DJI_OsmoAction6_SN-01.analog-stereo",
  description: "DJI Osmo Action 6"
}
const builtin = {
  name: "alsa_input.pci-0000_00_1f.3-platform-sof_sdw.HiFi__Mic__source",
  description: "Microphones"
}
const omavoice = {
  name: "omavoice",
  description: "Omavoice"
}

test("normalizePreset falls back to podcast, also for the old meeting", () => {
  assert.equal(Model.normalizePreset("podcast"), "podcast")
  assert.equal(Model.normalizePreset("CLEAN"), "clean")
  assert.equal(Model.normalizePreset("meeting"), "podcast")
  assert.equal(Model.normalizePreset("Denoise"), "podcast")
  assert.equal(Model.presetLabel("podcast"), "Denoise")
  assert.equal(Model.normalizePreset("NATURAL"), "natural")
  assert.equal(Model.presetLabel("natural"), "Natural")
  assert.equal(Model.normalizePreset("nope"), "podcast")
  assert.equal(Model.normalizePreset(""), "podcast")
})

test("isOmavoiceNode matches name or description when name is still unbound", () => {
  assert.equal(Model.isOmavoiceNode({ name: "omavoice" }), true)
  assert.equal(Model.isOmavoiceNode({ name: "omavoice.aec" }), false)
  assert.equal(Model.isOmavoiceNode({ name: "", description: "Omavoice" }), true)
  assert.equal(Model.isOmavoiceNode({ name: "", description: "Omavoice echo cancel" }), false)
  assert.equal(Model.isOmavoiceNode({ name: "", description: "Microphones" }), false)
  assert.equal(Model.isOmavoiceNode(null), false)
})

test("USB and omavoice name detection", () => {
  assert.equal(Model.isUsbSourceName(usb.name), true)
  assert.equal(Model.isUsbSourceName(builtin.name), false)
  assert.equal(Model.isOmavoiceName("omavoice"), true)
  assert.equal(Model.isOmavoiceName("omavoice.aec"), true)
  assert.equal(Model.isCaptureSourceName("omavoice"), false)
  assert.equal(Model.isCaptureSourceName(usb.name), true)
})

test("sourcesUnchanged ignores object identity and node ids", () => {
  const a = [{ name: usb.name, description: usb.description, id: 1 }]
  const b = [{ name: usb.name, description: usb.description, id: 99 }]
  assert.equal(Model.sourcesUnchanged(a, b), true)
  assert.equal(Model.sourcesUnchanged(a, [usb, builtin]), false)
})

test("pickSource prefers a pinned USB node", () => {
  const picked = Model.pickSource([builtin, usb, usb2], usb2.name, builtin.name)
  assert.equal(picked.name, usb2.name)
})

test("pickSource ignores a stale pin and prefers USB over the laptop mic", () => {
  const picked = Model.pickSource([builtin, usb], "alsa_input.usb-gone", builtin.name)
  assert.equal(picked.name, usb.name)
})

test("pickSource uses the default when it is the only USB match among several", () => {
  const picked = Model.pickSource([usb, usb2, builtin], "", usb.name)
  assert.equal(picked.name, usb.name)
})

test("pickSource keeps the current USB when several are present", () => {
  const picked = Model.pickSource([usb, usb2, builtin], "", builtin.name, usb2.name)
  assert.equal(picked.name, usb2.name)
})

test("pickSource still prefers a USB session default over the current USB", () => {
  const picked = Model.pickSource([usb, usb2, builtin], "", usb.name, usb2.name)
  assert.equal(picked.name, usb.name)
})

test("pickSource still prefers pin over current USB", () => {
  const picked = Model.pickSource([usb, usb2, builtin], usb2.name, usb.name, usb.name)
  assert.equal(picked.name, usb2.name)
})

test("pickSource falls back to the default builtin when no USB is present", () => {
  const picked = Model.pickSource([builtin, omavoice], "", builtin.name)
  assert.equal(picked.name, builtin.name)
})

const bluez = {
  name: "bluez_input.A0:0C:E2:D0:C3:81",
  description: "OpenFit Pro by Shokz"
}

test("pickFallbackName ignores omavoice and keeps a remembered capture", () => {
  assert.equal(Model.pickFallbackName(builtin.name, bluez.name), builtin.name)
  assert.equal(Model.pickFallbackName("omavoice", bluez.name), bluez.name)
  assert.equal(Model.pickFallbackName("omavoice", "omavoice"), "")
  assert.equal(Model.pickFallbackName("", ""), "")
})

test("pickSource uses a remembered BT headset when default is already omavoice", () => {
  const fallback = Model.pickFallbackName("omavoice", bluez.name)
  const picked = Model.pickSource([builtin, bluez], "", fallback)
  assert.equal(picked.name, bluez.name)
})

test("restoreCaptureName prefers the pin over a remembered bluetooth source", () => {
  assert.equal(Model.restoreCaptureName(builtin.name, bluez.name, [builtin, bluez]), builtin.name)
  assert.equal(Model.restoreCaptureName("", bluez.name, [builtin, bluez]), bluez.name)
  assert.equal(Model.restoreCaptureName("omavoice", bluez.name, [builtin, bluez]), bluez.name)
  assert.equal(Model.restoreCaptureName("", "omavoice", [builtin, bluez]), "")
  assert.equal(Model.restoreCaptureName("alsa_input.usb-gone", "", [builtin, bluez]), "")
})

test("pickSource prefers builtin over unpinned bluetooth", () => {
  const fallback = Model.pickFallbackName("omavoice", "")
  const picked = Model.pickSource([builtin, bluez], "", fallback)
  assert.equal(picked.name, builtin.name)
})

test("bluetoothAddress normalizes colon and underscore MACs", () => {
  assert.equal(Model.bluetoothAddress("bluez_input.A0:0C:E2:D0:C3:81"), "A0:0C:E2:D0:C3:81")
  assert.equal(Model.bluetoothAddress("bluez_input.A0_0C_E2_D0_C3_81.0"), "A0:0C:E2:D0:C3:81")
  assert.equal(Model.bluetoothAddress(builtin.name), "")
})

test("dedupeCaptureSources keeps one bluez row per address", () => {
  const twin = { name: "bluez_input.A0_0C_E2_D0_C3_81.headset-head-unit", description: bluez.description }
  const rows = Model.dedupeCaptureSources([builtin, bluez, twin], "")
  assert.equal(rows.length, 2)
  assert.equal(rows[0].name, builtin.name)
  assert.equal(rows[1].name, bluez.name)
  const preferred = Model.dedupeCaptureSources([bluez, twin], twin.name)
  assert.equal(preferred.length, 1)
  assert.equal(preferred[0].name, twin.name)
})

test("eqCurveParams matches the 0.3 voice table", () => {
  assert.deepEqual(Model.eqCurveParams("neutral"), { hpHz: 80, body: 0, pres: 0, air: 0 })
  assert.deepEqual(Model.eqCurveParams("warm"), { hpHz: 80, body: 2.0, pres: -1.5, air: 0 })
  assert.deepEqual(Model.eqCurveParams("clear"), { hpHz: 80, body: -2.5, pres: 2.0, air: 0 })
  assert.deepEqual(Model.eqCurveParams("bright"), { hpHz: 100, body: 0, pres: 1.0, air: 2.5 })
  assert.equal(Model.eqCurveParams("nope").hpHz, 80)
})

test("eqCurveForPreset maps old Presence/Air looks and defaults Clear on Podcast", () => {
  assert.equal(Model.normalizeEqCurve("presence"), "clear")
  assert.equal(Model.normalizeEqCurve("air"), "bright")
  assert.equal(Model.eqCurveForPreset("podcast", {}), "clear")
  assert.equal(Model.eqCurveForPreset("clean", { podcastEq: "bright" }), "")
  assert.equal(Model.eqCurveForPreset("podcast", { podcastEq: "air" }), "bright")
  assert.equal(Model.eqCurveForPreset("podcast", { podcastEq: "presence" }), "clear")
})

test("eqBandGains adds trim and clamps to 12 dB", () => {
  const clear = Model.eqBandGains("clear", { body: 1 })
  assert.equal(clear.body, -1.5)
  assert.equal(clear.pres, 2.0)
  assert.equal(Model.eqBandGains("warm", { body: 12 }).body, 8)
  assert.equal(Model.eqBandGains("bright", { air: -6 }).air, -3.5)
  assert.equal(Model.snapEqTrimDb(0.3), 0)
  assert.equal(Model.snapEqTrimDb(1.24), 1)
  assert.equal(Model.clampEqTrimDb(9), 6)
})

test("Clean ignores voice EQ trim", () => {
  const trim = Model.eqTrimForPreset("clean", { podcastEqBodyDb: 3 })
  assert.deepEqual(trim, { body: 0, pres: 0, air: 0 })
})

test("Natural shares the Denoise voice look and trim", () => {
  const values = { podcastEq: "bright", podcastEqBodyDb: 2 }
  assert.equal(Model.eqCurveForPreset("natural", values), "bright")
  assert.deepEqual(Model.eqTrimForPreset("natural", values), Model.eqTrimForPreset("podcast", values))
  assert.equal(Model.eqCurveForPreset("natural", {}), "clear")
})

test("eqTrimForPreset reads the podcast schema keys", () => {
  assert.deepEqual(
    Model.eqTrimForPreset("podcast", { meetingEqBodyDb: 4, podcastEqPresenceDb: 2, podcastEqAirDb: -1 }),
    { body: 0, pres: 2, air: -1 }
  )
  assert.equal(Model.eqTrimForPreset("podcast", { podcastEqBodyDb: 9 }).body, 6)
  assert.equal(Model.eqTrimForPreset("podcast", { podcastEqPresenceDb: "nope" }).pres, 0)
})

test("eqBandRange is the look ±6 clamp for Voice writes", () => {
  assert.deepEqual(Model.eqBandRange("neutral", "body"), { min: -6, max: 6 })
  assert.deepEqual(Model.eqBandRange("warm", "body"), { min: -4, max: 8 })
  assert.deepEqual(Model.eqBandRange("clear", "body"), { min: -8.5, max: 3.5 })
  assert.deepEqual(Model.eqBandRange("bright", "air"), { min: -3.5, max: 8.5 })
  assert.equal(Model.snapEqBandDb("warm", "body", 12), 8)
  assert.equal(Model.snapEqBandDb("warm", "body", -12), -4)
})

test("normalizeQuality defaults to better", () => {
  assert.equal(Model.normalizeQuality("good"), "good")
  assert.equal(Model.normalizeQuality("BEST"), "best")
  assert.equal(Model.normalizeQuality(""), "better")
  assert.equal(Model.normalizeQuality("nope"), "better")
  assert.equal(Model.qualityIndex("better"), 1)
  assert.equal(Model.qualityFromIndex(0), "good")
  assert.equal(Model.qualityFromIndex(2), "best")
  assert.equal(Model.qualityFromIndex(99), "best")
  assert.equal(Model.qualityLabel("good"), "Softer")
  assert.equal(Model.qualityLabel("better"), "Balanced")
  assert.equal(Model.qualityLabel("best"), "Stronger")
  assert.match(Model.qualityHint("good"), /Light/)
  assert.match(Model.qualityHint("best"), /Heavier/)
})

test("shouldDeferSourcePick keeps the mic while PipeWire names are unbound", () => {
  assert.equal(Model.shouldDeferSourcePick(usb.name, true), true)
  assert.equal(Model.shouldDeferSourcePick(usb.name, false), false)
  assert.equal(Model.shouldDeferSourcePick("", true), false)
  assert.equal(Model.shouldDeferSourcePick(null, true), false)
})

test("clampGainDb and gainDbToLinear convert output trim", () => {
  assert.equal(Model.clampGainDb(0), 0)
  assert.equal(Model.clampGainDb(-20), -12)
  assert.equal(Model.clampGainDb(20), 12)
  assert.equal(Model.clampGainDb("nope"), 0)
  assert.equal(Model.clampGainDb(undefined), 0)
  assert.equal(Model.gainDbToLinear(0), 1)
  assert.ok(Math.abs(Model.gainDbToLinear(6) - 2) < 0.01)
  assert.ok(Math.abs(Model.gainDbToLinear(-6) - 0.5) < 0.01)
  assert.equal(Model.snapGainDb(0.2), 0)
  assert.equal(Model.snapGainDb(-0.4), 0)
  assert.equal(Model.snapGainDb(0.5), 0.5)
  assert.equal(Model.snapGainDb(0.76), 1)
  assert.equal(Model.snapGainDb(-1.24), -1)
  assert.equal(Model.snapGainDb(20), 12)
  const all = {
    podcastOutputGainDb: 2,
    cleanOutputGainDb: 3,
    podcastCaptureGainDb: 5,
    cleanCaptureGainDb: 6
  }
  assert.equal(Model.outputGainDbForPreset("podcast", all), 2)
  assert.equal(Model.outputGainDbForPreset("clean", all), 3)
  assert.equal(Model.captureGainDbForPreset("podcast", all), 5)
  assert.equal(Model.outputGainDbForPreset("podcast", { outputGainDb: 7, ...all }), 7)
  assert.equal(Model.captureGainDbForPreset("clean", { captureGainDb: -1, ...all }), -1)
  assert.equal(Model.outputGainDbForPreset("podcast", { outputGainDb: 2 }), 2)
  assert.equal(Model.outputGainDbForPreset("clean", { outputGainDb: 2 }), 2)
  assert.equal(Model.outputGainDbForPreset("clean", {}), 0)
  assert.deepEqual(Model.sharedGainPatch("output", 2), {
    outputGainDb: 2,
    podcastOutputGainDb: 2,
    cleanOutputGainDb: 2
  })
  assert.equal(Model.sharedGainPatch("capture", 1.24).podcastCaptureGainDb, 1)
})

test("dpAttenuation matches the dump DPDFNet caps", () => {
  assert.equal(Model.dpAttenuation("good"), 24)
  assert.equal(Model.dpAttenuation("better"), 48)
  assert.equal(Model.dpAttenuation("best"), 100)
  assert.equal(Model.dpAttenuation("nope"), 48)
})

test("setupGuide flags missing DPDFNet only on Podcast", () => {
  const missing = Model.setupGuide("podcast", false)
  assert.equal(missing.needed, true)
  assert.match(missing.body, /Download/)
  assert.equal(Model.setupGuide("podcast", true).needed, false)
  assert.equal(Model.setupGuide("clean", false).needed, false)
  assert.equal(Model.setupGuide("natural", false).needed, false)
})

test("setupGuide asks for the light model DPDFNet falls back to", () => {
  const light = Model.setupGuide("podcast", true, false)
  assert.equal(light.needed, true)
  assert.match(light.hero, /light model/)
  assert.match(light.body, /Download/)
  assert.equal(Model.setupGuide("podcast", true, true).needed, false)
  assert.equal(Model.setupGuide("podcast", false, false).hero, "DPDFNet missing")
  assert.equal(Model.setupGuide("natural", true, false).needed, false)
})

test("hostErrorText is one short sentence", () => {
  assert.equal(Model.hostErrorText("bind"), "Could not start the microphone.")
  assert.equal(Model.hostErrorText("probe"), "Could not check audio plugins.")
  assert.equal(Model.hostErrorText("host", "omavoice-run: session PipeWire did not answer"), "PipeWire did not answer.")
  assert.equal(Model.hostErrorText("host", "can't load config /run/user/1000/omavoice/host.1.conf"), "Could not start the microphone.")
  assert.equal(Model.hostErrorText("fetch", "tar: noise\nDownload did not match the expected checksum."), "Download did not match the expected checksum.")
  assert.equal(Model.hostErrorText("fetch", ""), "DPDFNet download failed.")
})

test("statusText does not repeat lastError", () => {
  const text = Model.statusText({
    enabled: true,
    running: false,
    lastError: "Could not start the microphone.",
    targetName: usb.name
  })
  assert.equal(text, "Idle")
  assert.equal(text.includes("Could not start"), false)
})

test("statusText does not report missing DPDFNet on Clean", () => {
  const text = Model.statusText({
    enabled: true,
    running: true,
    setupNeeded: true,
    setupHero: "DPDFNet missing",
    preset: "clean",
    targetName: usb.name,
    targetLabel: usb.description
  })
  assert.match(text, /Clean/)
  assert.equal(text.includes("DPDFNet missing"), false)
})

test("statusText reports the live preset and device", () => {
  const text = Model.statusText({
    enabled: true,
    running: true,
    preset: "podcast",
    targetName: usb.name,
    targetLabel: usb.description
  })
  assert.match(text, /Denoise/)
  assert.match(text, /QUALCOMM/)
})

test("statusText names the preset while the host is starting", () => {
  const text = Model.statusText({
    enabled: true,
    running: false,
    busy: true,
    preset: "podcast",
    targetName: usb.name
  })
  assert.equal(text, "Starting Denoise…")
})

test("statusText names the duck: mic, reload", () => {
  assert.equal(Model.busyStatusText("target", "podcast"), "Switching microphone…")
  assert.equal(Model.busyStatusText("reload", "podcast"), "Reloading…")
  assert.equal(Model.statusText({
    enabled: true,
    running: true,
    busyReason: "preset",
    preset: "clean",
    targetName: usb.name
  }), "Starting Clean…")
})

test("hostSwitchReason prefers preset over target", () => {
  const prev = "podcast\0mic\0/dir"
  const next = "clean\0usb\0/dir"
  assert.equal(Model.hostSwitchReason(prev, next, false), "preset")
  assert.equal(Model.hostSwitchReason(prev, "podcast\0usb\0/dir", false), "target")
  assert.equal(Model.hostSwitchReason(prev, next, true), "reload")
  assert.equal(Model.hostSwitchReason("", next, false), "start")
})

test("hostSwitchReason names a model switch", () => {
  assert.equal(Model.hostSwitchReason("podcast\0mic\0/dir\0auto", "podcast\0mic\0/dir\0small", false), "model")
  assert.equal(Model.busyStatusText("model", "podcast"), "Switching model…")
})

test("normalizeModel keeps Auto, Large and Small", () => {
  assert.deepEqual(Model.MODELS, ["auto", "large", "small"])
  assert.equal(Model.normalizeModel("Large"), "large")
  assert.equal(Model.normalizeModel("small"), "small")
  assert.equal(Model.normalizeModel("huge"), "auto")
  assert.equal(Model.normalizeModel(undefined), "auto")
  assert.equal(Model.modelLabel("small"), "Small")
  assert.match(Model.modelHint("auto"), /steps down/)
})

test("hpFreq follows the look, off is a 10 Hz corner", () => {
  assert.equal(Model.hpFreq(true, "clear"), 80)
  assert.equal(Model.hpFreq(true, "bright"), 100)
  assert.equal(Model.hpFreq(true, ""), 80)
  assert.equal(Model.hpFreq(false, "bright"), 10)
  assert.equal(Model.HP_OFF_HZ, 10)
  assert.match(Model.hpHint(true, "bright"), /100 Hz/)
  assert.match(Model.hpHint(false, "clear"), /^Off/)
})
