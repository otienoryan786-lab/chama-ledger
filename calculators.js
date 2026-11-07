// ============================================================================
// calculators.js: the treasurer's toolbox.
// Pure maths first (loan schedules, income splitting, loan interest), then the
// Year-end page, then the Calculators page. Loaded BEFORE app.js, so this file
// only declares functions. They use app.js helpers ($, el, kes, state...) when
// they are called, by which time app.js has finished loading.
// ============================================================================

let calcCurrent = "loan";

// ---------- Pure maths ----------
const ymDiff = (a, b) => { const [ay, am] = a.split("-").map(Number), [by, bm] = b.split("-").map(Number); return (by - ay) * 12 + (bm - am); };
const round0 = (n) => Math.round(n).toLocaleString("en-KE");

// A full repayment schedule. flat: interest on the whole amount every month. reducing: interest on what is still owed.
function loanSchedule({ principal, rate, months, type, start }) {
  const r = rate / 100;
  const pay = type === "flat" ? (principal * (1 + r * months)) / months : r ? (principal * r) / (1 - Math.pow(1 + r, -months)) : principal / months;
  const rows = [];
  let bal = principal, totalInterest = 0;
  for (let i = 1; i <= months; i++) {
    const interest = type === "flat" ? principal * r : bal * r;
    const part = type === "flat" ? principal / months : pay - interest;
    bal = Math.max(0, bal - part);
    totalInterest += interest;
    rows.push({ n: i, month: start ? addMonths(start, i) : "", payment: pay, interest, principal: part, balance: bal });
  }
  return { rows, payment: pay, totalInterest, totalPaid: pay * months };
}

// Splits `income` between members and returns whole shillings that add up exactly to the income.
function splitIncome(weights, income) {
  const total = weights.reduce((a, b) => a + b, 0), n = weights.length;
  income = Math.round(income);
  if (!n || !total || income <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (income * w) / total), out = raw.map(Math.floor);
  let left = income - out.reduce((a, b) => a + b, 0);
  raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { out[i]++; left--; } });
  return out;
}
const weightsFor = (method, savings, timeWeights) => (method === "equal" ? savings.map(() => 1) : method === "time" ? timeWeights : savings);

// Interest a loan has earned the group up to a month. Repayments are treated as paying interest first.
function loanInterest(l, toYm) {
  const r = l.rate / 100, first = l.issued.slice(0, 7), reps = (l.repayments || []).filter((x) => x.date.slice(0, 7) <= toYm);
  let due = 0, left = l.principal, accrued = 0, received = 0, elapsed = 0;
  for (let ym = first; ym <= toYm; ym = addMonths(ym, 1)) {
    if (ym > first) {
      elapsed++;
      const i = l.type === "flat" ? (elapsed <= l.months ? l.principal * r : 0) : (left + due) * r;
      due += i; accrued += i;
    }
    reps.filter((x) => x.date.slice(0, 7) === ym).forEach((x) => {
      const toInterest = Math.min(x.amount, due);
      due -= toInterest; received += toInterest; left = Math.max(0, left - (x.amount - toInterest));
    });
  }
  return { accrued, received };
}

// ---------- Year-end share-out (uses your chama's real records) ----------
function computeYearEnd(o) {
  const span = ymDiff(o.from, o.to) + 1;
  const rows = state.members.map((m) => {
    let savings = m.opening || 0, tw = (m.opening || 0) * span;
    state.payments.filter((p) => p.memberId === m.id && kindOf(p) === "contribution" && p.month >= o.from && p.month <= o.to)
      .forEach((p) => { savings += p.amount; tw += p.amount * (ymDiff(p.month, o.to) + 1); });
    return { id: m.id, name: m.name, savings, tw, loanBal: state.loans.filter((l) => l.memberId === m.id).reduce((s, l) => s + loanStats(l).balance, 0), owed: finesOwed(m.id) + welfareOwed(m.id) };
  });
  let interest = 0;
  if (o.useInterest) state.loans.forEach((l) => { if (l.issued.slice(0, 7) <= o.to) { const li = loanInterest(l, o.to); interest += o.interestMode === "accrued" ? li.accrued : li.received; } });
  const fines = o.useFines ? state.payments.filter((p) => kindOf(p) === "fine" && p.month >= o.from && p.month <= o.to).reduce((s, p) => s + p.amount, 0) : 0;
  const income = Math.round(interest + fines + o.other - o.expenses);
  const w = weightsFor(o.method, rows.map((r) => r.savings), rows.map((r) => r.tw)), wTotal = w.reduce((a, b) => a + b, 0);
  const shares = splitIncome(w, income);
  rows.forEach((r, i) => {
    r.pct = wTotal ? w[i] / wTotal : 0;
    r.share = shares[i];
    r.deduction = o.deduct ? r.loanBal + r.owed : 0;
    r.net = (o.returnSavings ? r.savings : 0) + r.share - r.deduction;
  });
  const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
  return { rows, interest: Math.round(interest), fines, income, totals: { savings: sum("savings"), share: sum("share"), deduction: sum("deduction"), net: sum("net") } };
}

function yearEndOptions() {
  const n = (id) => Number($(id).value) || 0;
  return { from: $("yeFrom").value, to: $("yeTo").value, method: $("yeMethod").value, useInterest: $("yeInterest").checked, interestMode: $("yeIntMode").value, useFines: $("yeFines").checked, other: n("yeOther"), expenses: n("yeExpenses"), returnSavings: $("yeReturn").checked, deduct: $("yeDeduct").checked };
}

function yearEndSummary(r, o) {
  const head = `${state.settings.name || "Chama"} year-end share-out, ${o.from} to ${o.to}`;
  const lines = r.rows.map((x) => `${x.name}: ${kes(x.net)}${x.net < 0 ? " (owes the group)" : ""}`);
  return [head, `Income shared: ${kes(r.income)}`, ...lines].join("\n");
}

function renderYearEnd() {
  if (!$("yeFrom").value) $("yeFrom").value = state.settings.start && state.settings.start > addMonths(thisMonth(), -11) ? state.settings.start : addMonths(thisMonth(), -11);
  if (!$("yeTo").value) $("yeTo").value = thisMonth();
  const o = yearEndOptions();
  $("yeIntMode").disabled = !o.useInterest;
  if (!o.from || !o.to || o.from > o.to) { $("yeRows").replaceChildren(emptyRow(7, "Choose a start month that is not after the end month.")); $("yeFoot").replaceChildren(); $("yeStats").replaceChildren(); return; }
  const r = computeYearEnd(o), t = r.totals;
  $("yeStats").replaceChildren(...[[kes(r.interest), "Loan interest counted"], [kes(r.fines), "Fines counted"], [kes(r.income), "Income to share"], [kes(t.savings), "Total savings in the period"], [kes(t.net), "Total paid out"]].map(([big, small]) => {
    const d = el("div", undefined, "stat"); d.append(el("b", big), el("span", small)); return d;
  }));
  $("yeRows").replaceChildren(...(r.rows.length ? r.rows.map((x) => {
    const tr = el("tr");
    tr.append(cell(x.name), cell(kes(x.savings)), cell(Math.round(x.pct * 1000) / 10 + "%"), cell(kes(x.share)), cell(x.deduction ? "- " + kes(x.deduction) : "-"), cell(el("strong", kes(x.net), x.net < 0 ? "unpaid" : "")), cell(o.returnSavings ? "Savings + share" : "Share only"));
    return tr;
  }) : [emptyRow(7, "Add members and payments to see a share-out.")]));
  const foot = el("tr");
  foot.append(cell(el("strong", "Total")), cell(kes(t.savings)), cell(""), cell(kes(t.share)), cell(t.deduction ? "- " + kes(t.deduction) : "-"), cell(el("strong", kes(t.net))), cell(""));
  $("yeFoot").replaceChildren(foot);
  $("yeNote").textContent = o.income < 0 ? "" : `Loan interest assumes repayments pay interest first. Deductions use loan, fine and welfare balances as of today (for flat loans, the balance includes interest not yet earned). ${o.returnSavings ? "Each member's savings are returned along with their share." : "Only the share of income is paid out; savings stay in the group."}`;
}

function initYearEnd() {
  ["yeFrom", "yeTo", "yeMethod", "yeInterest", "yeIntMode", "yeFines", "yeOther", "yeExpenses", "yeReturn", "yeDeduct"].forEach((id) => { $(id).oninput = $(id).onchange = renderYearEnd; });
  $("yePrint").onclick = () => window.print();
  $("yeCopy").onclick = () => copyText(yearEndSummary(computeYearEnd(yearEndOptions()), yearEndOptions()), $("yeCopy"));
  $("yeCsv").onclick = () => {
    const o = yearEndOptions(), r = computeYearEnd(o);
    const lines = ["Member,Savings,SharePercent,ShareOfIncome,Deductions,NetPayout", ...r.rows.map((x) => [`"${x.name}"`, x.savings, Math.round(x.pct * 1000) / 10, x.share, x.deduction, x.net].join(","))];
    const a = el("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    a.download = `year-end-${o.to}.csv`;
    a.click();
  };
}

function copyText(text, btn) {
  const done = () => { const old = btn.textContent; btn.textContent = "Copied"; setTimeout(() => (btn.textContent = old), 1500); };
  if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => prompt("Copy this text", text));
  else prompt("Copy this text", text);
}

// ---------- Calculators page ----------
// Each calculator is a small description: its fields, and a run() that turns the values into results.
// To add another calculator, add one more object to this list.
function calcDefs() {
  const members = state.members;
  const parseAmounts = (text) => text.split(/\n/).map((l) => l.trim()).filter(Boolean).map((l, i) => {
    const m = l.match(/^(?:(.*?)[:,\s]+)?([\d,]+(?:\.\d+)?)$/);
    return m ? { name: (m[1] || "").trim() || `Member ${i + 1}`, amt: Number(m[2].replace(/,/g, "")) } : null;
  }).filter(Boolean);

  return [
    {
      id: "loan", title: "Loan",
      intro: "Work out the instalment, the total interest and the full repayment schedule before a loan is approved.",
      fields: [
        { id: "principal", label: "Loan amount (KES)", type: "number", value: 20000, min: 0 },
        { id: "rate", label: "Interest per month (%)", type: "number", value: 2, min: 0, step: "0.1" },
        { id: "months", label: "Months to repay", type: "number", value: 6, min: 1 },
        { id: "type", label: "Interest type", type: "select", value: "flat", options: [["flat", "Flat (on the full amount)"], ["reducing", "Reducing balance"]] },
        { id: "start", label: "Loan given in", type: "month", value: thisMonth() },
      ],
      run(v) {
        if (v.principal <= 0 || v.months < 1) return { note: "Enter the loan amount and the number of months." };
        const s = loanSchedule({ principal: v.principal, rate: v.rate, months: Math.round(v.months), type: v.type, start: v.start });
        return {
          lines: [["Monthly instalment", kes(Math.round(s.payment))], ["Total interest", kes(Math.round(s.totalInterest))], ["Total to repay", kes(Math.round(s.totalPaid))]],
          table: { head: ["#", "Month", "Instalment", "Interest", "Principal", "Balance"], rows: s.rows.map((x) => [x.n, x.month, round0(x.payment), round0(x.interest), round0(x.principal), round0(x.balance)]) },
          note: v.type === "flat" ? "Flat interest charges the same interest every month on the original amount." : "Reducing balance charges interest only on what is still owed, so the interest part falls each month.",
        };
      },
    },
    {
      id: "fine", title: "Late fine",
      intro: "Check what a member owes for a late contribution, using your chama's own fine rule.",
      fields: [
        { id: "pledge", label: "Monthly contribution (KES)", type: "number", value: 2000, min: 0 },
        { id: "due", label: "Due date", type: "date", value: dueDate(thisMonth()) },
        { id: "paid", label: "Date paid (leave empty if not paid yet)", type: "date", value: "" },
        { id: "grace", label: "Grace days", type: "number", value: 0, min: 0 },
        { id: "type", label: "Fine rule", type: "select", value: "daily", options: [["flat", "Flat amount per late payment"], ["daily", "Amount per day late"], ["percent", "Percent of the contribution"]] },
        { id: "value", label: "Fine amount (KES or %)", type: "number", value: 50, min: 0, step: "0.1" },
      ],
      prefill: () => ({ pledge: state.settings.amount || 2000, grace: state.settings.graceDays || 0, type: ["flat", "daily", "percent"].includes(state.settings.fineType) ? state.settings.fineType : "daily", value: state.settings.fineValue || 50, due: dueDate(thisMonth()) }),
      prefillLabel: "Use my group's rules",
      run(v) {
        if (!v.due || v.pledge <= 0) return { note: "Enter the contribution and the due date." };
        const late = dayDiff(addDays(v.due, v.grace), v.paid || today());
        const fine = late > 0 ? (v.type === "flat" ? v.value : v.type === "daily" ? v.value * late : (v.pledge * v.value) / 100) : 0;
        return { lines: [["Days late", Math.max(0, late)], ["Fine", kes(Math.round(fine))], ["Contribution plus fine", kes(Math.round(v.pledge + fine))]], note: v.paid ? "" : "No payment date entered, so today's date is used." };
      },
    },
    {
      id: "round", title: "Merry-go-round",
      intro: "Plan a rotation: who receives the pot each month and how much it is. Works for equal or different amounts.",
      fields: [
        { id: "amounts", label: "Each member's monthly amount, one per line (a name is optional, like Wanjiku: 2000)", type: "textarea", value: "2000\n2000\n2000\n2000\n2000\n2000" },
        { id: "start", label: "First round in", type: "month", value: thisMonth() },
        { id: "deduct", label: "Taken from each pot, such as welfare or fees (KES)", type: "number", value: 0, min: 0 },
      ],
      prefill: () => ({ amounts: members.map((m) => `${m.name}: ${pledgeOf(m.id)}`).join("\n") || "2000", start: state.settings.start || thisMonth() }),
      prefillLabel: "Use my members",
      run(v) {
        const items = parseAmounts(v.amounts);
        if (!items.length || items.some((x) => !x.amt)) return { note: "Enter one amount per line." };
        const pot = items.reduce((s, x) => s + x.amt, 0), net = pot - v.deduct, n = items.length;
        const equal = items.every((x) => x.amt === items[0].amt);
        const lines = [["Members", n], ["Pot each month", kes(pot)], ["Handed to the recipient", kes(net)], ["A full cycle ends in", addMonths(v.start || thisMonth(), n - 1)]];
        if (equal) lines.push(["Each member pays over a cycle", kes(items[0].amt * n)]);
        return { lines, table: { head: ["Round", "Month", "Recipient", "Pot", "Handed over"], rows: items.map((x, i) => [i + 1, addMonths(v.start || thisMonth(), i), x.name, round0(pot), round0(net)]) }, note: "This assumes every member pays in every round, including the member who is receiving." };
      },
    },
    {
      id: "year", title: "Year-end (quick)",
      intro: "Share out savings and income for any group. Type or paste: name, savings, and optionally the months saved. For your own chama's records, use the Year-end page.",
      fields: [
        { id: "rows", label: "One member per line: name, savings, months saved (optional)", type: "textarea", value: "Wanjiku, 24000, 12\nOtieno, 36000, 12\nAchieng, 18000, 9" },
        { id: "interest", label: "Loan interest earned (KES)", type: "number", value: 5000, min: 0 },
        { id: "fines", label: "Fines collected (KES)", type: "number", value: 1000, min: 0 },
        { id: "other", label: "Other income (KES)", type: "number", value: 0, min: 0 },
        { id: "expenses", label: "Expenses to take off (KES)", type: "number", value: 0, min: 0 },
        { id: "method", label: "Share income by", type: "select", value: "savings", options: [["savings", "Savings"], ["time", "Savings and time"], ["equal", "Equal shares"]] },
        { id: "ret", label: "Return savings too?", type: "select", value: "yes", options: [["yes", "Yes, savings plus share"], ["no", "No, share of income only"]] },
      ],
      prefill: () => ({ rows: members.map((m) => `${m.name}, ${paidBy(m.id)}, ${Math.max(1, monthsDue())}`).join("\n") || "Name, 10000, 12" }),
      prefillLabel: "Use my members' savings",
      run(v) {
        const items = v.rows.split(/\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
          const m = l.match(/^(.*?)[,\t:]\s*([\d,]+(?:\.\d+)?)(?:[,\t:]\s*(\d+))?$/);
          return m ? { name: m[1].trim(), sav: Number(m[2].replace(/,/g, "")), months: Number(m[3]) || 12 } : null;
        }).filter(Boolean);
        if (!items.length) return { note: "Add one member per line, like: Wanjiku, 24000, 12" };
        const income = Math.round(v.interest + v.fines + v.other - v.expenses);
        const w = weightsFor(v.method, items.map((x) => x.sav), items.map((x) => x.sav * x.months)), shares = splitIncome(w, income);
        const pay = items.map((x, i) => (v.ret === "yes" ? x.sav : 0) + shares[i]);
        return {
          lines: [["Income to share", kes(income)], ["Total savings", kes(items.reduce((s, x) => s + x.sav, 0))], ["Total paid out", kes(pay.reduce((s, x) => s + x, 0))]],
          table: { head: ["Member", "Savings", "Share of income", "Payout"], rows: items.map((x, i) => [x.name, round0(x.sav), round0(shares[i]), round0(pay[i])]) },
          note: income < 0 ? "Expenses are higher than income, so there is nothing to share." : "Shares are rounded to whole shillings and add up exactly to the income.",
        };
      },
    },
    {
      id: "goal", title: "Savings goal",
      intro: "How much must be saved each month to reach a target, or how long it will take.",
      fields: [
        { id: "target", label: "Target (KES)", type: "number", value: 100000, min: 0 },
        { id: "months", label: "Months to get there", type: "number", value: 12, min: 1 },
        { id: "have", label: "Already saved (KES)", type: "number", value: 0, min: 0 },
        { id: "rate", label: "Growth per month (%), if any", type: "number", value: 0, min: 0, step: "0.1" },
        { id: "pmt", label: "Or: if you save this much a month (KES)", type: "number", value: 0, min: 0 },
      ],
      run(v) {
        const i = v.rate / 100, n = Math.max(1, Math.round(v.months)), g = Math.pow(1 + i, n);
        if (v.target <= 0) return { note: "Enter a target." };
        const need = i ? ((v.target - v.have * g) * i) / (g - 1) : (v.target - v.have) / n;
        const lines = [["Save each month", kes(Math.max(0, Math.ceil(need)))], ["Total paid in", kes(Math.max(0, Math.ceil(need)) * n)]];
        if (v.pmt > 0) {
          let bal = v.have, m = 0;
          while (bal < v.target && m < 600) { bal = bal * (1 + i) + v.pmt; m++; }
          lines.push(["Months at that rate", m >= 600 ? "More than 50 years" : m]);
        }
        return { lines, note: need <= 0 ? "What is already saved reaches the target." : "" };
      },
    },
    {
      id: "limit", title: "Loan limit",
      intro: "Most chamas lend a multiple of a member's savings. Check how much a member can borrow.",
      fields: [
        { id: "member", label: "Member", type: "select", value: "", options: [["", "Type the numbers myself"], ...members.map((m) => [m.id, m.name])] },
        { id: "savings", label: "Savings (KES)", type: "number", value: 30000, min: 0 },
        { id: "mult", label: "Loan limit, times savings", type: "number", value: 3, min: 0, step: "0.5" },
        { id: "existing", label: "Loans still owed (KES)", type: "number", value: 0, min: 0 },
        { id: "want", label: "Loan wanted (KES, optional)", type: "number", value: 0, min: 0 },
      ],
      run(v) {
        let sav = v.savings, owed = v.existing;
        if (v.member) { sav = paidBy(v.member); owed = state.loans.filter((l) => l.memberId === v.member).reduce((s, l) => s + loanStats(l).balance, 0); }
        const max = sav * v.mult, free = Math.max(0, max - owed);
        const lines = [["Savings used", kes(sav)], ["Maximum loan", kes(max)], ["Loans still owed", kes(owed)], ["Available to borrow now", kes(free)]];
        if (v.want > 0) lines.push([v.want <= free ? "Loan wanted is within the limit" : "Savings needed for that loan", v.want <= free ? "Yes" : kes(Math.ceil(v.want / v.mult + owed / v.mult))]);
        return { lines };
      },
    },
  ];
}

function drawResult(out, r) {
  out.replaceChildren();
  if (r.lines) {
    const grid = el("div", undefined, "stats");
    r.lines.forEach(([k, val]) => { const d = el("div", undefined, "stat"); d.append(el("b", String(val)), el("span", k)); grid.append(d); });
    out.append(grid);
  }
  if (r.table) {
    const wrap = el("div", undefined, "scroll"), table = el("table"), thead = el("thead"), hr = el("tr"), tb = el("tbody");
    r.table.head.forEach((h) => hr.append(el("th", h)));
    thead.append(hr);
    r.table.rows.forEach((row) => { const tr = el("tr"); row.forEach((c) => tr.append(cell(String(c)))); tb.append(tr); });
    table.append(thead, tb); wrap.append(table); out.append(wrap);
  }
  if (r.note) out.append(el("p", r.note, "hint"));
}

function calcSummary(def, r) {
  if (!r) return "";
  const lines = [`${def.title} calculation`, ...(r.lines || []).map(([k, v]) => `${k}: ${v}`)];
  if (r.table) lines.push("", ...r.table.rows.slice(0, 24).map((row) => row.join(" | ")));
  return lines.join("\n");
}

function renderCalc(id) {
  if (id) calcCurrent = id;
  const defs = calcDefs(), def = defs.find((d) => d.id === calcCurrent) || defs[0];
  $("calcTabs").replaceChildren(...defs.map((d) => { const b = el("button", d.title); if (d.id === def.id) b.className = "on"; b.onclick = () => renderCalc(d.id); return b; }));
  const box = $("calcBox"), form = el("div", undefined, "row"), out = el("div"), inputs = {};
  def.fields.forEach((f) => {
    const lab = el("label", f.label);
    let inp;
    if (f.type === "select") { inp = el("select"); f.options.forEach(([val, text]) => inp.append(new Option(text, val))); }
    else if (f.type === "textarea") { inp = el("textarea"); inp.rows = 6; lab.style.flex = "1 1 100%"; }
    else { inp = el("input"); inp.type = f.type; if (f.min !== undefined) inp.min = f.min; if (f.step) inp.step = f.step; }
    inp.value = f.value;
    inp.oninput = inp.onchange = () => update();
    inputs[f.id] = inp; lab.append(inp); form.append(lab);
  });
  const values = () => { const v = {}; def.fields.forEach((f) => { const x = inputs[f.id].value; v[f.id] = f.type === "number" ? Number(x) || 0 : x; }); return v; };
  let last = null;
  const update = () => { last = def.run(values()); drawResult(out, last); };
  const bar = el("div", undefined, "row");
  bar.style.margin = ".8rem 0";
  if (def.prefill) {
    const b = el("button", def.prefillLabel || "Use my chama's data", "ghost");
    b.onclick = () => { const p = def.prefill(); Object.keys(p).forEach((k) => (inputs[k].value = p[k])); update(); };
    bar.append(b);
  }
  const copy = el("button", "Copy summary", "ghost");
  copy.onclick = () => copyText(calcSummary(def, last), copy);
  bar.append(copy);
  box.replaceChildren(el("h2", def.title), el("p", def.intro, "hint"), form, bar, out);
  update();
}

function initCalc() { renderCalc(); }
