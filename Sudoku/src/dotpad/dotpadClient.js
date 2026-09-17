import {
  DotPadScanner,
  DotPadSDK,
  DataCodes,
  DisplayMode,
  BrailleLanguage,
  GradeOption,
  LiblouisManager,
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

function notify() {
  for (const listener of listeners) listener(connectedDevice);
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
