// ============================================================================
// governance.js: the screens and helpers that sit on top of engine.js.
//   engine.js  = the rules (policy, ledger, share-out, approvals). No page access, tested in Node.
//   this file  = member roles, the merry-go-round pot, the Expenses page and "Where the money is".
// Loaded BEFORE app.js, so it only declares functions. They use app.js helpers
// ($, el, kes, state...) when called, after app.js has finished loading.
// ============================================================================

// ---------- Roles ----------
const ROLE_OPTIONS = [["member", "Member"], ["chair", "Chair"], ["secretary", "Secretary"], ["treasurer", "Treasurer"], ["official", "Other official"]];
const roleOf = (m) => (ROLE_OPTIONS.some((r) => r[0] === m.role) ? m.role : "member");
const roleLabel = (value) => (ROLE_OPTIONS.find((r) => r[0] === value) || ROLE_OPTIONS[0])[1];

// ---------- Saved data from earlier versions ----------
// Called when data is loaded. Brings older shapes up to date and returns any policy problems found.
function migrateState(st) {
  const hadData = (st.members || []).length > 0 || (st.payments || []).length > 0;
  const defined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
  let p = st.policy;
  if (p && !p.year_end_shareout && (p.shareOut || p.mgr || p.expenses)) { // an earlier, differently shaped policy
    const so = p.shareOut || {}, mg = p.mgr || {}, ex = p.expenses || {};
    p = {
      year_end_shareout: defined({ model: { savings: "savings_proportional", time: "time_weighted", equal: "equal" }[so.model], include_fines: so.includeFines, include_loan_interest: so.includeInterest, include_welfare_surplus: so.includeWelfareSurplus, deduct_unpaid_loans: so.deductDebts, return_savings: so.returnSavings }),
      merry_go_round: defined({ is_separate_fund: mg.mode ? mg.mode !== "integrated" : undefined, amount_per_member: mg.amount }),
      expense_governance: defined({ approval_policy: ex.approval, signatories_required: ex.signatories, approval_threshold: ex.threshold }),
    };
  }
  const merged = Engine.mergePolicy(p || {}, Engine.defaultPolicy());
  st.policy = merged.policy;
  // Records saved before any policy existed paid the pot out of the monthly contributions
  if (!p && hadData) st.policy.merry_go_round.is_separate_fund = false;

  (st.members || []).forEach((m) => { m.role = String(m.role || "member").toLowerCase(); if (!ROLE_OPTIONS.some((r) => r[0] === m.role)) m.role = "member"; });
  (st.payments || []).forEach((x) => { if (x.kind === "round") x.kind = "mgr"; });
  st.meetings = st.meetings || []; st.charges = st.charges || []; st.reconciliations = st.reconciliations || []; if (st.constitution === undefined) st.constitution = null;
  st.expenses = (st.expenses || []).map((e) => {
    if (e.description !== undefined) return e;
    const votes = e.votes || [];
    const treasurer = (st.members || []).find((m) => m.role === "treasurer");
    return {
      id: e.id, date: e.date, amount: e.amount, description: e.desc || "", category: e.category || "", receipt: e.note || "", draftedBy: treasurer ? treasurer.id : "",
      needed: Math.max(votes.filter((v) => v.decision === "for").length, e.status === "approved" ? 0 : Engine.approvalsNeeded(st, e.amount)),
      approvals: votes.filter((v) => v.decision === "for").map((v) => ({ memberId: v.memberId, at: v.date })),
      rejections: votes.filter((v) => v.decision === "against").map((v) => ({ memberId: v.memberId, at: v.date })),
      status: e.status === "declined" ? "rejected" : e.status, approvedOn: e.approvedOn || "",
    };
  });
  return { problems: merged.problems };
}

// ---------- Merry-go-round ----------
// separate: members pay a pot contribution of their own, on top of savings, and the pot is only those payments.
// not separate: the pot is paid out of the monthly contributions (an advance taken from savings).
const mgrSeparate = () => state.policy.merry_go_round.is_separate_fund;
const mgrAmount = () => state.policy.merry_go_round.amount_per_member || 0;
const potFor = (ym) => mgrSeparate()
  ? state.payments.filter((p) => kindOf(p) === "mgr" && p.month === ym).reduce((s, p) => s + p.amount, 0)
  : collected(ym);
const potTarget = () => (mgrSeparate() ? state.members.length * mgrAmount() : state.members.reduce((t, m) => t + pledgeOf(m.id), 0));
const mgrOwed = (id) => (mgrSeparate() ? Math.max(0, monthsDue() * mgrAmount() - sumKind(id, "mgr")) : 0);

// ---------- Expenses ----------
function describePolicy() {
  const g = state.policy.expense_governance;
  if (g.approval_policy === "treasurer_only") return "Your policy: the treasurer records expenses directly.";
  const small = g.approval_threshold > 0 ? `Expenses of ${kes(g.approval_threshold)} or less are recorded directly. ` : "";
  return small + (g.approval_policy === "multi_sig"
    ? `Larger ones need ${g.signatories_required} approvals from officials (Chair, Secretary, Treasurer or other officials) other than the person who recorded it.`
    : "Larger ones need more than half of the members to approve.");
}

function exMessage(text, ok) { $("exMsg").textContent = text; $("exMsg").className = ok ? "good" : "err"; }

function statusText(e) {
  if (e.status === "approved") return e.approvals.length ? "Approved by " + e.approvals.map((a) => memberName(a.memberId)).join(", ") : "Recorded directly";
  const no = (e.rejections || []).length ? ` · declined by ${e.rejections.map((a) => memberName(a.memberId)).join(", ")}` : "";
  if (e.status === "rejected") return "Declined" + no;
  return `${e.approvals.length} of ${e.needed} approvals${no}`;
}

function renderExpenses() {
  const ex = state.expenses, approved = ex.filter((e) => e.status === "approved"), pending = ex.filter((e) => e.status === "pending");
  $("exRule").textContent = describePolicy();
  const keep = $("exBy").value;
  $("exBy").replaceChildren(...state.members.map((m) => new Option(m.name + (roleOf(m) !== "member" ? ` (${roleLabel(roleOf(m))})` : ""), m.id)));
  if (keep) $("exBy").value = keep;
  $("exStats").replaceChildren(...[[kes(approved.reduce((s, e) => s + e.amount, 0)), "Approved expenses"], [`${pending.length}`, "Waiting for approval"], [kes(pending.reduce((s, e) => s + e.amount, 0)), "Amount waiting"]].map(([big, small]) => {
    const d = el("div", undefined, "stat"); d.append(el("b", big), el("span", small)); return d;
  }));
  $("exRows").replaceChildren(...(ex.length ? [...ex].sort((a, b) => b.date.localeCompare(a.date)).map((e) => {
    const tr = el("tr"), name = el("div", e.description), act = el("div", undefined, "row");
    const sub = [e.category, e.receipt && "Receipt: " + e.receipt, e.draftedBy && "recorded by " + memberName(e.draftedBy)].filter(Boolean).join(" · ");
    if (sub) name.append(el("br"), el("small", sub, "hint"));
    if (e.status === "pending") {
      const voters = Engine.eligibleApprovers(state, e);
      if (!voters.length) act.append(el("span", state.policy.expense_governance.approval_policy === "multi_sig" ? "No eligible approvers. Give members a Chair, Secretary, Treasurer or Official role." : "Everyone has voted.", "hint"));
      else {
        const sel = el("select"); voters.forEach((m) => sel.append(new Option(m.name, m.id)));
        const yes = el("button", "Approve", "ghost"), no = el("button", "Decline", "del"), ask = el("a", "Ask on WhatsApp", "btnlink");
        const setAsk = () => {
          const m = state.members.find((x) => x.id === sel.value);
          ask.hidden = !(m && m.phone);
          if (m) ask.href = `https://wa.me/${m.phone}?text=${encodeURIComponent(`Hello ${m.name}, please review this expense for ${state.settings.name || "our chama"}: ${e.description}, ${kes(e.amount)}. Reply Approved or Declined.`)}`;
        };
        sel.onchange = setAsk; setAsk();
        ask.target = "_blank"; ask.rel = "noopener";
        yes.onclick = () => { const r = Engine.approveExpense(state, e.id, sel.value, today()); if (!r.ok) return exMessage(r.error, false); save(); render(); };
        no.onclick = () => { if (!Engine.rejectExpense(state, e.id, sel.value, today())) return exMessage("That person cannot vote on this expense.", false); save(); render(); };
        act.append(sel, yes, no, ask);
      }
      const cancel = el("button", "Cancel request", "del");
      cancel.onclick = () => { if (confirm("Cancel this request? It will be marked as declined.")) { Engine.rejectExpense(state, e.id); save(); render(); } };
      act.append(cancel);
    }
    const del = el("button", "Delete", "del");
    del.onclick = () => { if (confirm("Delete this expense record?")) { state.expenses = state.expenses.filter((x) => x.id !== e.id); save(); render(); } };
    const st = badge(e.status === "approved" ? "Approved" : e.status === "rejected" ? "Declined" : "Pending", e.status === "approved" ? "ok" : e.status === "rejected" ? "bad" : "warn");
    tr.append(cell(e.date), cell(name), cell(kes(e.amount)), cell(st), cell(statusText(e)), cell(act), cell(del));
    return tr;
  }) : [emptyRow(7, "No expenses recorded yet.")]));
}

function initExpenses() {
  $("exDate").value = today();
  $("expenseForm").onsubmit = (ev) => {
    ev.preventDefault();
    const amount = Number($("exAmount").value);
    if (!state.members.length) return exMessage("Add a member before recording an expense.", false);
    if (!(amount > 0) || !$("exDate").value || !$("exDesc").value.trim()) return exMessage("Enter a valid date, amount and description.", false);
    const draft = { id: uid(), date: $("exDate").value, amount, description: $("exDesc").value.trim(), draftedBy: $("exBy").value, receipt: $("exNote").value.trim(), category: $("exCat").value };
    const needed = Engine.approvalsNeeded(state, amount);
    // Do not accept a request that nobody is allowed to approve
    if (state.policy.expense_governance.approval_policy === "multi_sig" && Engine.eligibleApprovers(state, draft).length < needed) {
      return exMessage(`This expense needs ${needed} approval(s) from officials, but fewer are available. Give members official roles, or change the approval rule in Settings.`, false);
    }
    const e = Engine.createExpense(state, draft);
    ev.target.reset(); $("exDate").value = today();
    save(); render();
    exMessage(e.status === "approved" ? "Expense saved and approved." : "Expense saved. It is waiting for approval.", true);
  };
}

// ---------- Where the money is ----------
// Every recorded entry is a balanced journal entry between named funds (see engine.js).
function renderBuckets() {
  const J = Engine.journal(state), b = Engine.balances(J), c = Engine.check(J), A = Engine.ACCOUNTS;
  const cards = [[b.savings, A.savings.label], [b.fines, A.fines.label], [b.welfare, A.welfare.label]];
  cards.push(mgrSeparate() ? [b.mgr, A.mgr.label + " held"] : [b.mgr_advances, A.mgr_advances.label + " (taken from savings)"]);
  cards.push([b.loans_receivable, A.loans_receivable.label], [b.loan_interest, A.loan_interest.label], [b.expenses, "Expenses paid"], [b.cash, "Estimated " + A.cash.label.toLowerCase()]);
  $("bucketStats").replaceChildren(...cards.map(([big, small]) => { const d = el("div", undefined, "stat"); d.append(el("b", kes(big)), el("span", small)); return d; }));
  $("bucketStatus").textContent = (c.balanced ? `The books balance: ${kes(c.debits)} in debits and ${kes(c.credits)} in credits. ` : `The books are out of balance (${kes(c.debits)} debits, ${kes(c.credits)} credits). Review the saved records. `)
    + (c.cashNegative ? "Recorded loans, payouts and expenses are more than the money recorded coming in, so check for missing payments. " : "")
    + "Compare the cash figure with your bank or M-Pesa balance.";
  $("bucketStatus").className = c.balanced ? "hint" : "err";
}

// When the approval rule changes, requests that are still waiting are checked against the new rule.
function resettlePending() {
  state.expenses.filter((e) => e.status === "pending").forEach((e) => {
    e.needed = Engine.approvalsNeeded(state, e.amount);
    if (e.approvals.length >= e.needed) { e.status = "approved"; e.approvedOn = e.approvedOn || today(); }
  });
}
