import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase-server";

export async function GET() {
  if (!supabaseServer) return NextResponse.json({ messages: [], status: "unavailable" }, { status: 500 });
  const { data, error } = await supabaseServer.from("gmail_messages").select("id,gmail_message_id,gmail_address,from_address,subject,snippet,received_at,amount,transaction_type,merchant,category,imported_transaction_id").eq("owner_key", "demo").order("received_at", { ascending: false }).limit(100);
  if (error) {
    return NextResponse.json({ messages: [], status: /gmail_messages/i.test(error.message || "") ? "schema-pending" : "unavailable" }, { status: 200 });
  }
  return NextResponse.json({ messages: data || [], status: "ready" });
}
