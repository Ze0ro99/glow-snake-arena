import { createServerFn } from "@tanstack/react-start";

async function piApi(path: string, init?: RequestInit) {
  const key = process.env.PI_API_KEY;
  if (!key) throw new Error("PI_API_KEY is not configured");
  const res = await fetch(`https://api.minepi.com${path}`, {
    ...init,
    headers: {
      Authorization: `Key ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pi API ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export const approvePiPayment = createServerFn({ method: "POST" })
  .inputValidator((data: { paymentId: string }) => {
    if (!data?.paymentId || typeof data.paymentId !== "string") {
      throw new Error("paymentId required");
    }
    return { paymentId: data.paymentId };
  })
  .handler(async ({ data }) => {
    const result = await piApi(`/v2/payments/${data.paymentId}/approve`, {
      method: "POST",
    });
    return { ok: true, payment: result };
  });

export const completePiPayment = createServerFn({ method: "POST" })
  .inputValidator((data: { paymentId: string; txid: string }) => {
    if (!data?.paymentId || !data?.txid) {
      throw new Error("paymentId and txid required");
    }
    return { paymentId: data.paymentId, txid: data.txid };
  })
  .handler(async ({ data }) => {
    const result = await piApi(`/v2/payments/${data.paymentId}/complete`, {
      method: "POST",
      body: JSON.stringify({ txid: data.txid }),
    });
    return { ok: true, payment: result };
  });
