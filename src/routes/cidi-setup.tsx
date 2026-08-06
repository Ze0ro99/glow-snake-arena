import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { initCidi, getTempToken, type CidiStatus } from "@/lib/cidi";

export const Route = createFileRoute("/cidi-setup")({
  head: () => ({
    meta: [
      { title: "CiDi Setup — Neon Slither 4D Integration Check" },
      {
        name: "description",
        content:
          "Runtime configuration check for Neon Slither 4D: CiDi SDK status, API key presence, and the Developer Center fields required for approval.",
      },
      { property: "og:title", content: "CiDi Setup — Neon Slither 4D" },
      {
        property: "og:description",
        content:
          "Verify the CiDi Games integration: SDK, API key, launch token, and required Developer Center fields.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CidiSetup,
});

const DEFAULT_BASE_URL = "https://elf-proxy.cidi.games/api/v1";
const PRODUCTION_URL = "https://glow-snake-arena.lovable.app";

type Check = { label: string; ok: boolean; detail: string };

/** Fields the CiDi Developer Center requires before the app can be approved. */
const DEV_CENTER_FIELDS: { section: string; items: string[] }[] = [
  {
    section: "Project information",
    items: [
      "English app name: Neon Slither 4D",
      "Developer name + contact email",
      "Category: Casual / Arcade",
      "Screen direction: Portrait",
      "Short intro (≤ 80 chars) + long intro",
      "Supported languages: English",
      "Test link: " + PRODUCTION_URL + "/",
    ],
  },
  {
    section: "Media assets",
    items: [
      "App icon (square, no rounded corners baked in)",
      "Library background image",
      "3+ operation / gameplay screenshots",
      "Editor banner + tournament banner",
    ],
  },
  {
    section: "Product architecture",
    items: [
      "Product type: OFFLINE (browser client + platform proxy SDK)",
      "No CiDi game server required",
      "No payment SDK used on this route",
    ],
  },
  {
    section: "App authentication",
    items: [
      "Submit domain: " + PRODUCTION_URL,
      "Validation key served at /validation-key.txt",
    ],
  },
  {
    section: "App key & login",
    items: [
      "Production App Key → VITE_CIDI_API_KEY",
      "Sandbox App Key for testing",
      "Production server IP whitelist",
      "Login SDK launch URL: " + PRODUCTION_URL + "/ (platform appends ?tempToken=…)",
    ],
  },
  {
    section: "Tournament",
    items: [
      "Rule text (≤ 80 chars): Highest snake length in a single run. Top 10 ranked per season.",
      "Scores reported via client.report.tournamentScore()",
      "Enable integration completion markers after sandbox testing",
    ],
  },
];

function CidiSetup() {
  const [status, setStatus] = useState<CidiStatus | null>(null);
  const [keyPresent, setKeyPresent] = useState(false);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [token, setToken] = useState<string | null>(null);
  const [validationKeyOk, setValidationKeyOk] = useState<boolean | null>(null);

  useEffect(() => {
    const key = (import.meta.env.VITE_CIDI_API_KEY as string | undefined) ?? "";
    setKeyPresent(key.trim().length > 0);
    setBaseUrl(
      (import.meta.env.VITE_CIDI_BASE_URL as string | undefined) ?? DEFAULT_BASE_URL,
    );
    setToken(getTempToken());
    void initCidi().then(setStatus);
    void fetch("/validation-key.txt")
      .then((r) => (r.ok ? r.text() : ""))
      .then((t) => setValidationKeyOk(t.trim().length >= 32))
      .catch(() => setValidationKeyOk(false));
  }, []);

  const checks: Check[] = [
    {
      label: "VITE_CIDI_API_KEY present",
      ok: keyPresent,
      detail: keyPresent
        ? "App Key found — login, tournament and medal reporting enabled."
        : "Missing. Add the production App Key from the Developer Center as VITE_CIDI_API_KEY, then republish.",
    },
    {
      label: "Proxy base URL",
      ok: baseUrl.startsWith("https://"),
      detail: baseUrl,
    },
    {
      label: "CiDi SDK loaded + init() called",
      ok: Boolean(status?.sdkReady),
      detail: status?.sdkReady
        ? "cidi-sdk.js loaded and initialised before any storage access."
        : (status?.error ?? "SDK not reachable — the game still runs standalone."),
    },
    {
      label: "Rewarded ads available",
      ok: Boolean(status?.adsReady),
      detail: status?.adsReady
        ? "CiDiSDK.showRewardedAd() available; reward granted only on success === true."
        : "showRewardedAd() not exposed by the SDK in this context.",
    },
    {
      label: "Launch tempToken",
      ok: Boolean(token),
      detail: token
        ? "Received from the platform launch URL."
        : "Open the app through the CiDi launch URL (?tempToken=…) to sign in.",
    },
    {
      label: "Proxy login (client.auth.login)",
      ok: Boolean(status?.loggedIn),
      detail: status?.loggedIn
        ? "Signed in — re-run on every page load, token kept in memory only."
        : "Requires both an App Key and a launch tempToken.",
    },
    {
      label: "Validation key served",
      ok: validationKeyOk === true,
      detail:
        validationKeyOk === null
          ? "Checking /validation-key.txt…"
          : validationKeyOk
            ? "/validation-key.txt is published for App Authentication."
            : "/validation-key.txt missing or too short.",
    },
  ];

  const passing = checks.filter((c) => c.ok).length;

  return (
    <div className="min-h-screen bg-black text-cyan-100">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Link
          to="/"
          className="text-[10px] tracking-[0.35em] text-cyan-400/70 hover:text-cyan-200"
        >
          ← BACK TO GAME
        </Link>

        <h1
          className="mt-6 text-3xl font-black tracking-tight sm:text-4xl"
          style={{ color: "#00f9ff", textShadow: "0 0 24px rgba(0,249,255,0.55)" }}
        >
          CIDI INTEGRATION CHECK
        </h1>
        <p className="mt-2 text-sm text-cyan-200/60">
          Runtime status of the CiDi Games offline-route integration, plus every field the
          Developer Center requires for approval.
        </p>

        <div
          className="mt-6 rounded-2xl border border-cyan-400/25 bg-cyan-500/5 p-4"
          style={{ boxShadow: "0 0 30px rgba(0,249,255,0.12)" }}
        >
          <div className="text-[10px] tracking-[0.35em] text-cyan-300/70">
            RUNTIME CHECKS
          </div>
          <div className="mt-1 text-2xl font-black text-cyan-200">
            {passing} / {checks.length} PASSING
          </div>

          <ul className="mt-4 space-y-3">
            {checks.map((c) => (
              <li key={c.label} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black"
                  style={{
                    background: c.ok ? "rgba(0,255,159,0.15)" : "rgba(255,0,120,0.15)",
                    color: c.ok ? "#00ff9f" : "#ff3d8b",
                    boxShadow: c.ok
                      ? "0 0 12px rgba(0,255,159,0.5)"
                      : "0 0 12px rgba(255,0,120,0.4)",
                  }}
                >
                  {c.ok ? "✓" : "!"}
                </span>
                <div>
                  <div className="text-sm font-bold tracking-wide text-cyan-100">
                    {c.label}
                    <span className="sr-only">{c.ok ? " — ok" : " — action needed"}</span>
                  </div>
                  <div className="text-xs leading-relaxed text-cyan-200/55 break-words">
                    {c.detail}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {!keyPresent && (
            <p className="mt-4 rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 p-3 text-xs leading-relaxed text-fuchsia-200">
              Without an App Key the game stays fully playable and rewarded ads still work —
              only login, tournament and medal reporting are disabled.
            </p>
          )}
        </div>

        <h2 className="mt-10 text-[10px] tracking-[0.35em] text-fuchsia-300/80">
          DEVELOPER CENTER FIELDS
        </h2>
        <div className="mt-3 space-y-4">
          {DEV_CENTER_FIELDS.map((group) => (
            <section
              key={group.section}
              className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/5 p-4"
            >
              <h3 className="text-sm font-black tracking-wide text-fuchsia-200">
                {group.section}
              </h3>
              <ul className="mt-2 space-y-1.5">
                {group.items.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 text-xs leading-relaxed text-cyan-100/70"
                  >
                    <span aria-hidden className="text-fuchsia-400/70">
                      ▹
                    </span>
                    <span className="break-words">{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-8 text-xs text-cyan-200/40">
          These fields are submitted in the CiDi Developer Center — they are not code.
          Everything under Runtime checks is verified live in this browser session.
        </p>
      </div>
    </div>
  );
}
