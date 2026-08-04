import React from "react";

// Payments disabled on CiDi/offline builds.
// The Pi payment UI is intentionally hidden on the branch used for CiDi integration.
// Real Pi payment flows remain available only on the production/mainnet workflow when
// you choose to enable them and supply the required secrets. Keeping this component
// as a no-op prevents the Pi SDK from being loaded or executed in the CiDi build.

export function PiPaymentButton() {
  // No-op placeholder — payments are hidden in CiDi/offline mode.
  return null;
}
