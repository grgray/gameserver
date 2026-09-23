import {
  DotPadScanner,
  DotPadSDK,
  DataCodes,
  DisplayMode,
  BrailleLanguage,
  GradeOption,
  LiblouisManager,
  DotPadKey,
} from './DotPadSDK-3.0.3.js';

// liblouis (used for text -> braille translation) is vendored as static
// assets under public/liblouis/ rather than bundled, so it needs to be
// pointed at that URL before any translation call.
if (typeof window !== 'undefined') {
  LiblouisManager.setAssetBaseUrl(`${window.location.origin}/liblouis/`);
}

const scanner = new DotPadScanner();
const sdk = new DotPadSDK();
sdk.setBrailleLanguage(BrailleLanguage.English, GradeOption.Grade2);

let connectedDevice = null;
const listeners = new Set();
const keyDownListeners = new Set();
const chordListeners = new Set();

function notify() {
  for (const listener of listeners) listener(connectedDevice);
}

// Chord tracking for all six buttons (Function 1-4, Panning Left/Right):
// onKeyDown/onKeyUp report one physical key at a time, so a multi-key combo
// (e.g. Panning Left+F2+F4) arrives as separate down/up events per key
// rather than a single event. We track which of these keys are currently
// held, remember every key that joined the chord since the first one went
// down, and fire once the chord is fully released — mirroring how a
// physical braille chord is "read" on release. This covers single-key
// presses too (a "chord" of one), so every button — alone or combined —
// goes through the same path, avoiding a key firing an immediate single-key
// action before the rest of its intended combo has joined.
const CHORD_KEY_TOKEN = {
  [DotPadKey.KeyFunction1]: '1',
  [DotPadKey.KeyFunction2]: '2',
  [DotPadKey.KeyFunction3]: '3',
  [DotPadKey.KeyFunction4]: '4',
  [DotPadKey.PanningLeft]: 'L',
  [DotPadKey.PanningRight]: 'R',
};

let heldChordKeys = new Set();
let chordKeys = new Set();

function handleChordKeyDown(key) {
  if (heldChordKeys.size === 0) chordKeys = new Set();
  heldChordKeys.add(key);
  chordKeys.add(key);
}

function handleChordKeyUp(key) {
  heldChordKeys.delete(key);
  if (heldChordKeys.size > 0 || chordKeys.size === 0) return;
  const chord = [...chordKeys]
    .map((k) => CHORD_KEY_TOKEN[k])
    .sort()
    .join('');
  chordKeys = new Set();
  for (const listener of chordListeners) listener(chord);
}

sdk.setCallBack(
  (device, dataCode) => {
    if (dataCode === DataCodes.Connected) {
      connectedDevice = device;
      sdk.displayAllDown(device);
      notify();
    } else if (dataCode === DataCodes.Disconnected || dataCode === DataCodes.ConnectedFail) {
      if (connectedDevice === device) connectedDevice = null;
      notify();
    }
  },
  () => {},
  (device, key) => {
    for (const listener of keyDownListeners) listener(key, device);
    if (key in CHORD_KEY_TOKEN) handleChordKeyDown(key);
  },
  (device, key) => {
    if (key in CHORD_KEY_TOKEN) handleChordKeyUp(key);
  },
);

export function isDotPadSupported() {
  return typeof navigator !== 'undefined' && (Boolean(navigator.bluetooth) || Boolean(navigator.serial));
}

export async function connectDotPadViaBluetooth() {
  const device = await scanner.startBleScan();
  if (!device) return null;
  return sdk.connectBleDevice(device);
}

export async function connectDotPadViaUsb() {
  const port = await scanner.startUsbScan();
  if (!port) return null;
  return sdk.connectUsbDevice(port);
}

export function disconnectDotPad(device) {
  sdk.disconnect(device);
}

// Sends plain text to the connected device's braille text line, translating
// and word-wrapping it to the device's own cell width. No-ops (rather than
// throwing) when nothing is connected, or if translation/display fails, so
// callers can fire-and-forget this alongside normal game-state updates.
export async function announceDotPadText(text) {
  if (!connectedDevice || !text) return;
  try {
    await sdk.displayTextData(text, connectedDevice, DisplayMode.TextMode, true);
  } catch {
    // Best-effort — a translation or transport hiccup shouldn't break the game.
  }
}

// Translates plain text to a single continuous line of braille hex — no
// word-wrapping, so it can run longer than the device's text line width.
// Callers are expected to slice out a display-width window themselves (see
// displayDotPadTextRaw) and re-slice as the reader pans left/right. Returns
// '' if nothing is connected or translation fails.
export async function translateDotPadText(text) {
  if (!connectedDevice || !text) return '';
  try {
    return await sdk.translateText(text, false);
  } catch {
    return '';
  }
}

// Sends an already-translated braille hex string straight to the connected
// device's text line, starting at its first cell — no further translation
// or word-wrapping, unlike announceDotPadText. Pairs with
// translateDotPadText: the caller translates once, then sends successive
// windows of that hex as the reader pans. No-ops when nothing is connected.
export function displayDotPadTextRaw(hex) {
  if (!connectedDevice) return;
  try {
    sdk.displayTextData(hex || '', connectedDevice, DisplayMode.TextMode, false);
  } catch {
    // Best-effort — a transport hiccup shouldn't break the game.
  }
}

// Sends a raw pin-hex string (see BrlToHex in brailleHex.js) straight to the
// graphic area (the 300-pin tactile display, not the small braille text
// line), starting from its top-left cell. No liblouis translation involved —
// the caller builds the exact dot pattern for each cell itself. No-ops when
// nothing is connected, or if the display call fails.
export function displayDotPadGraphic(hex) {
  if (!connectedDevice || !hex) return;
  try {
    sdk.displayGraphicData(hex, connectedDevice, DisplayMode.GraphicMode);
  } catch {
    // Best-effort — a transport hiccup shouldn't break the game.
  }
}

// Exposed so the next stage (sending display data, reading key events) can
// reuse this same connection without re-scanning or re-connecting.
export function getDotPadSdk() {
  return sdk;
}

export function getConnectedDotPadDevice() {
  return connectedDevice;
}

export function subscribeDotPadConnection(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Fires on every physical key press (a DotPadKey value — see
// DotPadSDK-3.0.3.d.ts) reported by the connected device, e.g. Panning
// Left/Right or Function 1-4. `listener(key, device)`.
export function subscribeDotPadKeyDown(listener) {
  keyDownListeners.add(listener);
  return () => keyDownListeners.delete(listener);
}

// Fires once a chord of buttons is fully released, with a canonical string
// of which keys were held together, sorted — "1"-"4" for Function 1-4, "L"/
// "R" for Panning Left/Right. E.g. "1" for Function 1 alone, "123" for
// Function 1+2+3 together, "24L" for Panning Left+F2+F4. `listener(chord)`.
export function subscribeDotPadChord(listener) {
  chordListeners.add(listener);
  return () => chordListeners.delete(listener);
}
