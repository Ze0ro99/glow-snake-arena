import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { claimTestnetPi } from "@/lib/pi-payments.functions";

export function PiPaymentButton({
  amount = 1,
  memo: _memo = "Neon Slither 4D claim",
}: {
  amount?: number;
  memo?: string;
  network?: "testnet" | "mainnet";
}) {
  const claim = useServerFn(claimTestnetPi);
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  const onClick = async () => {
    setStatus("processing");
    setMsg(null);
    try {
      const res = await claim();
      setStatus("done");
      setMsg(`Sent ${res.amount} π · tx ${res.txid.slice(0, 8)}…`);
    } catch (e) {
      setStatus("error");
      setMsg(e instanceof Error ? e.message : "Claim failed");
    }
  };

  return (
    <div className="mb-4 rounded-xl border border-amber-400/30 bg-black/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] tracking-[0.3em] text-amber-300/80">
          PI CLAIM · TESTNET
        </div>
        <div className="text-[10px] tracking-widest text-amber-200/80">
          {amount} π
        </div>
      </div>
      <button
        onClick={onClick}
        disabled={status === "processing" || status === "done"}
        className="w-full rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 px-4 py-2 text-sm font-bold tracking-wider text-black transition hover:scale-[1.02] disabled:opacity-60"
      >
        {status === "processing"
          ? "SENDING…"
          : status === "done"
            ? "CLAIMED ✓"
            : `CLAIM ${amount} π`}
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
