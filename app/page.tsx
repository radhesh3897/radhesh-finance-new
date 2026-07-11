"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { AnimatedCard, AnimatedGrid, AnimatedList, AnimatedListItem, AnimatedModal, AnimatedView, CountUp } from "../components/motion";

type View = "Overview" | "Transactions" | "Reports" | "Connections" | "Settings";
type Transaction = { name: string; category: string; date: string; month: string; amount: number; type: "income" | "expense"; icon: string; color: string; source?: string };

const MONTHS = [{ value: "2025-06", label: "June 2025" }, { value: "2025-05", label: "May 2025" }, { value: "2025-04", label: "April 2025" }];

const initialTransactions: Transaction[] = [
  { name: "Freelance payout", category: "Freelance", date: "Jun 14", month: "2025-06", amount: 48200, type: "income", source: "Acme Labs", icon: "+", color: "mint" },
  { name: "Nature's Basket", category: "Groceries", date: "Jun 14", month: "2025-06", amount: 8642, type: "expense", icon: "*", color: "peach" },
  { name: "Notion", category: "Subscriptions", date: "Jun 13", month: "2025-06", amount: 850, type: "expense", icon: "N", color: "lavender" },
  { name: "Uber India", category: "Transport", date: "Jun 13", month: "2025-06", amount: 2480, type: "expense", icon: "U", color: "sky" },
  { name: "Amazon India", category: "Shopping", date: "Jun 08", month: "2025-06", amount: 12999, type: "expense", icon: "A", color: "rose" },
  { name: "Consulting retainer", category: "Consulting", date: "Jun 05", month: "2025-06", amount: 18000, type: "income", source: "Arjun Mehta", icon: "+", color: "mint" },
  { name: "Electricity bill", category: "Utilities", date: "Jun 03", month: "2025-06", amount: 2140, type: "expense", icon: "E", color: "peach" },
];

const baseCategories = [
  { name: "Groceries", kind: "expense", color: "orange", spend: 18640, income: 0 },
  { name: "Transport", kind: "expense", color: "blue", spend: 8240, income: 0 },
  { name: "Subscriptions", kind: "expense", color: "purple", spend: 3150, income: 0 },
  { name: "Freelance", kind: "income", color: "green", spend: 0, income: 48200 },
  { name: "Other income", kind: "income", color: "teal", spend: 0, income: 18000 },
];

const money = (amount: number) => amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

export default function Home() {
  const [view, setView] = useState<View>("Overview");
  const [transactions, setTransactions] = useState(initialTransactions);
  const [categories, setCategories] = useState(baseCategories);
  const [showModal, setShowModal] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [toast, setToast] = useState("");
  const [period, setPeriod] = useState("This month");
  const [storageStatus, setStorageStatus] = useState("Local demo data");
  const [authenticated, setAuthenticated] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("2025-06");

  const visibleTransactions = useMemo(() => transactions.filter((transaction) => transaction.month === selectedMonth), [transactions, selectedMonth]);
  const totals = useMemo(() => ({
    income: visibleTransactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
    expense: visibleTransactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
  }), [visibleTransactions]);

  useEffect(() => {
    if (!authenticated || !supabase) return;
    let cancelled = false;
    async function loadSavedData() {
      const [transactionResult, categoryResult] = await Promise.all([
        supabase.from("transactions").select("*").eq("owner_key", "demo").order("created_at", { ascending: false }),
        supabase.from("categories").select("*").eq("owner_key", "demo").order("created_at", { ascending: true }),
      ]);
      if (cancelled) return;
      if (transactionResult.error || categoryResult.error) {
        setStorageStatus("Supabase connected · schema pending");
        return;
      }
      if (transactionResult.data?.length) setTransactions(transactionResult.data.map((row) => ({ name: row.name, category: row.category, date: row.date, month: row.month || "2025-06", amount: Number(row.amount), type: row.type, source: row.source || undefined, icon: row.icon, color: row.color })));
      if (categoryResult.data?.length) setCategories(categoryResult.data.map((row) => ({ name: row.name, kind: row.kind, color: row.color, spend: 0, income: 0 })));
      setStorageStatus("Supabase connected");
    }
    loadSavedData();
    return () => { cancelled = true; };
  }, [authenticated]);

  const notify = (message: string) => { setToast(message); setTimeout(() => setToast(""), 2400); };

  async function addTransaction(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const amount = Number(form.get("amount"));
    const type = form.get("type") as "income" | "expense";
    const category = String(form.get("category") || "Other");
    const source = String(form.get("source") || "");
    const month = String(form.get("month") || selectedMonth);
    setTransactions([{ name: String(form.get("name") || "New transaction"), category, date: "Just now", month, amount, type, source: type === "income" ? source : undefined, icon: type === "income" ? "+" : "*", color: type === "income" ? "mint" : "peach" }, ...transactions]);
    setShowModal(false);
    if (supabase) {
      const { error } = await supabase.from("transactions").insert({ owner_key: "demo", name: String(form.get("name") || "New transaction"), category, date: "Just now", month, amount, type, source: type === "income" ? source || null : null, icon: type === "income" ? "+" : "*", color: type === "income" ? "mint" : "peach" });
      if (error) { setStorageStatus("Supabase connected · schema pending"); notify("Added locally · run the Supabase schema to save permanently"); return; }
      setStorageStatus("Supabase connected");
    }
    notify(`${type === "income" ? "Income" : "Expense"} saved in INR`);
  }

  async function addCategory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setCategories([...categories, { name: String(form.get("categoryName")), kind: String(form.get("categoryKind")), color: "teal", spend: 0, income: 0 }]);
    e.currentTarget.reset();
    if (supabase) {
      const { error } = await supabase.from("categories").insert({ owner_key: "demo", name: String(form.get("categoryName")), kind: String(form.get("categoryKind")), color: "teal" });
      if (error) { setStorageStatus("Supabase connected · schema pending"); notify("Added locally · run the Supabase schema to save permanently"); return; }
      setStorageStatus("Supabase connected");
    }
    notify("Category saved");
  }

  const nav = (next: View) => { setView(next); window.scrollTo({ top: 0, behavior: "smooth" }); };

  if (!authenticated) return <LoginScreen onLogin={() => setAuthenticated(true)} />;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">₹</span><span>pocketwise</span></div>
        <nav>
          <p className="nav-label">Workspace</p>
          {(["Overview", "Transactions", "Reports"] as View[]).map((item) => <button key={item} className={`nav-item ${view === item ? "active" : ""}`} onClick={() => nav(item)}><span>{item === "Overview" ? "O" : item === "Transactions" ? "↕" : "R"}</span> {item}</button>)}
          <p className="nav-label second">Money flow</p>
          <div className="money-flow"><button className="flow-item income-flow" onClick={() => { nav("Transactions"); notify("Showing income transactions"); }}><span className="flow-icon">↗</span><span><strong>Income</strong><small>{money(totals.income)} this month</small></span><b>→</b></button><button className="flow-item expense-flow" onClick={() => { nav("Transactions"); notify("Showing expense transactions"); }}><span className="flow-icon">↘</span><span><strong>Expenses</strong><small>{money(totals.expense)} this month</small></span><b>→</b></button></div>
          <p className="nav-label second">Manage</p>
          <button className={`nav-item ${view === "Connections" ? "active" : ""}`} onClick={() => setShowConnect(true)}><span>~</span> Connections</button>
          <button className={`nav-item ${view === "Settings" ? "active" : ""}`} onClick={() => nav("Settings")}><span>⚙</span> Settings</button>
        </nav>
        <div className="sidebar-bottom"><div className="sync-card"><div className="sync-icon">@</div><div><strong>Connect your inbox</strong><p>Find expenses automatically</p></div><button onClick={() => setShowConnect(true)}>→</button></div><div className="profile"><div className="avatar">RA</div><div><strong>Radhesh Agrawal</strong><span>Indian rupee workspace</span></div><span className="dots">...</span></div></div>
      </aside>

      <section className="content">
        <header className="topbar"><div className="mobile-brand">₹ pocketwise</div><div className="breadcrumb">Personal / <strong>{view}</strong></div><div className="top-actions"><button className="icon-button" aria-label="Search" onClick={() => notify("Search is available in Transactions")}>⌕</button><button className="icon-button" aria-label="Notifications" onClick={() => notify("No new money alerts")}>♧<i /></button><div className="mini-avatar">RA</div></div></header>
        <div className="page-wrap">
          <AnimatedView viewKey={view}>
          {view === "Overview" && <Overview totals={totals} period={period} setPeriod={setPeriod} transactions={visibleTransactions} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} onAdd={() => setShowModal(true)} onNavigate={nav} onInsights={() => setShowInsights(true)} />}
          {view === "Transactions" && <Transactions transactions={visibleTransactions} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} onAdd={() => setShowModal(true)} />}
          {view === "Reports" && <Reports transactions={visibleTransactions} totals={totals} monthLabel={MONTHS.find((month) => month.value === selectedMonth)?.label || selectedMonth} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />}
          {view === "Settings" && <Settings categories={categories} onAddCategory={addCategory} notify={notify} />}
          {view === "Connections" && <Connections onConnect={() => { setShowConnect(true); notify(storageStatus); }} />}
          </AnimatedView>
        </div>
      </section>

      <AnimatedModal open={showModal} onClose={() => setShowModal(false)}>
        <div className="modal-head"><div><p className="eyebrow">MONEY MOVE · INR</p><h2>Add transaction</h2></div><button onClick={() => setShowModal(false)}>×</button></div><form onSubmit={addTransaction}><label>Description<input name="name" placeholder="e.g. Kotak card payment" required /></label><div className="form-row"><label>Amount in INR<input name="amount" type="number" step="0.01" placeholder="0.00" required /></label><label>Type<select name="type"><option value="expense">Expense</option><option value="income">Income</option></select></label></div><div className="form-row"><label>Category<select name="category">{categories.map((category) => <option key={category.name}>{category.name}</option>)}<option>Other</option></select></label><label>Client / source<input name="source" placeholder="For income only" /></label></div><button className="primary full" type="submit">Save transaction</button></form>
      </AnimatedModal>
      <AnimatedModal open={showConnect} onClose={() => setShowConnect(false)} className="modal connect-modal">
        <div className="connect-art">@</div><div className="modal-head"><div><p className="eyebrow">AUTOMATIC IMPORTS</p><h2>Connect your inbox</h2></div><button onClick={() => setShowConnect(false)}>×</button></div><p className="modal-copy">Pocketwise can scan receipts, invoices, and payout emails to help keep your INR ledger up to date. Your inbox stays private and you choose what gets added.</p><button className="email-connect" onClick={() => { setShowConnect(false); notify("Email connection request saved") }}><span>G</span> Connect with Gmail <b>→</b></button><button className="secondary" onClick={() => setShowConnect(false)}>I'll do this later</button>
      </AnimatedModal>
      <InsightModal open={showInsights} transactions={visibleTransactions} totals={totals} onClose={() => setShowInsights(false)} />
      {toast && <div className="toast">✓ &nbsp;{toast}</div>}
    </main>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) { return <div className="hero-row"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="subhead">{description}</p></div>{action}</div>; }

function MonthSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <label className="month-select"><span>Month</span><select value={value} onChange={(event) => onChange(event.target.value)} aria-label="Choose month">{MONTHS.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}</select></label>; }

function Overview({ totals, period, setPeriod, transactions, selectedMonth, setSelectedMonth, onAdd, onNavigate, onInsights }: { totals: { income: number; expense: number }; period: string; setPeriod: (value: string) => void; transactions: Transaction[]; selectedMonth: string; setSelectedMonth: (value: string) => void; onAdd: () => void; onNavigate: (view: View) => void; onInsights: () => void }) {
  const netBalance = 1284046 + totals.income - totals.expense;
  return (
    <>
      <PageHeading
        eyebrow="MONTHLY OVERVIEW · INDIA"
        title={<>Good morning, Radhesh <span>✦</span></>}
        description="Your money, clearly organised in Indian rupees."
        action={<div className="heading-actions"><MonthSelect value={selectedMonth} onChange={setSelectedMonth} /><button className="primary" onClick={onAdd}><b>＋</b> Add transaction</button></div>}
      />
      <AnimatedGrid className="stats-grid">
        <AnimatedCard className="stat-card dark-card"><div className="stat-head"><span>Net balance</span><button>...</button></div><div className="stat-value"><CountUp value={netBalance} format="currency" decimals={2} /></div><div className="stat-foot positive">↗ <strong>8.4%</strong><span>vs. last month</span></div><div className="sparkline"><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></AnimatedCard>
        <AnimatedCard className="stat-card"><div className="stat-head"><span>Income</span><div className="stat-icon green">↗</div></div><div className="stat-value"><CountUp value={totals.income} format="currency" decimals={2} /></div><div className="stat-foot positive">↗ <strong>12.8%</strong><span>vs. last month</span></div></AnimatedCard>
        <AnimatedCard className="stat-card"><div className="stat-head"><span>Expenses</span><div className="stat-icon coral">↘</div></div><div className="stat-value"><CountUp value={totals.expense} format="currency" decimals={2} /></div><div className="stat-foot negative">↘ <strong>3.2%</strong><span>vs. last month</span></div></AnimatedCard>
      </AnimatedGrid>
      <AnimatedGrid className="dashboard-grid">
        <AnimatedCard className="panel chart-panel">
          <div className="panel-head"><div><h2>Cash flow</h2><p>Income & expenses over time</p></div><select value={period} onChange={(e) => setPeriod(e.target.value)}><option>This month</option><option>Last month</option><option>This year</option></select></div>
          <div className="legend"><span><i className="dot income-dot"/> Income</span><span><i className="dot expense-dot"/> Expenses</span></div>
          <div className="chart"><div className="y-labels"><span>₹60k</span><span>₹40k</span><span>₹20k</span><span>₹0</span></div><div className="chart-area"><div className="gridline one"/><div className="gridline two"/><div className="gridline three"/><div className="gridline four"/><svg viewBox="0 0 700 220" preserveAspectRatio="none" aria-label="Cash flow chart"><path className="income-line" d="M0 157 C50 135, 70 156, 112 125 S185 100, 225 137 S290 115, 335 92 S400 129, 445 89 S510 58, 555 76 S625 33, 700 46"/><path className="expense-line" d="M0 178 C45 174, 75 180, 112 169 S190 159, 225 173 S290 147, 335 153 S400 136, 445 151 S510 119, 555 131 S625 112, 700 122"/></svg><div className="chart-labels"><span>Jun 1</span><span>Jun 5</span><span>Jun 9</span><span>Jun 13</span></div></div></div>
        </AnimatedCard>
        <AnimatedCard className="motion-card"><CategoryInsightCard transactions={transactions} onView={() => onNavigate("Reports")} /></AnimatedCard>
      </AnimatedGrid>
      <AnimatedCard className="panel transactions-panel" standalone>
        <div className="panel-head"><div><h2>Recent transactions</h2><p>Latest income and expenses</p></div><button className="text-button" onClick={() => onNavigate("Transactions")}>View all <span>→</span></button></div>
        <div className="transactions-list"><AnimatedList>{transactions.slice(0, 5).map((t, i) => <AnimatedListItem key={`${t.name}-${i}`}><TransactionRow transaction={t} /></AnimatedListItem>)}</AnimatedList></div>
      </AnimatedCard>
      <AnimatedCard className="insight" standalone><span className="insight-spark">✦</span><div><strong>Nice work — you&apos;re spending mindfully.</strong><p>Your dining spend is down 18% compared with last month.</p></div><button onClick={onInsights}>See insights <span>→</span></button></AnimatedCard>
    </>
  );
}

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
  const [email, setEmail] = useState("demo@pocketwise.in");
  const [password, setPassword] = useState("Pocketwise123");
  const [error, setError] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (email.trim().toLowerCase() === "demo@pocketwise.in" && password === "Pocketwise123") onLogin();
    else setError("Use the demo credentials shown below to continue.");
  }

  return <main className="login-shell"><section className="login-visual"><div className="login-brand"><span className="brand-mark">₹</span><span>pocketwise</span></div><div className="login-visual-copy"><p className="eyebrow">YOUR MONEY · YOUR CLARITY</p><h1>A calmer way to see where your money goes.</h1><p>Track income, expenses, budgets, and the small choices that add up.</p></div><div className="login-preview"><div className="preview-top"><span>Net balance</span><b>₹13,23,135</b></div><div className="preview-bars"><i/><i/><i/><i/><i/><i/><i/><i/></div><div className="preview-bottom"><span>Income</span><strong>₹66,200</strong><span>Expenses</span><strong className="preview-expense">₹27,111</strong></div></div></section><section className="login-panel"><div className="login-card"><div className="login-card-head"><p className="eyebrow">WELCOME BACK</p><h2>Sign in to Pocketwise</h2><p>Keep your personal finance picture close.</p></div><form onSubmit={submit} className="login-form"><label>Email address<input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} autoComplete="email" required /></label><label>Password<div className="password-wrap"><input type="password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} autoComplete="current-password" required /><span>•••</span></div></label>{error && <p className="login-error">{error}</p>}<button className="primary login-submit" type="submit">Sign in <span>→</span></button></form><div className="demo-credentials"><div><span>DEMO ACCOUNT</span><strong>Ready to explore</strong></div><div className="credential-row"><span>Email</span><b>demo@pocketwise.in</b></div><div className="credential-row"><span>Password</span><b>Pocketwise123</b></div></div><p className="login-footnote">Demo access only · Authentication is temporary for this prototype.</p></div></section></main>;
}

function CategoryInsightCard({ transactions, onView }: { transactions: Transaction[]; onView: () => void }) { const expenseTotals = transactions.filter((t) => t.type === "expense").reduce<Record<string, number>>((summary, t) => ({ ...summary, [t.category]: (summary[t.category] || 0) + t.amount }), {}); const rows = Object.entries(expenseTotals).sort((a, b) => b[1] - a[1]).slice(0, 3); const highest = rows[0]; return <div className="panel category-insight-panel"><div className="panel-head"><div><h2>Category insights</h2><p>Where your spending is concentrated</p></div><span className="insight-card-icon">↘</span></div>{highest ? <div className="category-lead"><small>Top category</small><strong>{highest[0]}</strong><b>{money(highest[1])}</b></div> : <p className="empty-report">Add expenses to see insights.</p>}<div className="mini-category-list">{rows.map(([category, amount]) => <div key={category}><span>{category}</span><b>{money(amount)}</b></div>)}</div><button className="text-button" onClick={onView}>View full report <span>→</span></button></div>; }

function TransactionRow({ transaction: t }: { transaction: Transaction }) { return <div className="transaction"><div className={`transaction-icon ${t.color}`}>{t.icon}</div><div className="transaction-info"><strong>{t.name}</strong><span>{t.category} <b>•</b> {t.date}</span></div><strong className={`amount ${t.type}`}>{t.type === "income" ? "+" : "−"}{money(t.amount)}</strong><button className="row-more">...</button></div>; }

function Transactions({ transactions, selectedMonth, setSelectedMonth, onAdd }: { transactions: Transaction[]; selectedMonth: string; setSelectedMonth: (value: string) => void; onAdd: () => void }) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"all" | "income" | "expense">("all");
  const filtered = transactions.filter((t) => (kind === "all" || t.type === kind) && `${t.name} ${t.category} ${t.source || ""}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <PageHeading eyebrow="LEDGER · INR" title="Transactions" description="Every rupee in and out, in one place." action={<div className="heading-actions"><MonthSelect value={selectedMonth} onChange={setSelectedMonth} /><button className="primary" onClick={onAdd}><b>＋</b> Add transaction</button></div>} />
      <AnimatedCard className="panel table-panel" standalone>
        <div className="table-tools"><div className="search-box">⌕<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search transactions" /></div><div className="filter-pills"><button className={`pill ${kind === "all" ? "active" : ""}`} onClick={() => setKind("all")}>All</button><button className={`pill ${kind === "income" ? "active" : ""}`} onClick={() => setKind("income")}>Income</button><button className={`pill ${kind === "expense" ? "active" : ""}`} onClick={() => setKind("expense")}>Expenses</button><span className="selected-month-note">{MONTHS.find((month) => month.value === selectedMonth)?.label}</span></div></div>
        <div className="transaction-table"><div className="table-row table-header"><span>Transaction</span><span>Category</span><span>Client / source</span><span>Date</span><span>Expenses</span><span>Income</span></div><AnimatedList>{filtered.map((t, i) => <AnimatedListItem className="table-row" key={`${t.name}-${i}`}><span className="table-name"><i className={`transaction-icon small ${t.color}`}>{t.icon}</i><strong>{t.name}</strong></span><span>{t.category}</span><span>{t.source || "—"}</span><span>{t.date}</span><span className="table-number expense-cell">{t.type === "expense" ? money(t.amount) : "—"}</span><span className="table-number income-cell">{t.type === "income" ? money(t.amount) : "—"}</span></AnimatedListItem>)}</AnimatedList></div>
      </AnimatedCard>
      <AnimatedCard className="ledger-note" standalone><span>i</span><div><strong>Showing {MONTHS.find((month) => month.value === selectedMonth)?.label}</strong><p>Income rows retain the client or source that paid you.</p></div></AnimatedCard>
    </>
  );
}

function Reports({ transactions, totals, monthLabel, selectedMonth, setSelectedMonth }: { transactions: Transaction[]; totals: { income: number; expense: number }; monthLabel: string; selectedMonth: string; setSelectedMonth: (value: string) => void }) {
  const expensesByCategory = transactions.filter((t) => t.type === "expense").reduce<Record<string, number>>((summary, t) => ({ ...summary, [t.category]: (summary[t.category] || 0) + t.amount }), {});
  const incomeByClient = transactions.filter((t) => t.type === "income").reduce<Record<string, number>>((summary, t) => { const client = t.source || "Unassigned income"; return { ...summary, [client]: (summary[client] || 0) + t.amount }; }, {});
  const expenseRows = Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1]);
  const clientRows = Object.entries(incomeByClient).sort((a, b) => b[1] - a[1]);
  const savings = Math.max(0, totals.income - totals.expense);
  const savingsRate = totals.income > 0 ? Math.round((savings / totals.income) * 100) : 0;

  return (
    <>
      <PageHeading eyebrow={`MONTHLY REPORT · ${monthLabel.toUpperCase()}`} title="Monthly report" description="See which categories cost you and which clients paid you." action={<MonthSelect value={selectedMonth} onChange={setSelectedMonth} />} />
      <AnimatedCard className="monthly-report-banner" standalone><div><span>REPORTING PERIOD</span><strong>{monthLabel}</strong></div><p>All income, expenses, clients, categories, and transaction activity for the selected month.</p></AnimatedCard>
      <AnimatedGrid className="report-kpis">
        <AnimatedCard className="panel report-kpi"><span>Total income</span><strong><CountUp value={totals.income} format="currency" decimals={2} /></strong><small className="green-text">Across {clientRows.length} client sources</small></AnimatedCard>
        <AnimatedCard className="panel report-kpi"><span>Total expenses</span><strong><CountUp value={totals.expense} format="currency" decimals={2} /></strong><small className="coral-text">Across {expenseRows.length} categories</small></AnimatedCard>
        <AnimatedCard className="panel report-kpi"><span>Net savings</span><strong><CountUp value={savings} format="currency" decimals={2} /></strong><small className="green-text"><CountUp value={savingsRate} format="percent" decimals={0} /> of income retained</small></AnimatedCard>
      </AnimatedGrid>
      <AnimatedGrid className="report-grid">
        <AnimatedCard className="panel category-report"><div className="panel-head"><div><h2>Spending by category</h2><p>Where your expenses are going</p></div></div><div className="category-bars"><AnimatedList>{expenseRows.length ? expenseRows.map(([category, amount]) => <AnimatedListItem className="category-bar" key={category}><div><span>{category}</span><strong><CountUp value={amount} format="currency" decimals={2} /></strong></div><div className="bar-track"><span className="expense-fill" style={{ width: `${Math.max(12, Math.min(100, (amount / Math.max(1, totals.expense)) * 100))}%` }} /></div></AnimatedListItem>) : <p className="empty-report">Add an expense to see category insights.</p>}</AnimatedList></div></AnimatedCard>
        <AnimatedCard className="panel client-report"><div className="panel-head"><div><h2>Income by client</h2><p>Who has paid you so far</p></div></div><div className="client-list"><AnimatedList>{clientRows.length ? clientRows.map(([client, amount], index) => <AnimatedListItem className="client-row" key={client}><span className="client-rank">0{index + 1}</span><span><strong>{client}</strong><small>{transactions.filter((t) => t.type === "income" && (t.source || "Unassigned income") === client).length} income entries</small></span><b><CountUp value={amount} format="currency" decimals={2} /></b></AnimatedListItem>) : <p className="empty-report">Add income with a client or source to see it here.</p>}</AnimatedList></div></AnimatedCard>
      </AnimatedGrid>
      <AnimatedCard className="panel report-notes" standalone><h2>Monthly activity summary</h2><div className="review-item"><span>01</span><div><strong>{transactions.length} transactions recorded</strong><p>{expenseRows.length} expense categories and {clientRows.length} income sources represented in {monthLabel}.</p></div></div><div className="review-item"><span>02</span><div><strong>{expenseRows[0]?.[0] || "Your categories"} is your biggest spend</strong><p>{expenseRows[0] ? `${money(expenseRows[0][1])} so far this month.` : "Add expenses manually or import them from Kotak emails."}</p></div></div><div className="review-item"><span>03</span><div><strong>{clientRows[0]?.[0] || "Your clients"} is your top income source</strong><p>{clientRows[0] ? `${money(clientRows[0][1])} received so far.` : "Record who paid you when adding an income."}</p></div></div></AnimatedCard>
      <AnimatedCard className="panel export-panel" standalone><div><strong>Need to share this report?</strong><p>Download a clean summary of categories, clients, income, and expenses.</p></div><button className="secondary-action" onClick={() => alert(`Report ready for ${transactions.length} transactions`)}>Export report</button></AnimatedCard>
    </>
  );
}

function Settings({ categories, onAddCategory, notify }: { categories: typeof baseCategories; onAddCategory: (event: React.FormEvent<HTMLFormElement>) => void; notify: (message: string) => void }) { return <><PageHeading eyebrow="PREFERENCES" title="Settings" description="Make Pocketwise feel like your money system." /><div className="settings-grid"><div className="panel settings-card"><div className="panel-head"><div><h2>Currency & locale</h2><p>Used across your dashboard and reports</p></div><span className="settings-check">✓</span></div><label>Currency<select defaultValue="INR"><option value="INR">INR · Indian Rupee (₹)</option></select></label><label>Number format<select defaultValue="en-IN"><option value="en-IN">India · 1,23,456.78</option></select></label><button className="secondary-action" onClick={() => notify("Indian rupee format saved")}>Save preferences</button></div><div className="panel settings-card"><div className="panel-head"><div><h2>Categories</h2><p>Organise both expenses and income</p></div><span className="category-count">{categories.length}</span></div><div className="category-settings-list">{categories.map((c) => <div key={c.name}><span><i className={`budget-dot ${c.color}`} />{c.name}</span><small>{c.kind === "income" ? "Income" : "Expense"}</small></div>)}</div><form className="category-form" onSubmit={onAddCategory}><input name="categoryName" placeholder="New category name" required /><select name="categoryKind"><option value="expense">Expense</option><option value="income">Income</option></select><button className="primary" type="submit">Add</button></form></div></div><div className="panel settings-card full-settings"><div className="panel-head"><div><h2>Email import rules</h2><p>Choose what Pocketwise should recognise from your inbox</p></div><span className="settings-check muted-check">✓</span></div><div className="rule-list"><label><input type="checkbox" defaultChecked /> Receipts and card spends</label><label><input type="checkbox" defaultChecked /> Salary and freelance credits</label><label><input type="checkbox" /> Bills and recurring payments</label></div><button className="text-button" onClick={() => notify("Import rules saved")}>Save import rules <span>→</span></button></div></>; }

function Connections({ onConnect }: { onConnect: () => void }) { return <><PageHeading eyebrow="AUTOMATIC IMPORTS" title="Connections" description="Bring Kotak Mahindra transaction emails into your INR ledger." action={<button className="primary" onClick={onConnect}>Connect Gmail</button>} /><div className="connection-grid"><div className="panel connection-card connected"><div className="connection-logo">G</div><div><h2>Gmail + Kotak Mahindra</h2><p>Import transaction alerts, card spends, UPI payments, and income credits for your review.</p><span className="connected-pill">Local setup ready</span></div><button className="text-button">Manage</button></div><div className="panel connection-card"><div className="connection-logo outlook">@</div><div><h2>Email rules</h2><p>Choose which Kotak email types should become draft transactions.</p><button className="secondary-action" onClick={onConnect}>Configure rules</button></div></div></div><div className="privacy-note"><strong>Your inbox, your control.</strong><p>Gmail sync will run through a secure server connection and every imported transaction will be reviewable before it enters your ledger.</p></div></>; }
