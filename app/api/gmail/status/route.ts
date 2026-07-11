import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase-server";

export async function GET() {
  if (!supabaseServer) return NextResponse.json({ connected: false, status: "not-configured" });

  const { data, error } = await supabaseServer.from("gmail_connections").select("gmail_address, updated_at").eq("owner_key", "demo").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return NextResponse.json({ connected: false, status: "schema-pending" });

  if (!data) {
    const { data: imported, error: importError } = await supabaseServer
      .from("gmail_messages")
      .select("gmail_address, updated_at")
      .eq("owner_key", "demo")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (importError) return NextResponse.json({ connected: false, status: "schema-pending" });
    if (imported?.gmail_address) {
      return NextResponse.json({ connected: true, email: imported.gmail_address, updatedAt: imported.updated_at, status: "connected", mode: "apps-script" });
    }
  }

  return NextResponse.json({
    connected: Boolean(data?.gmail_address),
    email: data?.gmail_address || null,
    updatedAt: data?.updated_at || null,
    status: data?.gmail_address ? "connected" : "not-connected",
    mode: data?.gmail_address ? "oauth" : null,
  });
}
