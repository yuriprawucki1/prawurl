import type { OAuthProvider } from "../shared/contracts";

export interface OAuthProfile {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface OAuthConfig {
  appOrigin: string;
  apiOrigin: string;
  googleClientId: string;
  googleClientSecret: string;
  githubClientId: string;
  githubClientSecret: string;
}

export function authorizationUrl(provider: OAuthProvider, config: OAuthConfig, state: string): string {
  const redirectUri = `${config.apiOrigin}/auth/${provider}/callback`;

  if (provider === "google") {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", config.googleClientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    return url.toString();
  }

  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", config.githubClientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "read:user user:email");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeOAuthCode(provider: OAuthProvider, code: string, config: OAuthConfig): Promise<OAuthProfile> {
  return provider === "google" ? exchangeGoogle(code, config) : exchangeGitHub(code, config);
}

async function exchangeGoogle(code: string, config: OAuthConfig): Promise<OAuthProfile> {
  const redirectUri = `${config.apiOrigin}/auth/google/callback`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri
    })
  });

  if (!tokenResponse.ok) {
    throw new Error("OAUTH_TOKEN_FAILED");
  }

  const token = (await tokenResponse.json()) as { access_token: string };
  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { authorization: `Bearer ${token.access_token}` }
  });

  if (!profileResponse.ok) {
    throw new Error("OAUTH_PROFILE_FAILED");
  }

  const profile = (await profileResponse.json()) as { sub: string; email: string; name?: string; picture?: string };
  return {
    provider: "google",
    providerAccountId: profile.sub,
    email: profile.email,
    name: profile.name ?? null,
    avatarUrl: profile.picture ?? null
  };
}

async function exchangeGitHub(code: string, config: OAuthConfig): Promise<OAuthProfile> {
  const redirectUri = `${config.apiOrigin}/auth/github/callback`;
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      client_id: config.githubClientId,
      client_secret: config.githubClientSecret,
      code,
      redirect_uri: redirectUri
    })
  });

  if (!tokenResponse.ok) {
    throw new Error("OAUTH_TOKEN_FAILED");
  }

  const token = (await tokenResponse.json()) as { access_token: string };
  const [userResponse, emailsResponse] = await Promise.all([
    fetch("https://api.github.com/user", { headers: githubHeaders(token.access_token) }),
    fetch("https://api.github.com/user/emails", { headers: githubHeaders(token.access_token) })
  ]);

  if (!userResponse.ok || !emailsResponse.ok) {
    throw new Error("OAUTH_PROFILE_FAILED");
  }

  const user = (await userResponse.json()) as { id: number; name?: string; avatar_url?: string; email?: string };
  const emails = (await emailsResponse.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
  const email = user.email ?? emails.find((item) => item.primary && item.verified)?.email ?? emails.find((item) => item.verified)?.email;

  if (!email) {
    throw new Error("OAUTH_EMAIL_MISSING");
  }

  return {
    provider: "github",
    providerAccountId: String(user.id),
    email,
    name: user.name ?? null,
    avatarUrl: user.avatar_url ?? null
  };
}

function githubHeaders(token: string): HeadersInit {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "user-agent": "prawurl"
  };
}
