"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { supabase } from "../lib/supabase";
import { AnimatedCard, AnimatedGrid, AnimatedList, AnimatedListItem, AnimatedModal, AnimatedView, CountUp } from "../components/motion";

type View = "Overview" | "Transactions" | "Reports" | "Mail" | "Connections" | "Settings";
type Transaction = { id?: string; name: string; category: string; date: string; month: string; amount: number; type: "income" | "expense"; icon: string; color: string; source?: string };
type GmailConnection = { connected: boolean; email: string | null; updatedAt: string | null; status: string; mode?: "oauth" | "apps-script" | null };
type GmailMessage = { id: string; gmail_address: string; from_address: string; subject: string; snippet: string; received_at: string; amount: number | null; transaction_type: "income" | "expense" | null; merchant: string | null; category: string | null; imported_transaction_id: string | null };

const MONTHS = Array.from({ length: 12 }, (_, index) => {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - index);
  return {
    value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    label: date.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
  };
});

type Category = { name: string; kind: "income" | "expense"; color: string };

const money = (amount: number) => amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const transactionIdentity = (transaction: Transaction) => transaction.id || `${transaction.name}-${transaction.date}-${transaction.amount}-${transaction.type}`;
const totalsFor = (items: Transaction[]) => ({ income: items.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0), expense: items.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0) });
const shiftMonth = (month: string, offset: number) => { const [year, value] = month.split("-").map(Number); const date = new Date(year, value - 1 + offset, 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; };
const transactionDateValue = (transaction: Transaction) => { if (/^\d{4}-\d{2}-\d{2}$/.test(transaction.date)) return transaction.date; const day = transaction.date.match(/\d{1,2}/)?.[0] || "1"; return `${transaction.month}-${day.padStart(2, "0")}`; };
const displayDate = (transaction: Transaction) => new Date(`${transactionDateValue(transaction)}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const comparison = (current: number, previous: number) => previous > 0 ? ((current - previous) / previous) * 100 : null;

export default function Home() {
  const [view, setView] = useState<View>("Overview");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showConnect, setShowConnect] = useState(false);
  const [gmailConnection, setGmailConnection] = useState<GmailConnection>({ connected: false, email: null, updatedAt: null, status: "not-connected", mode: null });
  const [gmailMessages, setGmailMessages] = useState<GmailMessage[]>([]);
  const [gmailMessagesStatus, setGmailMessagesStatus] = useState("not-loaded");
  const [showInsights, setShowInsights] = useState(false);
  const [toast, setToast] = useState("");
  const [storageStatus, setStorageStatus] = useState("Local demo data");
  const [authenticated, setAuthenticated] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[0].value);
  const [ledgerFilter, setLedgerFilter] = useState<"all" | "income" | "expense">("all");

  const visibleTransactions = useMemo(() => transactions.filter((transaction) => transaction.month === selectedMonth), [transactions, selectedMonth]);
  const totals = useMemo(() => totalsFor(visibleTransactions), [visibleTransactions]);
  const previousTotals = useMemo(() => totalsFor(transactions.filter((transaction) => transaction.month === shiftMonth(selectedMonth, -1))), [transactions, selectedMonth]);

  useEffect(() => {
    if (!authenticated || !supabase) return;
    const client = supabase as NonNullable<typeof supabase>;
    let cancelled = false;
    async function loadSavedData() {
      const [transactionResult, categoryResult] = await Promise.all([
        client.from("transactions").select("*").eq("owner_key", "demo").order("created_at", { ascending: false }),
        client.from("categories").select("*").eq("owner_key", "demo").order("created_at", { ascending: true }),
      ]);
      if (cancelled) return;
      if (transactionResult.error || categoryResult.error) {
        setStorageStatus("Supabase connected · schema pending");
        return;
      }
      setTransactions((transactionResult.data || []).map((row) => ({ id: row.id, name: row.name, category: row.category, date: row.date, month: row.month || "2025-06", amount: Number(row.amount), type: row.type, source: row.source || undefined, icon: row.icon, color: row.color })));
      setCategories((categoryResult.data || []).map((row) => ({ name: row.name, kind: row.kind, color: row.color })));
      setStorageStatus(transactionResult.data?.length ? "Supabase connected" : "Supabase connected · no transactions yet");
    }
    loadSavedData();
    return () => { cancelled = true; };
  }, [authenticated]);

  const reloadSavedData = async () => {
    if (!supabase) return;
    const client = supabase as NonNullable<typeof supabase>;
    const [transactionResult, categoryResult] = await Promise.all([
      client.from("transactions").select("*").eq("owner_key", "demo").order("created_at", { ascending: false }),
      client.from("categories").select("*").eq("owner_key", "demo").order("created_at", { ascending: true }),
    ]);
    if (transactionResult.error || categoryResult.error) return;
    setTransactions((transactionResult.data || []).map((row) => ({ id: row.id, name: row.name, category: row.category, date: row.date, month: row.month || "2025-06", amount: Number(row.amount), type: row.type, source: row.source || undefined, icon: row.icon, color: row.color })));
    setCategories((categoryResult.data || []).map((row) => ({ name: row.name, kind: row.kind, color: row.color })));
  };

  const notify = (message: string) => { setToast(message); setTimeout(() => setToast(""), 2400); };

  const loadGmailStatus = async () => {
    try {
      const response = await fetch("/api/gmail/status", { cache: "no-store" });
      const result = await response.json();
      setGmailConnection({ connected: Boolean(result.connected), email: result.email || null, updatedAt: result.updatedAt || null, status: result.status || "not-connected", mode: result.mode || null });
    } catch {
      setGmailConnection((current) => ({ ...current, status: "unavailable" }));
    }
  };

  const loadGmailMessages = async () => {
    try {
      const response = await fetch("/api/gmail/messages", { cache: "no-store" });
      const result = await response.json();
      setGmailMessages(result.messages || []);
      setGmailMessagesStatus(result.status || "unavailable");
    } catch {
      setGmailMessagesStatus("unavailable");
    }
  };

  useEffect(() => {
    if (!authenticated) return;
    loadGmailStatus();
    loadGmailMessages();
    const interval = window.setInterval(loadGmailStatus, 30000);
    return () => window.clearInterval(interval);
  }, [authenticated]);

  async function syncGmailInBackground() {
    if (!gmailConnection.connected || gmailConnection.mode !== "oauth") return;
    try {
      const response = await fetch("/api/gmail/sync", { cache: "no-store" });
      if (!response.ok) return;
      const result = await response.json();
      await loadGmailMessages();
      if (result.importedCount) await reloadSavedData();
    } catch {
      // Background checks stay quiet; the Connections screen remains available for manual retry.
    }
  }

  useEffect(() => {
    if (!authenticated || !gmailConnection.connected || gmailConnection.mode !== "oauth") return;
    const interval = window.setInterval(() => { void syncGmailInBackground(); }, 15 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [authenticated, gmailConnection.connected, gmailConnection.mode]);

  useEffect(() => {
    if (window.localStorage.getItem("finance_dashboard_authenticated") === "true") setAuthenticated(true);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gmailStatus = params.get("gmail");
    const gmailDetail = params.get("detail");
    if (gmailStatus === "connected") notify(`Gmail connected${params.get("email") ? ` · ${params.get("email")}` : ""}`);
    if (gmailStatus === "not-configured") notify("Add the Google OAuth values to the local environment first");
    if (gmailStatus === "google-denied") notify("Google permission was not approved");
    if (gmailStatus === "authorization-failed") notify("Gmail connection failed: session check expired. Try again from this tab");
    if (gmailStatus === "missing-refresh-token") notify(`Google did not return a refresh token${params.get("email") ? ` for ${params.get("email")}` : ""}`);
    if (gmailStatus === "missing-gmail-address") notify("Google connected but did not return the Gmail address");
    if (gmailStatus === "supabase-not-configured") notify("Supabase server key is not configured");
    if (gmailStatus === "supabase-save-failed") notify("Gmail connected, but Supabase could not save it");
    if (gmailStatus === "token-exchange-failed") notify("Google token exchange failed. Check OAuth client secret and redirect URI");
    if (gmailStatus === "gmail-api-disabled") notify(gmailDetail ? `Gmail API disabled: ${gmailDetail}` : "Gmail API is disabled in Google Cloud. Enable it, then reconnect");
    if (gmailStatus === "gmail-scope-missing") notify(gmailDetail ? `Gmail scope issue: ${gmailDetail}` : "Gmail permission scope is missing. Check OAuth consent scopes");
    if (gmailStatus === "gmail-profile-failed") notify(gmailDetail ? `Gmail profile failed: ${gmailDetail}` : "Gmail profile check failed. Confirm Gmail API is enabled");
    if (gmailStatus === "connection-error") notify("Gmail connection failed during callback");
    if (gmailStatus) window.history.replaceState({}, "", window.location.pathname);
  }, []);

  async function syncGmail() {
    if (gmailConnection.mode !== "oauth") {
      await Promise.all([loadGmailStatus(), loadGmailMessages(), reloadSavedData()]);
      notify(gmailConnection.connected ? "Apps Script sync is active. New Kotak emails are checked every 15 minutes." : "Set up the Kotak Apps Script, then run it once to connect this inbox.");
      return;
    }
    const response = await fetch("/api/gmail/sync");
    const result = await response.json();
    if (!response.ok) { notify(result.message || "Connect Gmail first"); return; }
    await loadGmailStatus();
    await loadGmailMessages();
    if (result.importedCount) await reloadSavedData();
    notify(result.count ? `Synced ${result.count} Kotak email${result.count === 1 ? "" : "s"} · imported ${result.importedCount || 0}` : "No Kotak debit or credit emails found this month");
  }

  const openConnectionModal = () => { setShowConnect(true); void loadGmailStatus(); };

  async function addTransaction(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const amount = Number(form.get("amount"));
    const type = form.get("type") as "income" | "expense";
    const category = String(form.get("category") || "Other");
    const source = String(form.get("source") || "");
    const date = String(form.get("date") || `${selectedMonth}-01`);
    const month = date.slice(0, 7);
    const identity = editingTransaction ? transactionIdentity(editingTransaction) : null;
    const id = editingTransaction?.id || crypto.randomUUID();
    const nextTransaction: Transaction = {
      id,
      name: String(form.get("name") || "New transaction"),
      category,
      date,
      month,
      amount,
      type,
      source: type === "income" ? source : undefined,
      icon: type === "income" ? "+" : "*",
      color: type === "income" ? "mint" : "peach",
    };

    setTransactions((current) => editingTransaction && identity
      ? current.map((transaction) => transactionIdentity(transaction) === identity ? nextTransaction : transaction)
      : [nextTransaction, ...current]);
    setShowModal(false);
    setEditingTransaction(null);

    if (supabase) {
      const databasePayload = { name: nextTransaction.name, category, date: nextTransaction.date, month, amount, type, source: type === "income" ? source || null : null, icon: nextTransaction.icon, color: nextTransaction.color };
      const result = editingTransaction?.id
        ? await supabase.from("transactions").update(databasePayload).eq("owner_key", "demo").eq("id", editingTransaction.id)
        : editingTransaction
          ? { error: null }
          : await supabase.from("transactions").insert({ owner_key: "demo", id, ...databasePayload });
      if (result.error) { setStorageStatus("Supabase connected · schema pending"); notify(editingTransaction ? "Updated locally · check the Supabase schema" : "Added locally · run the Supabase schema to save permanently"); return; }
      setStorageStatus("Supabase connected");
    }

    notify(editingTransaction ? "Transaction updated" : `${type === "income" ? "Income" : "Expense"} saved in INR`);
  }

  async function addCategory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const category: Category = { name: String(form.get("categoryName")).trim(), kind: String(form.get("categoryKind")) as Category["kind"], color: "teal" };
    if (!category.name || categories.some((item) => item.name.toLowerCase() === category.name.toLowerCase())) { notify("That category already exists"); return; }
    setCategories((current) => [...current, category]);
    e.currentTarget.reset();
    if (supabase) {
      const { error } = await supabase.from("categories").insert({ owner_key: "demo", name: String(form.get("categoryName")), kind: String(form.get("categoryKind")), color: "teal" });
      if (error) { setStorageStatus("Supabase connected · schema pending"); notify("Added locally · run the Supabase schema to save permanently"); return; }
      setStorageStatus("Supabase connected");
    }
    notify("Category saved");
  }

  const closeTransactionModal = () => { setShowModal(false); setEditingTransaction(null); };
  const openAddTransaction = () => { setEditingTransaction(null); setShowModal(true); };
  const openEditTransaction = (transaction: Transaction) => { setEditingTransaction(transaction); setShowModal(true); };

  const nav = (next: View, filter?: "all" | "income" | "expense") => { if (filter) setLedgerFilter(filter); setView(next); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const signOut = () => { window.localStorage.removeItem("finance_dashboard_authenticated"); setAuthenticated(false); setView("Overview"); };

  if (!authenticated) return <LoginScreen onLogin={() => { window.localStorage.setItem("finance_dashboard_authenticated", "true"); setAuthenticated(true); }} />;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">₹</span><span>pocketwise</span></div>
        <nav>
          <p className="nav-label">Workspace</p>
          {(["Overview", "Transactions", "Reports", "Mail"] as View[]).map((item) => <button key={item} className={`nav-item ${view === item ? "active" : ""}`} onClick={() => nav(item)}><span>{item === "Overview" ? "O" : item === "Transactions" ? "↕" : item === "Reports" ? "R" : "M"}</span> {item}</button>)}
          <p className="nav-label second">Money flow</p>
          <div className="money-flow"><button className="flow-item income-flow" onClick={() => nav("Transactions", "income")}><span className="flow-icon">↗</span><span><strong>Income</strong><small>{money(totals.income)} this month</small></span><b>→</b></button><button className="flow-item expense-flow" onClick={() => nav("Transactions", "expense")}><span className="flow-icon">↘</span><span><strong>Expenses</strong><small>{money(totals.expense)} this month</small></span><b>→</b></button></div>
          <p className="nav-label second">Manage</p>
          <button className={`nav-item ${view === "Connections" ? "active" : ""}`} onClick={openConnectionModal}><span>~</span> Connections</button>
          <button className={`nav-item ${view === "Settings" ? "active" : ""}`} onClick={() => nav("Settings")}><span>⚙</span> Settings</button>
        </nav>
        <div className="sidebar-bottom"><div className="sync-card"><div className="sync-icon">@</div><div><strong>{gmailConnection.connected ? "Gmail connected" : "Connect your inbox"}</strong><p>{gmailConnection.connected ? gmailConnection.email : "Find expenses automatically"}</p></div><button onClick={openConnectionModal}>→</button></div><div className="profile"><div className="avatar">RA</div><div><strong>Radhesh Agrawal</strong><span>Indian rupee workspace</span></div></div><button className="sign-out" onClick={signOut}>Sign out <span>→</span></button></div>
      </aside>

      <section className="content">
        <header className="topbar"><div className="mobile-brand">₹ pocketwise</div><div className="breadcrumb">Personal / <strong>{view}</strong></div><div className="top-actions"><button className="icon-button" aria-label="Search transactions" onClick={() => nav("Transactions", "all")}>⌕</button><div className="mini-avatar">RA</div></div></header>
        <div className="page-wrap">
          <AnimatedView viewKey={view}>
           {view === "Overview" && <Overview totals={totals} previousTotals={previousTotals} transactions={visibleTransactions} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} onAdd={openAddTransaction} onNavigate={nav} onInsights={() => setShowInsights(true)} onEdit={openEditTransaction} />}
           {view === "Transactions" && <Transactions transactions={visibleTransactions} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} onAdd={openAddTransaction} onEdit={openEditTransaction} initialKind={ledgerFilter} />}
          {view === "Reports" && <Reports transactions={visibleTransactions} totals={totals} monthLabel={MONTHS.find((month) => month.value === selectedMonth)?.label || selectedMonth} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />}
          {view === "Mail" && <Mail messages={gmailMessages} status={gmailMessagesStatus} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} onSync={syncGmail} />}
          {view === "Settings" && <Settings categories={categories} onAddCategory={addCategory} storageStatus={storageStatus} />}
           {view === "Connections" && <Connections onConnect={openConnectionModal} onSync={syncGmail} connection={gmailConnection} />}
          </AnimatedView>
        </div>
      </section>

      <AnimatedModal open={showModal} onClose={closeTransactionModal}>
        <div className="modal-head"><div><p className="eyebrow">{editingTransaction ? "EDIT TRANSACTION · INR" : "MONEY MOVE · INR"}</p><h2>{editingTransaction ? "Edit transaction" : "Add transaction"}</h2></div><button onClick={closeTransactionModal}>×</button></div>
        <form onSubmit={addTransaction}>
          <label>Description<input name="name" defaultValue={editingTransaction?.name || ""} placeholder="e.g. Kotak card payment" required /></label>
          <div className="form-row"><label>Amount in INR<input name="amount" type="number" min="0.01" step="0.01" defaultValue={editingTransaction?.amount || ""} placeholder="0.00" required /></label><label>Date<input name="date" type="date" defaultValue={editingTransaction ? transactionDateValue(editingTransaction) : `${selectedMonth}-01`} required /></label></div>
          <div className="form-row"><label>Type<select name="type" defaultValue={editingTransaction?.type || "expense"}><option value="expense">Expense</option><option value="income">Income</option></select></label><label>Category<input name="category" list="category-options" defaultValue={editingTransaction?.category || ""} placeholder="e.g. Transport" required /><datalist id="category-options">{categories.map((category) => <option key={category.name} value={category.name} />)}</datalist></label></div>
          <label>Client / source<input name="source" defaultValue={editingTransaction?.source || ""} placeholder="For income only" /></label>
          <button className="primary full" type="submit">{editingTransaction ? "Save changes" : "Save transaction"}</button>
        </form>
      </AnimatedModal>
      <AnimatedModal open={showConnect} onClose={() => setShowConnect(false)} className="modal connect-modal">
        <div className="connect-art">@</div>
        <div className="modal-head"><div><p className="eyebrow">AUTOMATIC IMPORTS</p><h2>Connect your inbox</h2></div><button onClick={() => setShowConnect(false)}>×</button></div>
        <div className={`gmail-connection-status ${gmailConnection.connected ? "is-connected" : ""}`} role="status"><span className="status-dot" />{gmailConnection.connected ? <>Connected to <strong>{gmailConnection.email}</strong></> : gmailConnection.status === "schema-pending" ? "Connection storage needs setup" : "Not connected yet"}</div>
        <p className="modal-copy">{gmailConnection.connected ? "The Gmail-side sync is active. New Kotak debit and credit emails are checked automatically every 15 minutes." : "Set up the small Google Apps Script in the Gmail account where Kotak sends transaction emails. It does not need Google Cloud OAuth."}</p>
        <button className="email-connect" onClick={syncGmail}><span>{gmailConnection.connected ? "↻" : "G"}</span> {gmailConnection.connected ? "Check connection" : "Set up automatic import"} <b>→</b></button>
        <button className="secondary" onClick={() => setShowConnect(false)}>I'll do this later</button>
      </AnimatedModal>
      <InsightModal open={showInsights} transactions={visibleTransactions} totals={totals} onClose={() => setShowInsights(false)} />
      {toast && <div className="toast">✓ &nbsp;{toast}</div>}
    </main>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: React.ReactNode; description: string; action?: React.ReactNode }) { return <div className="hero-row"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="subhead">{description}</p></div>{action}</div>; }

function MonthSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <label className="month-select"><span>Month</span><select value={value} onChange={(event) => onChange(event.target.value)} aria-label="Choose month">{MONTHS.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}</select></label>; }

function Overview({ totals, previousTotals, transactions, selectedMonth, setSelectedMonth, onAdd, onNavigate, onInsights, onEdit }: { totals: { income: number; expense: number }; previousTotals: { income: number; expense: number }; transactions: Transaction[]; selectedMonth: string; setSelectedMonth: (value: string) => void; onAdd: () => void; onNavigate: (view: View, filter?: "all" | "income" | "expense") => void; onInsights: () => void; onEdit: (transaction: Transaction) => void }) {
  const netCashFlow = totals.income - totals.expense;
  const orderedTransactions = [...transactions].sort((a, b) => transactionDateValue(b).localeCompare(transactionDateValue(a)));
  return <>
    <PageHeading eyebrow="MONTHLY OVERVIEW · INDIA" title={<>Good morning, Radhesh <span>✦</span></>} description="Your money, clearly organised in Indian rupees." action={<div className="heading-actions"><MonthSelect value={selectedMonth} onChange={setSelectedMonth} /><button className="primary" onClick={onAdd}><b>＋</b> Add transaction</button></div>} />
    <AnimatedGrid className="stats-grid">
      <AnimatedCard className="stat-card dark-card"><div className="stat-head"><span>Net cash flow</span></div><div className="stat-value"><CountUp value={netCashFlow} format="currency" decimals={2} /></div><MetricChange value={comparison(netCashFlow, previousTotals.income - previousTotals.expense)} label="vs. last month" /><div className="cash-flow-summary"><span>In {money(totals.income)}</span><span>Out {money(totals.expense)}</span></div></AnimatedCard>
      <AnimatedCard className="stat-card"><div className="stat-head"><span>Income</span><div className="stat-icon green">↗</div></div><div className="stat-value"><CountUp value={totals.income} format="currency" decimals={2} /></div><MetricChange value={comparison(totals.income, previousTotals.income)} label="vs. last month" /></AnimatedCard>
      <AnimatedCard className="stat-card"><div className="stat-head"><span>Expenses</span><div className="stat-icon coral">↘</div></div><div className="stat-value"><CountUp value={totals.expense} format="currency" decimals={2} /></div><MetricChange value={comparison(totals.expense, previousTotals.expense)} label="vs. last month" inverse /></AnimatedCard>
    </AnimatedGrid>
    <AnimatedGrid className="dashboard-grid"><AnimatedCard className="panel chart-panel"><div className="panel-head"><div><h2>Cash flow</h2><p>Income and expenses recorded during this month</p></div><span className="selected-month-note">{MONTHS.find((month) => month.value === selectedMonth)?.label}</span></div><CashFlowChart transactions={transactions} selectedMonth={selectedMonth} /></AnimatedCard><AnimatedCard className="motion-card"><CategoryInsightCard transactions={transactions} onView={() => onNavigate("Reports")} /></AnimatedCard></AnimatedGrid>
    <AnimatedCard className="panel transactions-panel" standalone><div className="panel-head"><div><h2>Recent transactions</h2><p>Latest income and expenses</p></div><button className="text-button" onClick={() => onNavigate("Transactions", "all")}>View all <span>→</span></button></div><div className="transactions-list">{orderedTransactions.length ? <AnimatedList>{orderedTransactions.slice(0, 5).map((transaction) => <AnimatedListItem key={transactionIdentity(transaction)}><TransactionRow transaction={transaction} onEdit={onEdit} /></AnimatedListItem>)}</AnimatedList> : <p className="empty-report">No transactions recorded for this month yet.</p>}</div></AnimatedCard>
    <InsightBanner transactions={transactions} totals={totals} onOpen={onInsights} />
  </>;
}

function MetricChange({ value, label, inverse = false }: { value: number | null; label: string; inverse?: boolean }) { if (value === null) return <div className="stat-foot"><span>No prior-month data</span></div>; const positive = inverse ? value <= 0 : value >= 0; return <div className={`stat-foot ${positive ? "positive" : "negative"}`}><span>{value >= 0 ? "↗" : "↘"}</span><strong>{Math.abs(value).toFixed(1)}%</strong><span>{label}</span></div>; }

function CashFlowChart({ transactions, selectedMonth }: { transactions: Transaction[]; selectedMonth: string }) { const reduceMotion = useReducedMotion(); const days = new Date(Number(selectedMonth.slice(0, 4)), Number(selectedMonth.slice(5, 7)), 0).getDate(); const values = Array.from({ length: days }, () => ({ income: 0, expense: 0 })); transactions.forEach((transaction) => { const day = Math.max(1, Math.min(days, Number(transactionDateValue(transaction).slice(-2)))); values[day - 1][transaction.type] += transaction.amount; }); let incomeRunning = 0; let expenseRunning = 0; const cumulative = values.map((value) => ({ income: incomeRunning += value.income, expense: expenseRunning += value.expense })); const maximum = Math.max(1, ...cumulative.flatMap((value) => [value.income, value.expense])); const pathFor = (key: "income" | "expense") => cumulative.map((value, index) => `${index ? "L" : "M"}${(index / Math.max(1, days - 1)) * 700} ${175 - (value[key] / maximum) * 145}`).join(" "); const labels = [1, Math.ceil(days / 3), Math.ceil((days * 2) / 3), days]; if (!transactions.length) return <div className="chart-empty">Add an income or expense to see your cash flow for this month.</div>; return <><div className="legend"><motion.span initial={reduceMotion ? false : { opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: reduceMotion ? 0 : .22, ease: "easeOut" }}><i className="dot income-dot" /> Income <b>↗</b></motion.span><motion.span initial={reduceMotion ? false : { opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: reduceMotion ? 0 : .22, delay: reduceMotion ? 0 : .06, ease: "easeOut" }}><i className="dot expense-dot" /> Expenses <b>↘</b></motion.span></div><div className="chart"><div className="y-labels"><span>{money(maximum)}</span><span>{money(maximum * .66)}</span><span>{money(maximum * .33)}</span><span>₹0</span></div><div className="chart-area"><div className="gridline one" /><div className="gridline two" /><div className="gridline three" /><div className="gridline four" /><svg viewBox="0 0 700 220" preserveAspectRatio="none" aria-label="Cash flow chart"><motion.path className="income-line" d={pathFor("income")} initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: reduceMotion ? 0 : .35, ease: "easeOut" }} /><motion.path className="expense-line" d={pathFor("expense")} initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: reduceMotion ? 0 : .35, delay: reduceMotion ? 0 : .06, ease: "easeOut" }} /></svg><div className="chart-labels">{labels.map((day) => <span key={day}>{new Date(`${selectedMonth}-${String(day).padStart(2, "0")}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>)}</div></div></div></>; }

function InsightBanner({ transactions, totals, onOpen }: { transactions: Transaction[]; totals: { income: number; expense: number }; onOpen: () => void }) { const highest = Object.entries(transactions.filter((transaction) => transaction.type === "expense").reduce<Record<string, number>>((result, transaction) => ({ ...result, [transaction.category]: (result[transaction.category] || 0) + transaction.amount }), {})).sort((a, b) => b[1] - a[1])[0]; return <AnimatedCard className="insight" standalone><span className="insight-spark">✦</span><div><strong>{highest ? `${highest[0]} is your top spending category.` : "No expense insight yet."}</strong><p>{highest ? `${money(highest[1])} recorded in this category from ${transactions.length} transaction${transactions.length === 1 ? "" : "s"}.` : totals.income ? "Add expenses as they occur to see meaningful spending insights." : "Add your first income or expense to begin your monthly record."}</p></div><button onClick={onOpen}>See insights <span>→</span></button></AnimatedCard>; }

function InsightModal({ open, transactions, totals, onClose }: { open: boolean; transactions: Transaction[]; totals: { income: number; expense: number }; onClose: () => void }) {
  const categoryTotals = transactions.filter((t) => t.type === "expense").reduce<Record<string, number>>((summary, transaction) => ({ ...summary, [transaction.category]: (summary[transaction.category] || 0) + transaction.amount }), {});
  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0] || ["No expenses yet", 0];
  const savingsRate = totals.income > 0 ? Math.round(((totals.income - totals.expense) / totals.income) * 100) : 0;
  const coverage = totals.expense > 0 ? totals.income / totals.expense : 0;
  return (
    <AnimatedModal open={open} onClose={onClose} className="modal insights-modal">
      <div className="modal-head"><div><p className="eyebrow">PERSONAL MONEY REVIEW · INR</p><h2>Your spending insights</h2></div><button onClick={onClose}>×</button></div>
      <p className="insights-intro">A quick read of the transactions currently in your Finance Dashboard ledger.</p>
      <div className="insight-grid">
        <div className="insight-card insight-card-orange"><span className="insight-card-icon">↘</span><small>Top spend category</small><strong>{topCategory[0]}</strong><b><CountUp value={Number(topCategory[1])} format="currency" decimals={2} /></b><p>Keep an eye on this category this month.</p></div>
        <div className="insight-card insight-card-green"><span className="insight-card-icon">✦</span><small>Savings rate</small><strong><CountUp value={savingsRate} format="percent" decimals={0} /></strong><b><CountUp value={Math.max(0, totals.income - totals.expense)} format="currency" decimals={2} /> saved</b><p>Based on income minus expenses.</p></div>
        <div className="insight-card insight-card-blue"><span className="insight-card-icon">↗</span><small>Income coverage</small><strong><CountUp value={coverage} format="number" decimals={1} suffix="×" /></strong><b>your expenses</b><p>Every rupee in is covering your outflow.</p></div>
      </div>
      <div className="insight-footer"><span>Reviewed {transactions.length} transactions</span><button className="secondary-action" onClick={onClose}>Close insights</button></div>
    </AnimatedModal>
  );
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  return <main className="login-shell"><section className="login-visual"><div className="login-brand"><span className="brand-mark">₹</span><span>pocketwise</span></div><div className="login-visual-copy"><p className="eyebrow">YOUR MONEY · YOUR CLARITY</p><h1>A calmer way to see where your money goes.</h1><p>Track real income, expenses, imported bank alerts, and monthly reports in one place.</p></div></section><section className="login-panel"><div className="login-card"><div className="login-card-head"><p className="eyebrow">PERSONAL FINANCE</p><h2>Open Finance Dashboard</h2><p>Your dashboard now starts with an empty, live ledger rather than demonstration figures.</p></div><button className="primary login-submit" type="button" onClick={onLogin}>Open dashboard <span>→</span></button><p className="login-footnote">Secure account sign-in is not configured yet. This screen no longer accepts a fake password.</p></div></section></main>;
}

function CategoryInsightCard({ transactions, onView }: { transactions: Transaction[]; onView: () => void }) { const expenseTotals = transactions.filter((t) => t.type === "expense").reduce<Record<string, number>>((summary, t) => ({ ...summary, [t.category]: (summary[t.category] || 0) + t.amount }), {}); const rows = Object.entries(expenseTotals).sort((a, b) => b[1] - a[1]).slice(0, 3); const highest = rows[0]; return <div className="panel category-insight-panel"><div className="panel-head"><div><h2>Category insights</h2><p>Where your spending is concentrated</p></div><span className="insight-card-icon">↘</span></div>{highest ? <div className="category-lead"><small>Top category</small><strong>{highest[0]}</strong><b>{money(highest[1])}</b></div> : <p className="empty-report">Add expenses to see insights.</p>}<div className="mini-category-list">{rows.map(([category, amount]) => <div key={category}><span>{category}</span><b>{money(amount)}</b></div>)}</div><button className="text-button" onClick={onView}>View full report <span>→</span></button></div>; }

function TransactionRow({ transaction: t, onEdit }: { transaction: Transaction; onEdit?: (transaction: Transaction) => void }) { return <div className="transaction"><div className="transaction-info"><strong>{t.name}</strong><span>{t.category} · {displayDate(t)}</span></div><strong className={`amount ${t.type}`}>{t.type === "income" ? "+" : "−"}{money(t.amount)}</strong><button className="edit-button row-edit" onClick={() => onEdit?.(t)} aria-label={`Edit ${t.name}`}>Edit</button></div>; }

function Transactions({ transactions, selectedMonth, setSelectedMonth, onAdd, onEdit, initialKind }: { transactions: Transaction[]; selectedMonth: string; setSelectedMonth: (value: string) => void; onAdd: () => void; onEdit: (transaction: Transaction) => void; initialKind: "all" | "income" | "expense" }) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"all" | "income" | "expense">(initialKind);
  useEffect(() => setKind(initialKind), [initialKind]);
  const filtered = transactions.filter((t) => (kind === "all" || t.type === kind) && `${t.name} ${t.category} ${t.source || ""}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <PageHeading eyebrow="LEDGER · INR" title="Transactions" description="Every rupee in and out, in one place." action={<div className="heading-actions"><MonthSelect value={selectedMonth} onChange={setSelectedMonth} /><button className="primary" onClick={onAdd}><b>＋</b> Add transaction</button></div>} />
      <AnimatedCard className="panel table-panel" standalone>
        <div className="table-tools"><div className="search-box">⌕<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search transactions" /></div><div className="filter-pills"><button className={`pill ${kind === "all" ? "active" : ""}`} onClick={() => setKind("all")}>All</button><button className={`pill ${kind === "income" ? "active" : ""}`} onClick={() => setKind("income")}>Income</button><button className={`pill ${kind === "expense" ? "active" : ""}`} onClick={() => setKind("expense")}>Expenses</button><span className="selected-month-note">{MONTHS.find((month) => month.value === selectedMonth)?.label}</span></div></div>
        <div className="transaction-table"><div className="table-row table-header"><span>Transaction</span><span>Category</span><span>Client / source</span><span>Date</span><span>Expenses</span><span>Income</span><span>Action</span></div>{filtered.length ? <AnimatedList>{filtered.map((t) => <AnimatedListItem className="table-row" key={transactionIdentity(t)}><span className="table-name"><strong>{t.name}</strong></span><span>{t.category}</span><span>{t.source || "—"}</span><span>{displayDate(t)}</span><span className="table-number expense-cell">{t.type === "expense" ? money(t.amount) : "—"}</span><span className="table-number income-cell">{t.type === "income" ? money(t.amount) : "—"}</span><button className="edit-button" onClick={() => onEdit(t)} aria-label={`Edit ${t.name}`}>Edit</button></AnimatedListItem>)}</AnimatedList> : <p className="empty-report">No matching transactions for this month.</p>}</div>
      </AnimatedCard>
      <AnimatedCard className="ledger-note" standalone><span>i</span><div><strong>Showing {MONTHS.find((month) => month.value === selectedMonth)?.label}</strong><p>Income rows retain the client or source that paid you.</p></div></AnimatedCard>
    </>
  );
}

function Mail({ messages, status, selectedMonth, setSelectedMonth, onSync }: { messages: GmailMessage[]; status: string; selectedMonth: string; setSelectedMonth: (value: string) => void; onSync: () => void }) {
  const visibleMessages = messages.filter((message) => {
    const date = new Date(message.received_at);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` === selectedMonth;
  });

  return (
    <>
      <PageHeading eyebrow="MAIL REVIEW" title="Imported Kotak emails" description="Every matched bank alert is saved here before it becomes part of your ledger." action={<div className="heading-actions"><MonthSelect value={selectedMonth} onChange={setSelectedMonth} /><button className="primary" onClick={onSync}>Check sync</button></div>} />
      <AnimatedCard className="panel transactions-panel" standalone>
        <div className="panel-head"><div><h2>Email activity</h2><p>{status === "ready" ? `${visibleMessages.length} emails in the selected month` : "Waiting for your first Apps Script sync"}</p></div></div>
        {visibleMessages.length ? <AnimatedList>{visibleMessages.map((message) => <AnimatedListItem className="transaction" key={message.id}><div className="transaction-info"><strong>{message.subject || message.merchant || "Kotak transaction"}</strong><span>{message.from_address} · {new Date(message.received_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></div><strong className={`amount ${message.transaction_type || "expense"}`}>{message.amount ? `${message.transaction_type === "income" ? "+" : "−"}${money(message.amount)}` : "Needs review"}</strong></AnimatedListItem>)}</AnimatedList> : <p className="empty-report">No Kotak emails have been imported for this month yet. Run the Apps Script once after deployment to bring them in.</p>}
      </AnimatedCard>
    </>
  );
}

function downloadReport(transactions: Transaction[], monthLabel: string) {
  const header = ["Date", "Description", "Type", "Category", "Client or source", "Income INR", "Expense INR"];
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const rows = transactions.map((transaction) => [displayDate(transaction), transaction.name, transaction.type, transaction.category, transaction.source || "", transaction.type === "income" ? transaction.amount.toFixed(2) : "", transaction.type === "expense" ? transaction.amount.toFixed(2) : ""]);
  const csv = [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = `finance-dashboard-${monthLabel.toLowerCase().replaceAll(" ", "-")}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function Reports({ transactions, totals, monthLabel, selectedMonth, setSelectedMonth }: { transactions: Transaction[]; totals: { income: number; expense: number }; monthLabel: string; selectedMonth: string; setSelectedMonth: (value: string) => void }) {
  const expensesByCategory = transactions.filter((t) => t.type === "expense").reduce<Record<string, number>>((summary, t) => ({ ...summary, [t.category]: (summary[t.category] || 0) + t.amount }), {});
  const incomeByClient = transactions.filter((t) => t.type === "income").reduce<Record<string, number>>((summary, t) => { const client = t.source || "Unassigned income"; return { ...summary, [client]: (summary[client] || 0) + t.amount }; }, {});
  const expenseRows = Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1]);
  const clientRows = Object.entries(incomeByClient).sort((a, b) => b[1] - a[1]);
  const netCashFlow = totals.income - totals.expense;
  const savingsRate = totals.income > 0 ? Math.round((netCashFlow / totals.income) * 100) : 0;

  return (
    <>
      <PageHeading eyebrow={`MONTHLY REPORT · ${monthLabel.toUpperCase()}`} title="Monthly report" description="See which categories cost you and which clients paid you." action={<MonthSelect value={selectedMonth} onChange={setSelectedMonth} />} />
      <AnimatedCard className="monthly-report-banner" standalone><div><span>REPORTING PERIOD</span><strong>{monthLabel}</strong></div><p>All income, expenses, clients, categories, and transaction activity for the selected month.</p></AnimatedCard>
      <AnimatedGrid className="report-kpis">
        <AnimatedCard className="panel report-kpi"><span>Total income</span><strong><CountUp value={totals.income} format="currency" decimals={2} /></strong><small className="green-text">Across {clientRows.length} client sources</small></AnimatedCard>
        <AnimatedCard className="panel report-kpi"><span>Total expenses</span><strong><CountUp value={totals.expense} format="currency" decimals={2} /></strong><small className="coral-text">Across {expenseRows.length} categories</small></AnimatedCard>
        <AnimatedCard className="panel report-kpi"><span>Net cash flow</span><strong><CountUp value={netCashFlow} format="currency" decimals={2} /></strong><small className={netCashFlow >= 0 ? "green-text" : "coral-text"}>{totals.income ? <><CountUp value={savingsRate} format="percent" decimals={0} /> of income retained</> : "No income recorded yet"}</small></AnimatedCard>
      </AnimatedGrid>
      <AnimatedGrid className="report-grid">
        <AnimatedCard className="panel category-report"><div className="panel-head"><div><h2>Spending by category</h2><p>Where your expenses are going</p></div></div><div className="category-bars"><AnimatedList>{expenseRows.length ? expenseRows.map(([category, amount]) => <AnimatedListItem className="category-bar" key={category}><div><span>{category}</span><strong><CountUp value={amount} format="currency" decimals={2} /></strong></div><div className="bar-track"><span className="expense-fill" style={{ width: `${Math.max(12, Math.min(100, (amount / Math.max(1, totals.expense)) * 100))}%` }} /></div></AnimatedListItem>) : <p className="empty-report">Add an expense to see category insights.</p>}</AnimatedList></div></AnimatedCard>
        <AnimatedCard className="panel client-report"><div className="panel-head"><div><h2>Income by client</h2><p>Who has paid you so far</p></div></div><div className="client-list"><AnimatedList>{clientRows.length ? clientRows.map(([client, amount], index) => <AnimatedListItem className="client-row" key={client}><span className="client-rank">0{index + 1}</span><span><strong>{client}</strong><small>{transactions.filter((t) => t.type === "income" && (t.source || "Unassigned income") === client).length} income entries</small></span><b><CountUp value={amount} format="currency" decimals={2} /></b></AnimatedListItem>) : <p className="empty-report">Add income with a client or source to see it here.</p>}</AnimatedList></div></AnimatedCard>
      </AnimatedGrid>
      <AnimatedCard className="panel report-notes" standalone><h2>Monthly activity summary</h2><div className="review-item"><span>01</span><div><strong>{transactions.length} transactions recorded</strong><p>{expenseRows.length} expense categories and {clientRows.length} income sources represented in {monthLabel}.</p></div></div><div className="review-item"><span>02</span><div><strong>{expenseRows[0]?.[0] || "Your categories"} is your biggest spend</strong><p>{expenseRows[0] ? `${money(expenseRows[0][1])} so far this month.` : "Add expenses manually or import them from Kotak emails."}</p></div></div><div className="review-item"><span>03</span><div><strong>{clientRows[0]?.[0] || "Your clients"} is your top income source</strong><p>{clientRows[0] ? `${money(clientRows[0][1])} received so far.` : "Record who paid you when adding an income."}</p></div></div></AnimatedCard>
      <AnimatedCard className="panel export-panel" standalone><div><strong>Need to share this report?</strong><p>Download a CSV summary of the transactions in this reporting period.</p></div><button className="secondary-action" onClick={() => downloadReport(transactions, monthLabel)} disabled={!transactions.length}>Export CSV</button></AnimatedCard>
    </>
  );
}

function Settings({ categories, onAddCategory, storageStatus }: { categories: Category[]; onAddCategory: (event: React.FormEvent<HTMLFormElement>) => void; storageStatus: string }) { return <><PageHeading eyebrow="PREFERENCES" title="Settings" description="Your fixed finance-dashboard preferences and categories." /><div className="settings-grid"><div className="panel settings-card"><div className="panel-head"><div><h2>Currency & locale</h2><p>Used consistently across your dashboard and reports</p></div><span className="settings-check">✓</span></div><div className="preference-value"><span>Currency</span><strong>INR · Indian Rupee (₹)</strong></div><div className="preference-value"><span>Number format</span><strong>India · 1,23,456.78</strong></div><div className="preference-value"><span>Data status</span><strong>{storageStatus}</strong></div></div><div className="panel settings-card"><div className="panel-head"><div><h2>Categories</h2><p>Organise both expenses and income</p></div><span className="category-count">{categories.length}</span></div><div className="category-settings-list">{categories.length ? categories.map((category) => <div key={category.name}><span><i className={`budget-dot ${category.color}`} />{category.name}</span><small>{category.kind === "income" ? "Income" : "Expense"}</small></div>) : <p className="empty-report">No categories yet. Add one below.</p>}</div><form className="category-form" onSubmit={onAddCategory}><input name="categoryName" placeholder="New category name" required /><select name="categoryKind"><option value="expense">Expense</option><option value="income">Income</option></select><button className="primary" type="submit">Add</button></form></div></div><div className="panel settings-card full-settings"><div className="panel-head"><div><h2>Import behaviour</h2><p>Only transaction-like Kotak debit and credit alerts are imported. Bills, statements, registration alerts, and marketing emails are excluded.</p></div><span className="settings-check">✓</span></div><p className="settings-note">This is enforced by the importer, not by a decorative setting. Review imported mail before relying on it in your ledger.</p></div></>; }

function Connections({ onConnect, onSync, connection }: { onConnect: () => void; onSync: () => void; connection: GmailConnection }) {
  return (
    <>
      <PageHeading eyebrow="AUTOMATIC IMPORTS" title="Connections" description="Bring Kotak Mahindra transaction emails into your INR ledger." action={<button className="primary" onClick={onConnect}>Set up Gmail sync</button>} />
      <div className="connection-grid">
        <div className="panel connection-card connected"><div className="connection-logo">G</div><div><h2>Gmail + Kotak Mahindra</h2><p>Import transaction alerts, card spends, UPI payments, and income credits for your review.</p><span className={`connected-pill ${connection.connected ? "is-live" : ""}`}>{connection.connected ? `Connected · ${connection.email}` : connection.status === "schema-pending" ? "Storage setup needed" : "Not connected"}</span></div><button className="text-button" onClick={onSync}>{connection.connected ? "Check sync" : "Set up"}</button></div>
        <div className="panel connection-card"><div className="connection-logo outlook">@</div><div><h2>Email rules</h2><p>Only Kotak-related emails will be shortlisted for review before they become transactions.</p><button className="secondary-action" onClick={onConnect}>Configure rules</button></div></div>
      </div>
      <div className="privacy-note"><strong>Your inbox, your control.</strong><p>Gmail access is read-only. Imported emails will be reviewable before they enter your ledger.</p></div>
    </>
  );
}
