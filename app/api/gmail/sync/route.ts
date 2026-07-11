import { google } from "googleapis";
import { NextResponse } from "next/server";
import { getGoogleOAuthClient } from "../../../../lib/google";
import { supabaseServer } from "../../../../lib/supabase-server";

const kotakQuery = process.env.GMAIL_TRANSACTION_QUERY || "newer_than:180d {from:(kotak.com) from:(kotakmahindra.com) subject:(Kotak) subject:(transaction) subject:(payment)}";

export async function GET(request: Request) {
  try {
    if (!supabaseServer) throw new Error("Supabase server environment variables are not configured");
    const { data: connection, error: connectionError } = await supabaseServer.from("gmail_connections").select("gmail_address, refresh_token").eq("owner_key", "demo").order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (connectionError || !connection) return NextResponse.json({ connected: false, message: "Connect Gmail first" }, { status: 404 });

    const oauthClient = getGoogleOAuthClient();
    oauthClient.setCredentials({ refresh_token: connection.refresh_token });
    const gmail = google.gmail({ version: "v1", auth: oauthClient });
    const list = await gmail.users.messages.list({ userId: "me", q: kotakQuery, maxResults: 50 });
    const messageIds = (list.data.messages || []).map((message) => message.id).filter((id): id is string => Boolean(id));
    const messages = await Promise.all(messageIds.slice(0, 25).map(async (id) => {
      const result = await gmail.users.messages.get({ userId: "me", id, format: "metadata", metadataHeaders: ["From", "Subject", "Date"] });
      const headers = result.data.payload?.headers || [];
      return {
        id,
        snippet: result.data.snippet || "",
        from: headers.find((header) => header.name?.toLowerCase() === "from")?.value || "",
        subject: headers.find((header) => header.name?.toLowerCase() === "subject")?.value || "",
        date: headers.find((header) => header.name?.toLowerCase() === "date")?.value || "",
      };
    }));

    return NextResponse.json({ connected: true, email: connection.gmail_address, query: kotakQuery, count: messages.length, messages });
  } catch {
    return NextResponse.json({ connected: false, message: "Gmail sync failed" }, { status: 500 });
  }
}
