// ============================================================================
// design.js: the visual layer. Icons, avatars, the circle of members, figure
// decorations, folding forms, phone tab bar and the "more" sheet.
// Loaded BEFORE app.js, so it only declares functions; they run after app.js loads.
// ============================================================================

// ---------- Icons: one small set, drawn on a 24-point grid ----------
const ICONS = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.2c3 .1 5 2.3 5 5.3"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1.2"/>',
  swap: '<path d="M4 8h13l-3-3"/><path d="M20 16H7l3 3"/>',
  stack: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  chart: '<path d="M5 20V11M12 20V5M19 20v-7"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="3"/><rect x="8" y="6" width="8" height="3" rx="1"/><path d="M9 13h.01M12 13h.01M15 13h.01M9 17h.01M12 17h.01M15 17h.01"/>',
  upload: '<path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M5 20h14"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.2-4.2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  auto: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  coins: '<ellipse cx="9" cy="8" rx="5" ry="2.6"/><path d="M4 8v4c0 1.4 2.2 2.6 5 2.6s5-1.2 5-2.6V8"/><path d="M14.5 10.6c2.8.1 5 1.2 5 2.6v4c0 1.4-2.2 2.6-5 2.6s-5-1.2-5-2.6"/>',
  trend: '<path d="M4 16l5-5 4 4 7-8"/><path d="M15 7h5v5"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  crown: '<path d="M4 18h16M4 18L3 8l5 4 4-7 4 7 5-4-1 10"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  scale: '<path d="M12 4v16M7 20h10"/><path d="M4 8h16"/><path d="M4 8l-2.5 6a2.5 2.5 0 0 0 5 0z"/><path d="M20 8l-2.5 6a2.5 2.5 0 0 0 5 0z"/>',
  file: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
};
function spriteMarkup() {
  return `<svg class="sprite" aria-hidden="true" focusable="false"><defs>${Object.entries(ICONS).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${v}</symbol>`).join("")}</defs></svg>`;
}
function icon(name) {
  const s = svg("svg", { class: "ico", "aria-hidden": "true", focusable: "false" }), u = svg("use");
  u.setAttribute("href", "#i-" + name); s.append(u);
  return s;
}
function themeButtonUI(pref) {
  const b = $("themeBtn"); if (!b) return;
  b.replaceChildren(icon(pref === "dark" ? "moon" : pref === "light" ? "sun" : "auto"), el("span", { auto: "Auto", light: "Light", dark: "Dark" }[pref]));
  b.title = `Theme: ${pref}. Click to change.`; b.setAttribute("aria-label", `Theme: ${pref}. Click to change.`);
}

// ---------- People: initials in a colour that is always the same for the same name ----------
const initials = (name) => { const p = String(name).trim().split(/\s+/); return ((p[0] || "")[0] || "").toUpperCase() + (p.length > 1 ? p[p.length - 1][0].toUpperCase() : ""); };
const HUES = [205, 162, 28, 338, 262, 190, 12, 285, 95, 45];
function avatar(name) {
  let h = 0; for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const a = el("span", undefined, "avatar"); a.dataset.i = initials(name); a.setAttribute("aria-hidden", "true"); a.style.setProperty("--h", HUES[h % HUES.length]);
  return a;
}
function nameCell(name, extra) { const td = document.createElement("td"); td.append(avatar(name), document.createTextNode(name + (extra || ""))); return td; }
const badge = (text, kind) => el("span", text, "badge " + kind);

// ---------- The circle: every member is a dot, like the logo ----------
function renderCircle() {
  const month = $("viewMonth").value || thisMonth(), n = state.members.length, box = $("ring");
  if (!n) { $("circleHint").textContent = ""; box.replaceChildren(el("p", "Add your members and they will appear here, as a circle.", "empty")); return; }
  const rec = recipientFor(month), cx = 180, cy = 180, R = 128, r = n <= 6 ? 22 : n <= 10 ? 18 : n <= 16 ? 14 : 10;
  const status = (m) => { const pl = pledgeOf(m.id), paid = paidBy(m.id, month); return pl === 0 || paid >= pl ? "paid" : paid > 0 ? "part" : "none"; };
  const counts = { paid: 0, part: 0, none: 0 }; state.members.forEach((m) => counts[status(m)]++);
  $("circleHint").textContent = `${counts.paid} of ${n} paid for ${month}${counts.part ? `, ${counts.part} part paid` : ""}. Select a person to open their record.`;
  const s = svg("svg", { viewBox: "0 0 360 360", role: "group", "aria-label": `Circle of ${n} members` });
  s.append(svg("circle", { cx, cy, r: R, fill: "none", stroke: "var(--line)", "stroke-width": 1.5, "stroke-dasharray": "2 7" }));
  const core = svg("g", { class: "circle-core" }), pot = potFor(month) || 0, target = potTarget();
  core.append(svg("text", { x: cx, y: 150, "text-anchor": "middle", class: "sub" }, `Pot for ${month}`), svg("text", { x: cx, y: 184, "text-anchor": "middle", class: "pot" }, kes(pot || target)), svg("text", { x: cx, y: 208, "text-anchor": "middle", class: "sub" }, pot ? `of ${kes(target)} expected` : "expected"));
  if (rec) core.append(svg("text", { x: cx, y: 232, "text-anchor": "middle", class: "sub" }, "goes to " + memberName(rec).slice(0, 18)));
  s.append(core);
  state.members.forEach((m, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a), st = status(m);
    const g = svg("g", { class: `cdot ${st}${m.id === rec ? " recipient" : ""}`, tabindex: 0, role: "button", "aria-label": `${m.name}: ${st === "paid" ? "paid" : st === "part" ? "part paid" : "not paid yet"}${m.id === rec ? ", takes the pot" : ""}` });
    g.style.setProperty("--i", i);
    if (m.id === rec) g.append(svg("circle", { class: "halo", cx: x, cy: y, r: r + 7 }));
    g.append(svg("title", {}, `${m.name}: ${st === "paid" ? "paid" : st === "part" ? "part paid" : "not paid yet"}`), svg("circle", { cx: x, cy: y, r }), svg("text", { x, y: y + 4, "text-anchor": "middle" }, initials(m.name)));
    g.onclick = () => openMember(m.id);
    g.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openMember(m.id); } };
    s.append(g);
  });
  box.replaceChildren(s);
}

// ---------- Figures: an icon for each, a trend for contributions, a meter for the month ----------
function decorateStats() {
  const map = [["Contributions to date", "coins"], ["Collected", "trend"], ["Members paid", "users"], ["Outstanding arrears", "alert"], ["Late fines", "clock"], ["Welfare", "heart"], ["Loans outstanding", "swap"], ["Takes the pot", "crown"]];
  const month = $("viewMonth").value || thisMonth();
  document.querySelectorAll("#stats .stat").forEach((card) => {
    const label = card.querySelector("span").textContent, hit = map.find(([k]) => label.startsWith(k));
    if (hit) { const chip = el("span", undefined, "chip"); chip.append(icon(hit[1])); card.prepend(chip); }
    if (label.startsWith("Contributions to date")) {
      const opening = state.members.reduce((t, m) => t + (m.opening || 0), 0);
      const vals = [-5, -4, -3, -2, -1, 0].map((k) => addMonths(month, k)).map((ym) => opening + state.payments.filter((p) => kindOf(p) === "contribution" && p.month <= ym).reduce((t, p) => t + p.amount, 0));
      const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
      const pts = vals.map((v, i) => [4 + i * 22.4, 30 - ((v - lo) / span) * 24]);
      const sp = svg("svg", { class: "spark", viewBox: "0 0 120 34", "aria-hidden": "true", preserveAspectRatio: "none" });
      sp.append(svg("path", { d: "M" + pts.map((p) => p.join(" ")).join(" L"), "vector-effect": "non-scaling-stroke" }), svg("circle", { cx: pts[5][0], cy: pts[5][1], r: 2.6 }));
      card.append(sp);
    }
    if (label.startsWith("Collected")) {
      const target = state.members.reduce((t, m) => t + pledgeOf(m.id), 0), m = el("div", undefined, "meter"), i = el("i");
      i.style.width = Math.round(Math.min(1, target ? collected(month) / target : 0) * 100) + "%"; m.append(i); card.append(m);
    }
  });
}

// ---------- Add-forms fold away once there is something to look at ----------
const FOLDS = { foldMember: () => state.members.length, foldLoan: () => state.loans.length, foldExpense: () => state.expenses.length, foldMeeting: () => state.meetings.length };
function syncFolds() { Object.entries(FOLDS).forEach(([id, count]) => { const f = $(id); if (f && !f.dataset.seen) { f.open = count() === 0; f.dataset.seen = "1"; } }); }
function resetFolds() { Object.keys(FOLDS).forEach((id) => { if ($(id)) delete $(id).dataset.seen; }); }

// ---------- Tables become cards on a phone: each cell needs to know its column name ----------
function autoLabel() {
  document.querySelectorAll("table.stack").forEach((t) => {
    const heads = [...t.querySelectorAll("thead th")].map((h) => h.textContent.trim());
    t.querySelectorAll("tbody tr").forEach((tr) => [...tr.children].forEach((td, i) => { if (heads[i]) td.dataset.label = heads[i]; }));
  });
}

// ---------- Page title, greeting and the phone navigation ----------
function greeting() { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; }
function renderSubtitle() {
  const v = titles[location.hash.slice(1)] ? location.hash.slice(1) : "overview", group = state.settings.name || "Set your group name in Settings";
  $("groupName").textContent = v === "overview" ? `${group} · ${new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" })}` : group;
}
function syncTabs(v) {
  document.querySelectorAll("#tabbar button").forEach((b) => b.classList.toggle("on", b.dataset.tab === v || (b.dataset.tab === "more" && !["overview", "members", "payments", "meetings"].includes(v))));
}
function openMore() {
  const sheet = $("moreSheet"), grid = el("div", undefined, "sheetgrid"), cur = location.hash.slice(1) || "overview";
  document.querySelectorAll("#nav button").forEach((nb) => {
    const b = el("button"); b.type = "button"; if (nb.dataset.view === cur) b.className = "on";
    b.append(icon(nb.dataset.icon), el("span", nb.querySelector("span").textContent));
    b.onclick = () => { sheet.close(); location.hash = nb.dataset.view; };
    grid.append(b);
  });
  const row = el("div", undefined, "sheetrow");
  const s = el("button", "Search", "ghost"); s.type = "button"; s.prepend(icon("search")); s.onclick = () => { sheet.close(); openPalette(); };
  const t = el("button", "Theme", "ghost"); t.type = "button"; t.onclick = () => { cycleTheme(); sheet.close(); };
  const w = el("button", "Welcome page", "ghost"); w.type = "button"; w.onclick = () => { location.href = "index.html"; };
  const md = el("button", mode === "demo" ? "Back to my chama" : "View demo data", "ghost"); md.type = "button"; md.onclick = () => { sheet.close(); setMode(mode === "demo" ? "mine" : "demo"); };
  row.append(s, t, md, w);
  sheet.replaceChildren(el("h2", "All pages"), grid, row);
  if (!sheet.open) sheet.showModal();
}
function initDesign() {
  document.body.insertAdjacentHTML("afterbegin", spriteMarkup());
  $("searchBtn").prepend(icon("search"));
  themeButtonUI(localStorage.getItem(THEME_KEY) || "auto");
  document.querySelectorAll("#tabbar button").forEach((b) => { b.onclick = () => (b.dataset.tab === "more" ? openMore() : (location.hash = b.dataset.tab)); });
  $("moreSheet").addEventListener("click", (e) => { if (e.target === $("moreSheet")) $("moreSheet").close(); });
  ["rows", "history", "loanRows", "exRows", "mtRows", "lgRows", "auRows", "rcRows", "coHistory"].forEach((id) => { const t = $(id) && $(id).closest("table"); if (t) t.classList.add("stack"); });
}
