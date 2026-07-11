import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase-server";

export async function GET() {
  if (!supabaseServer) return NextResponse.json({ connected: false, status: "not-configured" });

  const { data, error } = await supabaseServer.from("gmail_connections").select("gmail_address, updated_at").eq("owner_key", "demo").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return NextResponse.json({ connected: false, status: "schema-pending" });

  return NextResponse.json({
    connected: Boolean(data?.gmail_address),
    email: data?.gmail_address || null,
    updatedAt: data?.updated_at || null,
    status: data?.gmail_address ? "connected" : "not-connected",
  });
}
