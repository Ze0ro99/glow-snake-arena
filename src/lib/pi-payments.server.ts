// Server-only durable ownership/claim records for Pi payments.
// Uses the admin client because Pi users are not Supabase auth users —
// ownership is enforced here, in code, against the Pi session uid.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Claims a payment id for a Pi uid. Returns false when the payment id is
 * already recorded against a different uid (IDOR attempt).
 */
export async function claimPaymentOwnership(
  paymentId: string,
  uid: string,
  network: "testnet" | "mainnet",
  kind: "u2a" | "a2u" = "u2a",
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("pi_payments")
    .insert({ payment_id: paymentId, pi_uid: uid, network, kind });

  if (!error) return true;

  // Unique violation → row exists; only the original owner may proceed.
  const { data } = await supabaseAdmin
    .from("pi_payments")
    .select("pi_uid")
    .eq("payment_id", paymentId)
    .maybeSingle();

  return data?.pi_uid === uid;
}

/** Verifies an existing payment record belongs to the caller. */
export async function assertPaymentOwner(
  paymentId: string,
  uid: string,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("pi_payments")
    .select("pi_uid")
    .eq("payment_id", paymentId)
    .maybeSingle();

  if (error) throw new Error("Unable to verify payment ownership");
  return data?.pi_uid === uid;
}

/**
 * Atomically reserves the one-per-Pi-account testnet claim.
 * Returns false when this uid already claimed.
 */
export async function reserveTestnetClaim(
  uid: string,
  username: string | undefined,
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("pi_testnet_claims")
    .insert({ pi_uid: uid, pi_username: username ?? null });
  return !error;
}

export async function finalizeTestnetClaim(
  uid: string,
  paymentId: string,
  txid: string,
): Promise<void> {
  await supabaseAdmin
    .from("pi_testnet_claims")
    .update({ payment_id: paymentId, txid })
    .eq("pi_uid", uid);
}

export async function releaseTestnetClaim(uid: string): Promise<void> {
  await supabaseAdmin.from("pi_testnet_claims").delete().eq("pi_uid", uid);
}
