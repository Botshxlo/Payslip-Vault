export interface TokenStatus {
  label: string;
  healthy: boolean;
  message: string;
}

export async function checkTokenExpiry(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  label: string
): Promise<TokenStatus> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      return {
        label,
        healthy: false,
        message: `Refresh failed (${res.status}). Token may be revoked or expired.`,
      };
    }

    const data = (await res.json()) as Record<string, unknown>;

    if (typeof data.refresh_token_expires_in === "number") {
      const secondsLeft = data.refresh_token_expires_in as number;
      const daysLeft = Math.floor(secondsLeft / 86400);

      if (secondsLeft < 172800) {
        return {
          label,
          healthy: false,
          message: `Expires in ${daysLeft} day(s). Re-authorize immediately.`,
        };
      }
    }

    return { label, healthy: true, message: "Token is healthy." };
  } catch (err) {
    return {
      label,
      healthy: false,
      message: `Check failed: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
}
