export type PiUser = { uid: string; username: string };

export type PiIncompletePayment = {
  identifier: string;
  transaction?: { txid: string };
};

export type PiPaymentCallbacks = {
  onReadyForServerApproval: (paymentId: string) => void;
  onReadyForServerCompletion: (paymentId: string, txid: string) => void;
  onCancel: (paymentId: string) => void;
  onError: (error: Error, payment?: unknown) => void;
};

export type PiSDK = {
  init: (opts: { version: string; sandbox?: boolean }) => unknown;
  authenticate: (
    scopes: string[],
    onIncompletePaymentFound: (p: PiIncompletePayment) => void,
  ) => Promise<{ accessToken: string; user: PiUser }>;
  createPayment: (
    payment: { amount: number; memo: string; metadata: Record<string, unknown> },
    callbacks: PiPaymentCallbacks,
  ) => void;
};

declare global {
  interface Window {
    Pi?: PiSDK;
  }
}

const PI_SDK_URL = "https://sdk.minepi.com/pi-sdk.js";

export function loadPiSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.Pi) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${PI_SDK_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Pi SDK")));
      return;
    }
    const s = document.createElement("script");
    s.src = PI_SDK_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Pi SDK"));
    document.head.appendChild(s);
  });
}
