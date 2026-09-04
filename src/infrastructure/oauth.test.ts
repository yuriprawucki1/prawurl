import { afterEach, describe, expect, it, vi } from "vitest";
import { exchangeOAuthCode, type OAuthConfig } from "./oauth";

const config: OAuthConfig = {
  appOrigin: "https://app.prawurl.com",
  apiOrigin: "https://api.prawurl.com",
  googleClientId: "google-client",
  googleClientSecret: "google-secret",
  githubClientId: "github-client",
  githubClientSecret: "github-secret"
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OAuth profile validation", () => {
  it("rejects a Google profile without a verified email", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "https://oauth2.googleapis.com/token") {
          return new Response(JSON.stringify({ access_token: "google-token" }), { status: 200 });
        }
        return new Response(JSON.stringify({ sub: "google-user", email: "user@example.com", email_verified: false }), { status: 200 });
      })
    );

    await expect(exchangeOAuthCode("google", "code", config)).rejects.toThrow("OAUTH_EMAIL_UNVERIFIED");
  });

  it("uses only verified GitHub email addresses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "https://github.com/login/oauth/access_token") {
          return new Response(JSON.stringify({ access_token: "github-token" }), { status: 200 });
        }
        if (url === "https://api.github.com/user") {
          return new Response(JSON.stringify({ id: 42, email: "unverified@example.com" }), { status: 200 });
        }
        return new Response(JSON.stringify([{ email: "unverified@example.com", primary: true, verified: false }]), { status: 200 });
      })
    );

    await expect(exchangeOAuthCode("github", "code", config)).rejects.toThrow("OAUTH_EMAIL_MISSING");
  });

  it("prefers a verified primary GitHub email", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "https://github.com/login/oauth/access_token") {
          return new Response(JSON.stringify({ access_token: "github-token" }), { status: 200 });
        }
        if (url === "https://api.github.com/user") {
          return new Response(JSON.stringify({ id: 42, name: "User", avatar_url: null, email: null }), { status: 200 });
        }
        return new Response(
          JSON.stringify([
            { email: "verified@example.com", primary: true, verified: true },
            { email: "other@example.com", primary: false, verified: true }
          ]),
          { status: 200 }
        );
      })
    );

    await expect(exchangeOAuthCode("github", "code", config)).resolves.toMatchObject({
      provider: "github",
      providerAccountId: "42",
      email: "verified@example.com"
    });
  });
});
