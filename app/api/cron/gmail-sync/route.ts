import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!expected || authorization !== `Bearer ${expected}`) return new NextResponse("Unauthorized", { status: 401 });

  const syncUrl = new URL("/api/gmail/sync", request.url);
  const response = await fetch(syncUrl, { cache: "no-store" });
  const result = await response.json().catch(() => ({ message: "Gmail sync returned an invalid response" }));
  return NextResponse.json({ ...result, scheduled: true }, { status: response.status });
}
