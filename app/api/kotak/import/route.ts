import { randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { parseInboxImport } from "../../../../lib/gmail-parser";
import { supabaseServer } from "../../../../lib/supabase-server";

type InboxImport = {
  gmailMessageId?: string;
  gmailThreadId?: string;
  gmailAddress?: string;
  fromAddress?: string;
  subject?: string;
  snippet?: string;
  body?: string;
  receivedAt?: string;
};

function hasValidSecret(request: Request) {
  const expected = process.env.KOTAK_IMPORT_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

function localDate(iso: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Calcutta" }).format(new Date(iso));
}

function localMonth(iso: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Calcutta", year: "numeric", month: "2-digit" }).formatToParts(new Date(iso));
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}

export async function POST(request: Request) {
  if (!hasValidSecret(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: "Server database is not configured" }, { status: 500 });

  let input: InboxImport;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Request must contain JSON" }, { status: 400 });
  }

  const gmailMessageId = input.gmailMessageId?.trim();
  const gmailAddress = input.gmailAddress?.trim().toLowerCase();
  const fromAddress = input.fromAddress?.trim();
  const subject = input.subject?.trim();
  if (!gmailMessageId || !gmailAddress || !fromAddress || !subject) {
    return NextResponse.json({ error: "gmailMessageId, gmailAddress, fromAddress, and subject are required" }, { status: 400 });
  }

  const parsed = parseInboxImport({
    id: gmailMessageId,
    threadId: input.gmailThreadId,
    from: fromAddress,
    subject,
    snippet: input.snippet?.slice(0, 1000),
    body: input.body?.slice(0, 12000),
    receivedAt: input.receivedAt,
  });

  const { data: savedMessage, error: messageError } = await supabaseServer
    .from("gmail_messages")
    .upsert({
      owner_key: "demo",
      gmail_message_id: parsed.id,
      gmail_thread_id: parsed.threadId,
      gmail_address: gmailAddress,
      from_address: parsed.from,
      subject: parsed.subject,
      snippet: parsed.snippet,
      received_at: parsed.receivedAt,
      amount: parsed.amount,
      transaction_type: parsed.type,
      merchant: parsed.merchant,
      category: parsed.category,
      updated_at: new Date().toISOString(),
    }, { onConflict: "owner_key,gmail_message_id" })
    .select("id,imported_transaction_id")
    .maybeSingle();

  if (messageError || !savedMessage) return NextResponse.json({ error: "Could not save the email record" }, { status: 500 });
  if (savedMessage.imported_transaction_id || !parsed.amount || !parsed.type) {
    return NextResponse.json({ saved: true, imported: false, messageId: savedMessage.id });
  }

  const { data: existingTransaction, error: existingError } = await supabaseServer
    .from("transactions")
    .select("id")
    .eq("owner_key", "demo")
    .eq("source_email_id", savedMessage.id)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: "Could not check existing transaction" }, { status: 500 });

  const transactionId = existingTransaction?.id || randomUUID();
  if (!existingTransaction) {
    const { error: transactionError } = await supabaseServer.from("transactions").insert({
      id: transactionId,
      owner_key: "demo",
      name: parsed.merchant,
      category: parsed.category,
      source: parsed.type === "income" ? parsed.merchant : null,
      date: localDate(parsed.receivedAt),
      month: localMonth(parsed.receivedAt),
      amount: parsed.amount,
      type: parsed.type,
      icon: parsed.type === "income" ? "+" : "*",
      color: parsed.type === "income" ? "mint" : "peach",
      source_email_id: savedMessage.id,
    });
    if (transactionError) return NextResponse.json({ error: "Could not save the transaction" }, { status: 500 });
  }

  const { error: linkError } = await supabaseServer
    .from("gmail_messages")
    .update({ imported_transaction_id: transactionId, updated_at: new Date().toISOString() })
    .eq("id", savedMessage.id);
  if (linkError) return NextResponse.json({ error: "Could not link the transaction to its email" }, { status: 500 });

  return NextResponse.json({ saved: true, imported: true, messageId: savedMessage.id, transactionId });
}
