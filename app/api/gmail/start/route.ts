import { NextResponse } from "next/server";
import { getGoogleOAuthClient, GMAIL_READONLY_SCOPE } from "../../../../lib/google";

export async function GET(request: Request) {
  try {
    const state = crypto.randomUUID();
    const oauthClient = getGoogleOAuthClient();
    const authorizationUrl = oauthClient.generateAuthUrl({
      access_type: "offline",
      prompt: "select_account consent",
      include_granted_scopes: false,
      login_hint: "aradhesh2009@gmail.com",
      scope: [GMAIL_READONLY_SCOPE],
      state,
    });
    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set("gmail_oauth_state", state, {
      httpOnly: true,
      maxAge: 600,
      path: "/",
      sameSite: "lax",
      secure: new URL(request.url).protocol === "https:",
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/?gmail=not-configured", request.url));
  }
}
