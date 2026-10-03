import { afterEach, expect, it, vi } from "vitest";
import { authorizationUrl, exchangeOAuthCode } from "./oauth";
import { verifyTurnstile } from "./turnstile";

// Contract fixtures only: these tests never contact a provider or use real credentials.
const config = { appOrigin: "https://app.example.test", apiOrigin: "https://api.example.test",
  googleClientId: "test-google", googleClientSecret: "test-secret",
  githubClientId: "test-github", githubClientSecret: "test-secret" };
afterEach(() => vi.unstubAllGlobals());

it.each(["google", "github"] as const)("OAuth %s preserves callback and state", (provider) => {
  const url = new URL(authorizationUrl(provider, config, "fixture-state"));
  expect(url.searchParams.get("state")).toBe("fixture-state");
  expect(url.searchParams.get("redirect_uri")).toBe(`https://api.example.test/auth/${provider}/callback`);
  expect(url.searchParams.get("client_id")).toBe(`test-${provider}`);
});

it("Google profile is read with exchanged bearer token", async () => {
  const outbound = vi.fn().mockResolvedValueOnce(Response.json({ access_token: "fixture-token" }))
    .mockResolvedValueOnce(Response.json({ sub: "google-1", email: "google@example.test", email_verified: true, name: "Google user" }));
  vi.stubGlobal("fetch", outbound);
  expect(await exchangeOAuthCode("google", "fixture-code", config)).toEqual({ provider: "google", providerAccountId: "google-1", email: "google@example.test", name: "Google user", avatarUrl: null });
  expect(outbound.mock.calls[1][1].headers.authorization).toBe("Bearer fixture-token");
});

it("GitHub chooses a verified primary email", async () => {
  const outbound = vi.fn().mockImplementation(async (url: string) => {
    if (url.endsWith("access_token")) return Response.json({ access_token: "fixture-token" });
    if (url.endsWith("/user/emails")) return Response.json([
      { email: "unverified@example.test", primary: false, verified: false },
      { email: "github@example.test", primary: true, verified: true }
    ]);
    if (url.endsWith("/user")) return Response.json({ id: 123, name: "GitHub user" });
    throw new Error(`Unexpected external request: ${url}`);
  });
  vi.stubGlobal("fetch", outbound);
  expect(await exchangeOAuthCode("github", "fixture-code", config)).toEqual({ provider: "github", providerAccountId: "123", email: "github@example.test", name: "GitHub user", avatarUrl: null });
});

it.each(["google", "github"] as const)("OAuth %s propagates token failure", async (provider) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
  await expect(exchangeOAuthCode(provider, "fixture-code", config)).rejects.toThrow("OAUTH_TOKEN_FAILED");
});

it("Turnstile accepts a verified token and sends its token/IP", async () => {
  const outbound = vi.fn().mockResolvedValue(Response.json({ success: true }));
  vi.stubGlobal("fetch", outbound);
  await expect(verifyTurnstile("test-secret", "fixture-token", "192.0.2.1")).resolves.toBeUndefined();
  expect(outbound.mock.calls[0][1].body.get("response")).toBe("fixture-token");
  expect(outbound.mock.calls[0][1].body.get("remoteip")).toBe("192.0.2.1");
});

it.each([
  [null, 200, true, "TURNSTILE_TOKEN_MISSING"],
  ["fixture-token", 503, false, "TURNSTILE_VERIFY_FAILED"],
  ["fixture-token", 200, false, "TURNSTILE_INVALID"]
] as const)("Turnstile rejects missing/failed/invalid verification %s %s %s", async (token, status, success, error) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ success }, { status })));
  await expect(verifyTurnstile("test-secret", token, null)).rejects.toThrow(error);
});
