import { google } from "googleapis";
import { NextResponse } from "next/server";
import { getGoogleOAuthClient, GMAIL_READONLY_SCOPE } from "../../../../lib/google";
import { supabaseServer } from "../../../../lib/supabase-server";

function readCookie(cookieHeader: string | null, name: string) {
  const match = cookieHeader?.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = readCookie(request.headers.get("cookie"), "gmail_oauth_state");

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/?gmail=authorization-failed", request.url));
  }

  try {
    if (!supabaseServer) throw new Error("Supabase server environment variables are not configured");
    const oauthClient = getGoogleOAuthClient();
    const { tokens } = await oauthClient.getToken(code);
    oauthClient.setCredentials(tokens);
    const gmail = google.gmail({ version: "v1", auth: oauthClient });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const gmailAddress = profile.data.emailAddress;
    if (!gmailAddress || !tokens.refresh_token) throw new Error("Google did not return a Gmail address or refresh token");

    const { error } = await supabaseServer.from("gmail_connections").upsert({
      owner_key: "demo",
      gmail_address: gmailAddress,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope || GMAIL_READONLY_SCOPE,
      updated_at: new Date().toISOString(),
    }, { onConflict: "owner_key,gmail_address" });
    if (error) throw error;

    const redirect = new URL("/?gmail=connected", request.url);
    redirect.searchParams.set("email", gmailAddress);
    const response = NextResponse.redirect(redirect);
    response.cookies.delete("gmail_oauth_state");
    return response;
  } catch {
    return NextResponse.redirect(new URL("/?gmail=connection-error", request.url));
  }
}
