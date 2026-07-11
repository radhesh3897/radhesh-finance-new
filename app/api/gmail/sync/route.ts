import { randomUUID } from "node:crypto";
import { google } from "googleapis";
import { NextResponse } from "next/server";
import { getGoogleOAuthClient } from "../../../../lib/google";
import { parseGmailMessage } from "../../../../lib/gmail-parser";
import { supabaseServer } from "../../../../lib/supabase-server";

function monthBounds() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Calcutta", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value || "2026";
  const month = Number(parts.find((part) => part.type === "month")?.value || "1");
  const nextYear = month === 12 ? Number(year) + 1 : Number(year);
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    after: `${year}/${String(month).padStart(2, "0")}/01`,
    before: `${nextYear}/${String(nextMonth).padStart(2, "0")}/01`,
  };
}

const bounds = monthBounds();
const kotakQuery = process.env.GMAIL_TRANSACTION_QUERY || `in:anywhere after:${bounds.after} before:${bounds.before} {from:(kotak) from:(mahindra) subject:(kotak) subject:(debited) subject:(credited) subject:(debit) subject:(credit) subject:(transaction) subject:(payment)}`;

function localDate(iso: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Calcutta" }).format(new Date(iso));
}

function localMonth(iso: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Calcutta", year: "numeric", month: "2-digit" }).formatToParts(new Date(iso));
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}

export async function GET() {
  try {
    if (!supabaseServer) throw new Error("Supabase server environment variables are not configured");
    const { data: connection, error: connectionError } = await supabaseServer.from("gmail_connections").select("gmail_address, refresh_token").eq("owner_key", "demo").order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (connectionError || !connection) return NextResponse.json({ connected: false, message: "Connect Gmail first" }, { status: 404 });

    const oauthClient = getGoogleOAuthClient();
    oauthClient.setCredentials({ refresh_token: connection.refresh_token });
    const gmail = google.gmail({ version: "v1", auth: oauthClient });
    const list = await gmail.users.messages.list({ userId: "me", q: kotakQuery, maxResults: 100 });
    const messageIds = (list.data.messages || []).map((message) => message.id).filter((id): id is string => Boolean(id));
    const parsedMessages = await Promise.all(messageIds.slice(0, 50).map(async (id) => {
      const result = await gmail.users.messages.get({ userId: "me", id, format: "full" });
      return parseGmailMessage(result.data);
    }));

    const rows = parsedMessages.map((message) => ({
      owner_key: "demo",
      gmail_message_id: message.id,
      gmail_thread_id: message.threadId,
      gmail_address: connection.gmail_address,
      from_address: message.from,
      subject: message.subject,
      snippet: message.snippet,
      received_at: message.receivedAt,
      amount: message.amount,
      transaction_type: message.type,
      merchant: message.merchant,
      category: message.category,
      updated_at: new Date().toISOString(),
    }));
    const { data: savedMessages, error: messageError } = await supabaseServer.from("gmail_messages").upsert(rows, { onConflict: "owner_key,gmail_message_id" }).select("id,gmail_message_id,imported_transaction_id");
    if (messageError) throw messageError;

    let importedCount = 0;
    for (const message of parsedMessages) {
      const saved = savedMessages?.find((row) => row.gmail_message_id === message.id);
      if (!saved || saved.imported_transaction_id || !message.amount || !message.type) continue;
      const transactionId = randomUUID();
      const { error: transactionError } = await supabaseServer.from("transactions").insert({
        id: transactionId,
        owner_key: "demo",
        name: message.merchant,
        category: message.category,
        source: message.type === "income" ? message.merchant : null,
        date: localDate(message.receivedAt),
        month: localMonth(message.receivedAt),
        amount: message.amount,
        type: message.type,
        icon: message.type === "income" ? "+" : "*",
        color: message.type === "income" ? "mint" : "peach",
        source_email_id: saved.id,
      });
      if (transactionError && !/duplicate key/i.test(transactionError.message || "")) throw transactionError;
      const { error: linkError } = await supabaseServer.from("gmail_messages").update({ imported_transaction_id: transactionId, updated_at: new Date().toISOString() }).eq("id", saved.id);
      if (linkError) throw linkError;
      importedCount += 1;
    }

    return NextResponse.json({ connected: true, email: connection.gmail_address, query: kotakQuery, count: parsedMessages.length, importedCount, messages: parsedMessages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gmail sync failed";
    return NextResponse.json({ connected: false, message: /gmail_messages|source_email_id/i.test(message) ? "Run the latest Supabase schema before syncing Gmail" : "Gmail sync failed" }, { status: 500 });
  }
}
