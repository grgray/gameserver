import { useState } from "react";

// Connect / disconnect controls for a Dot Pad tactile display, as in
// CrossMyMind: one button opens a choice of Bluetooth or USB, and the
// browser's own device picker takes it from there.
export default function DotPadPanel({ dotPad }) {
  const [menuOpen, setMenuOpen] = useState(false);

  function connect(transport) {
    setMenuOpen(false);
    dotPad.connect(transport);
  }

  if (dotPad.status === "connected") {
    return (
      <div className="dotpad-panel dotpad-connected">
        <span className="dotpad-status" role="status">
          Dot Pad connected{dotPad.device?.cellType ? ` (${dotPad.device.cellType})` : ""}
        </span>
        <button type="button" className="button button-secondary" onClick={dotPad.disconnect}>
          Disconnect Dot Pad
        </button>
      </div>
    );
  }

  return (
    <div className="dotpad-panel dotpad-connect">
      <button
        type="button"
        className="button button-secondary"
        disabled={!dotPad.supported || dotPad.status === "connecting"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        {dotPad.status === "connecting" ? "Connecting to Dot Pad…" : "Connect to Dot Pad"}
      </button>

      {menuOpen && dotPad.status !== "connecting" && (
        <div className="dotpad-menu" role="group" aria-label="Choose Dot Pad connection type">
          <button type="button" className="button button-secondary" onClick={() => connect("bluetooth")}>
            Connect via Bluetooth
          </button>
          <button type="button" className="button button-secondary" onClick={() => connect("usb")}>
            Connect via USB
          </button>
        </div>
      )}

      {!dotPad.supported && (
        <p className="dotpad-hint">Dot Pad connections need a Chromium-based browser (e.g. Chrome or Edge).</p>
      )}
      {dotPad.status === "error" && (
        <p className="dotpad-hint dotpad-hint-error" role="alert">
          {dotPad.error}
        </p>
      )}
    </div>
  );
}
