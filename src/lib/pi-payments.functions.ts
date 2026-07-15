import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";

// Pi payments — U2A (approve/complete) + A2U (server-initiated "claim").
// Testnet vs Mainnet is switched by the server API key we present.

type PiSessionData = {
  uid: string;
  username: string;
  claimedTestnet?: boolean;
};

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
  return session;
}

// ---------------- U2A ----------------

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

// ---------------- A2U (Testnet claim) ----------------

// Claim 1 Testnet-π sent from the app wallet to the authenticated Pi user.
// Used to build the 5 unique A2U transactions Pi requires before granting
// Mainnet wallet access.
export const claimTestnetPi = createServerFn({ method: "POST" }).handler(
  async () => {
    const session = await requireUser();
    if (session.data.claimedTestnet) {
      throw new Error("You already claimed your Testnet π on this session.");
    }
    const uid = session.data.uid;
    const seed = process.env.PI_APP_WALLET_SEED_TESTNET;
    if (!seed) throw new Error("App wallet seed not configured");

    const network = "testnet" as const;
    const amount = 1;
    const memo = "Neon Slither 4D claim";

    // 1) Create A2U payment via Pi Platform.
    const created = (await piFetch(network, `/v2/payments`, {
      method: "POST",
      body: JSON.stringify({
        payment: {
          amount,
          memo,
          metadata: { kind: "a2u-claim", ts: Date.now() },
          uid,
        },
      }),
    })) as { identifier: string; recipient: string };

    // 2) Build + sign + submit the Stellar transaction on Pi Testnet.
    const sdk = await import("@stellar/stellar-sdk");
    const { Horizon, Keypair, TransactionBuilder, Operation, Asset, Networks, Memo } =
      sdk;
    const HORIZON = "https://api.testnet.minepi.com";
    const NETWORK_PASSPHRASE = "Pi Testnet";
    const server = new Horizon.Server(HORIZON);
    const kp = Keypair.fromSecret(seed);
    const account = await server.loadAccount(kp.publicKey());
    const fee = await server.fetchBaseFee();

    const tx = new TransactionBuilder(account, {
      fee: String(fee),
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.payment({
          destination: created.recipient,
          asset: Asset.native(),
          amount: amount.toFixed(7),
        }),
      )
      .addMemo(Memo.text(`pi:${created.identifier}`.slice(0, 28)))
      .setTimeout(60)
      .build();
    tx.sign(kp);
    const submitted = (await server.submitTransaction(tx)) as { hash: string };
    const txid = submitted.hash;

    // 3) Complete the payment with the txid.
    await piFetch(network, `/v2/payments/${created.identifier}/complete`, {
      method: "POST",
      body: JSON.stringify({ txid }),
    });

    await session.update({ ...session.data, claimedTestnet: true });

    return { ok: true, paymentId: created.identifier, txid, amount };
  },
);

export const getPiPaymentConfig = createServerFn({ method: "GET" }).handler(
  async () => ({
    testnetWallet: process.env.PI_WALLET_ADDRESS_TESTNET ?? null,
    hasMainnetKey: Boolean(process.env.PI_API_KEY_MAINNET),
    hasTestnetKey: Boolean(process.env.PI_API_KEY_TESTNET),
    hasAppWalletSeed: Boolean(process.env.PI_APP_WALLET_SEED_TESTNET),
  }),
);
