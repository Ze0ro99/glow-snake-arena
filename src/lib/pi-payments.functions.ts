import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";

// Pi payments — approve & complete (U2A flow).
// Works for both Testnet and Mainnet: the network is decided by the API key
// the client uses when calling Pi.init. On the server we authorize the
// payment against the Pi Platform API using the matching server API key.

type PiSessionData = { uid: string; username: string };

function sessionConfig() {
  const password = process.env.SESSION_SECRET;
  if (!password) throw new Error("SESSION_SECRET is not configured");
  return {
    password,
    name: "pi_session",
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
    maxAge: 60 * 60 * 24 * 7,
  };
}

function serverKey(network: "testnet" | "mainnet") {
  const key =
    network === "mainnet"
      ? process.env.PI_API_KEY_MAINNET
      : process.env.PI_API_KEY_TESTNET;
  if (!key) throw new Error(`Missing Pi server API key for ${network}`);
  return key;
}

async function piFetch(
  network: "testnet" | "mainnet",
  path: string,
  init: RequestInit = {},
) {
  const res = await fetch(`https://api.minepi.com${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Key ${serverKey(network)}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Pi API ${res.status}: ${body.slice(0, 240)}`);
  }
  return res.json();
}

async function requireUser() {
  const session = await useSession<PiSessionData>(sessionConfig());
  if (!session.data?.uid) throw new Error("Not authenticated with Pi");
  return session.data;
}

export const approvePiPayment = createServerFn({ method: "POST" })
  .inputValidator((d: { paymentId: string; network?: "testnet" | "mainnet" }) => {
    if (!d?.paymentId || typeof d.paymentId !== "string") {
      throw new Error("paymentId required");
    }
    return { paymentId: d.paymentId, network: d.network ?? "testnet" };
  })
  .handler(async ({ data }) => {
    await requireUser();
    return piFetch(data.network, `/v2/payments/${data.paymentId}/approve`, {
      method: "POST",
    });
  });

export const completePiPayment = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { paymentId: string; txid: string; network?: "testnet" | "mainnet" }) => {
      if (!d?.paymentId || !d?.txid) throw new Error("paymentId and txid required");
      return {
        paymentId: d.paymentId,
        txid: d.txid,
        network: d.network ?? "testnet",
      };
    },
  )
  .handler(async ({ data }) => {
    await requireUser();
    return piFetch(data.network, `/v2/payments/${data.paymentId}/complete`, {
      method: "POST",
      body: JSON.stringify({ txid: data.txid }),
    });
  });

export const cancelIncompletePiPayment = createServerFn({ method: "POST" })
  .inputValidator((d: { paymentId: string; network?: "testnet" | "mainnet" }) => {
    if (!d?.paymentId) throw new Error("paymentId required");
    return { paymentId: d.paymentId, network: d.network ?? "testnet" };
  })
  .handler(async ({ data }) => {
    await requireUser();
    return piFetch(data.network, `/v2/payments/${data.paymentId}/cancel`, {
      method: "POST",
    });
  });

export const getPiPaymentConfig = createServerFn({ method: "GET" }).handler(
  async () => ({
    testnetWallet: process.env.PI_WALLET_ADDRESS_TESTNET ?? null,
    hasMainnetKey: Boolean(process.env.PI_API_KEY_MAINNET),
    hasTestnetKey: Boolean(process.env.PI_API_KEY_TESTNET),
  }),
);
