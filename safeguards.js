// ============================================================================
// safeguards.js: the features that protect a group's money and its trust.
//   Audit trail     every change is logged in a chain nobody can quietly rewrite (rules in audit.js)
//   Checkpoints     a short code the group keeps, so history cannot be rewritten later without notice
//   Receipts        a receipt for every payment, sent on WhatsApp in one tap
//   Reconciliation  the books against the bank, paybill and cash really held, and against an M-Pesa statement
//   Welfare checks  the group's own limits, checked before a claim is paid
// Loaded BEFORE app.js, so it only declares functions; they run after app.js loads.
// ============================================================================

// ---------- Audit trail: storing it and noticing changes ----------
const ACTOR_KEY = "chamaLedger.actor";
let auditStore = { log: [], base: null, checkpoints: [] }, auditTimer = null, auditMuted = false, auditShowAll = false;
const auditKey = () => `chamaLedger.audit.${mode}`;
const actorName = () => localStorage.getItem(ACTOR_KEY) || "Treasurer";

// What is watched, and how each kind of change is described in words.
function auditSpec() {
  const nm = (id) => memberName(id);
  return {
    collections: {
      payments: { label: "Payment", summary: (p) => `${kes(p.amount)} ${p.kind || "contribution"}${p.month ? " for " + p.month : ""} from ${nm(p.memberId)}${p.ref ? " (" + p.ref + ")" : ""}` },
      members: { label: "Member", summary: (m) => m.name + (m.role && m.role !== "member" ? ` (${m.role})` : "") },
      loans: { label: "Loan", summary: (l, a, before) => `${kes(l.principal)} loan to ${nm(l.memberId)}${a === "change" && before && (l.repayments || []).length > (before.repayments || []).length ? ", repayment recorded" : ""}` },
      expenses: { label: "Expense", summary: (e) => `${e.description}, ${kes(e.amount)} (${e.status})` },
      meetings: { label: "Meeting", summary: (m) => `${m.title} (${m.status})` },
      charges: { label: "Attendance fine", summary: (c) => `${kes(c.amount)} for ${nm(c.memberId)}${c.waived ? " (waived)" : ""}` },
      payouts: { label: "Payout", summary: (p) => `${p.kind} payout of ${kes(p.amount)} to ${nm(p.memberId)}${p.override ? `, rules overridden: ${p.override}` : ""}` },
      reconciliations: { label: "Reconciliation", summary: (r) => `${r.date}: records say ${kes(r.expected)}, counted ${kes(r.statement)}` },
    },
    singles: { settings: { label: "Group settings" }, policy: { label: "Group policy" }, constitution: { label: "Constitution" } },
  };
}

function persistAudit() { try { localStorage.setItem(auditKey(), JSON.stringify(auditStore)); } catch (e) { /* storage full: the records themselves are saved first */ } }
function logEntries(list, actor, ts) { list.forEach((e) => Audit.append(auditStore.log, { ts: ts || new Date().toISOString(), actor, ...e })); }

// Compares the records now with the last time they were logged, and logs what is different.
function flushAudit(actor) {
  if (auditMuted) return;
  const spec = auditSpec(), d = Audit.diff(auditStore.base, state, spec);
  if (d.length) logEntries(d, actor || actorName());
  auditStore.base = Audit.snapshot(state, spec);
  persistAudit();
}
function queueAudit() { clearTimeout(auditTimer); auditTimer = setTimeout(() => { flushAudit(); if (location.hash === "#audit") renderAudit(); }, 1200); }

// Opens the trail for the current data. Anything that changed while the app was closed is logged as found "outside the app".
function loadAudit() {
  clearTimeout(auditTimer);
  try { auditStore = JSON.parse(localStorage.getItem(auditKey()) || "null"); } catch (e) { auditStore = null; }
  const fresh = !auditStore;
  if (fresh) auditStore = { log: [], base: null, checkpoints: [] };
  auditStore.checkpoints = auditStore.checkpoints || [];
  const spec = auditSpec();
  if (!auditStore.base) {
    auditStore.base = Audit.snapshot(state, spec);
    const n = ["payments", "members", "loans", "expenses", "meetings"].reduce((t, c) => t + (state[c] || []).length, 0);
    logEntries([{ action: "info", what: "Audit trail", id: "start", text: `Audit trail started. ${n} record${n === 1 ? "" : "s"} already existed and are taken as the starting point.` }], actorName());
    if (mode === "demo" && fresh) seedDemoAudit();
  } else {
    // Compare what was saved with what was last logged. Upgrades the app makes to old data on opening are not changes.
    let saved = null; try { saved = rawStored ? JSON.parse(rawStored) : null; } catch (e) { saved = null; }
    const d = saved ? Audit.diff(auditStore.base, saved, spec) : [];
    if (d.length) logEntries(d, "Outside the app (found when it opened)");
    auditStore.base = Audit.snapshot(state, spec);
  }
  persistAudit();
}

// A short history for the demo group, so the page is worth looking at.
function seedDemoAudit() {
  const ago = (days, hr) => new Date(Date.now() - days * 864e5 + hr * 36e5).toISOString(), t = state.members.find((m) => m.role === "treasurer") || state.members[0], c = state.members.find((m) => m.role === "chair") || state.members[0];
  const who = (m) => `${m.name} (${m.role})`;
  logEntries([
    { action: "add", what: "Payment", id: "d1", text: `KES 2,000 contribution for ${thisMonth()} from ${state.members[0].name} (DEMO0061)` },
    { action: "add", what: "Payment", id: "d2", text: `KES 2,000 contribution for ${thisMonth()} from ${state.members[0].name} (DEMO0061)` },
    { action: "remove", what: "Payment", id: "d2", text: `KES 2,000 contribution for ${thisMonth()} from ${state.members[0].name} (DEMO0061), entered twice` },
  ], who(t), ago(6, 0));
  logEntries([{ action: "add", what: "Expense", id: "d3", text: "Legal fees for loan agreements, KES 2,500 (pending)" }], who(t), ago(5, 2));
  logEntries([{ action: "change", what: "Expense", id: "d3", text: "Legal fees for loan agreements, KES 2,500 (pending) (changed: approvals)", changes: { approvals: ["[]", `[{"memberId":"${c.id}"}]`] } }], who(c), ago(4, 1));
  logEntries([{ action: "change", what: "Group policy", id: "policy", text: "Group policy changed: expense_governance", changes: { expense_governance: ["treasurer_only", "multi_sig"] } }], who(c), ago(3, 3));
  const cp = Audit.checkpoint(auditStore.log);
  auditStore.checkpoints.push({ code: cp.code, on: ago(3, 3.5), n: cp.n, by: who(c) });
  logEntries([{ action: "add", what: "Meeting", id: "d4", text: `Monthly meeting, ${thisMonth()}-27 (planned)` }], who(state.members.find((m) => m.role === "secretary") || t), ago(1, 0));
}

// ---------- The Audit page ----------
function renderAudit() {
  const log = auditStore.log, v = Audit.verify(log), cp = auditStore.checkpoints, last = log[log.length - 1];
  $("auStats").replaceChildren(...[[String(log.length), "Entries in the trail"], [v.ok ? "Intact" : "Broken", v.ok ? "Chain checked just now" : `Broken at entry ${v.brokenAt}`], [last ? last.ts.slice(0, 10) : "-", "Latest entry"], [String(cp.length), "Checkpoints made"]].map(([big, small]) => {
    const d = el("div", undefined, "stat"); d.append(el("b", big), el("span", small)); return d;
  }));
  if (!v.ok) $("auStats").children[1].querySelector("b").style.color = "var(--bad)";
  $("auActor").value = localStorage.getItem(ACTOR_KEY) || "";
  $("auActor").placeholder = "Treasurer";
  $("cpList").replaceChildren(...(cp.length ? [...cp].reverse().map((c) => {
    const li = el("li"), left = el("span"), copy = el("button", "Copy message", "ghost");
    left.append(el("strong", c.code), el("br"), el("small", `${c.on.slice(0, 10)}, after entry ${c.n}, by ${c.by}`, "hint"));
    copy.onclick = () => copyText(checkpointMessage(c.code, c.on), copy);
    li.append(left, copy); return li;
  }) : [el("li", "No checkpoints yet. Make one after each meeting and send it to the group.", "empty")]));
  const q = $("auSearch").value.trim().toLowerCase(), what = $("auWhat").value;
  const keepW = $("auWhat").value; $("auWhat").replaceChildren(new Option("Everything", ""), ...[...new Set(log.map((e) => e.what))].sort().map((w) => new Option(w, w))); $("auWhat").value = keepW;
  const rows = [...log].reverse().filter((e) => (!q || (e.text + " " + e.actor).toLowerCase().includes(q)) && (!what || e.what === what));
  const shown = auditShowAll ? rows : rows.slice(0, 100);
  $("auRows").replaceChildren(...(shown.length ? shown.map((e) => {
    const tr = el("tr"), det = el("div", e.text);
    if (e.changes) Object.entries(e.changes).forEach(([k, [a, b]]) => det.append(el("br"), el("small", `${k}: ${a} to ${b}`, "hint")));
    tr.append(cell(String(e.n)), cell(e.ts.slice(0, 16).replace("T", " ")), cell(e.actor), cell(badge(e.action === "add" ? "Added" : e.action === "remove" ? "Removed" : e.action === "change" ? "Changed" : "Note", e.action === "remove" ? "bad" : e.action === "change" ? "warn" : e.action === "add" ? "ok" : "info")), cell(det), cell(el("code", e.hash.slice(0, 8))));
    return tr;
  }) : [emptyRow(6, "No entries match.")]));
  $("auMore").hidden = auditShowAll || rows.length <= 100; $("auMore").textContent = `Show all ${rows.length} entries`;
}
const checkpointMessage = (code, on) => `${state.settings.name || "Chama"} records checkpoint ${code} (${on.slice(0, 10)}). Keep this message. Anyone can later use it to check that the records before this point were not changed.`;

function initAudit() {
  window.addEventListener("pagehide", () => flushAudit());
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushAudit(); });
  $("auActor").oninput = () => { const v = $("auActor").value.trim(); if (v) localStorage.setItem(ACTOR_KEY, v); else localStorage.removeItem(ACTOR_KEY); };
  ["auSearch", "auWhat"].forEach((id) => { $(id).oninput = $(id).onchange = () => { auditShowAll = false; renderAudit(); }; });
  $("auMore").onclick = () => { auditShowAll = true; renderAudit(); };
  $("cpMake").onclick = () => {
    flushAudit();
    const c = Audit.checkpoint(auditStore.log); if (!c) return;
    const rec = { code: c.code, on: new Date().toISOString(), n: c.n, by: actorName() };
    auditStore.checkpoints.push(rec); persistAudit(); renderAudit();
    copyText(checkpointMessage(rec.code, rec.on), $("cpMake")); toast("Checkpoint made and copied. Paste it in the group's WhatsApp.");
  };
  $("cpCheck").onclick = () => {
    const r = Audit.verifyCheckpoint(auditStore.log, $("cpInput").value);
    $("cpResult").replaceChildren(badge(r.ok ? "Matches" : "Does not match", r.ok ? "ok" : "bad"), document.createTextNode(" " + r.message));
  };
  $("auCsv").onclick = () => {
    const lines = ["Entry,Time,Who,Action,What,Details,Hash", ...auditStore.log.map((e) => [e.n, e.ts, `"${e.actor.replace(/"/g, '""')}"`, e.action, e.what, `"${e.text.replace(/"/g, '""')}"`, e.hash].join(","))];
    const a = el("a"); a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" })); a.download = "audit-trail.csv"; a.click();
  };
  $("auJson").onclick = () => { const a = el("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(auditStore.log, null, 1)], { type: "application/json" })); a.download = "audit-trail.json"; a.click(); };
  $("auReset").onclick = () => {
    if (!confirm("Start a new audit trail? The old history will be erased from this device. Anyone holding an earlier checkpoint will see that the history was reset.")) return;
    localStorage.removeItem(auditKey()); loadAudit(); renderAudit(); toast("A new audit trail was started.");
  };
}

// ---------- Receipts ----------
const KIND_WORDS = { contribution: "contribution", fine: "fine", welfare: "welfare contribution", mgr: "merry-go-round pot contribution" };
const receiptNo = (p) => `R-${String(p.paidOn || p.date || "").replace(/-/g, "").slice(2, 6)}-${Audit.sha256(String(p.id)).slice(0, 4).toUpperCase()}`;
function receiptText(p) {
  const m = state.members.find((x) => x.id === p.memberId), owed = m ? totalDue(m.id) : 0;
  return `${state.settings.name || "Chama"} receipt ${receiptNo(p)}: received ${kes(p.amount)} (${KIND_WORDS[kindOf(p)] || kindOf(p)}${p.month ? " for " + p.month : ""}) from ${memberName(p.memberId)} on ${p.paidOn || p.date}${p.ref && !/^(CASH|LEDGER)/.test(p.ref) ? ", reference " + p.ref : ""}. Paid so far ${kes(m ? paidBy(m.id) : 0)}. ${owed ? "Still owed " + kes(owed) + "." : "Nothing owed."}`;
}
// A link that opens WhatsApp with the receipt ready, or a button that copies it when there is no phone number.
function receiptAction(p) {
  const m = state.members.find((x) => x.id === p.memberId);
  return m && m.phone ? { label: "Send receipt", href: `https://wa.me/${m.phone}?text=${encodeURIComponent(receiptText(p))}` } : { label: "Copy receipt", run: () => copyText(receiptText(p), el("span")) };
}
function rowActions(p, del) {
  const box = el("span", undefined, "rowactions"), a = receiptAction(p), r = a.href ? el("a", "Receipt", "btnlink") : el("button", "Receipt", "ghost");
  if (a.href) { r.href = a.href; r.target = "_blank"; r.rel = "noopener"; } else r.onclick = a.run;
  box.append(r, del);
  return box;
}

// ---------- Welfare: the group's own limits, checked before money goes out ----------
function welfareStatsCards() {
  const w = state.policy.welfare, bal = welfareBalance(), cover = Engine.welfareCover(state, today());
  const cards = [[kes(welfareCollected()), "Collected"], [kes(state.payouts.filter((p) => p.kind === "welfare").reduce((t, p) => t + p.amount, 0)), "Paid out"], [kes(bal), "Balance"]];
  if (w.reserve_min > 0) cards.push([bal >= w.reserve_min ? "Above reserve" : "Below reserve", `Reserve of ${kes(w.reserve_min)}`]);
  if (cover !== null) cards.push([cover >= 24 ? "24+ months" : cover.toFixed(1) + " months", "Cover at the recent pace"]);
  return cards;
}
function submitWelfare(ev) {
  ev.preventDefault();
  const claim = { memberId: $("wMember").value, amount: Number($("wAmount").value), date: today() }, check = Engine.checkWelfareClaim(state, claim), why = $("wOverride").value.trim();
  if (!check.ok && !why) {
    $("wMsg").replaceChildren(el("strong", "This claim goes against the group's rules: "), document.createTextNode(check.issues.map((i) => i.text).join(" ") + " To go ahead anyway, give the reason the group agreed to, and it will be recorded."));
    $("wMsg").className = "err"; $("wOverrideLabel").hidden = false; $("wOverride").focus();
    return;
  }
  state.payouts.push({ id: uid(), kind: "welfare", ...claim, reason: $("wReason").value.trim(), ...(check.ok ? {} : { override: why }) });
  ev.target.reset(); $("wOverrideLabel").hidden = true; $("wMsg").textContent = "";
  save(); render(); toast(check.ok ? "Welfare payout recorded." : "Welfare payout recorded, with the reason for going beyond the rules.");
}

// ---------- Reconciliation ----------
function rcTotal() { return ["rcBank", "rcMpesa", "rcCash"].reduce((t, id) => t + (Number($(id).value) || 0), 0); }
function renderReconcile() {
  const total = rcTotal(), date = $("rcDate").value || today(), r = Engine.reconcileCash(state, date, total), any = ["rcBank", "rcMpesa", "rcCash"].some((id) => $(id).value !== "");
  $("rcResult").replaceChildren(...[[kes(r.statement), "You counted"], [kes(r.expected), `Records say, as at ${date}`], [(r.diff > 0 ? "+" : r.diff < 0 ? "-" : "") + kes(Math.abs(r.diff)), "Difference"]].map(([big, small]) => { const d = el("div", undefined, "stat"); d.append(el("b", big), el("span", small)); return d; }));
  $("rcAdvice").replaceChildren();
  if (any) {
    $("rcAdvice").append(badge(r.status === "matched" ? "Matches" : r.status === "statement_lower" ? "Less money than the records say" : "More money than the records say", r.status === "matched" ? "ok" : "bad"), document.createTextNode(" " + (r.status === "matched" ? "The books agree with the real money." : r.status === "statement_lower" ? "Check for payments recorded that never arrived, cash not yet banked, and spending or loans paid out but not recorded." : "Check for money received but not recorded. The M-Pesa statement check below can find payments missing from the books.")));
  }
  $("rcRows").replaceChildren(...(state.reconciliations.length ? [...state.reconciliations].sort((a, b) => b.date.localeCompare(a.date)).map((x) => {
    const tr = el("tr"); tr.append(cell(x.date), cell(kes(x.statement)), cell(kes(x.expected)), cell((x.diff > 0 ? "+" : x.diff < 0 ? "-" : "") + kes(Math.abs(x.diff))), cell(badge(x.status === "matched" ? "Matches" : "Difference", x.status === "matched" ? "ok" : "bad")), cell(x.by || ""), cell(x.note || ""));
    return tr;
  }) : [emptyRow(7, "No checks yet. Count the real money once a month and record it here.")]));
}

// Paste an M-Pesa statement or messages and see what the books are missing, or what does not agree.
function compareStatement() {
  const items = parseChat($("stText").value);
  if (!items.length) { $("stOut").replaceChildren(el("p", "No M-Pesa codes found. Each line needs a 10-character code like SJK4X9ABCD.", "err")); return; }
  const byRef = new Map(); state.payments.forEach((p) => { if (p.ref) byRef.set(String(p.ref).toUpperCase(), p); });
  const matched = [], differs = [], missing = [], seen = new Set();
  items.forEach((it) => { seen.add(it.ref); const p = byRef.get(it.ref); if (!p) missing.push(it); else if (Math.round(p.amount) !== Math.round(it.amount)) differs.push({ it, p }); else matched.push(it); });
  const dates = items.map((i) => i.paidOn).filter(Boolean).sort(), lo = dates[0], hi = dates[dates.length - 1];
  const extra = state.payments.filter((p) => p.ref && !seen.has(String(p.ref).toUpperCase()) && /^[A-Z0-9]{10}$/i.test(p.ref) && !/^DEMO/i.test(p.ref) && (!lo || ((p.paidOn || p.date) >= lo && (p.paidOn || p.date) <= hi)));
  const block = (title, kind, list, line) => { const d = el("div"); d.append(el("h3", `${title} (${list.length})`)); const ul = el("ul", undefined, "list"); (list.length ? list : [null]).forEach((x) => { const li = el("li", x ? line(x) : "None.", x ? "" : "empty"); ul.append(li); }); d.append(ul); d.className = kind; return d; };
  const out = [
    el("p", `${items.length} payment${items.length === 1 ? "" : "s"} found in the statement. ${matched.length} agree with the records.`, "hint"),
    block("In the statement but not in the records", "bad", missing, (i) => `${i.ref}: ${kes(i.amount)}${i.paidOn ? " on " + i.paidOn : ""}`),
    block("Recorded with a different amount", "warn", differs, (x) => `${x.it.ref}: statement ${kes(x.it.amount)}, records ${kes(x.p.amount)} (${memberName(x.p.memberId)})`),
    block("Recorded but not in this statement", "warn", extra, (p) => `${p.ref}: ${kes(p.amount)} from ${memberName(p.memberId)}${lo ? "" : " (the statement has no dates, so check the period)"}`),
  ];
  if (missing.length) { const b = el("button", "Review the missing payments in Import", "ghost"); b.onclick = () => { $("chatText").value = $("stText").value.split("\n").filter((l) => missing.some((m) => l.toUpperCase().includes(m.ref))).join("\n"); location.hash = "import"; $("parseChat").click(); }; out.push(b); }
  $("stOut").replaceChildren(...out);
}
function initReconcile() {
  $("rcDate").value = today();
  ["rcDate", "rcBank", "rcMpesa", "rcCash"].forEach((id) => { $(id).oninput = $(id).onchange = renderReconcile; });
  $("rcSave").onclick = () => {
    if (["rcBank", "rcMpesa", "rcCash"].every((id) => $(id).value === "")) { toast("Enter at least one balance first."); return; }
    const r = Engine.reconcileCash(state, $("rcDate").value || today(), rcTotal());
    state.reconciliations.push({ id: uid(), date: $("rcDate").value || today(), bank: Number($("rcBank").value) || 0, mpesa: Number($("rcMpesa").value) || 0, cash: Number($("rcCash").value) || 0, statement: r.statement, expected: r.expected, diff: r.diff, status: r.status, note: $("rcNote").value.trim(), by: actorName() });
    ["rcBank", "rcMpesa", "rcCash", "rcNote"].forEach((id) => { $(id).value = ""; }); save(); render(); toast(r.status === "matched" ? "Saved. The books match the real money." : "Saved, with a difference to look into.");
  };
  $("stCompare").onclick = compareStatement;
}
