export async function verifyTurnstile(secret: string | undefined, token: string | null, remoteIp: string | null): Promise<void> {
  if (!secret) {
    return;
  }

  if (!token) {
    throw new Error("TURNSTILE_TOKEN_MISSING");
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret,
      response: token,
      ...(remoteIp ? { remoteip: remoteIp } : {})
    })
  });

  if (!response.ok) {
    throw new Error("TURNSTILE_VERIFY_FAILED");
  }

  const result = (await response.json()) as { success: boolean };
  if (!result.success) {
    throw new Error("TURNSTILE_INVALID");
  }
}
