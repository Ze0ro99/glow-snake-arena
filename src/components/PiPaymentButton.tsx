import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  approvePiPayment,
  completePiPayment,
  cancelIncompletePiPayment,
  claimTestnetPi,
} from "@/lib/pi-payments.functions";
import { verifyPiToken, getPiSession } from "@/lib/pi-auth.functions";
import {
  PI_PRODUCTS,
  PI_PRODUCT_LIST,
  type PiProductId,
} from "@/lib/pi-products";


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
  if (typeof window === "undefined" || !("Pi" in window)) {
    await loadPiSdk().catch(() => {
      throw new Error("Open this app inside the Pi Browser to claim.");
    });
  }
  if (!window.Pi?.authenticate) {
    throw new Error("Open this app inside the Pi Browser to claim.");
  }
  await Promise.resolve(window.Pi.init({ version: "2.0" }));
  const auth = await window.Pi.authenticate(["username", "payments"], () => {});
  await verify({ data: { accessToken: auth.accessToken } });
}

function TestnetClaim() {
  const claim = useServerFn(claimTestnetPi);
  const verify = useServerFn(verifyPiToken);
  const session = useServerFn(getPiSession);
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  const onClick = async () => {
    setStatus("processing");
    setMsg(null);
    try {
      // Make sure a Pi session exists BEFORE hitting the claim endpoint, so the
      // server never has to throw "Not authenticated with Pi" at us.
      const current = await session().catch(() => ({ authenticated: false }));
      if (!current.authenticated) {
        setMsg("Connecting your Pi account…");
        await reauthWithPi(verify);
      }

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
      setMsg(
        e instanceof Error
          ? isAuthError(e)
            ? "Sign in with Pi first (open in the Pi Browser)."
            : e.message
          : "Claim failed",
      );
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

function MainnetPay() {
  const approve = useServerFn(approvePiPayment);
  const complete = useServerFn(completePiPayment);
  const cancel = useServerFn(cancelIncompletePiPayment);
  const verify = useServerFn(verifyPiToken);
  const session = useServerFn(getPiSession);
  const [productId, setProductId] = useState<PiProductId>("arena_entry");
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  const product = PI_PRODUCTS[productId];

  const completeInFlight = (payment: unknown) => {
    const p = payment as {
      identifier?: string;
      transaction?: { txid?: string } | null;
    } | null;
    if (!p?.identifier || !p.transaction?.txid) return;
    void complete({
      data: { paymentId: p.identifier, txid: p.transaction.txid, network: "mainnet" },
    }).catch(() => {});
  };

  const pay = async () => {
    setStatus("processing");
    setMsg(null);
    try {
      // Pi.init must be awaited before createPayment, and the session must carry
      // the `payments` scope.
      await loadPiSdk();
      if (!window.Pi?.createPayment) {
        throw new Error("Open this app inside the Pi Browser.");
      }
      await Promise.resolve(window.Pi.init({ version: "2.0" }));

      const current = await session().catch(() => ({ authenticated: false }));
      if (!current.authenticated) {
        setMsg("Connecting your Pi account…");
      }
      const auth = await window.Pi.authenticate(
        ["username", "payments"],
        completeInFlight,
      );
      await verify({ data: { accessToken: auth.accessToken } });

      await window.Pi.createPayment(
        {
          amount: product.amount,
          memo: product.memo,
          metadata: { product: product.id, network: "mainnet", ts: Date.now() },
        },
        {
          onReadyForServerApproval: async (paymentId) => {
            await approve({
              data: { paymentId, network: "mainnet", productId: product.id },
            });
          },
          onReadyForServerCompletion: async (paymentId, txid) => {
            await complete({ data: { paymentId, txid, network: "mainnet" } });
            setStatus("done");
            setMsg(`${product.label} unlocked · tx ${txid.slice(0, 10)}…`);
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
      <div className="mb-3 grid grid-cols-2 gap-2">
        {PI_PRODUCT_LIST.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setProductId(p.id);
              setStatus("idle");
              setMsg(null);
            }}
            className={`rounded-lg border px-2 py-2 text-left transition ${
              p.id === productId
                ? "border-cyan-300 bg-cyan-300/10"
                : "border-white/10 hover:border-cyan-300/40"
            }`}
          >
            <div className="text-[11px] font-bold tracking-wide text-cyan-100">
              {p.label}
            </div>
            <div className="mt-0.5 text-[9px] leading-tight text-cyan-200/60">
              {p.description}
            </div>
            <div className="mt-1 text-[10px] font-bold text-cyan-300">
              {p.amount} π
            </div>
          </button>
        ))}
      </div>
      <button
        onClick={pay}
        disabled={status === "processing"}
        className="w-full rounded-lg bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-4 py-2 text-sm font-bold tracking-wider text-black transition hover:scale-[1.02] disabled:opacity-60"
      >
        {status === "processing"
          ? "PROCESSING…"
          : `BUY ${product.label.toUpperCase()} — ${product.amount} π`}
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
      {tab === "testnet" ? <TestnetClaim /> : <MainnetPay />}
    </div>
  );
}
