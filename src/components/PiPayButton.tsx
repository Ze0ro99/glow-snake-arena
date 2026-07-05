import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { approvePiPayment, completePiPayment } from "@/lib/pi-payments.functions";

declare global {
  interface Window {
    Pi?: {
      init: (opts: { version: string; sandbox?: boolean }) => unknown;
      authenticate: (
        scopes: string[],
        onIncompletePaymentFound: (p: { identifier: string; transaction?: { txid: string } }) => void,
      ) => Promise<{ accessToken: string; user: { uid: string; username: string } }>;
      createPayment: (
        payment: {
          amount: number;
          memo: string;
          metadata: Record<string, unknown>;
        },
        callbacks: {
          onReadyForServerApproval: (paymentId: string) => void;
          onReadyForServerCompletion: (paymentId: string, txid: string) => void;
          onCancel: (paymentId: string) => void;
          onError: (error: Error, payment?: unknown) => void;
        },
      ) => void;
    };
  }
}

const PI_SDK_URL = "https://sdk.minepi.com/pi-sdk.js";

function loadPiSdk(): Promise<void> {
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

type Props = {
  amount?: number;
  memo?: string;
  metadata?: Record<string, unknown>;
  label?: string;
};

export function PiPayButton({
  amount = 1,
  memo = "PiRC Governance Contribution",
  metadata = { type: "pirc_proposal", proposalId: "PiRC-101" },
  label,
}: Props) {
  const approve = useServerFn(approvePiPayment);
  const complete = useServerFn(completePiPayment);
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error" | "cancelled">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const pay = async () => {
    setStatus("pending");
    setMessage(null);
    try {
      await loadPiSdk();
      await Promise.resolve(window.Pi!.init({ version: "2.0" }));
      await window.Pi!.authenticate(["username", "payments"], async (incomplete) => {
        if (incomplete?.identifier && incomplete.transaction?.txid) {
          try {
            await complete({ data: { paymentId: incomplete.identifier, txid: incomplete.transaction.txid } });
          } catch {
            /* ignore */
          }
        }
      });

      window.Pi!.createPayment(
        { amount, memo, metadata },
        {
          onReadyForServerApproval: async (paymentId) => {
            try {
              await approve({ data: { paymentId } });
            } catch (e) {
              setStatus("error");
              setMessage(e instanceof Error ? e.message : "Approval failed");
            }
          },
          onReadyForServerCompletion: async (paymentId, txid) => {
            try {
              await complete({ data: { paymentId, txid } });
              setStatus("success");
              setMessage(`Payment complete (${txid.slice(0, 8)}…)`);
            } catch (e) {
              setStatus("error");
              setMessage(e instanceof Error ? e.message : "Completion failed");
            }
          },
          onCancel: () => {
            setStatus("cancelled");
            setMessage("Payment cancelled");
          },
          onError: (error) => {
            setStatus("error");
            setMessage(error.message || "Payment error");
          },
        },
      );
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Failed to start payment");
    }
  };

  return (
    <div className="mb-4 rounded-xl border border-amber-400/30 bg-black/40 p-3">
      <div className="mb-2 text-[10px] tracking-[0.3em] text-amber-300/80">PI PAYMENT</div>
      <button
        onClick={pay}
        disabled={status === "pending"}
        className="w-full rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-bold tracking-wider text-white transition hover:scale-[1.02] disabled:opacity-60"
      >
        {status === "pending" ? "PROCESSING…" : (label ?? `PAY ${amount}π — ${memo.toUpperCase()}`)}
      </button>
      {message && (
        <div
          className={`mt-2 text-[11px] ${
            status === "success"
              ? "text-emerald-300"
              : status === "cancelled"
                ? "text-amber-300"
                : "text-red-300"
          }`}
        >
          {message}
        </div>
      )}
    </div>
  );
}
