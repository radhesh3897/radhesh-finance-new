import { google } from "googleapis";
import { NextResponse } from "next/server";
import { getGoogleOAuthClient, GMAIL_READONLY_SCOPE } from "../../../../lib/google";
import { supabaseServer } from "../../../../lib/supabase-server";

function readCookie(cookieHeader: string | null, name: string) {
  const match = cookieHeader?.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function redirectWithStatus(request: Request, status: string) {
  const redirect = new URL("/", request.url);
  redirect.searchParams.set("gmail", status);
  return NextResponse.redirect(redirect);
}

function redirectWithDetail(request: Request, status: string, detail: string) {
  const redirect = new URL("/", request.url);
  redirect.searchParams.set("gmail", status);
  redirect.searchParams.set("detail", detail.replace(/\s+/g, " ").slice(0, 160));
  return NextResponse.redirect(redirect);
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function googleErrorDetail(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const maybeError = error as {
      code?: number;
      status?: number;
      message?: string;
      errors?: Array<{ reason?: string; message?: string }>;
      response?: {
        status?: number;
        data?: {
          error?: {
            code?: number;
            status?: string;
            message?: string;
            errors?: Array<{ reason?: string; message?: string }>;
          };
        };
      };
    };
    const responseError = maybeError.response?.data?.error;
    const nestedError = responseError?.errors?.[0];
    const topError = maybeError.errors?.[0];
    return [
      responseError?.code || maybeError.response?.status || maybeError.code || maybeError.status,
      responseError?.status,
      nestedError?.reason || topError?.reason,
      nestedError?.message || responseError?.message || topError?.message || maybeError.message || errorMessage(error),
    ].filter(Boolean).join(" ");
  }
  return errorMessage(error);
}

function gmailProfileStatus(error: unknown) {
  const message = googleErrorDetail(error).toLowerCase();
  if (message.includes("gmail api") && (message.includes("disabled") || message.includes("not been used"))) {
    return "gmail-api-disabled";
  }
  if (message.includes("insufficient") || message.includes("permission") || message.includes("scope")) {
    return "gmail-scope-missing";
  }
  return "gmail-profile-failed";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const googleError = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = readCookie(request.headers.get("cookie"), "gmail_oauth_state");

  if (googleError) {
    return redirectWithStatus(request, "google-denied");
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWithStatus(request, "authorization-failed");
  }

  if (!supabaseServer) return redirectWithStatus(request, "supabase-not-configured");

  const oauthClient = getGoogleOAuthClient();
  let tokens;
  try {
    const tokenResponse = await oauthClient.getToken(code);
    tokens = tokenResponse.tokens;
  } catch (error) {
    console.error("Gmail token exchange failed", errorMessage(error));
    return redirectWithStatus(request, "token-exchange-failed");
  }

  try {
    oauthClient.setCredentials(tokens);
    if (tokens.scope && !tokens.scope.split(/\s+/).includes(GMAIL_READONLY_SCOPE)) {
      return redirectWithDetail(request, "gmail-scope-missing", `Granted scopes: ${tokens.scope}`);
    }
    const gmail = google.gmail({ version: "v1", auth: oauthClient });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const gmailAddress = profile.data.emailAddress;
    if (!gmailAddress) return redirectWithStatus(request, "missing-gmail-address");
    if (!tokens.refresh_token) {
      const redirect = new URL("/", request.url);
      redirect.searchParams.set("gmail", "missing-refresh-token");
      redirect.searchParams.set("email", gmailAddress);
      return NextResponse.redirect(redirect);
    }

    const { error } = await supabaseServer.from("gmail_connections").upsert({
      owner_key: "demo",
      gmail_address: gmailAddress,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope || GMAIL_READONLY_SCOPE,
      updated_at: new Date().toISOString(),
    }, { onConflict: "owner_key,gmail_address" });
    if (error) {
      console.error("Gmail connection save failed", { code: error.code, message: error.message });
      return redirectWithStatus(request, "supabase-save-failed");
    }

    const redirect = new URL("/?gmail=connected", request.url);
    redirect.searchParams.set("email", gmailAddress);
    const response = NextResponse.redirect(redirect);
    response.cookies.delete("gmail_oauth_state");
    return response;
  } catch (error) {
    const detail = googleErrorDetail(error);
    console.error("Gmail profile or save failed", detail);
    return redirectWithDetail(request, gmailProfileStatus(error), detail);
  }
}
