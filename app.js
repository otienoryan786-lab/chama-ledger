// ---------- State: one object, saved in the browser's localStorage ----------
const KEY = "chamaLedger.v1";
const blank = () => ({
  settings: { name: "", amount: 0, start: "", dueDay: 5, graceDays: 0, fineType: "none", fineValue: 0, welfareAmount: 0 },
  members: [], payments: [], loans: [], payouts: [], rotation: [],
});
let state = JSON.parse(localStorage.getItem(KEY) || "null") || blank();
// Older saved data may lack the newer fields, so fill in the gaps
state.settings = { ...blank().settings, ...state.settings };
state.loans = state.loans || []; state.payouts = state.payouts || []; state.rotation = state.rotation || [];
const save = () => localStorage.setItem(KEY, JSON.stringify(state));
const today = () => new Date().toISOString().slice(0, 10);

// ---------- Helpers ----------
const $ = (id) => document.getElementById(id);
const kes = (n) => "KES " + Number(n).toLocaleString("en-KE");
const thisMonth = () => new Date().toISOString().slice(0, 7);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const memberName = (id) => (state.members.find((m) => m.id === id) || { name: "(removed)" }).name;
const addMonths = (ym, n) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
};
const monthLabel = (ym) => new Date(ym + "-01T00:00:00Z").toLocaleString("en-KE", { month: "short", timeZone: "UTC" });

// Months owed from the start month to now, inclusive
function monthsDue() {
  if (!state.settings.start) return 0;
  const [sy, sm] = state.settings.start.split("-").map(Number);
  const [cy, cm] = thisMonth().split("-").map(Number);
  return Math.max(0, (cy - sy) * 12 + (cm - sm) + 1);
}
// ---------- Money rules ----------
const kindOf = (p) => p.kind || "contribution"; // contribution | fine | welfare
// Each member can have their own monthly amount ("pledge"); otherwise the group amount applies
const pledgeOf = (id) => { const m = state.members.find((x) => x.id === id); return (m && m.pledge) || state.settings.amount || 0; };
const sumKind = (id, kind, month) =>
  state.payments.filter((p) => p.memberId === id && kindOf(p) === kind && (!month || p.month === month)).reduce((s, p) => s + p.amount, 0);
// "opening" is money paid before the group started using the app (from the old book or Word file)
const paidBy = (id, month) => {
  const m = state.members.find((x) => x.id === id);
  const base = sumKind(id, "contribution", month);
  return month ? base : base + ((m && m.opening) || 0);
};
const arrears = (id) => Math.max(0, monthsDue() * pledgeOf(id) - paidBy(id));
const hasPaid = (id, month) => pledgeOf(id) > 0 && paidBy(id, month) >= pledgeOf(id);
const collected = (month) => state.payments.filter((p) => kindOf(p) === "contribution" && p.month === month).reduce((s, p) => s + p.amount, 0);

const addDays = (d, n) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);
const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const dueDate = (ym) => `${ym}-${String(Math.min(28, state.settings.dueDay || 5)).padStart(2, "0")}`;

// Late fines, worked out month by month from the date each contribution was completed.
function fineFor(id) {
  const s = state.settings, pledge = pledgeOf(id);
  if (!s.start || !pledge || s.fineType === "none" || !s.fineValue) return 0;
  let total = 0;
  for (let ym = s.start; ym <= thisMonth(); ym = addMonths(ym, 1)) {
    const limit = addDays(dueDate(ym), s.graceDays || 0);
    const pays = state.payments.filter((p) => p.memberId === id && kindOf(p) === "contribution" && p.month === ym)
      .sort((x, y) => (x.paidOn || x.date).localeCompare(y.paidOn || y.date));
    let sum = 0, doneOn = null;
    for (const p of pays) { sum += p.amount; if (sum >= pledge) { doneOn = p.paidOn || p.date; break; } }
    const late = dayDiff(limit, doneOn || today()); // not fully paid yet: the fine keeps growing until it is
    if (late > 0) total += s.fineType === "flat" ? s.fineValue : s.fineType === "daily" ? s.fineValue * late : (pledge * s.fineValue) / 100;
  }
  return Math.round(total);
}
const finesOwed = (id) => Math.max(0, fineFor(id) - sumKind(id, "fine"));
const welfareOwed = (id) => Math.max(0, monthsDue() * (state.settings.welfareAmount || 0) - sumKind(id, "welfare"));
const totalDue = (id) => arrears(id) + finesOwed(id) + welfareOwed(id);

// Safe element builders (textContent never runs user input as HTML)
function el(tag, text, cls) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}
const svg = (tag, attrs = {}, text) => {
  const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text !== undefined) e.textContent = text;
  return e;
};
function cell(content) {
  const td = document.createElement("td");
  td.append(content instanceof Node ? content : document.createTextNode(content));
  return td;
}
function say(text, ok) {
  $("msg").textContent = text;
  $("msg").className = ok ? "good" : "err";
}
function remindLink(m, amount) {
  const text = `Hello ${m.name}, friendly reminder from ${state.settings.name || "our chama"}: your outstanding balance is ${kes(amount)}. Please pay and send the M-Pesa code. Thank you!`;
  const a = el("a", "Remind on WhatsApp", "btnlink");
  a.href = `https://wa.me/${m.phone}?text=${encodeURIComponent(text)}`;
  a.target = "_blank";
  a.rel = "noopener";
  return a;
}
const emptyRow = (cols, text) => {
  const tr = el("tr"), td = el("td", text, "empty");
  td.colSpan = cols;
  tr.append(td);
  return tr;
};

// ---------- Navigation ----------
const titles = { overview: "Overview", members: "Members", payments: "Payments", settings: "Settings", import: "Import records", loans: "Loans", funds: "Funds" };
function showView() {
  const v = titles[location.hash.slice(1)] ? location.hash.slice(1) : "overview";
  document.querySelectorAll(".view").forEach((s) => (s.hidden = s.id !== "view-" + v));
  document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("on", b.dataset.view === v));
  $("pageTitle").textContent = titles[v];
}
$("nav").onclick = (e) => { if (e.target.dataset.view) location.hash = e.target.dataset.view; };
window.onhashchange = showView;

// ---------- Render: Overview ----------
function renderOverview(month) {
  const n = state.members.length;
  const paidCount = state.members.filter((m) => hasPaid(m.id, month)).length;
  const pot = state.payments.filter((p) => kindOf(p) === "contribution").reduce((s, p) => s + p.amount, 0) + state.members.reduce((s, m) => s + (m.opening || 0), 0);
  const totalArrears = state.members.reduce((s, m) => s + arrears(m.id), 0);
  const target = state.members.reduce((s, m) => s + pledgeOf(m.id), 0);

  $("stats").replaceChildren(
    ...statCards(month, n, paidCount, pot, totalArrears).map(([big, small]) => {
      const d = el("div", undefined, "stat");
      d.append(el("b", big), el("span", small));
      return d;
    })
  );

  // Bar chart: six months ending at the selected month, with a dashed target line
  const months = [-5, -4, -3, -2, -1, 0].map((k) => addMonths(month, k));
  const values = months.map(collected);
  const max = Math.max(target, ...values, 1);
  const W = 520, H = 230, base = 190, top = 20, bw = 50, gap = (W - 6 * bw) / 7;
  const chart = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Collections per month" });
  months.forEach((m, i) => {
    const h = (values[i] / max) * (base - top), x = gap + i * (bw + gap);
    chart.append(
      svg("rect", { x, y: base - h, width: bw, height: h, rx: 3, fill: m === month ? "#f2a900" : "#12263a" }),
      svg("text", { x: x + bw / 2, y: base + 20, "text-anchor": "middle", "font-size": 13, fill: "#5d6f7e" }, monthLabel(m)),
      svg("text", { x: x + bw / 2, y: base - h - 6, "text-anchor": "middle", "font-size": 12, fill: "#12263a" }, values[i] ? Math.round(values[i] / 1000 * 10) / 10 + "k" : "")
    );
  });
  if (target) {
    const y = base - (target / max) * (base - top);
    chart.append(svg("line", { x1: 0, x2: W, y1: y, y2: y, stroke: "#b3341f", "stroke-dasharray": "5 5" }), svg("text", { x: W - 2, y: y - 5, "text-anchor": "end", "font-size": 12, fill: "#b3341f" }, "Target"));
  }
  $("chart").replaceChildren(chart);

  // Progress ring: share of members who have paid
  const pct = n ? Math.round((paidCount / n) * 100) : 0, C = 2 * Math.PI * 52;
  const ring = svg("svg", { viewBox: "0 0 140 140", role: "img", "aria-label": pct + " percent paid" });
  ring.append(
    svg("circle", { cx: 70, cy: 70, r: 52, fill: "none", stroke: "#cfd9e0", "stroke-width": 14 }),
    svg("circle", { cx: 70, cy: 70, r: 52, fill: "none", stroke: "#1f7a4d", "stroke-width": 14, "stroke-linecap": "round", "stroke-dasharray": `${(pct / 100) * C} ${C}`, transform: "rotate(-90 70 70)" }),
    svg("text", { x: 70, y: 78, "text-anchor": "middle", "font-size": 26, "font-weight": 800, fill: "#12263a" }, pct + "%")
  );
  $("ring").replaceChildren(ring);

  // Lists
  const top5 = state.members.map((m) => ({ m, a: totalDue(m.id) })).filter((x) => x.a > 0).sort((a, b) => b.a - a.a).slice(0, 5);
  $("topArrears").replaceChildren(...(top5.length ? top5.map(({ m, a }) => {
    const li = el("li");
    const open = el("button", m.name, "del");
    open.style.color = "#12263a";
    open.onclick = () => openMember(m.id);
    li.append(open, el("strong", kes(a)));
    return li;
  }) : [el("li", n ? "Nobody is in arrears. Well done." : "Add members to start tracking.", "empty")]));

  const last = [...state.payments].slice(-5).reverse();
  $("recent").replaceChildren(...(last.length ? last.map((p) => {
    const li = el("li"), left = el("span", memberName(p.memberId));
    left.append(el("br"), el("small", `${p.ref} · for ${p.month}`));
    li.append(left, el("strong", kes(p.amount)));
    return li;
  }) : [el("li", "No payments recorded yet.", "empty")]));
}

// ---------- Render: Members ----------
function renderMembers(month) {
  const q = $("search").value.trim().toLowerCase(), f = $("statusFilter").value;
  const list = state.members.filter((m) => {
    if (q && !m.name.toLowerCase().includes(q)) return false;
    if (f === "paid") return hasPaid(m.id, month);
    if (f === "unpaid") return !hasPaid(m.id, month);
    if (f === "arrears") return totalDue(m.id) > 0;
    return true;
  });
  $("rows").replaceChildren(...(list.length ? list.map((m) => {
    const tr = el("tr", undefined, "click"), ok = hasPaid(m.id, month);
    tr.tabIndex = 0;
    tr.onclick = () => openMember(m.id);
    tr.onkeydown = (e) => { if (e.key === "Enter") openMember(m.id); };
    tr.append(cell(m.name), cell(el("span", ok ? "Paid " + kes(paidBy(m.id, month)) : "Not paid", ok ? "paid" : "unpaid")), cell(kes(paidBy(m.id))), cell(kes(arrears(m.id))), cell(kes(finesOwed(m.id) + welfareOwed(m.id))));
    return tr;
  }) : [emptyRow(5, state.members.length ? "No member matches that filter." : "No members yet. Add your first member above.")]));
}

function openMember(id) {
  const m = state.members.find((x) => x.id === id);
  if (!m) return;
  const d = $("memberDialog"), arr = totalDue(id);
  const hist = el("ul", undefined, "list");
  const mine = state.payments.filter((p) => p.memberId === id).reverse();
  hist.replaceChildren(...(mine.length ? mine.map((p) => {
    const li = el("li");
    li.append(el("span", `${p.month} · ${kindOf(p)} · ${p.ref}`), el("strong", kes(p.amount)));
    return li;
  }) : [el("li", "No payments yet.", "empty")]));
  const actions = el("div", undefined, "row");
  if (arr > 0 && m.phone) actions.append(remindLink(m, arr));
  const remove = el("button", "Remove member", "danger");
  remove.onclick = () => {
    if (confirm(`Remove ${m.name}? Their payments stay in the history.`)) { state.members = state.members.filter((x) => x.id !== id); save(); d.close(); render(); }
  };
  const close = el("button", "Close", "ghost");
  close.onclick = () => d.close();
  actions.append(remove, close);
  const pledge = el("input"); pledge.type = "number"; pledge.min = 0; pledge.value = m.pledge || ""; pledge.placeholder = String(state.settings.amount);
  const pl = el("label", "Own monthly amount (KES)"); pl.append(pledge);
  const savePledge = el("button", "Save amount", "ghost");
  savePledge.onclick = () => { m.pledge = Number(pledge.value) || 0; save(); render(); openMember(id); };
  const plRow = el("div", undefined, "row"); plRow.append(pl, savePledge);
  plRow.style.marginBottom = ".8rem";
  d.replaceChildren(el("h2", m.name),
    el("p", `${m.phone ? "+" + m.phone + " · " : "No phone yet · "}pays ${kes(pledgeOf(id))} a month · paid ${kes(paidBy(id))}${m.opening ? ` (includes ${kes(m.opening)} brought forward)` : ""}`, "hint"),
    el("p", `Owes: contributions ${kes(arrears(id))} · fines ${kes(finesOwed(id))} · welfare ${kes(welfareOwed(id))}`, "hint"),
    plRow, hist, actions);
  d.showModal();
}

// ---------- Render: Payments & settings ----------
function renderPayments() {
  const opts = () => state.members.map((m) => new Option(m.name, m.id));
  const keep = $("pMember").value, keepF = $("fMember").value;
  $("pMember").replaceChildren(...opts());
  if (keep) $("pMember").value = keep;
  $("fMember").replaceChildren(new Option("Everyone", "all"), ...opts());
  if (keepF) $("fMember").value = keepF;

  const f = $("fMember").value || "all";
  const rows = [...state.payments].reverse().filter((p) => f === "all" || p.memberId === f);
  $("history").replaceChildren(...(rows.length ? rows.map((p) => {
    const del = el("button", "Delete", "del");
    del.onclick = () => { if (confirm("Delete this payment record?")) { state.payments = state.payments.filter((x) => x.id !== p.id); save(); render(); } };
    const tr = el("tr");
    tr.append(cell(p.paidOn || p.date), cell(memberName(p.memberId)), cell(p.month), cell(kes(p.amount)), cell(p.ref), cell(kindOf(p) + " · " + (p.source || "mpesa")), cell(del));
    return tr;
  }) : [emptyRow(7, "No payments to show.")]));
}
function fillSettings() {
  $("setName").value = state.settings.name;
  $("setAmount").value = state.settings.amount || "";
  $("setStart").value = state.settings.start;
  $("setDue").value = state.settings.dueDay; $("setGrace").value = state.settings.graceDays;
  $("setFineType").value = state.settings.fineType; $("setFineValue").value = state.settings.fineValue || "";
  $("setWelfare").value = state.settings.welfareAmount || "";
}
function render() {
  const month = $("viewMonth").value || thisMonth();
  $("groupName").textContent = state.settings.name || "Set your group name in Settings";
  renderOverview(month);
  renderMembers(month);
  renderPayments();
  renderLoans();
  renderFunds(month);
}

// ---------- Events ----------
$("viewMonth").onchange = render;
$("search").oninput = render;
$("statusFilter").onchange = render;
$("fMember").onchange = renderPayments;

$("saveSettings").onclick = () => {
  state.settings = {
    name: $("setName").value.trim(), amount: Number($("setAmount").value) || 0, start: $("setStart").value,
    dueDay: Number($("setDue").value) || 5, graceDays: Number($("setGrace").value) || 0,
    fineType: $("setFineType").value, fineValue: Number($("setFineValue").value) || 0, welfareAmount: Number($("setWelfare").value) || 0,
  };
  save(); render();
};
$("memberForm").onsubmit = (e) => {
  e.preventDefault();
  state.members.push({ id: uid(), name: $("mName").value.trim(), phone: $("mPhone").value.trim(), opening: Number($("mOpening").value) || 0, pledge: Number($("mPledge").value) || 0 });
  e.target.reset(); save(); render();
};
$("payForm").onsubmit = (e) => {
  e.preventDefault();
  const cash = $("pMethod").value === "cash";
  const ref = cash ? "CASH-" + uid().slice(-5).toUpperCase() : $("pRef").value.trim().toUpperCase();
  // The rule that prevents most chama disputes: one M-Pesa code can only be used once.
  if (state.payments.some((p) => p.ref === ref)) return say("That M-Pesa code is already recorded.", false);
  if (!state.members.length) return say("Add a member first.", false);
  state.payments.push({ id: uid(), memberId: $("pMember").value, month: $("pMonth").value, amount: Number($("pAmount").value), ref, source: cash ? "cash" : "mpesa", kind: $("pKind").value, paidOn: $("pDate").value || today(), date: new Date().toISOString().slice(0, 10) });
  save(); render(); say("Payment saved.", true);
  $("pRef").value = "";
};
$("exportBtn").onclick = () => {
  const lines = ["DatePaid,Member,Month,Amount,Type,Code", ...state.payments.map((p) => [p.paidOn || p.date, `"${memberName(p.memberId)}"`, p.month, p.amount, kindOf(p), p.ref].join(","))];
  const a = el("a");
  a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  a.download = "chama-payments.csv";
  a.click();
};
$("resetBtn").onclick = () => {
  if (confirm("Erase all members and payments? This cannot be undone.")) { state = blank(); save(); fillSettings(); render(); }
};
// Demo data so you (and anyone viewing your portfolio) can see the dashboard working
$("demoBtn").onclick = () => {
  if (state.members.length && !confirm("This replaces your current data with demo data. Continue?")) return;
  const start = addMonths(thisMonth(), -5);
  const people = [["Wanjiku Kamau", "254712000001", 2000], ["Otieno Odhiambo", "254712000002", 3000], ["Achieng Atieno", "254712000003", 1500], ["Kiprono Koech", "254712000004", 2000], ["Mwende Mutua", "254712000005", 1000], ["Njeri Mwangi", "254712000006", 2500], ["Hassan Ali", "254712000007", 2000], ["Naliaka Wekesa", "254712000008", 1500]];
  state = blank();
  state.settings = { ...state.settings, name: "Donholm Vijana Chama", amount: 2000, start, dueDay: 5, graceDays: 2, fineType: "daily", fineValue: 50, welfareAmount: 100 };
  let n = 1;
  const ref = () => "DEMO" + String(n++).padStart(4, "0");
  people.forEach(([name, phone, pledge], i) => {
    const id = uid();
    state.members.push({ id, name, phone, pledge: pledge === 2000 ? 0 : pledge });
    for (let k = 0; k < 6; k++) {
      if (((i * 3 + k) % 7 === 0 && k > 2) || (k === 5 && i % 3 === 2)) continue; // a few missed months
      const ym = addMonths(start, k), day = (i + k) % 4 === 0 ? "14" : "04"; // some pay late
      state.payments.push({ id: uid(), memberId: id, month: ym, amount: pledge, ref: ref(), source: "mpesa", kind: "contribution", paidOn: `${ym}-${day}`, date: `${ym}-${day}` });
    }
    if (i < 6) state.payments.push({ id: uid(), memberId: id, month: start, amount: 600, ref: ref(), source: "cash", kind: "welfare", paidOn: start + "-05", date: start + "-05" });
  });
  const M = state.members;
  state.loans = [
    { id: uid(), memberId: M[1].id, principal: 20000, rate: 2, months: 6, type: "flat", issued: addMonths(start, 1) + "-10", repayments: [{ id: uid(), amount: 3733, date: addMonths(start, 2) + "-10" }, { id: uid(), amount: 3733, date: addMonths(start, 3) + "-10" }] },
    { id: uid(), memberId: M[4].id, principal: 10000, rate: 1.5, months: 4, type: "reducing", issued: addMonths(start, 2) + "-03", repayments: [{ id: uid(), amount: 2600, date: addMonths(start, 3) + "-03" }] },
  ];
  state.rotation = M.map((m) => m.id);
  for (let k = 0; k < 4; k++) { const ym = addMonths(start, k); state.payouts.push({ id: uid(), kind: "round", month: ym, memberId: M[k].id, amount: collected(ym), date: ym + "-28" }); }
  state.payouts.push({ id: uid(), kind: "welfare", memberId: M[3].id, amount: 1500, reason: "Family support", date: addMonths(start, 3) + "-20" });
  save(); fillSettings(); render();
};

// ---------- Import: bring in records from WhatsApp, Word, Excel or a ledger book ----------
let pending = [];

// Find which member a line of text refers to: phone number first, then name words.
function findMember(text, phone) {
  if (phone) { const byPhone = state.members.find((m) => m.phone === phone); if (byPhone) return byPhone; }
  const t = text.toLowerCase();
  let best = null, bestScore = 0, tie = false;
  state.members.forEach((m) => {
    const score = m.name.toLowerCase().split(/\s+/).filter((w) => w.length >= 3 && t.includes(w)).length;
    if (score > bestScore) { best = m; bestScore = score; tie = false; } else if (score === bestScore && score > 0) tie = true;
  });
  return tie ? null : best;
}

// Chat lines. M-Pesa codes are 10 characters mixing letters and digits, e.g. SJK4X9ABCD.
function parseChat(text) {
  const codeRe = /\b(?=[A-Z0-9]*[A-Z])(?=[A-Z0-9]*\d)[A-Z0-9]{10}\b/i;
  return text.split(/\n/).map((l) => l.trim()).filter(Boolean).map((line) => {
    const code = (line.match(codeRe) || [])[0];
    if (!code) return null;
    const phoneM = line.match(/\b(?:254|0)([71]\d{8})\b/);
    const phone = phoneM ? "254" + phoneM[1] : "";
    let amount = 0;
    const ksh = line.match(/(?:ksh|kes)\.?\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (ksh) amount = parseFloat(ksh[1].replace(/,/g, ""));
    else {
      const rest = line.replace(codeRe, "").replace(/\b(?:254|0)[71]\d{8}\b/g, "").replace(/\d{1,2}\/\d{1,2}\/\d{2,4}/g, "");
      const n = rest.match(/\b\d{3,6}\b/);
      if (n) amount = Number(n[0]);
    }
    let month = $("viewMonth").value || thisMonth();
    let paidOn = today();
    const d = line.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (d && +d[2] >= 1 && +d[2] <= 12) {
      const yr = +d[3] < 100 ? 2000 + +d[3] : d[3];
      month = `${yr}-${String(d[2]).padStart(2, "0")}`;
      paidOn = `${month}-${String(d[1]).padStart(2, "0")}`;
    }
    const m = findMember(line, phone);
    return { use: true, memberId: m ? m.id : "", newName: "", month, amount, ref: code.toUpperCase(), source: "chat", paidOn };
  }).filter(Boolean);
}

// Tables copied from Word or Excel arrive tab-separated. Months across the top, names down the side.
const MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
function monthFromHeading(h, year) {
  h = h.trim().toLowerCase();
  if (/^\d{4}-\d{2}$/.test(h)) return h;
  const i = MON.findIndex((x) => h.startsWith(x));
  return i >= 0 ? `${year}-${String(i + 1).padStart(2, "0")}` : null;
}
function parseGrid(text, year) {
  const rows = text.split(/\n/).map((r) => r.replace(/\s+$/, "")).filter((r) => r.trim()).map((r) => r.split(r.includes("\t") ? "\t" : ","));
  if (rows.length < 2) return [];
  const months = rows[0].map((h) => monthFromHeading(h, year));
  const out = [];
  rows.slice(1).forEach((r) => {
    const name = (r[0] || "").trim();
    if (!name) return;
    const m = findMember(name, "");
    months.forEach((mo, i) => {
      if (!mo || i === 0) return;
      const amount = Number(String(r[i] || "").replace(/[^\d.]/g, ""));
      if (amount > 0) out.push({ use: true, memberId: m ? m.id : "", newName: m ? "" : name, month: mo, amount, ref: "", source: "ledger", paidOn: dueDate(mo) });
    });
  });
  return out;
}

function renderPreview() {
  $("preview").hidden = !pending.length;
  const names = [...new Set(pending.map((p) => p.newName).filter(Boolean))];
  $("previewRows").replaceChildren(...pending.map((p) => {
    const tr = el("tr");
    const use = el("input"); use.type = "checkbox"; use.checked = p.use; use.onchange = () => (p.use = use.checked);
    const sel = el("select");
    sel.append(new Option("Choose member", ""));
    state.members.forEach((m) => sel.append(new Option(m.name, m.id)));
    if (p.newName) sel.append(new Option("New member: " + p.newName, "__new__"));
    sel.value = p.memberId || (p.newName ? "__new__" : "");
    sel.onchange = () => { p.memberId = sel.value === "__new__" ? "" : sel.value; };
    const month = el("input"); month.type = "month"; month.value = p.month; month.onchange = () => (p.month = month.value);
    const amt = el("input"); amt.type = "number"; amt.value = p.amount; amt.onchange = () => (p.amount = Number(amt.value));
    const ref = el("input"); ref.value = p.ref; ref.placeholder = "Cash"; ref.onchange = () => (p.ref = ref.value.trim().toUpperCase());
    const dupe = p.ref && state.payments.some((x) => x.ref === p.ref);
    if (dupe) use.checked = p.use = false;
    tr.append(cell(use), cell(sel), cell(month), cell(amt), cell(ref), cell(el("span", dupe ? "Already recorded" : !p.amount ? "Amount missing" : "", "note")));
    return tr;
  }));
  $("importMsg").textContent = pending.length ? `${pending.length} payment(s) found. Fix anything that looks wrong, then save.` : "";
  $("importMsg").className = "good";
}

$("importTabs").onclick = (e) => {
  const t = e.target.dataset.tab;
  if (!t) return;
  document.querySelectorAll("#importTabs button").forEach((b) => b.classList.toggle("on", b === e.target));
  $("tab-chat").hidden = t !== "chat";
  $("tab-grid").hidden = t !== "grid";
  pending = []; renderPreview();
};
$("parseChat").onclick = () => {
  pending = parseChat($("chatText").value);
  renderPreview();
  if (!pending.length) { $("preview").hidden = false; $("previewRows").replaceChildren(emptyRow(6, "No M-Pesa codes found. Each line needs a 10-character code like SJK4X9ABCD. Use the table import for cash records.")); $("importMsg").textContent = ""; }
};
$("parseGrid").onclick = () => {
  pending = parseGrid($("gridText").value, $("gridYear").value || new Date().getFullYear());
  renderPreview();
  if (!pending.length) { $("preview").hidden = false; $("previewRows").replaceChildren(emptyRow(6, "Nothing found. Check that the first row has months and the first column has names.")); $("importMsg").textContent = ""; }
};
$("cancelImport").onclick = () => { pending = []; renderPreview(); };
$("commitImport").onclick = () => {
  const created = {};
  let saved = 0, skipped = 0;
  pending.filter((p) => p.use).forEach((p) => {
    let id = p.memberId;
    if (!id && p.newName) {
      if (!created[p.newName]) { created[p.newName] = uid(); state.members.push({ id: created[p.newName], name: p.newName, phone: "", opening: 0 }); }
      id = created[p.newName];
    }
    const ref = p.ref || "LEDGER-" + uid().slice(-5).toUpperCase();
    if (!id || !p.amount || !p.month || state.payments.some((x) => x.ref === ref)) { skipped++; return; }
    state.payments.push({ id: uid(), memberId: id, month: p.month, amount: p.amount, ref, source: p.source, kind: "contribution", paidOn: p.paidOn || dueDate(p.month), date: new Date().toISOString().slice(0, 10) });
    saved++;
  });
  save(); render();
  pending = []; renderPreview();
  $("preview").hidden = false;
  $("previewRows").replaceChildren();
  $("importMsg").textContent = `Saved ${saved} payment(s)${skipped ? `, skipped ${skipped} (missing member, amount or duplicate code)` : ""}. New members have no phone yet: add it later for WhatsApp reminders.`;
  $("importMsg").className = "good";
};
$("pDate").value = today();
$("lDate").value = today();
$("pMethod").onchange = () => {
  const cash = $("pMethod").value === "cash";
  $("pRef").disabled = cash; $("pRef").required = !cash;
  if (cash) $("pRef").value = "";
};
$("gridYear").value = new Date().getFullYear();

// ---------- Overview cards ----------
function statCards(month, n, paidCount, pot, totalArrears) {
  const s = state.settings, cards = [[kes(pot), "Contributions to date"], [kes(collected(month)), `Collected for ${month}`], [`${paidCount} of ${n}`, "Members paid this month"], [kes(totalArrears), "Outstanding arrears"]];
  if (s.fineType !== "none" && s.fineValue) cards.push([kes(state.members.reduce((t, m) => t + finesOwed(m.id), 0)), "Late fines owed"]);
  if (s.welfareAmount || state.payouts.some((p) => p.kind === "welfare")) cards.push([kes(welfareBalance()), "Welfare fund balance"]);
  if (state.loans.length) cards.push([kes(state.loans.reduce((t, l) => t + loanStats(l).balance, 0)), "Loans outstanding"]);
  const r = recipientFor(month);
  if (r) cards.push([memberName(r), `Takes the pot for ${month}`]);
  return cards;
}

// ---------- Loans ----------
// flat: interest on the full amount for every month. reducing: interest on what is still owed each month.
function loanStats(l) {
  const r = l.rate / 100, n = l.months, reps = l.repayments || [];
  const repaid = reps.reduce((t, x) => t + x.amount, 0);
  let total, installment, balance;
  if (l.type === "flat") { total = l.principal * (1 + r * n); installment = total / n; balance = total - repaid; }
  else {
    installment = r ? (l.principal * r) / (1 - Math.pow(1 + r, -n)) : l.principal / n;
    total = installment * n;
    let bal = l.principal;
    const first = l.issued.slice(0, 7);
    for (let ym = first; ym <= thisMonth(); ym = addMonths(ym, 1)) {
      if (ym > first) bal += bal * r;
      bal -= reps.filter((x) => x.date.slice(0, 7) === ym).reduce((t, x) => t + x.amount, 0);
    }
    balance = bal;
  }
  return { total: Math.round(total), installment: Math.round(installment), repaid, balance: Math.max(0, Math.round(balance)) };
}
function renderLoans() {
  const sel = $("lMember"), keep = sel.value;
  sel.replaceChildren(...state.members.map((m) => new Option(m.name, m.id)));
  if (keep) sel.value = keep;
  $("loanRows").replaceChildren(...(state.loans.length ? state.loans.map((l) => {
    const st = loanStats(l), tr = el("tr");
    const amt = el("input"); amt.type = "number"; amt.min = 1; amt.placeholder = String(st.installment);
    const go = el("button", "Save", "ghost");
    go.onclick = () => { const a = Number(amt.value); if (!a) return; (l.repayments = l.repayments || []).push({ id: uid(), amount: a, date: today() }); save(); render(); };
    const box = el("div", undefined, "row"); box.append(amt, go);
    const del = el("button", "Delete", "del");
    del.onclick = () => { if (confirm("Delete this loan and its repayments?")) { state.loans = state.loans.filter((x) => x.id !== l.id); save(); render(); } };
    tr.append(cell(memberName(l.memberId)), cell(kes(l.principal)), cell(`${l.rate}% a month, ${l.type === "flat" ? "flat" : "reducing"}, ${l.months} months`), cell(kes(st.installment)), cell(kes(st.repaid)), cell(el("strong", st.balance ? kes(st.balance) : "Cleared")), cell(box), cell(del));
    return tr;
  }) : [emptyRow(8, "No loans yet.")]));
}
$("loanForm").onsubmit = (e) => {
  e.preventDefault();
  state.loans.push({ id: uid(), memberId: $("lMember").value, principal: Number($("lAmount").value), rate: Number($("lRate").value), months: Number($("lMonths").value), type: $("lType").value, issued: $("lDate").value, repayments: [] });
  e.target.reset(); $("lDate").value = today(); save(); render();
};

// ---------- Funds: merry-go-round and welfare ----------
function rotationOrder() {
  state.rotation = state.rotation.filter((id) => state.members.some((m) => m.id === id));
  state.members.forEach((m) => { if (!state.rotation.includes(m.id)) state.rotation.push(m.id); });
  return state.rotation;
}
function recipientFor(ym) {
  const order = rotationOrder();
  if (!order.length || !state.settings.start) return null;
  const [sy, sm] = state.settings.start.split("-").map(Number), [y, m] = ym.split("-").map(Number);
  const k = (y - sy) * 12 + (m - sm);
  return k < 0 ? null : order[k % order.length];
}
const welfareCollected = () => state.payments.filter((p) => kindOf(p) === "welfare").reduce((t, p) => t + p.amount, 0);
const welfareBalance = () => welfareCollected() - state.payouts.filter((p) => p.kind === "welfare").reduce((t, p) => t + p.amount, 0);

function renderFunds(month) {
  const order = rotationOrder();
  $("orderList").replaceChildren(...(order.length ? order.map((id, i) => {
    const li = el("li"), btns = el("span");
    const move = (d) => () => { const j = i + d; if (j < 0 || j >= order.length) return; [order[i], order[j]] = [order[j], order[i]]; save(); render(); };
    const up = el("button", "Up", "del"), down = el("button", "Down", "del");
    up.style.color = down.style.color = "#12263a"; up.onclick = move(-1); down.onclick = move(1);
    btns.append(up, down);
    li.append(el("span", `${i + 1}. ${memberName(id)}`), btns);
    return li;
  }) : [el("li", "Add members to build the order.", "empty")]));

  const target = state.members.reduce((t, m) => t + pledgeOf(m.id), 0);
  const months = [-2, -1, 0, 1, 2, 3].map((k) => addMonths(month, k));
  $("roundRows").replaceChildren(...(order.length ? months.map((ym) => {
    const r = recipientFor(ym), paid = state.payouts.find((p) => p.kind === "round" && p.month === ym), tr = el("tr");
    const amount = collected(ym) || (ym > thisMonth() ? target : 0);
    let status;
    if (!r) status = el("span", "Before the group started", "empty");
    else if (paid) status = el("span", `Paid out on ${paid.date}`, "paid");
    else if (!collected(ym)) status = el("span", ym > thisMonth() ? "Upcoming" : "Nothing collected yet", "empty");
    else {
      status = el("button", "Record payout", "ghost");
      status.onclick = () => { state.payouts.push({ id: uid(), kind: "round", month: ym, memberId: r, amount: collected(ym), date: today() }); save(); render(); };
    }
    tr.append(cell(ym), cell(r ? memberName(r) : "-"), cell(paid ? kes(paid.amount) : amount ? kes(amount) : "-"), cell(status));
    return tr;
  }) : [emptyRow(4, "Add members to see the rounds.")]));

  $("welfareStats").replaceChildren(...[[kes(welfareCollected()), "Collected"], [kes(state.payouts.filter((p) => p.kind === "welfare").reduce((t, p) => t + p.amount, 0)), "Paid out"], [kes(welfareBalance()), "Balance"]].map(([big, small]) => {
    const d = el("div", undefined, "stat"); d.append(el("b", big), el("span", small)); return d;
  }));
  const sel = $("wMember"), keep = sel.value;
  sel.replaceChildren(...state.members.map((m) => new Option(m.name, m.id)));
  if (keep) sel.value = keep;
  const wp = state.payouts.filter((p) => p.kind === "welfare").reverse();
  $("welfareList").replaceChildren(...(wp.length ? wp.map((p) => {
    const li = el("li"), left = el("span", memberName(p.memberId));
    left.append(el("br"), el("small", `${p.reason} · ${p.date}`));
    li.append(left, el("strong", kes(p.amount)));
    return li;
  }) : [el("li", "No welfare payouts yet. Set a monthly welfare amount in Settings to start collecting.", "empty")]));
}
$("shuffleBtn").onclick = () => {
  if (!confirm("Draw a new random order? This changes who takes the pot in every month, including past ones.")) return;
  const o = rotationOrder();
  for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  save(); render();
};
$("welfareForm").onsubmit = (e) => {
  e.preventDefault();
  if (Number($("wAmount").value) > welfareBalance() && !confirm("This is more than the welfare balance. Record it anyway?")) return;
  state.payouts.push({ id: uid(), kind: "welfare", memberId: $("wMember").value, amount: Number($("wAmount").value), reason: $("wReason").value.trim(), date: today() });
  e.target.reset(); save(); render();
};

// ---------- Start ----------
$("viewMonth").value = thisMonth();
$("pMonth").value = thisMonth();
fillSettings();
showView();
render();
