"use client";

import { useMemo, useState } from "react";

type Transaction = { name: string; category: string; date: string; amount: number; type: "income" | "expense"; icon: string; color: string };

const initialTransactions: Transaction[] = [
  { name: "Stripe payout", category: "Income", date: "Today, 9:41 AM", amount: 4820, type: "income", icon: "↗", color: "mint" },
  { name: "Whole Foods Market", category: "Groceries", date: "Today, 8:12 AM", amount: 86.42, type: "expense", icon: "✦", color: "peach" },
  { name: "Notion", category: "Software", date: "Yesterday", amount: 10, type: "expense", icon: "N", color: "lavender" },
  { name: "Uber", category: "Transport", date: "Yesterday", amount: 24.8, type: "expense", icon: "U", color: "sky" },
  { name: "Apple", category: "Shopping", date: "Jun 08", amount: 129.99, type: "expense", icon: "●", color: "rose" },
];

const money = (amount: number) => amount.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function Home() {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [showModal, setShowModal] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [toast, setToast] = useState("");
  const [period, setPeriod] = useState("This month");

  const totals = useMemo(() => ({
    income: transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
    expense: transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
  }), [transactions]);

  function addTransaction(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const amount = Number(form.get("amount"));
    const type = form.get("type") as "income" | "expense";
    setTransactions([{ name: String(form.get("name") || "New transaction"), category: String(form.get("category") || "Other"), date: "Just now", amount, type, icon: type === "income" ? "↗" : "✦", color: type === "income" ? "mint" : "peach" }, ...transactions]);
    setShowModal(false);
    setToast("Transaction added");
    setTimeout(() => setToast(""), 2400);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">$</span><span>pocketwise</span></div>
        <nav>
          <p className="nav-label">Workspace</p>
          <button className="nav-item active"><span>◈</span> Overview</button>
          <button className="nav-item" onClick={() => setToast("Transactions view is coming next") }><span>↕</span> Transactions</button>
          <button className="nav-item" onClick={() => setToast("Budgets view is coming next") }><span>◫</span> Budgets <em>3</em></button>
          <button className="nav-item" onClick={() => setToast("Reports view is coming next") }><span>▥</span> Reports</button>
          <p className="nav-label second">Manage</p>
          <button className="nav-item" onClick={() => setShowConnect(true)}><span>⌁</span> Connections</button>
          <button className="nav-item" onClick={() => setToast("Settings saved locally") }><span>⚙</span> Settings</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sync-card"><div className="sync-icon">✉</div><div><strong>Connect your inbox</strong><p>Find expenses automatically</p></div><button onClick={() => setShowConnect(true)}>→</button></div>
          <div className="profile"><div className="avatar">RA</div><div><strong>Radhesh Agrawal</strong><span>Personal workspace</span></div><span className="dots">•••</span></div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar"><div className="mobile-brand">$ pocketwise</div><div className="breadcrumb">Personal / <strong>Overview</strong></div><div className="top-actions"><button className="icon-button" aria-label="Search">⌕</button><button className="icon-button" aria-label="Notifications">♧<i /></button><div className="mini-avatar">RA</div></div></header>
        <div className="page-wrap">
          <div className="hero-row"><div><p className="eyebrow">SATURDAY, JUNE 14, 2025</p><h1>Good morning, Radhesh <span>✦</span></h1><p className="subhead">Here&apos;s your money at a glance.</p></div><button className="primary" onClick={() => setShowModal(true)}><b>＋</b> Add transaction</button></div>

          <div className="stats-grid">
            <div className="stat-card dark-card"><div className="stat-head"><span>Net balance</span><button>•••</button></div><div className="stat-value">{money(12840.46 + totals.income - totals.expense)}</div><div className="stat-foot positive">↗ <strong>8.4%</strong><span>vs. last month</span></div><div className="sparkline"><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div>
            <div className="stat-card"><div className="stat-head"><span>Income</span><div className="stat-icon green">↗</div></div><div className="stat-value">{money(totals.income)}</div><div className="stat-foot positive">↗ <strong>12.8%</strong><span>vs. last month</span></div></div>
            <div className="stat-card"><div className="stat-head"><span>Spending</span><div className="stat-icon coral">↘</div></div><div className="stat-value">{money(totals.expense)}</div><div className="stat-foot negative">↘ <strong>3.2%</strong><span>vs. last month</span></div></div>
            <div className="stat-card"><div className="stat-head"><span>To spend</span><div className="stat-icon violet">◔</div></div><div className="stat-value">$2,180<span className="muted">.00</span></div><div className="progress"><span style={{ width: "68%" }} /></div><div className="stat-foot"><span>68% of monthly budget</span></div></div>
          </div>

          <div className="dashboard-grid">
            <div className="panel chart-panel"><div className="panel-head"><div><h2>Cash flow</h2><p>Income & spending over time</p></div><select value={period} onChange={(e) => setPeriod(e.target.value)}><option>This month</option><option>Last month</option><option>This year</option></select></div><div className="legend"><span><i className="dot income-dot"/> Income</span><span><i className="dot expense-dot"/> Spending</span></div><div className="chart"><div className="y-labels"><span>$6k</span><span>$4k</span><span>$2k</span><span>$0</span></div><div className="chart-area"><div className="gridline one"/><div className="gridline two"/><div className="gridline three"/><div className="gridline four"/><svg viewBox="0 0 700 220" preserveAspectRatio="none" aria-label="Cash flow chart"><path className="income-line" d="M0 157 C50 135, 70 156, 112 125 S185 100, 225 137 S290 115, 335 92 S400 129, 445 89 S510 58, 555 76 S625 33, 700 46"/><path className="expense-line" d="M0 178 C45 174, 75 180, 112 169 S190 159, 225 173 S290 147, 335 153 S400 136, 445 151 S510 119, 555 131 S625 112, 700 122"/></svg><div className="chart-labels"><span>Jun 1</span><span>Jun 5</span><span>Jun 9</span><span>Jun 13</span></div></div></div></div>
            <div className="panel budget-panel"><div className="panel-head"><div><h2>Budget snapshot</h2><p>June 2025</p></div><button className="more">•••</button></div><div className="budget-ring"><div><strong>$1,820</strong><span>of $2,680</span></div></div><div className="budget-list"><div><span><i className="budget-dot orange"/> Essentials</span><strong>$1,160</strong></div><div><span><i className="budget-dot blue"/> Lifestyle</span><strong>$460</strong></div><div><span><i className="budget-dot purple"/> Savings</span><strong>$200</strong></div></div><button className="text-button" onClick={() => setToast("Budget editor coming next")}>View budgets <span>→</span></button></div>
          </div>

          <div className="panel transactions-panel"><div className="panel-head"><div><h2>Recent transactions</h2><p>Your latest money moves</p></div><button className="text-button" onClick={() => setToast("Showing all transactions")}>View all <span>→</span></button></div><div className="transactions-list">{transactions.slice(0, 5).map((t, i) => <div className="transaction" key={`${t.name}-${i}`}><div className={`transaction-icon ${t.color}`}>{t.icon}</div><div className="transaction-info"><strong>{t.name}</strong><span>{t.category} <b>•</b> {t.date}</span></div><strong className={`amount ${t.type}`}>{t.type === "income" ? "+" : "−"}{money(t.amount)}</strong><button className="row-more">•••</button></div>)}</div></div>
          <div className="insight"><span className="insight-spark">✦</span><div><strong>Nice work — you&apos;re spending mindfully.</strong><p>Your dining spend is down 18% compared with last month.</p></div><button onClick={() => setToast("Opening your spending insights")}>See insights <span>→</span></button></div>
        </div>
      </section>

      {showModal && <div className="modal-backdrop" onClick={() => setShowModal(false)}><div className="modal" onClick={(e) => e.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">MONEY MOVE</p><h2>Add transaction</h2></div><button onClick={() => setShowModal(false)}>×</button></div><form onSubmit={addTransaction}><label>Description<input name="name" placeholder="e.g. Coffee with Maya" required /></label><div className="form-row"><label>Amount<input name="amount" type="number" step="0.01" placeholder="0.00" required /></label><label>Type<select name="type"><option value="expense">Expense</option><option value="income">Income</option></select></label></div><label>Category<select name="category"><option>Other</option><option>Food & dining</option><option>Transport</option><option>Shopping</option><option>Software</option><option>Income</option></select></label><button className="primary full" type="submit">Save transaction</button></form></div></div>}
      {showConnect && <div className="modal-backdrop" onClick={() => setShowConnect(false)}><div className="modal connect-modal" onClick={(e) => e.stopPropagation()}><div className="connect-art">✉</div><div className="modal-head"><div><p className="eyebrow">AUTOMATIC IMPORTS</p><h2>Connect your inbox</h2></div><button onClick={() => setShowConnect(false)}>×</button></div><p className="modal-copy">Pocketwise can scan receipts, invoices, and payout emails to help keep your finances up to date. Your inbox stays private and you choose what gets added.</p><button className="email-connect" onClick={() => { setShowConnect(false); setToast("Email connection request saved") }}><span>G</span> Connect with Gmail <b>→</b></button><button className="secondary" onClick={() => setShowConnect(false)}>I&apos;ll do this later</button></div></div>}
      {toast && <div className="toast">✓ &nbsp;{toast}</div>}
    </main>
  );
}
