import { useCallback, useEffect, useState } from 'react';
import {
  connectDotPadViaBluetooth,
  connectDotPadViaUsb,
  disconnectDotPad,
  getConnectedDotPadDevice,
  isDotPadSupported,
  subscribeDotPadConnection,
} from './dotpadClient.js';

export function useDotPad() {
  const [device, setDevice] = useState(() => getConnectedDotPadDevice());
  const [status, setStatus] = useState(() => (getConnectedDotPadDevice() ? 'connected' : 'idle'));
  const [error, setError] = useState('');

  useEffect(
    () =>
      subscribeDotPadConnection((nextDevice) => {
        setDevice(nextDevice);
        setStatus(nextDevice ? 'connected' : 'idle');
      }),
    [],
  );

  const connect = useCallback(async (transport) => {
    setStatus('connecting');
    setError('');
    try {
      const connected =
        transport === 'usb' ? await connectDotPadViaUsb() : await connectDotPadViaBluetooth();
      if (!connected) {
        // User closed the browser's device picker without choosing one.
        setStatus((current) => (current === 'connecting' ? 'idle' : current));
        return;
      }
      setDevice(connected);
      setStatus('connected');
    } catch (err) {
      setStatus('error');
      setError(err?.message || 'Could not connect to the Dot Pad.');
    }
  }, []);

  const disconnect = useCallback(() => {
    disconnectDotPad(device);
    setDevice(null);
    setStatus('idle');
  }, [device]);

  return {
    device,
    status,
    error,
    connect,
    disconnect,
    supported: isDotPadSupported(),
  };
}
