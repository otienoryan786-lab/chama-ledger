// ============================================================================
// ui.js: the interactive layer. Theme, toasts with undo, the command palette
// (Ctrl/Cmd+K), animated figures, install and offline status.
// Loaded BEFORE app.js, so it only declares functions; they run after app.js loads.
// ============================================================================

// ---------- Theme: auto (follow the phone), light or dark ----------
const THEME_KEY = "chamaLedger.theme";
function applyTheme() {
  const pref = localStorage.getItem(THEME_KEY) || "auto";
  const dark = pref === "dark" || (pref === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  const names = { auto: "Theme: auto", light: "Theme: light", dark: "Theme: dark" };
  if ($("themeBtn")) { $("themeBtn").textContent = names[pref]; $("themeBtn").title = "Change theme"; }
  render(); // charts take their colours from the theme
}
function cycleTheme() {
  const order = ["auto", "light", "dark"], now = localStorage.getItem(THEME_KEY) || "auto";
  localStorage.setItem(THEME_KEY, order[(order.indexOf(now) + 1) % 3]);
  applyTheme();
}

// ---------- Toasts, with undo ----------
function toast(text, undo) {
  const t = el("div", undefined, "toast");
  t.append(el("span", text));
  if (undo) { const b = el("button", "Undo", "toastbtn"); b.onclick = () => { undo(); t.remove(); }; t.append(b); }
  $("toasts").append(t);
  setTimeout(() => t.classList.add("out"), undo ? 6000 : 2800);
  setTimeout(() => t.remove(), undo ? 6400 : 3200);
}

// ---------- Figures that count up when they change ----------
const statMemory = new Map();
function animateStats() {
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll(".stat").forEach((card) => {
    const b = card.querySelector("b"), label = card.querySelector("span") && card.querySelector("span").textContent;
    const m = b && label && b.textContent.match(/^(KES\s)?(-?[\d,]+)$/);
    if (!m) return;
    const to = Number(m[2].replace(/,/g, "")), from = statMemory.has(label) ? statMemory.get(label) : 0, text = b.textContent;
    statMemory.set(label, to);
    if (calm || from === to) return;
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / 600), e = 1 - Math.pow(1 - k, 3);
      b.textContent = (m[1] || "") + Math.round(from + (to - from) * e).toLocaleString("en-KE");
      if (k < 1) requestAnimationFrame(tick); else b.textContent = text;
    };
    requestAnimationFrame(tick);
  });
}

// ---------- Command palette ----------
let palIndex = 0, palItems = [];
function paletteItems() {
  const go = (view, focus) => () => { location.hash = view; if (focus) setTimeout(() => $(focus).focus(), 60); };
  const items = [];
  document.querySelectorAll("#nav button").forEach((b) => items.push({ group: "Go to", label: b.textContent.trim(), run: go(b.dataset.view) }));
  items.push(
    { group: "Do", label: "Record a payment", run: go("payments", "pAmount") },
    { group: "Do", label: "Add a member", run: go("members", "mName") },
    { group: "Do", label: "Record an expense", run: go("expenses", "exDesc") },
    { group: "Do", label: "Schedule a meeting", run: go("meetings", "mtDate") },
    { group: "Do", label: "Give a loan", run: go("loans", "lAmount") },
    { group: "Do", label: mode === "demo" ? "Switch to my chama" : "Switch to demo data", run: () => setMode(mode === "demo" ? "mine" : "demo") },
    { group: "Do", label: "Change theme", run: cycleTheme },
    { group: "Do", label: "Download payments (CSV)", run: () => $("exportBtn").click() },
    { group: "Do", label: "Open the welcome page", run: () => { location.href = "index.html"; } },
  );
  state.members.forEach((m) => items.push({ group: "Members", label: m.name, hint: roleOf(m) !== "member" ? roleLabel(roleOf(m)) : "", run: () => openMember(m.id) }));
  return items;
}
function drawPalette() {
  const q = $("palInput").value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  palItems = paletteItems().filter((i) => q.every((w) => (i.label + " " + i.group).toLowerCase().includes(w))).slice(0, 9);
  palIndex = Math.min(palIndex, Math.max(0, palItems.length - 1));
  $("palList").replaceChildren(...(palItems.length ? palItems.map((it, i) => {
    const li = el("li"); li.setAttribute("role", "option");
    li.className = i === palIndex ? "on" : "";
    li.append(el("span", it.label), el("small", it.hint ? `${it.group} · ${it.hint}` : it.group));
    li.onclick = () => runPalette(i);
    return li;
  }) : [el("li", "Nothing matches that.", "empty")]));
}
function runPalette(i) { const it = palItems[i]; if (!it) return; $("palette").close(); it.run(); }
function openPalette() { $("palInput").value = ""; palIndex = 0; drawPalette(); if (!$("palette").open) $("palette").showModal(); $("palInput").focus(); }

// ---------- Setting everything up ----------
function initUI() {
  applyThemeButtonOnly();
  $("themeBtn").onclick = cycleTheme;
  $("searchBtn").onclick = openPalette;
  $("fab").onclick = openPalette;
  $("palInput").oninput = () => { palIndex = 0; drawPalette(); };
  $("palInput").onkeydown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); palIndex = Math.min(palIndex + 1, palItems.length - 1); drawPalette(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); palIndex = Math.max(palIndex - 1, 0); drawPalette(); }
    else if (e.key === "Enter") { e.preventDefault(); runPalette(palIndex); }
  };
  $("palette").addEventListener("click", (e) => { if (e.target === $("palette")) $("palette").close(); });
  document.addEventListener("keydown", (e) => {
    const typing = /^(input|textarea|select)$/i.test(document.activeElement.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); }
    else if (e.key === "/" && !typing && !$("palette").open) { e.preventDefault(); openPalette(); }
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if ((localStorage.getItem(THEME_KEY) || "auto") === "auto") applyTheme(); });

  // Installing the app and working offline
  let installEvent = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvent = e; $("installBtn").hidden = false; });
  $("installBtn").onclick = async () => { if (!installEvent) return; installEvent.prompt(); await installEvent.userChoice; installEvent = null; $("installBtn").hidden = true; };
  const net = () => { $("netPill").hidden = navigator.onLine; };
  window.addEventListener("online", net); window.addEventListener("offline", net); net();
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register("sw.js").catch(() => {});
}
function applyThemeButtonOnly() {
  const pref = localStorage.getItem(THEME_KEY) || "auto";
  $("themeBtn").textContent = { auto: "Theme: auto", light: "Theme: light", dark: "Theme: dark" }[pref];
}
