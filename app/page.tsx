"use client";

import { useMemo, useState } from "react";

type View = "Overview" | "Transactions" | "Budgets" | "Reports" | "Connections" | "Settings";
type Transaction = { name: string; category: string; date: string; amount: number; type: "income" | "expense"; icon: string; color: string };

const initialTransactions: Transaction[] = [
  { name: "Freelance payout", category: "Freelance", date: "Today, 9:41 AM", amount: 48200, type: "income", icon: "+", color: "mint" },
  { name: "Nature's Basket", category: "Groceries", date: "Today, 8:12 AM", amount: 8642, type: "expense", icon: "*", color: "peach" },
  { name: "Notion", category: "Subscriptions", date: "Yesterday", amount: 850, type: "expense", icon: "N", color: "lavender" },
  { name: "Uber India", category: "Transport", date: "Yesterday", amount: 2480, type: "expense", icon: "U", color: "sky" },
  { name: "Amazon India", category: "Shopping", date: "Jun 08", amount: 12999, type: "expense", icon: "A", color: "rose" },
  { name: "Rent received", category: "Other income", date: "Jun 05", amount: 18000, type: "income", icon: "+", color: "mint" },
  { name: "Electricity bill", category: "Utilities", date: "Jun 03", amount: 2140, type: "expense", icon: "E", color: "peach" },
];

const baseCategories = [
  { name: "Groceries", kind: "expense", color: "orange", spend: 18640, income: 0, budget: 24000 },
  { name: "Transport", kind: "expense", color: "blue", spend: 8240, income: 0, budget: 12000 },
  { name: "Subscriptions", kind: "expense", color: "purple", spend: 3150, income: 0, budget: 5000 },
  { name: "Freelance", kind: "income", color: "green", spend: 0, income: 48200, budget: 50000 },
  { name: "Other income", kind: "income", color: "teal", spend: 0, income: 18000, budget: 20000 },
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

  const totals = useMemo(() => ({
    income: transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
    expense: transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
  }), [transactions]);

  const notify = (message: string) => { setToast(message); setTimeout(() => setToast(""), 2400); };

  function addTransaction(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const amount = Number(form.get("amount"));
    const type = form.get("type") as "income" | "expense";
    const category = String(form.get("category") || "Other");
    setTransactions([{ name: String(form.get("name") || "New transaction"), category, date: "Just now", amount, type, icon: type === "income" ? "+" : "*", color: type === "income" ? "mint" : "peach" }, ...transactions]);
    setShowModal(false);
    notify(`${type === "income" ? "Income" : "Expense"} added in INR`);
  }

  function addCategory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setCategories([...categories, { name: String(form.get("categoryName")), kind: String(form.get("categoryKind")), color: "teal", spend: 0, income: 0, budget: Number(form.get("categoryBudget") || 0) }]);
    e.currentTarget.reset();
    notify("Category added");
  }

  const nav = (next: View) => { setView(next); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const [authenticated, setAuthenticated] = useState(false);

  if (!authenticated) return <LoginScreen onLogin={() => setAuthenticated(true)} />;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">₹</span><span>pocketwise</span></div>
        <nav>
          <p className="nav-label">Workspace</p>
          {(["Overview", "Transactions", "Budgets", "Reports"] as View[]).map((item) => <button key={item} className={`nav-item ${view === item ? "active" : ""}`} onClick={() => nav(item)}><span>{item === "Overview" ? "O" : item === "Transactions" ? "↕" : item === "Budgets" ? "B" : "R"}</span> {item}{item === "Budgets" && <em>3</em>}</button>)}
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
          {view === "Overview" && <Overview totals={totals} period={period} setPeriod={setPeriod} transactions={transactions} onAdd={() => setShowModal(true)} onNavigate={nav} onInsights={() => setShowInsights(true)} />}
          {view === "Transactions" && <Transactions transactions={transactions} onAdd={() => setShowModal(true)} />}
          {view === "Budgets" && <Budgets categories={categories} notify={notify} />}
          {view === "Reports" && <Reports transactions={transactions} totals={totals} />}
          {view === "Settings" && <Settings categories={categories} onAddCategory={addCategory} notify={notify} />}
          {view === "Connections" && <Connections onConnect={() => setShowConnect(true)} />}
        </div>
      </section>

      {showModal && <div className="modal-backdrop" onClick={() => setShowModal(false)}><div className="modal" onClick={(e) => e.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">MONEY MOVE · INR</p><h2>Add transaction</h2></div><button onClick={() => setShowModal(false)}>×</button></div><form onSubmit={addTransaction}><label>Description<input name="name" placeholder="e.g. Coffee with Maya" required /></label><div className="form-row"><label>Amount in INR<input name="amount" type="number" step="0.01" placeholder="0.00" required /></label><label>Type<select name="type"><option value="expense">Expense</option><option value="income">Income</option></select></label></div><label>Category<select name="category">{categories.map((category) => <option key={category.name}>{category.name}</option>)}<option>Other</option></select></label><button className="primary full" type="submit">Save transaction</button></form></div></div>}
      {showConnect && <div className="modal-backdrop" onClick={() => setShowConnect(false)}><div className="modal connect-modal" onClick={(e) => e.stopPropagation()}><div className="connect-art">@</div><div className="modal-head"><div><p className="eyebrow">AUTOMATIC IMPORTS</p><h2>Connect your inbox</h2></div><button onClick={() => setShowConnect(false)}>×</button></div><p className="modal-copy">Pocketwise can scan receipts, invoices, and payout emails to help keep your INR ledger up to date. Your inbox stays private and you choose what gets added.</p><button className="email-connect" onClick={() => { setShowConnect(false); notify("Email connection request saved") }}><span>G</span> Connect with Gmail <b>→</b></button><button className="secondary" onClick={() => setShowConnect(false)}>I'll do this later</button></div></div>}
      {showInsights && <InsightModal transactions={transactions} totals={totals} onClose={() => setShowInsights(false)} />}
      {toast && <div className="toast">✓ &nbsp;{toast}</div>}
    </main>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) { return <div className="hero-row"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="subhead">{description}</p></div>{action}</div>; }

function Overview({ totals, period, setPeriod, transactions, onAdd, onNavigate, onInsights }: { totals: { income: number; expense: number }; period: string; setPeriod: (value: string) => void; transactions: Transaction[]; onAdd: () => void; onNavigate: (view: View) => void; onInsights: () => void }) {
  return <><PageHeading eyebrow="SATURDAY, JUNE 14, 2025 · INDIA" title={<>Good morning, Radhesh <span>✦</span></>} description="Your money, clearly organised in Indian rupees." action={<button className="primary" onClick={onAdd}><b>＋</b> Add transaction</button>} />
    <div className="stats-grid"><div className="stat-card dark-card"><div className="stat-head"><span>Net balance</span><button>...</button></div><div className="stat-value">{money(1284046 + totals.income - totals.expense)}</div><div className="stat-foot positive">↗ <strong>8.4%</strong><span>vs. last month</span></div><div className="sparkline"><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div><div className="stat-card"><div className="stat-head"><span>Income</span><div className="stat-icon green">↗</div></div><div className="stat-value">{money(totals.income)}</div><div className="stat-foot positive">↗ <strong>12.8%</strong><span>vs. last month</span></div></div><div className="stat-card"><div className="stat-head"><span>Expenses</span><div className="stat-icon coral">↘</div></div><div className="stat-value">{money(totals.expense)}</div><div className="stat-foot negative">↘ <strong>3.2%</strong><span>vs. last month</span></div></div><div className="stat-card"><div className="stat-head"><span>To spend</span><div className="stat-icon violet">◔</div></div><div className="stat-value">₹21,800<span className="muted">.00</span></div><div className="progress"><span style={{ width: "68%" }} /></div><div className="stat-foot"><span>68% of monthly budget</span></div></div></div>
    <div className="dashboard-grid"><div className="panel chart-panel"><div className="panel-head"><div><h2>Cash flow</h2><p>Income & expenses over time</p></div><select value={period} onChange={(e) => setPeriod(e.target.value)}><option>This month</option><option>Last month</option><option>This year</option></select></div><div className="legend"><span><i className="dot income-dot"/> Income</span><span><i className="dot expense-dot"/> Expenses</span></div><div className="chart"><div className="y-labels"><span>₹60k</span><span>₹40k</span><span>₹20k</span><span>₹0</span></div><div className="chart-area"><div className="gridline one"/><div className="gridline two"/><div className="gridline three"/><div className="gridline four"/><svg viewBox="0 0 700 220" preserveAspectRatio="none" aria-label="Cash flow chart"><path className="income-line" d="M0 157 C50 135, 70 156, 112 125 S185 100, 225 137 S290 115, 335 92 S400 129, 445 89 S510 58, 555 76 S625 33, 700 46"/><path className="expense-line" d="M0 178 C45 174, 75 180, 112 169 S190 159, 225 173 S290 147, 335 153 S400 136, 445 151 S510 119, 555 131 S625 112, 700 122"/></svg><div className="chart-labels"><span>Jun 1</span><span>Jun 5</span><span>Jun 9</span><span>Jun 13</span></div></div></div></div><BudgetCard onView={() => onNavigate("Budgets")} /></div>
    <div className="panel transactions-panel"><div className="panel-head"><div><h2>Recent transactions</h2><p>Latest income and expenses</p></div><button className="text-button" onClick={() => onNavigate("Transactions")}>View all <span>→</span></button></div><div className="transactions-list">{transactions.slice(0, 5).map((t, i) => <TransactionRow key={`${t.name}-${i}`} transaction={t} />)}</div></div><div className="insight"><span className="insight-spark">✦</span><div><strong>Nice work — you&apos;re spending mindfully.</strong><p>Your dining spend is down 18% compared with last month.</p></div><button onClick={onInsights}>See insights <span>→</span></button></div></>;
}

function InsightModal({ transactions, totals, onClose }: { transactions: Transaction[]; totals: { income: number; expense: number }; onClose: () => void }) {
  const categoryTotals = transactions.filter((t) => t.type === "expense").reduce<Record<string, number>>((summary, transaction) => ({ ...summary, [transaction.category]: (summary[transaction.category] || 0) + transaction.amount }), {});
  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0] || ["No expenses yet", 0];
  const savingsRate = totals.income > 0 ? Math.round(((totals.income - totals.expense) / totals.income) * 100) : 0;
  const coverage = totals.expense > 0 ? (totals.income / totals.expense).toFixed(1) : "0.0";
  return <div className="modal-backdrop" onClick={onClose}><div className="modal insights-modal" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">PERSONAL MONEY REVIEW · INR</p><h2>Your spending insights</h2></div><button onClick={onClose}>×</button></div><p className="insights-intro">A quick read of the transactions currently in your Pocketwise ledger.</p><div className="insight-grid"><div className="insight-card insight-card-orange"><span className="insight-card-icon">↘</span><small>Top spend category</small><strong>{topCategory[0]}</strong><b>{money(Number(topCategory[1]))}</b><p>Keep an eye on this category this month.</p></div><div className="insight-card insight-card-green"><span className="insight-card-icon">✦</span><small>Savings rate</small><strong>{savingsRate}%</strong><b>{money(Math.max(0, totals.income - totals.expense))} saved</b><p>Based on income minus expenses.</p></div><div className="insight-card insight-card-blue"><span className="insight-card-icon">↗</span><small>Income coverage</small><strong>{coverage}×</strong><b>your expenses</b><p>Every rupee in is covering your outflow.</p></div></div><div className="insight-footer"><span>Reviewed {transactions.length} transactions</span><button className="secondary-action" onClick={onClose}>Close insights</button></div></div></div>;
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

function TransactionRow({ transaction: t }: { transaction: Transaction }) { return <div className="transaction"><div className={`transaction-icon ${t.color}`}>{t.icon}</div><div className="transaction-info"><strong>{t.name}</strong><span>{t.category} <b>•</b> {t.date}</span></div><strong className={`amount ${t.type}`}>{t.type === "income" ? "+" : "−"}{money(t.amount)}</strong><button className="row-more">...</button></div>; }

function Transactions({ transactions, onAdd }: { transactions: Transaction[]; onAdd: () => void }) { const [search, setSearch] = useState(""); const filtered = transactions.filter((t) => `${t.name} ${t.category}`.toLowerCase().includes(search.toLowerCase())); return <><PageHeading eyebrow="LEDGER · INR" title="Transactions" description="Every rupee in and out, in one place." action={<button className="primary" onClick={onAdd}><b>＋</b> Add transaction</button>} /><div className="panel table-panel"><div className="table-tools"><div className="search-box">⌕<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search transactions" /></div><div className="filter-pills"><button className="pill active">All</button><button className="pill">Income</button><button className="pill">Expenses</button><button className="pill">This month</button></div></div><div className="transaction-table"><div className="table-row table-header"><span>Transaction</span><span>Category</span><span>Date</span><span>Expenses</span><span>Income</span></div>{filtered.map((t, i) => <div className="table-row" key={`${t.name}-${i}`}><span className="table-name"><i className={`transaction-icon small ${t.color}`}>{t.icon}</i><strong>{t.name}</strong></span><span>{t.category}</span><span>{t.date}</span><span className="table-number expense-cell">{t.type === "expense" ? money(t.amount) : "—"}</span><span className="table-number income-cell">{t.type === "income" ? money(t.amount) : "—"}</span></div>)}</div></div><div className="ledger-note"><span>i</span><div><strong>Income and expenses are kept separate</strong><p>Use the two columns above to quickly review exactly what came in and what went out.</p></div></div></>; }

function BudgetCard({ onView }: { onView: () => void }) { return <div className="panel budget-panel"><div className="panel-head"><div><h2>Budget snapshot</h2><p>June 2025 · INR</p></div><button className="more">...</button></div><div className="budget-ring"><div><strong>₹18,200</strong><span>of ₹26,800</span></div></div><div className="budget-list"><div><span><i className="budget-dot orange"/> Essentials</span><strong>₹11,600</strong></div><div><span><i className="budget-dot blue"/> Lifestyle</span><strong>₹4,600</strong></div><div><span><i className="budget-dot purple"/> Savings</span><strong>₹2,000</strong></div></div><button className="text-button" onClick={onView}>Manage budgets <span>→</span></button></div>; }

function Budgets({ categories, notify }: { categories: typeof baseCategories; notify: (message: string) => void }) { return <><PageHeading eyebrow="PLAN · JUNE 2025" title="Budgets" description="Give every rupee a clear job." action={<button className="secondary-action" onClick={() => notify("Budget editor opened")}>+ New budget</button>} /><div className="budget-summary"><div><span>Monthly budget</span><strong>₹26,800</strong></div><div><span>Spent so far</span><strong>₹18,200</strong></div><div><span>Remaining</span><strong className="green-text">₹8,600</strong></div><div><span>Days left</span><strong>16</strong></div></div><div className="budget-grid">{categories.filter((c) => c.kind === "expense").map((c) => <div className="panel budget-detail" key={c.name}><div className="budget-detail-head"><span><i className={`budget-dot ${c.color}`} />{c.name}</span><button onClick={() => notify(`${c.name} budget selected`)}>...</button></div><strong>{money(c.spend)} <small>of {money(c.budget)}</small></strong><div className="wide-progress"><span style={{ width: `${Math.min(100, (c.spend / c.budget) * 100)}%` }} /></div><p>{Math.round((c.spend / c.budget) * 100)}% used <span>{money(c.budget - c.spend)} left</span></p></div>)}</div><div className="panel budget-tip"><span className="insight-spark">✦</span><div><strong>Small win: subscriptions are on track</strong><p>You have ₹1,850 left in this category for the rest of the month.</p></div></div></>; }

function Reports({ transactions, totals }: { transactions: Transaction[]; totals: { income: number; expense: number } }) { return <><PageHeading eyebrow="INSIGHTS · INR" title="Reports" description="See patterns, not just numbers." action={<button className="period-button">June 2025 ▾</button>} /><div className="report-kpis"><div className="panel report-kpi"><span>Total income</span><strong>{money(totals.income)}</strong><small className="green-text">+12.8% vs. last month</small></div><div className="panel report-kpi"><span>Total expenses</span><strong>{money(totals.expense)}</strong><small className="coral-text">−3.2% vs. last month</small></div><div className="panel report-kpi"><span>Savings rate</span><strong>64.3%</strong><small className="green-text">+4.6 pts vs. last month</small></div></div><div className="report-grid"><div className="panel category-report"><div className="panel-head"><div><h2>Spends and income by category</h2><p>June 2025 totals</p></div></div><div className="category-bars">{baseCategories.map((c) => <div className="category-bar" key={c.name}><div><span>{c.name}</span><strong>{c.kind === "income" ? money(c.income) : money(c.spend)}</strong></div><div className="bar-track"><span className={c.kind === "income" ? "income-fill" : "expense-fill"} style={{ width: `${Math.max(12, Math.min(100, ((c.kind === "income" ? c.income : c.spend) / 50000) * 100))}%` }} /></div></div>)}</div></div><div className="panel report-notes"><h2>Monthly review</h2><div className="review-item"><span>01</span><div><strong>Income is diversified</strong><p>Freelance work makes up 73% of inflows.</p></div></div><div className="review-item"><span>02</span><div><strong>Groceries are your top spend</strong><p>They account for 47% of expenses this month.</p></div></div><div className="review-item"><span>03</span><div><strong>Good savings momentum</strong><p>You are ahead of your monthly savings target.</p></div></div></div></div><div className="panel export-panel"><div><strong>Need to share this report?</strong><p>Download a clean monthly summary for your records.</p></div><button className="secondary-action" onClick={() => alert(`Report ready for ${transactions.length} transactions`)}>Export report</button></div></>; }

function Settings({ categories, onAddCategory, notify }: { categories: typeof baseCategories; onAddCategory: (event: React.FormEvent<HTMLFormElement>) => void; notify: (message: string) => void }) { return <><PageHeading eyebrow="PREFERENCES" title="Settings" description="Make Pocketwise feel like your money system." /><div className="settings-grid"><div className="panel settings-card"><div className="panel-head"><div><h2>Currency & locale</h2><p>Used across your dashboard and reports</p></div><span className="settings-check">✓</span></div><label>Currency<select defaultValue="INR"><option value="INR">INR · Indian Rupee (₹)</option></select></label><label>Number format<select defaultValue="en-IN"><option value="en-IN">India · 1,23,456.78</option></select></label><button className="secondary-action" onClick={() => notify("Indian rupee format saved")}>Save preferences</button></div><div className="panel settings-card"><div className="panel-head"><div><h2>Categories</h2><p>Organise both expenses and income</p></div><span className="category-count">{categories.length}</span></div><div className="category-settings-list">{categories.map((c) => <div key={c.name}><span><i className={`budget-dot ${c.color}`} />{c.name}</span><small>{c.kind === "income" ? "Income" : "Expense"}</small></div>)}</div><form className="category-form" onSubmit={onAddCategory}><input name="categoryName" placeholder="New category name" required /><select name="categoryKind"><option value="expense">Expense</option><option value="income">Income</option></select><input name="categoryBudget" type="number" placeholder="Budget ₹" /><button className="primary" type="submit">Add</button></form></div></div><div className="panel settings-card full-settings"><div className="panel-head"><div><h2>Email import rules</h2><p>Choose what Pocketwise should recognise from your inbox</p></div><span className="settings-check muted-check">✓</span></div><div className="rule-list"><label><input type="checkbox" defaultChecked /> Receipts and card spends</label><label><input type="checkbox" defaultChecked /> Salary and freelance credits</label><label><input type="checkbox" /> Bills and recurring payments</label></div><button className="text-button" onClick={() => notify("Import rules saved")}>Save import rules <span>→</span></button></div></>; }

function Connections({ onConnect }: { onConnect: () => void }) { return <><PageHeading eyebrow="AUTOMATIC IMPORTS" title="Connections" description="Bring transactions into your INR ledger with less effort." action={<button className="primary" onClick={onConnect}>Connect inbox</button>} /><div className="connection-grid"><div className="panel connection-card connected"><div className="connection-logo">G</div><div><h2>Gmail</h2><p>Ready to scan receipts, bills, and income alerts.</p><span className="connected-pill">Connection ready</span></div><button className="text-button">Manage</button></div><div className="panel connection-card"><div className="connection-logo outlook">@</div><div><h2>Other inbox</h2><p>Connect another email provider for more coverage.</p><button className="secondary-action" onClick={onConnect}>Add connection</button></div></div></div><div className="privacy-note"><strong>Your inbox, your control.</strong><p>Nothing is added automatically without your review. Pocketwise is designed to keep the final say with you.</p></div></>; }
