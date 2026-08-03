// Shared Pi payment product catalog (client + server).
// Amounts/memos/metadata must match exactly on both sides.

export type PiProductId = "arena_entry" | "skin_unlock" | "extra_lives" | "credits_topup";

export type PiProduct = {
  id: PiProductId;
  label: string;
  description: string;
  amount: number;
  memo: string;
};

export const PI_PRODUCTS: Record<PiProductId, PiProduct> = {
  arena_entry: {
    id: "arena_entry",
    label: "Arena Entry Ticket",
    description: "One ranked tournament run.",
    amount: 0.00001,
    memo: "Neon Slither 4D — arena entry",
  },
  skin_unlock: {
    id: "skin_unlock",
    label: "Skin Unlock",
    description: "Permanently unlock a neon skin.",
    amount: 0.00001,
    memo: "Neon Slither 4D — skin unlock",
  },
  extra_lives: {
    id: "extra_lives",
    label: "Extra Lives (3)",
    description: "Three continues after death.",
    amount: 0.00001,
    memo: "Neon Slither 4D — extra lives",
  },
  credits_topup: {
    id: "credits_topup",
    label: "Credits Top-Up",
    description: "1,000 ◎ store credits.",
    amount: 0.00001,
    memo: "Neon Slither 4D — credits top-up",
  },
};

export const PI_PRODUCT_LIST: PiProduct[] = Object.values(PI_PRODUCTS);

export function isPiProductId(value: unknown): value is PiProductId {
  return typeof value === "string" && value in PI_PRODUCTS;
}
