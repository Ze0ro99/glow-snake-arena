import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { verifyPiToken, getPiSession, signOutPi } from "@/lib/pi-auth.functions";

declare global {
  interface Window {
    Pi?: {
      init: (opts: { version: string; sandbox?: boolean }) => unknown;
      authenticate: (
        scopes: string[],
        onIncompletePaymentFound: (p: unknown) => void,
      ) => Promise<{ accessToken: string; user: { uid: string; username: string } }>;
    };
  }
}

const PI_SDK_URL = "https://sdk.minepi.com/pi-sdk.js";

function loadPiSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.Pi) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${PI_SDK_URL}"]`);
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

export function PiAuth() {
  const verify = useServerFn(verifyPiToken);
  const fetchSession = useServerFn(getPiSession);
  const signOut = useServerFn(signOutPi);
  const [username, setUsername] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "ready">("idle");
  const [error, setError] = useState<string | null>(null);
  const autoRan = useRef(false);

  const runAuth = async () => {
    setStatus("loading");
    setError(null);
    try {
      await loadPiSdk();
      await Promise.resolve(window.Pi!.init({ version: "2.0" }));
      const auth = await window.Pi!.authenticate(["username"], () => {});
      const result = await verify({ data: { accessToken: auth.accessToken } });
      setUsername(result.username);
      setStatus("ready");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Authentication failed");
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await fetchSession();
        if (cancelled) return;
        if (s.authenticated) {
          setUsername(s.username ?? null);
          setStatus("ready");
          return;
        }
      } catch {
        /* ignore */
      }
      if (!autoRan.current) {
        autoRan.current = true;
        runAuth();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setUsername(null);
    setStatus("idle");
  };

  return (
    <div className="mb-4 rounded-xl border border-fuchsia-400/30 bg-black/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] tracking-[0.3em] text-fuchsia-300/80">PI NETWORK</div>
        {username && (
          <button
            onClick={handleSignOut}
            className="text-[10px] tracking-widest text-fuchsia-300/70 hover:text-white"
          >
            SIGN OUT
          </button>
        )}
      </div>
      {username ? (
        <div className="text-sm font-bold tracking-wide text-fuchsia-200">
          @{username}
          <span className="ml-2 text-[10px] tracking-widest text-emerald-300/90">VERIFIED</span>
        </div>
      ) : (
        <button
          onClick={runAuth}
          disabled={status === "loading"}
          className="w-full rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-600 px-4 py-2 text-sm font-bold tracking-wider text-white transition hover:scale-[1.02] disabled:opacity-60"
        >
          {status === "loading" ? "AUTHENTICATING…" : "SIGN IN WITH PI"}
        </button>
      )}
      {error && (
        <div className="mt-2 text-[11px] text-red-300">
          {error}. Open this app inside the Pi Browser to sign in.
        </div>
      )}
    </div>
  );
}
