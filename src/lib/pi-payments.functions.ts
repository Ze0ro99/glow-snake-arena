import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { PI_PRODUCTS, isPiProductId, type PiProductId } from "./pi-products";

// Feature flag: disable server-side Pi payments in CiDi/offline deployments
const PI_PAYMENTS_ENABLED = (process.env.PI_PAYMENTS_ENABLED ?? "true").toLowerCase() !== "false";

function ensurePaymentsEnabled() {
  if (!PI_PAYMENTS_ENABLED) {
    const e = new Error("Payments are disabled in this deployment (CiDi/offline mode).");
    (e as any).status = 403;
    throw e;
  }
}

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
    cookie: { httpOnly: true, secure: true, sameSite: "none" as const, path: "/" },
    maxAge: 60 * 60 * 24 * 7,
  };
}

function serverKey(network: "testnet" | "mainnet") {
  const key =
    network === "mainnet"
      ? (process.env.PI_NETWORK_API_KEY_ACTIVE ??
        process.env.PI_NETWORK_API_KEY ??
        process.env.PI_API_KEY_MAINNET)
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
  const uid = session.data?.uid;
  if (!uid) throw new Error("Not authenticated with Pi");
  return { session, uid, username: session.data?.username };
}

const PAYMENT_ID_RE = /^[A-Za-z0-9_-]{6,128}$/;
const TXID_RE = /^[A-Za-z0-9]{6,128}$/;

function parsePaymentId(value: unknown): string {
  if (typeof value !== "string" || !PAYMENT_ID_RE.test(value)) {
    throw new Error("paymentId required");
  }
  return value;
}

function parseNetwork(value: unknown): "testnet" | "mainnet" {
  return value === "mainnet" ? "mainnet" : "testnet";
}

// ---------------- U2A ----------------

// Pi payment ids are guessable/observable, so every payment action is bound to
// the Pi uid that first approved it. Without this, any signed-in Pi user could
// approve, complete or cancel another user's payment (IDOR).

export const approvePiPayment = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      paymentId: string;
      network?: "testnet" | "mainnet";
      productId?: PiProductId;
    }) => ({
      paymentId: parsePaymentId(d?.paymentId),
      network: parseNetwork(d?.network),
      productId: isPiProductId(d?.productId) ? d.productId : undefined,
    }),
  )
  .handler(async ({ data }) => {
    ensurePaymentsEnabled();
    const { uid } = await requireUser();
    const { claimPaymentOwnership } = await import("./pi-payments.server");
    const owns = await claimPaymentOwnership(
      data.paymentId,
      uid,
      data.network,
      "u2a",
    );
    if (!owns) throw new Error("This payment does not belong to your Pi account");

    // Server-side validation: the pending payment must match our catalog entry.
    const pending = (await piFetch(
      data.network,
      `/v2/payments/${data.paymentId}`,
      { method: "GET" },
    )) as {
      amount?: number | string;
      memo?: string;
      metadata?: { product?: unknown };
      user_uid?: string;
    };

    if (pending.user_uid && pending.user_uid !== uid) {
      throw new Error("This payment does not belong to your Pi account");
    }

    const productId = isPiProductId(pending.metadata?.product)
      ? pending.metadata!.product
      : data.productId;
    if (!productId) throw new Error("Unknown payment product");
    const product = PI_PRODUCTS[productId];

    if (Number(pending.amount) !== product.amount || pending.memo !== product.memo) {
      throw new Error("Payment does not match the requested product");
    }

    await piFetch(data.network, `/v2/payments/${data.paymentId}/approve`, {
      method: "POST",
    });
    return { ok: true as const, product };
  });


export const completePiPayment = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { paymentId: string; txid: string; network?: "testnet" | "mainnet" }) => {
      if (typeof d?.txid !== "string" || !TXID_RE.test(d.txid)) {
        throw new Error("txid required");
      }
      return {
        paymentId: parsePaymentId(d?.paymentId),
        txid: d.txid,
        network: parseNetwork(d?.network),
      };
    },
  )
  .handler(async ({ data }) => {
    ensurePaymentsEnabled();
    const { uid } = await requireUser();
    const { assertPaymentOwner } = await import("./pi-payments.server");
    if (!(await assertPaymentOwner(data.paymentId, uid))) {
      throw new Error("This payment does not belong to your Pi account");
    }
    return piFetch(data.network, `/v2/payments/${data.paymentId}/complete`, {
      method: "POST",
      body: JSON.stringify({ txid: data.txid }),
    });
  });

export const cancelIncompletePiPayment = createServerFn({ method: "POST" })
  .inputValidator((d: { paymentId: string; network?: "testnet" | "mainnet" }) => ({
    paymentId: parsePaymentId(d?.paymentId),
    network: parseNetwork(d?.network),
  }))
  .handler(async ({ data }) => {
    ensurePaymentsEnabled();
    const { uid } = await requireUser();
    const { assertPaymentOwner } = await import("./pi-payments.server");
    if (!(await assertPaymentOwner(data.paymentId, uid))) {
      throw new Error("This payment does not belong to your Pi account");
    }
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
    ensurePaymentsEnabled();
    const { uid, username } = await requireUser();
    const { reserveTestnetClaim, finalizeTestnetClaim, releaseTestnetClaim } =
      await import("./pi-payments.server");

    // Durable, per-Pi-account reservation. A fresh session/cookie cannot bypass
    // this, so the reward can only ever be claimed once per Pi account.
    if (!(await reserveTestnetClaim(uid, username))) {
      throw new Error("This Pi account has already claimed the Testnet reward.");
    }

    const seed = process.env.PI_APP_WALLET_SEED_TESTNET;
    if (!seed) {
      await releaseTestnetClaim(uid);
      throw new Error("App wallet seed not configured");
    }

    const network = "testnet" as const;
    const amount = 1;
    const memo = "Neon Slither 4D claim";

    try {
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
      const { Horizon, Keypair, TransactionBuilder, Operation, Asset, Memo } = sdk;
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

      await finalizeTestnetClaim(uid, created.identifier, txid);

      return { ok: true, paymentId: created.identifier, txid, amount };
    } catch (e) {
      // Payout never landed — free the reservation so the user can retry.
      await releaseTestnetClaim(uid);
      throw e;
    }
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
