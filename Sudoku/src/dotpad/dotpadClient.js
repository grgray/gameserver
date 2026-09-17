import { DotPadScanner, DotPadSDK, DataCodes } from './DotPadSDK-3.0.3.js';

const scanner = new DotPadScanner();
const sdk = new DotPadSDK();

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
