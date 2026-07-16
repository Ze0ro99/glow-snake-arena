import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  approvePiPayment,
  completePiPayment,
  cancelIncompletePiPayment,
  claimTestnetPi,
} from "@/lib/pi-payments.functions";
import { verifyPiToken } from "@/lib/pi-auth.functions";

type Tab = "testnet" | "mainnet";

const PI_SDK_URL = "https://sdk.minepi.com/pi-sdk.js";

function loadPiSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.Pi) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${PI_SDK_URL}"]`,
    );
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

function isAuthError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return /not authenticated|unauthorized|401/i.test(msg);
}

async function reauthWithPi(
  verify: (args: { data: { accessToken: string } }) => Promise<unknown>,
): Promise<void> {
  await loadPiSdk();
  await Promise.resolve(window.Pi!.init({ version: "2.0" }));
  const auth = await window.Pi!.authenticate(["username", "payments"], () => {});
  await verify({ data: { accessToken: auth.accessToken } });
}

function TestnetClaim() {
  const claim = useServerFn(claimTestnetPi);
  const verify = useServerFn(verifyPiToken);
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  const onClick = async () => {
    setStatus("processing");
    setMsg(null);
    try {
      let res;
      try {
        res = await claim();
      } catch (e) {
        if (!isAuthError(e)) throw e;
        setMsg("Session expired — reconnecting Pi…");
        await reauthWithPi(verify);
        res = await claim();
      }
      setStatus("done");
      setMsg(`Sent ${res.amount} π · tx ${res.txid.slice(0, 10)}…`);
    } catch (e) {
      setStatus("error");
      setMsg(e instanceof Error ? e.message : "Claim failed");
    }
  };

  return (
    <div>
      <button
        onClick={onClick}
        disabled={status === "processing" || status === "done"}
        className="w-full rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 px-4 py-2 text-sm font-bold tracking-wider text-black transition hover:scale-[1.02] disabled:opacity-60"
      >
        {status === "processing"
          ? "SENDING…"
          : status === "done"
            ? "CLAIMED ✓"
            : "CLAIM 1 π TEST REWARD"}
      </button>
      <p className="mt-2 text-[10px] leading-relaxed text-amber-200/70">
        A2U (App-to-User) Testnet payout. Used to satisfy Pi's 5-unique-wallet
        Mainnet Wallet requirement.
      </p>
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

function MainnetPay({ amount = 1 }: { amount?: number }) {
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
          memo: "Neon Slither 4D — entry",
          metadata: { product: "arena-entry", network: "mainnet", ts: Date.now() },
        },
        {
          onReadyForServerApproval: async (paymentId) => {
            await approve({ data: { paymentId, network: "mainnet" } });
          },
          onReadyForServerCompletion: async (paymentId, txid) => {
            await complete({ data: { paymentId, txid, network: "mainnet" } });
            setStatus("done");
            setMsg(`Paid ${amount} π · tx ${txid.slice(0, 10)}…`);
          },
          onCancel: async (paymentId) => {
            await cancel({ data: { paymentId, network: "mainnet" } }).catch(() => {});
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
    <div>
      <button
        onClick={pay}
        disabled={status === "processing"}
        className="w-full rounded-lg bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-4 py-2 text-sm font-bold tracking-wider text-black transition hover:scale-[1.02] disabled:opacity-60"
      >
        {status === "processing" ? "PROCESSING…" : `PAY ${amount} π (MAINNET)`}
      </button>
      <p className="mt-2 text-[10px] leading-relaxed text-cyan-200/70">
        U2A (User-to-App) Mainnet payment. Requires Pi Browser and an approved
        Mainnet App Wallet.
      </p>
      {msg && (
        <div
          className={`mt-2 text-[11px] ${
            status === "error" ? "text-red-300" : "text-cyan-200/90"
          }`}
        >
          {msg}
        </div>
      )}
    </div>
  );
}

export function PiPaymentButton() {
  const [tab, setTab] = useState<Tab>("testnet");
  return (
    <div className="mb-4 rounded-xl border border-amber-400/30 bg-black/40 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[10px] tracking-[0.3em] text-amber-300/80">
          PI PAYMENTS
        </div>
        <div className="flex overflow-hidden rounded-md border border-white/10 text-[10px] tracking-widest">
          <button
            onClick={() => setTab("testnet")}
            className={`px-2 py-1 transition ${
              tab === "testnet"
                ? "bg-amber-400 text-black"
                : "bg-transparent text-amber-200/70 hover:text-white"
            }`}
          >
            TESTNET
          </button>
          <button
            onClick={() => setTab("mainnet")}
            className={`px-2 py-1 transition ${
              tab === "mainnet"
                ? "bg-cyan-300 text-black"
                : "bg-transparent text-cyan-200/70 hover:text-white"
            }`}
          >
            MAINNET
          </button>
        </div>
      </div>
      {tab === "testnet" ? <TestnetClaim /> : <MainnetPay amount={1} />}
    </div>
  );
}
