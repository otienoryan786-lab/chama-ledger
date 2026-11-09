// ============================================================================
// meetings.js: the Meetings page.
//   Schedule a meeting, build an agenda (it can suggest items from the books), take the register,
//   write the minutes, track action items, and close the meeting. Closing turns the register into
//   attendance fines using the group's policy (rules live in engine.js).
// Loaded BEFORE app.js, so it only declares functions; they run after app.js loads.
// ============================================================================

let mtSelected = "";
const MT_TYPES = { monthly: "Monthly meeting", agm: "Annual general meeting", special: "Special meeting" };
const ATT_LABEL = { present: "Present", late: "Late", apology: "Apology", absent: "Absent" };

const findMtg = (id) => state.meetings.find((m) => m.id === id);
const mtWhen = (m) => `${m.date}${m.time ? " at " + m.time : ""}`;
const chargesOf = (m) => state.charges.filter((c) => c.meetingId === m.id);
// What changes here also changes dues elsewhere (fines owed), so the whole app is redrawn.
const mtChanged = () => { save(); render(); };

function renderMeetings() {
  const all = [...state.meetings].sort((a, b) => b.date.localeCompare(a.date));
  const held = all.filter((m) => m.status === "held");
  const avg = held.length ? Math.round((held.reduce((t, m) => t + Engine.meetingStats(state, m).rate, 0) / held.length) * 100) : null;
  const open = Engine.openActions(state, today()), overdue = open.filter((a) => a.overdue).length;
  const next = state.meetings.filter((m) => m.status === "planned" && m.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
  $("mtStats").replaceChildren(...[[String(held.length), "Meetings held"], [avg === null ? "-" : avg + "%", "Average attendance"], [String(open.length), overdue ? `Open action items (${overdue} overdue)` : "Open action items"], [next ? next.date : "None", "Next meeting"]].map(([big, small]) => {
    const d = el("div", undefined, "stat"); d.append(el("b", big), el("span", small)); return d;
  }));

  $("mtRows").replaceChildren(...(all.length ? all.map((m) => {
    const st = Engine.meetingStats(state, m), tr = el("tr", undefined, "click");
    if (m.id === mtSelected) tr.classList.add("sel");
    const status = m.status === "held" ? el("span", st.quorumMet ? "Held" : "Held, no quorum", st.quorumMet ? "paid" : "unpaid") : el("span", "Planned");
    const marked = st.total - st.counts.unmarked;
    tr.append(cell(m.date), cell(m.title), cell(status), cell(marked ? `${st.attended} of ${st.total} (${Math.round(st.rate * 100)}%)` : "-"), cell(el("span", m.id === mtSelected ? "Open" : "View", "hint")));
    tr.onclick = () => { mtSelected = m.id; renderMeetings(); $("mtDetail").scrollIntoView({ behavior: "smooth", block: "start" }); };
    return tr;
  }) : [emptyRow(5, "No meetings yet. Schedule your first one above.")]));

  const m = findMtg(mtSelected);
  $("mtDetail").replaceChildren(...(m ? meetingDetail(m) : []));
}

// ---------- One meeting ----------
function field(label, input) { const l = el("label", label); l.append(input); return l; }
function textInput(value, onChange, type = "text") { const i = el("input"); i.type = type; i.value = value || ""; i.oninput = () => { onChange(i.value); save(); }; return i; }

function meetingDetail(m) {
  const panels = [], held = m.status === "held";

  // Header
  const head = el("div", undefined, "panel");
  const title = el("div", undefined, "row between");
  title.append(el("h2", m.title), el("span", held ? "Closed" : "Open for editing", held ? "paid" : "hint"));
  const meta = el("div", undefined, "row");
  meta.append(
    field("Title", textInput(m.title, (v) => { m.title = v; })),
    field("Date", textInput(m.date, (v) => { m.date = v; }, "date")),
    field("Time", textInput(m.time, (v) => { m.time = v; }, "time")),
    field("Venue", textInput(m.venue, (v) => { m.venue = v; })),
  );
  const bar = el("div", undefined, "row"); bar.style.marginTop = ".8rem";
  const msg = el("p", "", "hint"); msg.setAttribute("role", "status");
  if (!held) {
    const close = el("button", "Close meeting and post fines");
    close.onclick = () => {
      const r = Engine.closeMeeting(state, m.id, today());
      if (!r.ok) { msg.textContent = r.error; msg.className = "err"; return; }
      mtChanged();
      toast(`Meeting closed. ${r.posted} attendance fine${r.posted === 1 ? "" : "s"} posted (${kes(r.total)}).${r.quorumMet ? "" : " Quorum was not met."}`);
    };
    bar.append(close);
  }
  const notice = el("button", "Copy notice for WhatsApp", "ghost"); notice.onclick = () => copyText(noticeText(m), notice);
  const copy = el("button", "Copy minutes", "ghost"); copy.onclick = () => copyText(minutesText(m), copy);
  const print = el("button", "Print minutes", "ghost"); print.onclick = () => printMinutes(m);
  const del = el("button", "Delete meeting", "del");
  del.onclick = () => { if (confirm("Delete this meeting, its minutes and the attendance fines it posted?")) { state.charges = state.charges.filter((c) => c.meetingId !== m.id); state.meetings = state.meetings.filter((x) => x.id !== m.id); mtSelected = ""; mtChanged(); } };
  bar.append(notice, copy, print, del);
  head.append(title, meta, bar, msg);
  panels.push(head);

  // Agenda and minutes
  const ag = el("div", undefined, "panel");
  ag.append(el("h2", "Agenda and minutes"), el("p", "List what will be discussed. During the meeting, note what was said and what was decided.", "hint"));
  const arising = Engine.openActions(state, today()).filter((a) => a.meetingId !== m.id);
  if (arising.length) {
    const box = el("div", undefined, "arising"); box.append(el("strong", "Matters arising from earlier meetings"));
    const ul = el("ul", undefined, "list");
    arising.forEach((a) => {
      const li = el("li"), who = a.ownerId ? ` (${memberName(a.ownerId)})` : "", left = el("span", `${a.text}${who}`);
      left.append(el("br"), el("small", `${a.meetingTitle}, ${a.meetingDate}${a.due ? ", due " + a.due : ""}${a.overdue ? ", overdue" : ""}`, a.overdue ? "unpaid" : "hint"));
      const done = el("button", "Mark done", "ghost"); done.onclick = () => { const src = findMtg(a.meetingId).actions.find((x) => x.id === a.id); src.done = true; save(); renderMeetings(); };
      li.append(left, done); ul.append(li);
    });
    box.append(ul); ag.append(box);
  }
  m.agenda.forEach((it, i) => {
    const card = el("div", undefined, "agitem"), top = el("div", undefined, "row");
    top.append(el("strong", `${i + 1}.`), textInput(it.title, (v) => { it.title = v; }));
    top.lastChild.style.flex = "1 1 240px";
    const up = el("button", "Up", "del"), down = el("button", "Down", "del"), rm = el("button", "Remove", "del");
    up.style.color = down.style.color = "var(--ink)";
    up.onclick = () => { if (i) { [m.agenda[i - 1], m.agenda[i]] = [m.agenda[i], m.agenda[i - 1]]; save(); renderMeetings(); } };
    down.onclick = () => { if (i < m.agenda.length - 1) { [m.agenda[i + 1], m.agenda[i]] = [m.agenda[i], m.agenda[i + 1]]; save(); renderMeetings(); } };
    rm.onclick = () => { m.agenda.splice(i, 1); save(); renderMeetings(); };
    top.append(up, down, rm);
    const notes = el("textarea"); notes.rows = 2; notes.placeholder = "What was discussed"; notes.value = it.notes || ""; notes.oninput = () => { it.notes = notes.value; save(); };
    const dec = textInput(it.decision, (v) => { it.decision = v; }); dec.placeholder = "Decision or resolution";
    card.append(top, notes, dec); ag.append(card);
  });
  const addRow = el("div", undefined, "row"), newItem = el("input"); newItem.placeholder = "Add an agenda item";
  const add = el("button", "Add item", "ghost");
  const addIt = () => { const t = newItem.value.trim(); if (!t) return; m.agenda.push({ id: uid(), title: t, notes: "", decision: "" }); save(); renderMeetings(); };
  add.onclick = addIt; newItem.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); addIt(); } };
  const suggest = el("button", "Suggest from the books", "ghost");
  suggest.onclick = () => { const n = suggestAgenda(m); save(); renderMeetings(); toast(n ? `Added ${n} agenda item${n === 1 ? "" : "s"} from your records.` : "Nothing new to add."); };
  addRow.append(newItem, add, suggest); ag.append(addRow);
  panels.push(ag);

  // Attendance
  const at = el("div", undefined, "panel"), st = Engine.meetingStats(state, m), pol = state.policy.meetings;
  at.append(el("h2", "Attendance"));
  const rule = [`Quorum: ${pol.quorum_percent}% of members (${st.quorumNeeded} of ${st.total}).`];
  if (pol.absent_fine || pol.late_fine) rule.push(`Fines: absent ${kes(pol.absent_fine)}, late ${kes(pol.late_fine)}, apology ${pol.apology_excused ? "excused" : "fined like an absence"}. Change these in Settings.`);
  else rule.push("No attendance fines are set. You can set them in Settings.");
  at.append(el("p", rule.join(" "), "hint"));
  const sum = el("p", `${st.attended} attended (${st.counts.present} on time, ${st.counts.late} late), ${st.counts.apology} apolog${st.counts.apology === 1 ? "y" : "ies"}, ${st.counts.absent} absent${st.counts.unmarked ? `, ${st.counts.unmarked} not marked yet` : ""}. `);
  const q = el("strong", st.total - st.counts.unmarked === 0 ? "" : st.quorumMet ? "Quorum met." : "Quorum not met.", st.quorumMet ? "paid" : "unpaid");
  sum.append(q); at.append(sum);
  const quick = el("div", undefined, "row"); quick.style.marginBottom = ".6rem";
  const all = el("button", "Mark everyone present", "ghost"), clr = el("button", "Clear register", "ghost");
  all.onclick = () => { state.members.forEach((x) => Engine.setAttendance(state, m.id, x.id, "present")); mtChanged(); };
  clr.onclick = () => { state.members.forEach((x) => Engine.setAttendance(state, m.id, x.id, "")); mtChanged(); };
  quick.append(all, clr); at.append(quick);
  const table = el("table"), tb = el("tbody"), wrap = el("div", undefined, "scroll");
  const thead = el("thead"), hr = el("tr"); ["Member", "Register", "Fine"].forEach((h) => hr.append(el("th", h))); thead.append(hr);
  state.members.forEach((x) => {
    const cur = (m.attendance || {})[x.id] || "", seg = el("div", undefined, "seg");
    Engine.ATTENDANCE.forEach((k) => {
      const b = el("button", ATT_LABEL[k], k === cur ? "on" : ""); b.type = "button"; b.setAttribute("aria-pressed", String(k === cur));
      b.onclick = () => { Engine.setAttendance(state, m.id, x.id, k === cur ? "" : k); mtChanged(); };
      seg.append(b);
    });
    const amount = Engine.attendanceCharge(state, cur);
    const tr = el("tr"); tr.append(cell(x.name + (roleOf(x) !== "member" ? ` (${roleLabel(roleOf(x))})` : "")), cell(seg), cell(amount ? kes(amount) : "-"));
    tb.append(tr);
  });
  table.append(thead, tb); wrap.append(table); at.append(wrap);

  if (chargesOf(m).length) {
    at.append(el("h3", "Fines from this meeting"));
    const ul = el("ul", undefined, "list");
    chargesOf(m).forEach((c) => {
      const li = el("li"), left = el("span", `${memberName(c.memberId)}: ${kes(c.amount)}`);
      left.append(el("br"), el("small", c.waived ? c.reason + " (waived)" : c.reason, "hint"));
      const w = el("button", c.waived ? "Restore" : "Waive", "ghost"); w.onclick = () => { c.waived = !c.waived; mtChanged(); };
      li.append(left, w); ul.append(li);
    });
    at.append(ul, el("p", "These add to what each member owes in fines. They are paid like any other fine from the Payments page.", "hint"));
  }
  panels.push(at);

  // Action items and notes
  const ac = el("div", undefined, "panel");
  ac.append(el("h2", "Action items and notes"));
  m.actions.forEach((a, i) => {
    const row = el("div", undefined, "row actionrow");
    const done = el("input"); done.type = "checkbox"; done.checked = !!a.done; done.onchange = () => { a.done = done.checked; save(); renderMeetings(); };
    const owner = el("select"); owner.append(new Option("Nobody yet", "")); state.members.forEach((x) => owner.append(new Option(x.name, x.id))); owner.value = a.ownerId || ""; owner.onchange = () => { a.ownerId = owner.value; save(); };
    const text = textInput(a.text, (v) => { a.text = v; }); text.style.flex = "1 1 220px";
    const due = textInput(a.due, (v) => { a.due = v; }, "date");
    const rm = el("button", "Remove", "del"); rm.onclick = () => { m.actions.splice(i, 1); save(); renderMeetings(); };
    row.append(done, text, owner, due, rm); ac.append(row);
  });
  const nr = el("div", undefined, "row"), nt = el("input"), no = el("select"), nd = el("input"), nb = el("button", "Add action item", "ghost");
  nt.placeholder = "What needs to be done"; no.append(new Option("Owner", "")); state.members.forEach((x) => no.append(new Option(x.name, x.id))); nd.type = "date";
  nb.onclick = () => { if (!nt.value.trim()) return; m.actions.push({ id: uid(), text: nt.value.trim(), ownerId: no.value, due: nd.value, done: false }); save(); renderMeetings(); };
  nr.append(nt, no, nd, nb); ac.append(nr);
  const notes = el("textarea"); notes.rows = 4; notes.placeholder = "Other notes, announcements, any other business"; notes.value = m.minutes || ""; notes.oninput = () => { m.minutes = notes.value; save(); };
  notes.style.marginTop = ".8rem"; ac.append(notes);
  panels.push(ac);
  return panels;
}

// ---------- Suggested agenda ----------
// Builds agenda items from what the books say needs discussing. Items already on the agenda are not added twice.
function suggestAgenda(m) {
  const month = thisMonth(), items = ["Call to order and apologies", "Minutes of the last meeting and matters arising"];
  const behind = state.members.filter((x) => arrears(x.id) > 0).length;
  items.push(`Contributions and arrears${behind ? ` (${behind} member${behind === 1 ? "" : "s"} behind)` : ""}`);
  if (state.loans.length) { const late = buildSummary().loans.filter((l) => l.behindBy > 0).length; items.push(`Loans${late ? ` (${late} behind schedule)` : ""}`); }
  const r = recipientFor(month);
  if (r) items.push(`Merry-go-round: ${memberName(r)} receives ${kes(potFor(month) || potTarget())}`);
  const pend = state.expenses.filter((e) => e.status === "pending");
  if (pend.length) items.push(`Expenses awaiting approval (${pend.length}, ${kes(pend.reduce((s, e) => s + e.amount, 0))})`);
  items.push("Any other business", "Date of the next meeting");
  let added = 0;
  items.forEach((t) => { if (!m.agenda.some((a) => a.title.toLowerCase().startsWith(t.toLowerCase().slice(0, 14)))) { m.agenda.push({ id: uid(), title: t, notes: "", decision: "" }); added++; } });
  // "Any other business" and "Date of the next meeting" always close the agenda
  const last = (a) => /^(any other business|date of the next meeting)/i.test(a.title);
  m.agenda = [...m.agenda.filter((a) => !last(a)), ...m.agenda.filter(last)];
  return added;
}

// ---------- Notice, minutes, printing ----------
function noticeText(m) {
  const lines = [`${state.settings.name || "Chama"}: ${m.title}`, `Date: ${mtWhen(m)}${m.venue ? `, venue: ${m.venue}` : ""}`];
  if (m.agenda.length) lines.push("Agenda:", ...m.agenda.map((a, i) => `${i + 1}. ${a.title}`));
  return lines.join("\n");
}
function attendanceLists(m) {
  const names = (k) => state.members.filter((x) => (m.attendance || {})[x.id] === k).map((x) => x.name);
  return { present: names("present"), late: names("late"), apology: names("apology"), absent: names("absent") };
}
function minutesText(m) {
  const st = Engine.meetingStats(state, m), a = attendanceLists(m), join = (l) => (l.length ? l.join(", ") : "none");
  const lines = [`${state.settings.name || "Chama"}: minutes of ${m.title}`, `Date: ${mtWhen(m)}${m.venue ? `, venue: ${m.venue}` : ""}`, "",
    `Present: ${join(a.present)}`, `Late: ${join(a.late)}`, `Apologies: ${join(a.apology)}`, `Absent: ${join(a.absent)}`,
    `Quorum: ${st.quorumMet ? "met" : "not met"} (${st.attended} of ${st.total} attended, ${st.quorumNeeded} needed)`];
  if (m.agenda.length) { lines.push("", "AGENDA AND DECISIONS"); m.agenda.forEach((it, i) => { lines.push(`${i + 1}. ${it.title}`); if (it.notes) lines.push(`   Discussion: ${it.notes}`); if (it.decision) lines.push(`   Decision: ${it.decision}`); }); }
  if (m.actions.length) { lines.push("", "ACTION ITEMS"); m.actions.forEach((x) => lines.push(`- ${x.text}${x.ownerId ? ` (${memberName(x.ownerId)})` : ""}${x.due ? `, due ${x.due}` : ""}${x.done ? " [done]" : ""}`)); }
  if (m.minutes) lines.push("", "NOTES", m.minutes);
  return lines.join("\n");
}
function printMinutes(m) {
  const st = Engine.meetingStats(state, m), a = attendanceLists(m), join = (l) => (l.length ? l.join(", ") : "none"), box = $("printArea");
  const parts = [el("h1", `${state.settings.name || "Chama"}: minutes`), el("p", `${m.title}, ${mtWhen(m)}${m.venue ? ", " + m.venue : ""}`)];
  [["Present", a.present], ["Late", a.late], ["Apologies", a.apology], ["Absent", a.absent]].forEach(([k, l]) => { const p = el("p"); p.append(el("strong", k + ": "), document.createTextNode(join(l))); parts.push(p); });
  parts.push(el("p", `Quorum ${st.quorumMet ? "met" : "not met"}: ${st.attended} of ${st.total} attended, ${st.quorumNeeded} needed.`));
  if (m.agenda.length) { parts.push(el("h2", "Agenda and decisions")); m.agenda.forEach((it, i) => { parts.push(el("h3", `${i + 1}. ${it.title}`)); if (it.notes) parts.push(el("p", it.notes)); if (it.decision) { const p = el("p"); p.append(el("strong", "Decision: "), document.createTextNode(it.decision)); parts.push(p); } }); }
  if (m.actions.length) { parts.push(el("h2", "Action items")); const ul = el("ul"); m.actions.forEach((x) => ul.append(el("li", `${x.text}${x.ownerId ? ` (${memberName(x.ownerId)})` : ""}${x.due ? `, due ${x.due}` : ""}${x.done ? " [done]" : ""}`))); parts.push(ul); }
  if (m.minutes) parts.push(el("h2", "Notes"), el("p", m.minutes));
  const sig = el("p", "Chairperson: ______________________    Secretary: ______________________"); sig.style.marginTop = "3rem"; parts.push(sig);
  box.replaceChildren(...parts);
  document.body.classList.add("printing-minutes");
  const done = () => { document.body.classList.remove("printing-minutes"); window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  window.print();
}

function initMeetings() {
  $("mtDate").value = today();
  $("meetingForm").onsubmit = (e) => {
    e.preventDefault();
    const type = $("mtType").value;
    const m = Engine.createMeeting(state, { id: uid(), title: `${MT_TYPES[type]}, ${$("mtDate").value}`, type, date: $("mtDate").value, time: $("mtTime").value, venue: $("mtVenue").value.trim() });
    suggestAgenda(m);
    mtSelected = m.id;
    e.target.reset(); $("mtDate").value = today();
    mtChanged(); toast("Meeting created with a suggested agenda.");
    $("mtDetail").scrollIntoView({ behavior: "smooth", block: "start" });
  };
}
