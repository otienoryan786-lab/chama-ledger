// ============================================================================
// trust.js: the features that make every figure easy to check and to share.
//   Group health      a score and plain-language insights (insights.js)
//   Ledger            every entry, searchable (the engine's journal)
//   Explain           why a member owes what they owe, line by line
//   Statements        a printable statement and a link a member can open on their own phone
//   Projection        "what will each member get at the end of the period?"
// Loaded BEFORE app.js, so it only declares functions; they run after app.js loads.
// ============================================================================

// ---------- Group health ----------
function buildSummary() {
  const month = thisMonth(), J = Engine.journal(state), b = Engine.balances(J), c = Engine.check(J);
  const members = state.members.map((m) => {
    const pl = pledgeOf(m.id);
    return { name: m.name, paidThisMonth: pl === 0 || hasPaid(m.id, month), monthsBehind: pl ? Math.ceil(arrears(m.id) / pl - 0.0001) : 0 };
  });
  const loans = state.loans.map((l) => {
    const st = loanStats(l);
    if (!st.balance) return null;
    const expected = Math.min(l.months, Math.max(0, ymDiff(l.issued.slice(0, 7), month))) * st.installment;
    return { name: memberName(l.memberId), balance: st.balance, behindBy: Math.max(0, Math.round(expected - st.repaid)) };
  }).filter(Boolean);
  const pending = state.expenses.filter((e) => e.status === "pending");
  const heldM = state.meetings.filter((m) => m.status === "held").sort((a, b) => b.date.localeCompare(a.date)), last = heldM[0], ls = last ? Engine.meetingStats(state, last) : null;
  const openA = Engine.openActions(state, today());
  const lowAttendance = state.members.filter((m) => { const r = Engine.attendanceRate(state, m.id, 3); return r.held >= 2 && r.rate < 0.5; }).map((m) => m.name);
  return { meeting: last ? { date: last.date, attended: ls.attended, total: ls.total, quorumMet: ls.quorumMet } : null, actions: { open: openA.length, overdue: openA.filter((a) => a.overdue).length }, lowAttendance, daysSinceMeeting: last ? dayDiff(last.date, today()) : null, memberCount: members.length, monthLabel: month, members, loans, loansOut: b.loans_receivable, savings: b.savings, cash: b.cash, booksBalanced: c.balanced, cashNegative: c.cashNegative, pending: { count: pending.length, amount: pending.reduce((s, e) => s + e.amount, 0) } };
}

function renderHealth() {
  const s = buildSummary(), h = Insights.healthScore(s), list = Insights.buildInsights(s), box = $("healthBox");
  const gauge = el("div", undefined, "gauge");
  const len = Math.PI * 80, col = h.score === null ? "var(--line)" : h.score >= 65 ? "var(--ok)" : h.score >= 40 ? "var(--accent)" : "var(--bad)";
  const svgEl = svg("svg", { viewBox: "0 0 180 110", role: "img", "aria-label": h.score === null ? "No health score yet" : `Group health ${h.score} out of 100, ${h.label}` });
  const track = svg("path", { d: "M10 90 A80 80 0 0 1 170 90", fill: "none", stroke: "var(--line)", "stroke-width": 14, "stroke-linecap": "round" });
  const arc = svg("path", { d: "M10 90 A80 80 0 0 1 170 90", fill: "none", stroke: col, "stroke-width": 14, "stroke-linecap": "round" });
  arc.style.strokeDasharray = `0 ${len}`;
  arc.style.transition = "stroke-dasharray .9s cubic-bezier(.2,.8,.2,1)";
  svgEl.append(track, arc, svg("text", { x: 90, y: 78, "text-anchor": "middle", "font-size": 34, "font-weight": 800, fill: "var(--ink)" }, h.score === null ? "-" : String(h.score)), svg("text", { x: 90, y: 100, "text-anchor": "middle", "font-size": 13, fill: "var(--muted)" }, h.label));
  gauge.append(svgEl);
  if (h.score !== null) requestAnimationFrame(() => requestAnimationFrame(() => { arc.style.strokeDasharray = `${(len * h.score) / 100} ${len}`; }));

  const bars = el("div", undefined, "bars");
  h.parts.forEach((p) => {
    const row = el("div", undefined, "bar"), track2 = el("div", undefined, "track"), fill = el("div", undefined, "fill");
    fill.style.width = (p.points / p.max) * 100 + "%";
    track2.append(fill);
    const head = el("div", undefined, "barhead"); head.append(el("span", p.label), el("small", p.detail));
    row.append(head, track2); bars.append(row);
  });

  const ins = el("ul", undefined, "insights");
  list.forEach((i) => {
    const li = el("li", undefined, i.level);
    li.append(el("span", i.text));
    if (i.view) { const b = el("button", "View", "del"); b.style.color = "var(--ink)"; b.onclick = () => { location.hash = i.view; }; li.append(b); }
    ins.append(li);
  });
  const left = el("div"); left.append(gauge, bars);
  const right = el("div"); right.append(el("h3", "What stands out"), ins);
  box.replaceChildren(left, right);
}

// ---------- Ledger ----------
let ledgerAll = false;
function ledgerRows() {
  const q = $("lgSearch").value.trim().toLowerCase(), mem = $("lgMember").value, fund = $("lgFund").value, from = $("lgFrom").value, to = $("lgTo").value;
  return Engine.journal(state).filter((e) =>
    (!q || (e.memo + " " + memberName(e.memberId || "")).toLowerCase().includes(q)) &&
    (!mem || e.memberId === mem) && (!fund || e.lines.some((l) => l.acct === fund)) && (!from || e.date >= from) && (!to || e.date <= to)
  ).sort((a, b) => b.date.localeCompare(a.date));
}
function renderLedger() {
  const keepM = $("lgMember").value, keepF = $("lgFund").value;
  $("lgMember").replaceChildren(new Option("Everyone", ""), ...state.members.map((m) => new Option(m.name, m.id)));
  $("lgFund").replaceChildren(new Option("All funds", ""), ...Object.entries(Engine.ACCOUNTS).map(([k, a]) => new Option(a.label, k)));
  $("lgMember").value = keepM; $("lgFund").value = keepF;
  const rows = ledgerRows(), shown = ledgerAll ? rows : rows.slice(0, 120), A = Engine.ACCOUNTS, c = Engine.check(Engine.journal(state));
  const side = (e, k) => { const d = el("div"); e.lines.filter((l) => l[k] > 0).forEach((l) => d.append(el("div", `${A[l.acct].label}: ${kes(l[k])}`))); return d; };
  $("lgRows").replaceChildren(...(shown.length ? shown.map((e) => {
    const tr = el("tr"); tr.append(cell(e.date), cell(e.memo), cell(e.memberId ? memberName(e.memberId) : "-"), cell(side(e, "dr")), cell(side(e, "cr")));
    return tr;
  }) : [emptyRow(5, "No entries match.")]));
  $("lgMore").hidden = ledgerAll || rows.length <= 120;
  $("lgMore").textContent = `Show all ${rows.length} entries`;
  $("lgStatus").textContent = `${rows.length} entr${rows.length === 1 ? "y" : "ies"}. ` + (c.balanced ? "The books balance: every entry has equal debits and credits." : "The books are out of balance. Review the records.");
}
function initLedger() {
  ["lgSearch", "lgMember", "lgFund", "lgFrom", "lgTo"].forEach((id) => { $(id).oninput = $(id).onchange = () => { ledgerAll = false; renderLedger(); }; });
  $("lgMore").onclick = () => { ledgerAll = true; renderLedger(); };
  $("lgCsv").onclick = () => {
    const A = Engine.ACCOUNTS, lines = ["Date,What happened,Member,Side,Fund,Amount"];
    ledgerRows().forEach((e) => e.lines.forEach((l) => { [["Debit", l.dr], ["Credit", l.cr]].forEach(([s, v]) => { if (v > 0) lines.push([e.date, `"${e.memo.replace(/"/g, '""')}"`, `"${e.memberId ? memberName(e.memberId) : ""}"`, s, A[l.acct].label, v].join(",")); }); }));
    const a = el("a"); a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" })); a.download = "ledger.csv"; a.click();
  };
}

// ---------- Explain this number ----------
function explainDues(id) {
  const pl = pledgeOf(id), n = monthsDue(), m = state.members.find((x) => x.id === id), s = state.settings, out = [];
  // Contributions
  const c = [`${kes(pl)} a month for ${n} month${n === 1 ? "" : "s"} since ${s.start || "the start"} comes to ${kes(pl * n)}.`];
  if (m.opening) c.push(`Brought forward from earlier records: ${kes(m.opening)}.`);
  c.push(`Paid so far: ${kes(paidBy(id))}.`);
  if (s.start && !m.opening) for (let ym = s.start; ym <= thisMonth(); ym = addMonths(ym, 1)) { const p = paidBy(id, ym); if (p < pl) c.push(`${ym}: paid ${kes(p)} of ${kes(pl)}.`); }
  c.push(arrears(id) ? `So ${kes(arrears(id))} is still to pay.` : "Fully paid up.");
  out.push({ title: "Contributions", amount: arrears(id), lines: c });
  // Fines: late contributions and attendance at meetings
  const rule = s.fineType !== "none" && s.fineValue, myCharges = state.charges.filter((c) => c.memberId === id);
  if (rule || myCharges.length) {
    const f = [];
    if (rule) {
      const text = s.fineType === "flat" ? `${kes(s.fineValue)} for each late payment` : s.fineType === "daily" ? `${kes(s.fineValue)} for each day late` : `${s.fineValue}% of the contribution`;
      f.push(`Late contributions: ${text}, due on day ${s.dueDay || 5}${s.graceDays ? ` with ${s.graceDays} grace days` : ""}.`);
      fineBreakdown(id).forEach((x) => f.push(`${x.month}: ${x.doneOn ? `completed on ${x.doneOn}` : "not fully paid yet"}, ${x.late} day${x.late === 1 ? "" : "s"} after ${x.limit} gives ${kes(x.fine)}.`));
    }
    myCharges.forEach((c) => f.push(`${c.date}: ${c.reason}: ${kes(c.amount)}${c.waived ? " (waived)" : ""}.`));
    f.push(`Fines paid so far: ${kes(sumKind(id, "fine"))}.`, finesOwed(id) ? `So ${kes(finesOwed(id))} is still owed.` : "Nothing owed in fines.");
    out.push({ title: "Fines", amount: finesOwed(id), lines: f });
  }
  if (s.welfareAmount) out.push({ title: "Welfare", amount: welfareOwed(id), lines: [`${kes(s.welfareAmount)} a month for ${n} month${n === 1 ? "" : "s"} comes to ${kes(s.welfareAmount * n)}.`, `Paid so far: ${kes(sumKind(id, "welfare"))}.`, welfareOwed(id) ? `So ${kes(welfareOwed(id))} is still to pay.` : "Fully paid up."] });
  if (mgrSeparate() && mgrAmount()) out.push({ title: "Merry-go-round pot", amount: mgrOwed(id), lines: [`${kes(mgrAmount())} a month for ${n} month${n === 1 ? "" : "s"} comes to ${kes(mgrAmount() * n)}.`, `Paid so far: ${kes(sumKind(id, "mgr"))}.`, mgrOwed(id) ? `So ${kes(mgrOwed(id))} is still to pay.` : "Fully paid up."] });
  state.loans.filter((l) => l.memberId === id).forEach((l) => { const st = loanStats(l); out.push({ title: "Loan of " + kes(l.principal), amount: st.balance, lines: [`${l.rate}% a month, ${l.type === "flat" ? "flat" : "reducing balance"}, over ${l.months} months, given ${l.issued}.`, `Monthly instalment: ${kes(st.installment)}. Total to repay: ${kes(st.total)}.`, `Repaid so far: ${kes(st.repaid)}.`, st.balance ? `Balance: ${kes(st.balance)}.` : "Cleared."] }); });
  return out;
}

// ---------- Statements: a page to print and a link to share ----------
function statementData(id) {
  const m = state.members.find((x) => x.id === id), pl = pledgeOf(id), now = thisMonth(), s = state.settings;
  const months = [], begin = s.start && s.start > addMonths(now, -11) ? s.start : addMonths(now, -11);
  for (let ym = begin; ym <= now; ym = addMonths(ym, 1)) months.push([ym, paidBy(id, ym), pl]);
  const pay = state.payments.filter((p) => p.memberId === id).sort((a, b) => (b.paidOn || b.date).localeCompare(a.paidOn || a.date)).slice(0, 8).map((p) => [p.paidOn || p.date, kindOf(p), p.amount, p.ref]);
  const ln = state.loans.filter((l) => l.memberId === id).map((l) => { const st = loanStats(l); return [l.principal, l.rate, l.type, st.balance, st.installment]; });
  return { v: 1, g: s.name || "Chama", m: m.name, t: today(), pl, paid: paidBy(id), arr: arrears(id), fine: finesOwed(id), wel: welfareOwed(id), mgr: mgrOwed(id), mo: months, pay, ln };
}
function encodeStatement(obj) {
  let bin = ""; new TextEncoder().encode(JSON.stringify(obj)).forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const statementLink = (id) => new URL("statement.html", location.href).href.split("#")[0] + "#" + encodeStatement(statementData(id));
function statementText(id) {
  const d = statementData(id), owed = d.arr + d.fine + d.wel + d.mgr;
  return `${d.g}: statement for ${d.m} as at ${d.t}. Paid so far ${kes(d.paid)}. ${owed ? `Owed now ${kes(owed)}.` : "Nothing owed, you are paid up."} Full statement: ${statementLink(id)}`;
}
function trustBlock(id) {
  const wrap = el("div", undefined, "trust");
  const why = el("details", undefined, "why"); why.append(el("summary", "Why is this the amount?"));
  explainDues(id).forEach((sec) => {
    const box = el("div", undefined, "whysec"), head = el("div", undefined, "whyhead"); head.append(el("strong", sec.title), el("span", sec.amount ? kes(sec.amount) + " owed" : "Clear", sec.amount ? "unpaid" : "paid"));
    const ul = el("ul"); sec.lines.forEach((t) => ul.append(el("li", t)));
    box.append(head, ul); why.append(box);
  });
  const bar = el("div", undefined, "row"), m = state.members.find((x) => x.id === id);
  bar.style.margin = ".6rem 0";
  const open = el("a", "Open statement", "btnlink"); open.href = statementLink(id); open.target = "_blank"; open.rel = "noopener";
  const copy = el("button", "Copy link", "ghost"); copy.onclick = () => copyText(statementLink(id), copy);
  bar.append(open, copy);
  if (m && m.phone) { const wa = el("a", "Send on WhatsApp", "btnlink"); wa.href = `https://wa.me/${m.phone}?text=${encodeURIComponent(statementText(id))}`; wa.target = "_blank"; wa.rel = "noopener"; bar.append(wa); }
  wrap.append(why, bar);
  return wrap;
}

// ---------- Projection ----------
// Adds the months still to come (members keep paying a share of their monthly amount, loans are repaid on schedule)
// to a copy of the records, then runs the same share-out on it.
function projectedYearEnd(o, rate) {
  const real = state, proj = JSON.parse(JSON.stringify(state)), f = rate / 100, remaining = {};
  real.loans.forEach((l) => { remaining[l.id] = loanStats(l).balance; });
  for (let ym = addMonths(thisMonth(), 1); ym <= o.to; ym = addMonths(ym, 1)) {
    proj.members.forEach((m) => { const pl = pledgeOf(m.id); if (pl) proj.payments.push({ id: `proj-${ym}-${m.id}`, memberId: m.id, month: ym, amount: Math.round(pl * f), kind: "contribution", ref: `PROJ-${ym}-${m.id}`, source: "projected", date: `${ym}-05`, paidOn: `${ym}-05` }); });
    proj.loans.forEach((l) => { const pay = Math.min(loanStats(l).installment, remaining[l.id]); if (pay > 0) { (l.repayments = l.repayments || []).push({ id: `proj-${ym}-${l.id}`, amount: pay, date: `${ym}-10` }); remaining[l.id] -= pay; } });
  }
  state = proj;
  try { return computeYearEnd(o); } finally { state = real; }
}
function renderProjection(o) {
  const on = $("prEnable").checked, rate = Number($("prRate").value);
  $("prOut").textContent = rate + "%";
  $("prControls").hidden = !on;
  if (!on) { $("prTable").replaceChildren(); $("prNote").textContent = ""; return; }
  if (o.to <= thisMonth()) { $("prTable").replaceChildren(); $("prNote").textContent = "The period has already ended, so there is nothing left to project."; return; }
  const now = computeYearEnd(o), later = projectedYearEnd(o, rate);
  const t = el("table"), th = el("thead"), hr = el("tr"), tb = el("tbody");
  ["Member", "If the period ended today", "Projected", "Change"].forEach((h) => hr.append(el("th", h))); th.append(hr);
  later.rows.forEach((r, i) => {
    const diff = r.net - now.rows[i].net, tr = el("tr");
    tr.append(cell(r.name), cell(kes(now.rows[i].net)), cell(el("strong", kes(r.net))), cell(el("span", (diff >= 0 ? "+" : "-") + kes(Math.abs(diff)), diff >= 0 ? "paid" : "unpaid")));
    tb.append(tr);
  });
  t.append(th, tb);
  const wrap = el("div", undefined, "scroll"); wrap.append(t);
  $("prTable").replaceChildren(wrap);
  $("prNote").textContent = `Income to share: ${kes(now.income)} now, projected ${kes(later.income)}. Assumes members pay ${rate}% of their monthly amount each remaining month and loans are repaid on schedule. It is an estimate, not a promise.`;
}
function initProjection() {
  ["prEnable", "prRate"].forEach((id) => { $(id).oninput = $(id).onchange = () => renderYearEnd(); });
}
