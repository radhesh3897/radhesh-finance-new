export type ParsedMail = {
  id: string;
  threadId: string | null;
  from: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  amount: number | null;
  type: "income" | "expense" | null;
  merchant: string;
  category: string;
};

function decodeBase64Url(value: string) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

export function gmailPayloadText(payload: any): string {
  if (payload?.body?.data) return decodeBase64Url(payload.body.data);
  return (payload?.parts || []).map((part: any) => gmailPayloadText(part)).filter(Boolean).join("\n");
}

export function htmlToText(value: string) {
  return value.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
}

function firstAmount(text: string) {
  const match = text.match(/(?:₹|INR|Rs\.?|Rupees)\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

function classify(text: string): "income" | "expense" | null {
  if (/\b(credited|credit\s+alert|cash\s+deposit|received|deposit|salary|refund|reversed)\b/i.test(text)) return "income";
  if (/\b(debited|debit|payment\s+of|upi\s+payment|card\s+transaction|transaction\s+of|has\s+been\s+processed|spent|purchase|paid|withdrawn|transferred)\b/i.test(text)) return "expense";
  return null;
}

export function isKotakTransactionEmail(input: { from: string; subject: string; snippet?: string; body?: string }) {
  const from = input.from.toLowerCase();
  const text = `${input.subject}\n${input.snippet || ""}\n${input.body || ""}`.toLowerCase();
  const isKotakSender = /@(\w+[.-])*kotak(?:\.bank)?\.in\b|@kotak\.com\b/.test(from);
  const hasAmount = /(?:₹|â‚¹|inr|rs\.?|rupees)\s*[0-9][0-9,]*(?:\.\d{1,2})?/i.test(text);
  const hasTransactionSignal = /\b(debited|credited|credit\s+alert|payment\s+of|upi\s+payment|card\s+transaction|transaction\s+of|has\s+been\s+processed)\b/i.test(text);
  const isNonTransaction = /\b(new\s+bill|bill\s+generated|amount\s+due|credit\s+card\s+bill|statement|registration\s+successful|upi\s+pin|scheduled\s+maintenance|reward\s+points|failed\s+attempt|important\s+update)\b/i.test(text);
  return isKotakSender && hasAmount && hasTransactionSignal && !isNonTransaction;
}

function categoryFor(text: string, type: "income" | "expense" | null) {
  if (type === "income") return /salary|payroll/i.test(text) ? "Salary" : "Income from bank";
  if (/grocery|groceries|basket|supermarket/i.test(text)) return "Groceries";
  if (/uber|ola|rapido|metro|transport|fuel|petrol|diesel/i.test(text)) return "Transport";
  if (/amazon|flipkart|shopping|myntra/i.test(text)) return "Shopping";
  if (/swiggy|zomato|restaurant|food|dining/i.test(text)) return "Dining";
  if (/electricity|water bill|broadband|utility/i.test(text)) return "Utilities";
  if (/netflix|notion|subscription|spotify/i.test(text)) return "Subscriptions";
  return "Other expense";
}

function merchantFor(subject: string, text: string, type: "income" | "expense" | null) {
  const cleanedSubject = subject.replace(/^(re:|fwd?:)\s*/gi, "").replace(/kotak\s*mahindra\s*(bank)?/gi, "").trim();
  if (cleanedSubject) return cleanedSubject.slice(0, 120);
  if (type === "income") return "Bank credit";
  const match = text.match(/(?:at|to|from|merchant)\s+([A-Za-z][A-Za-z0-9 &'().-]{2,60})/i);
  return match?.[1]?.trim() || "Kotak transaction";
}

export function parseGmailMessage(message: any): ParsedMail {
  const headers = message.payload?.headers || [];
  const header = (name: string) => headers.find((item: any) => item.name?.toLowerCase() === name.toLowerCase())?.value || "";
  const subject = header("Subject");
  const rawText = gmailPayloadText(message.payload || {});
  const text = htmlToText(rawText);
  const type = classify(`${subject} ${text}`);
  const amount = firstAmount(`${subject} ${text}`);
  const receivedAt = new Date(Number(message.internalDate || Date.now())).toISOString();
  return {
    id: message.id,
    threadId: message.threadId || null,
    from: header("From"),
    subject,
    snippet: message.snippet || text.slice(0, 240),
    receivedAt,
    amount,
    type,
    merchant: merchantFor(subject, text, type),
    category: categoryFor(`${subject} ${text}`, type),
  };
}

/**
 * Parses the small, plain-text message payload sent by the Gmail-side Apps Script.
 * The full email body is deliberately not stored in Supabase.
 */
export function parseInboxImport(input: {
  id: string;
  threadId?: string | null;
  from: string;
  subject: string;
  snippet?: string;
  body?: string;
  receivedAt?: string;
}): ParsedMail {
  const text = htmlToText(`${input.subject}\n${input.snippet || ""}\n${input.body || ""}`);
  const parsedDate = input.receivedAt ? new Date(input.receivedAt) : new Date();
  const receivedAt = Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();
  const type = classify(text);

  return {
    id: input.id,
    threadId: input.threadId || null,
    from: input.from,
    subject: input.subject,
    snippet: (input.snippet || text).slice(0, 500),
    receivedAt,
    amount: firstAmount(text),
    type,
    merchant: merchantFor(input.subject, text, type),
    category: categoryFor(text, type),
  };
}
