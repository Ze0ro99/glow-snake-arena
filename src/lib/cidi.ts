// CiDi Games platform integration (OFFLINE product route).
//
// Requirements implemented here, per https://developdoc.cidi.games:
//  - CiDiSDK.init() runs before the game touches localStorage (Pi Browser / iOS rule).
//  - Rewarded ads via CiDiSDK.showRewardedAd(); reward granted only when success === true.
//  - Offline proxy client via CidiProxySDK.createClient({ baseURL, apiKey }).
//  - Login exchanges the `tempToken` from the launch URL: client.auth.login().
//  - Tournament score reporting via client.report.tournamentScore().
//  - Login is re-run on every page load (no persisted accessToken).
//
// The apiKey is a public client credential supplied by the platform; the
// API Secret / Callback Secret are never referenced in client code.

const CIDI_SDK_URL = "https://app.cidi.games/sdk/cidi-sdk.js";
const CIDI_PROXY_SDK_URL =
  "https://elf-resource.cidi.games/sdk/cidi-proxy-sdk.umd.js";
const DEFAULT_BASE_URL = "https://elf-proxy.cidi.games/api/v1";

type RewardedAdResult = { success?: boolean } | null | undefined;

type CidiProxyClient = {
  auth: { login: () => Promise<boolean> };
  report: {
    tournamentScore: (input: {
      score: string;
      reportedAt: number;
      callbackUrl?: string;
    }) => Promise<boolean>;
    gameTask: (input: unknown) => Promise<boolean>;
    gameTaskResult: (input: unknown) => Promise<unknown>;
    medal: (input?: unknown) => Promise<boolean>;
    medalOwnership: (input?: unknown) => Promise<unknown>;
  };
};

declare global {
  interface Window {
    CiDiSDK?: {
      init?: () => void | Promise<void>;
      showRewardedAd?: (options?: { timeout?: number }) => Promise<RewardedAdResult>;
    };
    CidiProxySDK?: {
      createClient: (config: { baseURL: string; apiKey: string }) => CidiProxyClient;
    };
  }
}

export type CidiStatus = {
  sdkReady: boolean;
  adsReady: boolean;
  loggedIn: boolean;
  hasTempToken: boolean;
  configured: boolean;
  error: string | null;
};

const status: CidiStatus = {
  sdkReady: false,
  adsReady: false,
  loggedIn: false,
  hasTempToken: false,
  configured: false,
  error: null,
};

let client: CidiProxyClient | null = null;
let initPromise: Promise<CidiStatus> | null = null;

function apiKey(): string {
  return (import.meta.env.VITE_CIDI_API_KEY as string | undefined) ?? "";
}

function baseUrl(): string {
  return (
    (import.meta.env.VITE_CIDI_BASE_URL as string | undefined) ?? DEFAULT_BASE_URL
  );
}

function loadScript(src: string, timeoutMs = 8000): Promise<void> {
  if (typeof document === "undefined") return Promise.reject(new Error("no dom"));
  const existing = document.querySelector<HTMLScriptElement>(
    `script[data-cidi="${src}"]`,
  );
  if (existing?.dataset.loaded === "true") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = existing ?? document.createElement("script");
    const timer = setTimeout(() => reject(new Error(`timeout loading ${src}`)), timeoutMs);
    s.addEventListener("load", () => {
      clearTimeout(timer);
      s.dataset.loaded = "true";
      resolve();
    });
    s.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error(`failed loading ${src}`));
    });
    if (!existing) {
      s.src = src;
      s.async = true;
      s.dataset.cidi = src;
      document.head.appendChild(s);
    }
  });
}

/** The platform appends ?tempToken=... to the configured launch URL. */
export function getTempToken(): string | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  return (
    url.searchParams.get("tempToken") ??
    new URLSearchParams(url.hash.replace(/^#\/?[^?]*\??/, "")).get("tempToken")
  );
}

/**
 * Must be awaited before the first localStorage read/write, so CiDiSDK.init()
 * can install its storage shim inside Pi Browser / Pi App iOS.
 * Never rejects — the game stays playable standalone.
 */
export function initCidi(): Promise<CidiStatus> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (typeof window === "undefined") return status;
    status.hasTempToken = Boolean(getTempToken());
    status.configured = Boolean(apiKey());

    try {
      await loadScript(CIDI_SDK_URL);
      await Promise.resolve(window.CiDiSDK?.init?.());
      status.sdkReady = true;
      status.adsReady = typeof window.CiDiSDK?.showRewardedAd === "function";
    } catch (e) {
      status.error = e instanceof Error ? e.message : "CiDi SDK unavailable";
    }

    if (status.configured) {
      try {
        await loadScript(CIDI_PROXY_SDK_URL);
        client =
          window.CidiProxySDK?.createClient({
            baseURL: baseUrl(),
            apiKey: apiKey(),
          }) ?? null;
        // Login is required before any reporting call, and must re-run per page load.
        if (client && status.hasTempToken) {
          status.loggedIn = (await client.auth.login()) === true;
        }
      } catch (e) {
        const err = e as { code?: string; message?: string };
        status.error = err?.code ?? err?.message ?? "CiDi login failed";
      }
    }
    return { ...status };
  })();
  return initPromise;
}

export function getCidiStatus(): CidiStatus {
  return { ...status };
}

/** Rewarded ad. Resolves true ONLY when the platform reports success === true. */
export async function showRewardedAd(timeout = 30000): Promise<boolean> {
  await initCidi();
  const fn = window.CiDiSDK?.showRewardedAd;
  if (typeof fn !== "function") return false;
  try {
    const result = await fn({ timeout });
    return result?.success === true;
  } catch {
    return false;
  }
}

/** Report a finished run to the CiDi tournament ranking. Safe no-op when offline. */
export async function reportTournamentScore(score: number): Promise<boolean> {
  await initCidi();
  if (!client) return false;
  try {
    if (!status.loggedIn) {
      if (!status.hasTempToken) return false;
      status.loggedIn = (await client.auth.login()) === true;
      if (!status.loggedIn) return false;
    }
    return (
      (await client.report.tournamentScore({
        score: String(Math.max(0, Math.floor(score))),
        reportedAt: Math.floor(Date.now() / 1000),
      })) === true
    );
  } catch {
    return false;
  }
}
