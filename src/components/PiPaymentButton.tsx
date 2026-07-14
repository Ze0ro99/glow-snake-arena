import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  approvePiPayment,
  completePiPayment,
  cancelIncompletePiPayment,
} from "@/lib/pi-payments.functions";

// Pi window type is declared in PiAuth.tsx

type Network = "testnet" | "mainnet";

export function PiPaymentButton({
  amount = 1,
  memo = "Neon Slither 4D — support",
  network = "mainnet",
}: {
  amount?: number;
  memo?: string;
  network?: Network;
}) {
  const approve = useServerFn(approvePiPayment);
  const complete = useServerFn(completePiPayment);
  const cancel = useServerFn(cancelIncompletePiPayment);
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  const pay = async () => {
    if (!window.Pi?.createPayment) {
      setStatus("error");
      setMsg("Open this app inside the Pi Browser.");
      return;
    }
    setStatus("processing");
    setMsg(null);
    try {
      await window.Pi.createPayment(
        {
          amount,
          memo,
          metadata: { product: "neon-slither-support", network, ts: Date.now() },
        },
        {
          onReadyForServerApproval: async (paymentId) => {
            await approve({ data: { paymentId, network } });
          },
          onReadyForServerCompletion: async (paymentId, txid) => {
            await complete({ data: { paymentId, txid, network } });
            setStatus("done");
            setMsg(`Payment complete (tx ${txid.slice(0, 8)}…)`);
          },
          onCancel: async (paymentId) => {
            await cancel({ data: { paymentId, network } }).catch(() => {});
            setStatus("idle");
            setMsg("Payment cancelled.");
          },
          onError: (err) => {
            setStatus("error");
            setMsg(err.message);
          },
        },
      );
    } catch (e) {
      setStatus("error");
      setMsg(e instanceof Error ? e.message : "Payment failed");
    }
  };

  return (
    <div className="mb-4 rounded-xl border border-amber-400/30 bg-black/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] tracking-[0.3em] text-amber-300/80">
          PI PAYMENT · {network.toUpperCase()}
        </div>
        <div className="text-[10px] tracking-widest text-amber-200/80">
          {amount} π
        </div>
      </div>
      <button
        onClick={pay}
        disabled={status === "processing"}
        className="w-full rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 px-4 py-2 text-sm font-bold tracking-wider text-black transition hover:scale-[1.02] disabled:opacity-60"
      >
        {status === "processing" ? "PROCESSING…" : `PAY ${amount} π`}
      </button>
      {msg && (
        <div
          className={`mt-2 text-[11px] ${
            status === "error" ? "text-red-300" : "text-amber-200/90"
          }`}
        >
          {msg}
        </div>
      )}
    </div>
  );
}
