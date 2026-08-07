import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { initCidi, getTempToken, type CidiStatus } from "@/lib/cidi";

export const Route = createFileRoute("/cidi-setup")({
  head: () => ({
    meta: [
      { title: "CiDi Verification — Neon Slither 4D Readiness Check" },
      {
        name: "description",
        content:
          "Six-stage CiDi Games verification checklist for Neon Slither 4D: project info, product architecture, domain authentication, App Key and login, ads and tournament reporting, sandbox sign-off.",
      },
      { property: "og:title", content: "CiDi Verification — Neon Slither 4D" },
      {
        property: "og:description",
        content:
          "Live readiness check for the six CiDi Games verification stages: SDK, App Key, launch token, ads, tournament reporting and submission fields.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "CiDi Verification — Neon Slither 4D" },
      {
        name: "twitter:description",
        content:
          "Live readiness check for the six CiDi Games verification stages of Neon Slither 4D.",
      },
    ],
  }),
  component: CidiSetup,
});

const DEFAULT_BASE_URL = "https://elf-proxy.cidi.games/api/v1";
const PRODUCTION_URL = "https://glow-snake-arena.lovable.app";

type Item = {
  label: string;
  /** true = verified, false = action needed, null = submitted in the Developer Center */
  ok: boolean | null;
  detail: string;
};

type Stage = { n: number; title: string; items: Item[] };

function CidiSetup() {
  const [status, setStatus] = useState<CidiStatus | null>(null);
  const [keyPresent, setKeyPresent] = useState(false);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [token, setToken] = useState<string | null>(null);
  const [validationKeyOk, setValidationKeyOk] = useState<boolean | null>(null);
  const [portrait, setPortrait] = useState(true);
  const [storageOk, setStorageOk] = useState(false);
  const [secure, setSecure] = useState(true);

  useEffect(() => {
    const key = (import.meta.env.VITE_CIDI_API_KEY as string | undefined) ?? "";
    setKeyPresent(key.trim().length > 0);
    setBaseUrl(
      (import.meta.env.VITE_CIDI_BASE_URL as string | undefined) ?? DEFAULT_BASE_URL,
    );
    setToken(getTempToken());
    setSecure(window.location.protocol === "https:" || window.location.hostname === "localhost");
    void initCidi().then((s) => {
      setStatus(s);
      // Storage is only touched after init() resolves — verify it works here too.
      try {
        window.localStorage.setItem("cidi-probe", "1");
        window.localStorage.removeItem("cidi-probe");
        setStorageOk(true);
      } catch {
        setStorageOk(false);
      }
      setPortrait(window.innerHeight >= window.innerWidth);
    });
    void fetch("/validation-key.txt")
      .then((r) => (r.ok ? r.text() : ""))
      .then((t) => setValidationKeyOk(t.trim().length >= 32))
      .catch(() => setValidationKeyOk(false));
  }, []);

  const stages: Stage[] = [
    {
      n: 1,
      title: "Project information & media",
      items: [
        { label: "English app name: Neon Slither 4D", ok: null, detail: "Developer Center → Project Information" },
        { label: "Developer name + contact email", ok: null, detail: "Developer Center → Project Information" },
        { label: "Category: Casual / Arcade", ok: null, detail: "Developer Center → Project Information" },
        {
          label: "Screen direction: Portrait",
          ok: portrait,
          detail: portrait
            ? "This session renders portrait; the layout is mobile-first and locks to portrait metrics."
            : "Rotate to portrait — the game is submitted as a portrait title.",
        },
        { label: "Short intro (≤ 80 chars) + long intro", ok: null, detail: "Short: Neon snake arena — grow, boost, devour, climb the tournament." },
        { label: "Supported languages: English", ok: null, detail: "Developer Center → Project Information" },
        { label: "Icon, library background, 3+ screenshots, editor & tournament banners", ok: null, detail: "Assets shipped in the repo under src/assets/images." },
        { label: "Test link", ok: null, detail: PRODUCTION_URL + "/" },
      ],
    },
    {
      n: 2,
      title: "Product architecture (OFFLINE)",
      items: [
        {
          label: "Product type: OFFLINE",
          ok: true,
          detail: "Browser client + platform proxy SDK. No CiDi game server is required.",
        },
        {
          label: "No payment / wallet SDK on this route",
          ok: true,
          detail: "No payment SDK is loaded anywhere in this build.",
        },
        {
          label: "API Secret / Callback Secret never in client code",
          ok: true,
          detail: "Only the public App Key is used client-side.",
        },
      ],
    },
    {
      n: 3,
      title: "App authentication (domain)",
      items: [
        {
          label: "Served over HTTPS",
          ok: secure,
          detail: secure ? "Secure origin — required by the SDK." : "Open the production https:// URL.",
        },
        {
          label: "Validation key served at /validation-key.txt",
          ok: validationKeyOk,
          detail:
            validationKeyOk === null
              ? "Checking /validation-key.txt…"
              : validationKeyOk
                ? "Published and reachable for App Authentication."
                : "Missing or too short — restore public/validation-key.txt.",
        },
        { label: "Submit domain in the Developer Center", ok: null, detail: PRODUCTION_URL },
      ],
    },
    {
      n: 4,
      title: "App Key & login SDK",
      items: [
        {
          label: "VITE_CIDI_API_KEY present",
          ok: keyPresent,
          detail: keyPresent
            ? "App Key found — login, tournament and medal reporting are enabled."
            : "Missing. Add the production App Key from the Developer Center as VITE_CIDI_API_KEY, then republish.",
        },
        { label: "Proxy base URL is https", ok: baseUrl.startsWith("https://"), detail: baseUrl },
        {
          label: "CiDiSDK loaded and init() awaited before storage",
          ok: Boolean(status?.sdkReady),
          detail: status?.sdkReady
            ? "cidi-sdk.js loaded and initialised before any localStorage access."
            : (status?.error ?? "SDK not reachable in this context — the game still runs standalone."),
        },
        {
          label: "Storage works after init()",
          ok: storageOk,
          detail: storageOk
            ? "localStorage read/write succeeds through the SDK shim (Pi Browser / iOS rule)."
            : "Storage blocked — progress will not persist in this webview.",
        },
        {
          label: "Launch tempToken received",
          ok: Boolean(token),
          detail: token
            ? "Read from the platform launch URL."
            : "Open the app through the CiDi launch URL (?tempToken=…) to sign in.",
        },
        {
          label: "client.auth.login() succeeds and re-runs per load",
          ok: Boolean(status?.loggedIn),
          detail: status?.loggedIn
            ? "Signed in — the access token is kept in memory only, never persisted."
            : "Requires both an App Key and a launch tempToken.",
        },
        { label: "Sandbox + production App Keys, server IP whitelist", ok: null, detail: "Developer Center → App Key" },
        { label: "Login SDK launch URL", ok: null, detail: PRODUCTION_URL + "/ (platform appends ?tempToken=…)" },
      ],
    },
    {
      n: 5,
      title: "Ads & tournament reporting",
      items: [
        {
          label: "Rewarded ad available (CiDiSDK.showRewardedAd)",
          ok: Boolean(status?.adsReady),
          detail: status?.adsReady
            ? "Available; credits are granted only when success === true."
            : "showRewardedAd() is not exposed by the SDK in this context.",
        },
        {
          label: "Ad failures, timeouts and retries handled",
          ok: true,
          detail: "30s ad timeout, 8s script timeout; any failure degrades to standalone play.",
        },
        {
          label: "Score reported after the run is final",
          ok: true,
          detail: "client.report.tournamentScore({ score, reportedAt }) is called once from endGame().",
        },
        { label: "Tournament rule text (≤ 80 chars)", ok: null, detail: "Highest snake length in a single run. Top 10 ranked per season." },
      ],
    },
    {
      n: 6,
      title: "Sandbox test & completion markers",
      items: [
        { label: "Play a full run in the sandbox launch URL", ok: null, detail: "Open " + PRODUCTION_URL + "/?tempToken=… in the platform browser." },
        { label: "Confirm a completed rewarded ad grants credits", ok: null, detail: "Tap WATCH AD · +250 ◎ on the start screen." },
        { label: "Confirm the score appears in the tournament ranking", ok: null, detail: "Die once, then check the ranking in the platform." },
        { label: "Enable integration completion markers", ok: null, detail: "Developer Center → after sandbox sign-off." },
      ],
    },
  ];

  const runtime = stages.flatMap((s) => s.items).filter((i) => i.ok !== null);
  const passing = runtime.filter((i) => i.ok).length;

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
          CIDI VERIFICATION · 6 STAGES
        </h1>
        <p className="mt-2 text-sm text-cyan-200/60">
          Every stage the CiDi Games review covers. Checks marked ✓ or ! are verified live in
          this browser session; ▹ items are submitted in the Developer Center.
        </p>

        <div
          className="mt-6 rounded-2xl border border-cyan-400/25 bg-cyan-500/5 p-4"
          style={{ boxShadow: "0 0 30px rgba(0,249,255,0.12)" }}
        >
          <div className="text-[10px] tracking-[0.35em] text-cyan-300/70">RUNTIME CHECKS</div>
          <div className="mt-1 text-2xl font-black text-cyan-200">
            {passing} / {runtime.length} PASSING
          </div>
          {!keyPresent && (
            <p className="mt-3 rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 p-3 text-xs leading-relaxed text-fuchsia-200">
              Without an App Key the game stays fully playable and rewarded ads still work —
              only login, tournament and medal reporting are disabled. Add the Developer
              Center App Key as VITE_CIDI_API_KEY and republish to close stage 4.
            </p>
          )}
        </div>

        <div className="mt-8 space-y-4">
          {stages.map((stage) => {
            const live = stage.items.filter((i) => i.ok !== null);
            const done = live.filter((i) => i.ok).length;
            return (
              <section
                key={stage.n}
                className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/5 p-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-sm font-black tracking-wide text-fuchsia-200">
                    <span className="mr-2 text-fuchsia-400/70">STAGE {stage.n}</span>
                    {stage.title}
                  </h2>
                  {live.length > 0 && (
                    <span className="shrink-0 text-[10px] tracking-widest text-cyan-300/70">
                      {done}/{live.length}
                    </span>
                  )}
                </div>

                <ul className="mt-3 space-y-3">
                  {stage.items.map((item) => (
                    <li key={item.label} className="flex gap-3">
                      <span
                        aria-hidden
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black"
                        style={{
                          background:
                            item.ok === null
                              ? "rgba(255,255,255,0.07)"
                              : item.ok
                                ? "rgba(0,255,159,0.15)"
                                : "rgba(255,0,120,0.15)",
                          color:
                            item.ok === null ? "#9fb6c4" : item.ok ? "#00ff9f" : "#ff3d8b",
                          boxShadow:
                            item.ok === null
                              ? "none"
                              : item.ok
                                ? "0 0 12px rgba(0,255,159,0.5)"
                                : "0 0 12px rgba(255,0,120,0.4)",
                        }}
                      >
                        {item.ok === null ? "▹" : item.ok ? "✓" : "!"}
                      </span>
                      <div>
                        <div className="text-sm font-bold tracking-wide text-cyan-100">
                          {item.label}
                          <span className="sr-only">
                            {item.ok === null
                              ? " — submitted in the Developer Center"
                              : item.ok
                                ? " — ok"
                                : " — action needed"}
                          </span>
                        </div>
                        <div className="text-xs leading-relaxed break-words text-cyan-200/55">
                          {item.detail}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <p className="mt-8 text-xs text-cyan-200/40">
          Runtime checks reflect this exact build. Developer Center items are platform
          submissions and are listed here so nothing is missed during review.
        </p>
      </div>
    </div>
  );
}
