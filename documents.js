// ============================================================================
// documents.js: the paperwork a chama is asked for.
//   Constitution       a draft written from the group's own rules, edited, adopted and fingerprinted
//   Registration pack  the papers commonly asked for when registering a group or opening a bank account
//   Statements         money in and out, and the position, for any period, straight from the ledger
//   Track record       how reliably the group has behaved, for a lender (no member names)
// Everything prints cleanly. National ID numbers are never stored: printed lists leave a space to write them.
// Loaded BEFORE app.js, so it only declares functions; they run after app.js loads.
// ============================================================================

// ---------- Printing ----------
function printNodes(nodes) {
  $("printArea").replaceChildren(...nodes);
  document.body.classList.add("printing-minutes");
  const done = () => { document.body.classList.remove("printing-minutes"); window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  window.print();
}
const groupName = () => state.settings.name || "The Chama";
function docTable(head, rows, cls) {
  const t = el("table", undefined, cls || ""), th = el("thead"), hr = el("tr"), tb = el("tbody");
  head.forEach((h) => hr.append(el("th", h))); th.append(hr);
  rows.forEach((r) => { const tr = el("tr"); r.forEach((c, i) => tr.append(c instanceof Node ? (() => { const td = el("td"); td.append(c); return td; })() : el("td", String(c)))); tb.append(tr); });
  t.append(th, tb); return t;
}
function docFoot() {
  const cp = auditStore.log.length ? Audit.checkpoint(auditStore.log) : null;
  return el("p", `Prepared by ${groupName()} from its own records with Chama Ledger on ${today()}.${cp ? ` Audit checkpoint ${cp.code}.` : ""} These records have not been audited. Check the requirements of the office, bank or lender you are giving this to.`, "docfoot");
}
const sigLine = (labels) => { const p = el("p", labels.map((l) => `${l}: ______________________`).join("      "), "sigs"); return p; };
const officialsOf = () => { const by = (r) => state.members.find((m) => roleOf(m) === r); return { chair: by("chair"), secretary: by("secretary"), treasurer: by("treasurer") }; };
const dateBlank = (label) => `${label}: ____ / ____ / ________`;

// ---------- Constitution ----------
function constitutionContext() {
  const p = state.policy, o = officialsOf(), lastLoan = [...state.loans].sort((a, b) => b.issued.localeCompare(a.issued))[0];
  const sep = p.merry_go_round.is_separate_fund;
  return {
    name: state.settings.name, amount: state.settings.amount, dueDay: state.settings.dueDay, graceDays: state.settings.graceDays, fineType: state.settings.fineType, fineValue: state.settings.fineValue, welfareAmount: state.settings.welfareAmount,
    customAmounts: state.members.some((m) => m.pledge && m.pledge !== state.settings.amount),
    mgr: { used: sep ? p.merry_go_round.amount_per_member > 0 : state.payouts.some((x) => x.kind === "round"), separate: sep, amount: p.merry_go_round.amount_per_member },
    approval: { policy: p.expense_governance.approval_policy, signatories: p.expense_governance.signatories_required, threshold: p.expense_governance.approval_threshold },
    meetings: { quorum: p.meetings.quorum_percent, absentFine: p.meetings.absent_fine, lateFine: p.meetings.late_fine, apologyExcused: p.meetings.apology_excused },
    welfare: { reserve: p.welfare.reserve_min, cap: p.welfare.claim_cap, maxClaims: p.welfare.max_claims_per_year },
    shareout: { model: p.year_end_shareout.model, fines: p.year_end_shareout.include_fines, interest: p.year_end_shareout.include_loan_interest, welfare: p.year_end_shareout.include_welfare_surplus, returnSavings: p.year_end_shareout.return_savings, deduct: p.year_end_shareout.deduct_unpaid_loans },
    loan: lastLoan ? { rate: lastLoan.rate, type: lastLoan.type } : {},
    officials: { chair: o.chair && o.chair.name, secretary: o.secretary && o.secretary.name, treasurer: o.treasurer && o.treasurer.name },
  };
}
const constitutionOf = () => state.constitution || (state.constitution = { sections: [], version: 0, adopted: null, history: [] });
const constitutionHash = () => Audit.sha256(Constitution.fullText(constitutionOf().sections));

function createConstitution() {
  const c = constitutionOf(), fresh = Constitution.buildConstitution(constitutionContext()), old = new Map(c.sections.map((s) => [s.id, s]));
  c.sections = fresh.map((s) => (old.get(s.id) && old.get(s.id).custom ? old.get(s.id) : s)); // sections the group has edited are never overwritten
  save(); renderDocuments();
}

function renderConstitution() {
  const c = constitutionOf(), box = $("coBox"), ph = Constitution.placeholders(c.sections);
  if (!c.sections.length) { box.replaceChildren(el("p", "No constitution yet. Create a first draft from the rules your chama already uses in this app, then edit it together at a meeting.", "hint")); $("coAdopt").hidden = $("coPrint").hidden = true; $("coCreate").textContent = "Create from my rules"; $("coHistory").replaceChildren(); return; }
  $("coAdopt").hidden = $("coPrint").hidden = false; $("coCreate").textContent = "Update untouched sections from my rules";
  const status = el("p", undefined, "costatus"), adopted = c.adopted, changed = adopted && adopted.hash !== constitutionHash();
  if (adopted) status.append(badge(`Version ${adopted.version} adopted`, "ok"), document.createTextNode(` on ${adopted.on} by ${adopted.approvedBy.length} of ${state.members.length} members. Fingerprint ${adopted.hash.slice(0, 12).toUpperCase()}. `), changed ? badge("Edited since", "warn") : document.createTextNode(""));
  else status.append(badge("Draft", "info"), document.createTextNode(" Not adopted yet."));
  const warn = el("p", ph.length ? `${ph.length} gap${ph.length === 1 ? "" : "s"} in [square brackets] still need the group's answer: ${[...new Set(ph.map((p) => p.text))].slice(0, 4).join(", ")}${ph.length > 4 ? ", and more" : ""}.` : "No gaps left to fill in.", ph.length ? "err" : "good");
  warn.id = "coWarn";
  const parts = [status, warn];
  c.sections.forEach((s) => {
    const d = el("div", undefined, "cosec"), head = el("div", undefined, "row between"), ta = el("textarea");
    head.append(el("h3", s.title), s.custom ? badge("Edited", "info") : el("span"));
    ta.value = s.text; ta.rows = Math.max(3, Math.ceil(s.text.length / 95));
    ta.oninput = () => { s.text = ta.value; s.custom = true; save(); const n = Constitution.placeholders(c.sections).length; $("coWarn").textContent = n ? `${n} gap${n === 1 ? "" : "s"} in [square brackets] still need the group's answer.` : "No gaps left to fill in."; $("coWarn").className = n ? "err" : "good"; };
    d.append(head, ta); parts.push(d);
  });
  box.replaceChildren(...parts);
  $("coHistory").replaceChildren(...(c.history.length ? [...c.history].reverse().map((h) => { const tr = el("tr"); tr.append(cell("Version " + h.version), cell(h.on), cell(`${h.approvedBy.length} of ${state.members.length}`), cell(el("code", h.hash.slice(0, 12).toUpperCase())), cell(h.note || "")); return tr; }) : [emptyRow(5, "Nothing adopted yet.")]));
}

function adoptConstitution() {
  const c = constitutionOf(), ph = Constitution.placeholders(c.sections), dlg = el("dialog");
  const date = el("input"); date.type = "date"; date.value = today();
  const note = el("input"); note.placeholder = "Which meeting adopted it (optional)";
  const list = el("div", undefined, "adoptlist"), boxes = state.members.map((m) => { const l = el("label", undefined, "check"), i = el("input"); i.type = "checkbox"; i.checked = true; l.append(i, document.createTextNode(" " + m.name)); list.append(l); return [m, i]; });
  const go = el("button", "Adopt this version"), cancel = el("button", "Cancel", "ghost"), row = el("div", undefined, "row");
  go.onclick = () => {
    if (ph.length && !confirm(`${ph.length} gap${ph.length === 1 ? " is" : "s are"} still in [square brackets]. Adopt anyway?`)) return;
    const approvedBy = boxes.filter(([, i]) => i.checked).map(([m]) => m.id);
    if (!approvedBy.length) { toast("Choose the members who approved it."); return; }
    const rec = { version: c.version + 1, on: date.value || today(), hash: constitutionHash(), approvedBy, note: note.value.trim() };
    c.version = rec.version; c.adopted = rec; c.history.push(rec);
    save(); dlg.close(); renderDocuments(); toast(`Constitution version ${rec.version} adopted.`);
  };
  cancel.onclick = () => dlg.close(); dlg.addEventListener("close", () => dlg.remove());
  row.append(go, cancel);
  dlg.append(el("h2", "Adopt this constitution"), el("p", "Record that the members approved this version at a meeting. A fingerprint of the exact text is kept, so any later change can be seen. This is a record of adoption. Print it and have members sign for registration.", "hint"), field("Date adopted", date), field("Note", note), el("h3", "Members who approved it"), list, row);
  document.body.append(dlg); dlg.showModal();
}

function constitutionDoc() {
  const c = constitutionOf(), a = c.adopted, parts = [el("h1", `Constitution of ${groupName()}`), el("p", a ? `Version ${a.version}, adopted on ${a.on}.` : "Draft, not yet adopted.")];
  c.sections.forEach((s) => { parts.push(el("h3", s.title), el("p", s.text)); });
  if (a) {
    parts.push(el("h2", "Adopted by"), docTable(["Name", "Position", "Signature"], state.members.filter((m) => a.approvedBy.includes(m.id)).map((m) => [m.name, roleOf(m) === "member" ? "Member" : roleLabel(roleOf(m)), ""]), "sign"));
    parts.push(el("p", `Fingerprint of this text: ${a.hash.slice(0, 16).toUpperCase()}`, "docfoot"));
  } else parts.push(sigLine(["Chairperson", "Secretary"]));
  parts.push(docFoot()); return parts;
}

// ---------- Registration pack ----------
function membersListDoc() {
  const rows = state.members.map((m, i) => [i + 1, m.name, roleOf(m) === "member" ? "Member" : roleLabel(roleOf(m)), "", m.phone ? "+" + m.phone : "", ""]);
  return [el("h1", `${groupName()}: list of members`), el("p", "To be signed by each member. Write each ID number by hand. Chama Ledger does not store ID numbers."), docTable(["No.", "Name", "Position", "ID number", "Phone", "Signature"], rows, "sign"), docFoot()];
}
function foundingMinutesDoc() {
  const o = officialsOf(), c = state.constitution && state.constitution.adopted, blank = (m) => (m ? m.name : "______________________");
  return [el("h1", `${groupName()}: minutes of the meeting to adopt the constitution and elect officials`), el("p", `${dateBlank("Date")}      Venue: ______________________`),
    el("h3", "Members present"), el("p", state.members.map((m) => m.name).join(", ") || "______________________"),
    el("h3", "Resolutions"), (() => { const ol = el("ol"); [`The members resolved to form a self-help group named ${groupName()}.`, c ? `The constitution (version ${c.version}) was read and adopted by the members present.` : "The constitution was read and adopted by the members present.", `The following officials were elected: Chairperson ${blank(o.chair)}; Secretary ${blank(o.secretary)}; Treasurer ${blank(o.treasurer)}.`, "The group will apply to register with the Social Development Officer of the sub-county.", "The group will open an account in its name (see the separate resolution).", "There being no other business, the meeting closed at ________."].forEach((t) => ol.append(el("li", t))); return ol; })(),
    sigLine(["Chairperson", "Secretary"]), docFoot()];
}
function bankResolutionDoc() {
  const o = officialsOf(), name = (m) => (m ? m.name : "______________________");
  return [el("h1", `${groupName()}: resolution to open a bank account`), el("p", `At a meeting of ${groupName()} held on ____ / ____ / ________ it was RESOLVED that:`),
    (() => { const ol = el("ol"); ["The Chama opens an account in its name with ______________________ (bank or SACCO).", `The following officials are authorised signatories: ${name(o.chair)} (Chairperson), ${name(o.secretary)} (Secretary) and ${name(o.treasurer)} (Treasurer).`, "Any ____ of them must sign together for every withdrawal.", "The Treasurer will give members the account statement at each monthly meeting, and the books will be checked against it."].forEach((t) => ol.append(el("li", t))); return ol; })(),
    sigLine(["Chairperson", "Secretary"]), docFoot()];
}
function renderRegistration() {
  const a = state.constitution && state.constitution.adopted, o = officialsOf();
  const item = (done, text, action) => { const li = el("li"), left = el("span"); left.append(badge(done === null ? "To do" : done ? "Ready" : "To do", done ? "ok" : "info"), document.createTextNode(" " + text)); li.append(left); if (action) li.append(action); return li; };
  const btn = (label, fn) => { const b = el("button", label, "ghost"); b.type = "button"; b.onclick = fn; return b; };
  $("rgList").replaceChildren(
    item(null, "Choose a name and check it is not already used by another group (ask the sub-county Social Development office)."),
    item(!!a, a ? `Constitution adopted (version ${a.version}, ${a.on}).` : "Constitution written and adopted by the members.", btn("Print constitution", () => printNodes(constitutionDoc()))),
    item(!!(o.chair && o.secretary && o.treasurer), "Officials elected: a Chairperson, a Secretary and a Treasurer (set each member's role in their profile).", btn("Print minutes", () => printNodes(foundingMinutesDoc()))),
    item(state.members.length > 0, `List of members with names, positions, ID numbers, phone numbers and signatures (${state.members.length} listed).`, btn("Print list for signing", () => printNodes(membersListDoc()))),
    item(null, "Copies of every member's ID, and the registration fee. Ask the office for the current fee."),
    item(null, "For a bank or SACCO account: a resolution to open the account, with the signatories named.", btn("Print resolution", () => printNodes(bankResolutionDoc()))),
  );
}

// ---------- Financial statements ----------
const money = (n) => kes(n);
function statementNodes(from, to) {
  const cs = Engine.cashStatement(state, from, to), pos = Engine.position(state, `${to}-31`), rows = (o) => Object.entries(o).filter(([, v]) => Math.round(v) !== 0);
  const r = [["Cash at the start of the period", money(cs.opening)], ...rows(cs.receipts).map(([k, v]) => ["Received: " + k, money(v)]), ["Total received", money(cs.totalReceipts)], ...rows(cs.payments).map(([k, v]) => ["Paid: " + k, money(v)]), ["Total paid out", money(cs.totalPayments)], ["Cash at the end of the period", money(cs.closing)]];
  const p = [...rows(pos.assets).map(([k, v]) => [k, money(v)]), ["Total held by the chama", money(pos.totalAssets)], ...rows(pos.funds).map(([k, v]) => ["Owed to members and funds: " + k, money(v)]), ["Total owed to members and funds", money(pos.totalFunds)]];
  return { nodes: [el("h2", `Money received and paid, ${from} to ${to}`), docTable(["", "KES"], r.map(([a, b]) => [a, b]), "fs"), el("h2", `Position at the end of ${to}`), docTable(["", "KES"], p, "fs")], ok: cs.reconciles && pos.balanced };
}
function renderStatements() {
  const year = new Date().getFullYear();
  if (!$("fsFrom").value) $("fsFrom").value = `${year}-01`;
  if (!$("fsTo").value) $("fsTo").value = thisMonth();
  const from = $("fsFrom").value, to = $("fsTo").value;
  if (!from || !to || from > to) { $("fsOut").replaceChildren(el("p", "Choose a start month that is not after the end month.", "err")); return; }
  const s = statementNodes(from, to), check = el("p", undefined, "hint");
  check.append(badge(s.ok ? "Balanced" : "Does not balance", s.ok ? "ok" : "bad"), document.createTextNode(s.ok ? " The statements agree with the ledger. Cash received less cash paid equals the change in cash, and what the chama holds equals what it owes to members and funds." : " Review the records: the statements do not agree with the ledger."));
  $("fsOut").replaceChildren(...s.nodes, check);
}
function annualReportDoc(from, to) {
  const s = statementNodes(from, to), o = officialsOf(), parts = [el("h1", `${groupName()}: annual report`), el("p", `Period: ${from} to ${to}`)];
  parts.push(el("h2", "Membership and officials"), el("p", `${state.members.length} members. Chairperson: ${o.chair ? o.chair.name : "-"}. Secretary: ${o.secretary ? o.secretary.name : "-"}. Treasurer: ${o.treasurer ? o.treasurer.name : "-"}.`));
  parts.push(...s.nodes);
  const months = []; for (let ym = from; ym <= to; ym = addMonths(ym, 1)) months.push(ym);
  parts.push(el("h2", "Contributions by member"), docTable(["Member", "Due", "Paid", "Behind"], state.members.map((m) => { const due = pledgeOf(m.id) * months.length, paid = months.reduce((t, ym) => t + sumKind(m.id, "contribution", ym), 0); return [m.name, money(due), money(paid), money(Math.max(0, due - paid))]; }), "fs"));
  if (state.loans.length) parts.push(el("h2", "Loans"), docTable(["Member", "Given", "Terms", "Balance"], state.loans.map((l) => [memberName(l.memberId), money(l.principal), `${l.rate}% a month, ${l.type === "flat" ? "flat" : "reducing"}, ${l.months} months, from ${l.issued}`, money(loanStats(l).balance)]), "fs"));
  const held = state.meetings.filter((m) => m.status === "held" && m.date.slice(0, 7) >= from && m.date.slice(0, 7) <= to);
  if (held.length) parts.push(el("h2", "Meetings held"), docTable(["Date", "Meeting", "Attended", "Quorum"], held.map((m) => { const st = Engine.meetingStats(state, m); return [m.date, m.title, `${st.attended} of ${st.total}`, st.quorumMet ? "Met" : "Not met"]; }), "fs"));
  const spent = state.expenses.filter((e) => e.status === "approved" && e.date.slice(0, 7) >= from && e.date.slice(0, 7) <= to);
  if (spent.length) parts.push(el("h2", "Expenses"), docTable(["Date", "What for", "Amount", "Approved by"], spent.map((e) => [e.date, e.description, money(e.amount), e.approvals.length ? e.approvals.map((a) => memberName(a.memberId)).join(", ") : "Recorded directly"]), "fs"));
  const v = Audit.verify(auditStore.log), cp = Audit.checkpoint(auditStore.log);
  parts.push(el("h2", "Integrity of the records"), el("p", `Audit trail: ${v.ok ? "intact" : "broken at entry " + v.brokenAt}, ${auditStore.log.length} entries.${cp ? ` Latest checkpoint code ${cp.code}.` : ""}`), sigLine(["Chairperson", "Secretary", "Treasurer"]), docFoot());
  return parts;
}

// ---------- Track record ----------
function completionDate(id, ym) {
  const pl = pledgeOf(id); let sum = 0;
  for (const p of state.payments.filter((x) => x.memberId === id && kindOf(x) === "contribution" && x.month === ym).sort((a, b) => (a.paidOn || a.date).localeCompare(b.paidOn || b.date))) { sum += p.amount; if (sum >= pl) return p.paidOn || p.date; }
  return null;
}
function trackInput() {
  const s = state.settings, now = thisMonth(), monthsActive = s.start ? Math.max(0, ymDiff(s.start, now) + 1) : 0;
  const lastDue = today() > addDays(dueDate(now), s.graceDays || 0) ? now : addMonths(now, -1), from = monthsActive > 12 ? addMonths(now, -11) : (s.start || now);
  const months = []; for (let ym = from; ym <= lastDue; ym = addMonths(ym, 1)) months.push(ym);
  let expected = 0, paid = 0, paidMonths = 0, onTime = 0;
  state.members.forEach((m) => { const pl = pledgeOf(m.id); if (!pl) return; months.forEach((ym) => { expected += pl; const got = sumKind(m.id, "contribution", ym); paid += Math.min(got, pl); if (got >= pl) { paidMonths++; const d = completionDate(m.id, ym); if (d && d <= addDays(dueDate(ym), s.graceDays || 0)) onTime++; } }); });
  const loans = state.loans.map((l) => { const st = loanStats(l), exp = Math.min(l.months, Math.max(0, ymDiff(l.issued.slice(0, 7), now))) * st.installment, behind = Math.max(0, exp - st.repaid); return { cleared: st.balance === 0, onSchedule: st.balance > 0 && behind <= 0, defaulted: st.balance > 0 && behind >= 3 * st.installment }; });
  const held = state.meetings.filter((m) => m.status === "held" && m.date.slice(0, 7) >= from && m.date.slice(0, 7) <= now);
  const att = held.length ? held.reduce((t, m) => t + Engine.meetingStats(state, m).rate, 0) / held.length : null, v = Audit.verify(auditStore.log);
  return { monthsActive, memberCount: state.members.length, contributions: { expected, paid, paidMonths, onTimeMonths: onTime }, loans: { issued: loans.length, onSchedule: loans.filter((x) => x.onSchedule).length, cleared: loans.filter((x) => x.cleared).length, defaulted: loans.filter((x) => x.defaulted).length }, meetings: { held: held.length, expected: months.length, attendance: att }, records: { chainOk: v.ok, entries: auditStore.log.length } };
}
const TRACK_NOTE = "This score is worked out from the group's own records. It is not a credit rating, and it has not been audited. A lender should check it against the group's bank and M-Pesa statements.";
function renderTrack() {
  const r = TrackRecord.trackRecord(trackInput()), box = $("trBox"), big = el("div", undefined, "trscore");
  big.append(el("b", r.score === null ? "-" : String(r.score)), el("span", r.label), el("small", r.basis, "hint"));
  const bars = el("div", undefined, "bars");
  r.parts.forEach((p) => { const row = el("div", undefined, "bar"), head = el("div", undefined, "barhead"), tk = el("div", undefined, "track"), fl = el("div", undefined, "fill"); head.append(el("span", p.label), el("small", p.detail)); fl.style.width = p.points === null ? "0%" : (p.points / p.max) * 100 + "%"; tk.append(fl); row.append(head, tk); bars.append(row); });
  box.replaceChildren(big, bars, el("p", TRACK_NOTE, "hint"));
}
function trackDoc() {
  const r = TrackRecord.trackRecord(trackInput()), inp = trackInput(), b = Engine.balances(Engine.journal(state)), cp = auditStore.log.length ? Audit.checkpoint(auditStore.log) : null;
  return [el("h1", `${groupName()}: track record`), el("p", `As at ${today()}. Based on ${r.monthsActive} month${r.monthsActive === 1 ? "" : "s"} of records.`),
    el("h2", `Reliability score: ${r.score === null ? "not yet available" : r.score + " out of 100, " + r.label}`),
    docTable(["Measure", "Result"], r.parts.map((p) => [p.label, p.detail]), "fs"),
    el("h2", "The group at a glance"), docTable(["", ""], [["Members", String(inp.memberCount)], ["Months of records", String(inp.monthsActive)], ["Member savings held", money(b.savings)], ["Loans given", `${state.loans.length} loans, ${money(state.loans.reduce((t, l) => t + l.principal, 0))} in total`], ["Meetings held", String(state.meetings.filter((m) => m.status === "held").length)]], "fs"),
    el("h2", "How to check these records"), el("p", `${cp ? `The group's audit trail has ${auditStore.log.length} entries and its latest checkpoint is ${cp.code}. The group holds earlier checkpoints that show whether past records were changed. ` : ""}Ask for the group's bank and M-Pesa statements to confirm the balances.`),
    el("p", TRACK_NOTE, "docfoot"), docFoot()];
}

// ---------- The page ----------
function renderDocuments() { renderConstitution(); renderRegistration(); renderStatements(); renderTrack(); }
function initDocuments() {
  $("coCreate").onclick = createConstitution; $("coAdopt").onclick = adoptConstitution; $("coPrint").onclick = () => printNodes(constitutionDoc());
  ["fsFrom", "fsTo"].forEach((id) => { $(id).oninput = $(id).onchange = renderStatements; });
  $("fsPrint").onclick = () => { const f = $("fsFrom").value, t = $("fsTo").value; if (f && t && f <= t) printNodes([el("h1", `${groupName()}: financial statements`), ...statementNodes(f, t).nodes, docFoot()]); };
  $("fsReport").onclick = () => { const f = $("fsFrom").value, t = $("fsTo").value; if (f && t && f <= t) printNodes(annualReportDoc(f, t)); };
  $("trPrint").onclick = () => printNodes(trackDoc());
}
