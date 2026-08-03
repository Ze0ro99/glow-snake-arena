CREATE TABLE public.pi_testnet_claims (
  pi_uid TEXT NOT NULL PRIMARY KEY,
  pi_username TEXT,
  payment_id TEXT,
  txid TEXT,
  amount NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.pi_testnet_claims TO service_role;
ALTER TABLE public.pi_testnet_claims ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.pi_payments (
  payment_id TEXT NOT NULL PRIMARY KEY,
  pi_uid TEXT NOT NULL,
  network TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'u2a',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX pi_payments_pi_uid_idx ON public.pi_payments (pi_uid);

GRANT ALL ON public.pi_payments TO service_role;
ALTER TABLE public.pi_payments ENABLE ROW LEVEL SECURITY;