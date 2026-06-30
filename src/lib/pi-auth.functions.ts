import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";

type PiSessionData = { uid: string; username: string };

function sessionConfig() {
  const password = process.env.SESSION_SECRET;
  if (!password) throw new Error("SESSION_SECRET is not configured");
  return {
    password,
    name: "pi_session",
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
    },
    maxAge: 60 * 60 * 24 * 7,
  };
}

export const verifyPiToken = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string }) => {
    if (!data || typeof data.accessToken !== "string" || data.accessToken.length < 8) {
      throw new Error("Invalid access token");
    }
    return { accessToken: data.accessToken };
  })
  .handler(async ({ data }) => {
    const res = await fetch("https://api.minepi.com/v2/me", {
      headers: { Authorization: `Bearer ${data.accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Pi token validation failed (${res.status})`);
    }
    const me = (await res.json()) as { uid?: string; username?: string };
    if (!me?.uid || !me?.username) {
      throw new Error("Pi /v2/me returned no user");
    }
    const session = await useSession<PiSessionData>(sessionConfig());
    await session.update({ uid: me.uid, username: me.username });
    return { uid: me.uid, username: me.username };
  });

export const getPiSession = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useSession<PiSessionData>(sessionConfig());
  if (!session.data?.uid) return { authenticated: false as const };
  return {
    authenticated: true as const,
    uid: session.data.uid,
    username: session.data.username,
  };
});

export const signOutPi = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<PiSessionData>(sessionConfig());
  await session.clear();
  return { ok: true };
});
