// Shows one member's statement from data carried in the link itself (after the #).
// The data never goes to a server: the part of a link after # is not sent when a page is requested.
(function () {
  "use strict";
  const kes = (n) => "KES " + Math.round(n).toLocaleString("en-KE");
  const el = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
  const body = document.getElementById("body");
  const KIND = { contribution: "Contribution", mgr: "Merry-go-round pot", fine: "Fine", welfare: "Welfare" };
  document.getElementById("printBtn").onclick = () => window.print();

  function decode(h) {
    h = h.replace(/-/g, "+").replace(/_/g, "/");
    while (h.length % 4) h += "=";
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(h), (c) => c.charCodeAt(0))));
  }
  let d;
  try { d = decode(location.hash.slice(1)); if (d.v !== 1 || !d.m) throw new Error("bad"); }
  catch (e) { body.replaceChildren(el("p", "This statement link is missing or damaged. Ask your treasurer to send it again.", "note")); return; }

  document.title = `${d.m}: statement | ${d.g}`;
  const owed = d.arr + d.fine + d.wel + d.mgr;
  const card = (big, small, cls) => { const c = el("div", undefined, "card"); c.append(el("span", small), el("b", big, "big " + (cls || ""))); return c; };
  const sec = (title) => el("h2", title);
  const out = [el("h1", d.m), el("p", `${d.g} · as at ${d.t}`, "sub")];
  const cards = el("div", undefined, "cards");
  cards.append(card(kes(d.paid), "Paid so far"), card(kes(d.pl), "Monthly amount"), card(owed ? kes(owed) : "Nothing", "Owed now", owed ? "bad" : "ok"));
  out.push(cards);

  if (owed) {
    const t = el("table"), tb = el("tbody");
    [["Contributions behind", d.arr], ["Late fines", d.fine], ["Welfare", d.wel], ["Merry-go-round pot", d.mgr]].filter((r) => r[1]).forEach(([k, v]) => { const tr = el("tr"); tr.append(el("td", k), el("td", kes(v))); tb.append(tr); });
    t.append(tb); out.push(sec("What is owed"), t);
  }
  if (d.mo && d.mo.length) {
    out.push(sec("Month by month"));
    const g = el("div", undefined, "months");
    d.mo.forEach(([ym, paid, due]) => { const m = el("div", undefined, "m " + (paid >= due ? "paid" : "short")); m.append(el("b", ym), el("span", paid >= due ? "Paid" : `${kes(paid)} of ${kes(due)}`)); g.append(m); });
    out.push(g);
  }
  if (d.ln && d.ln.length) {
    out.push(sec("Loans"));
    const t = el("table"), th = el("thead"), hr = el("tr"), tb = el("tbody");
    ["Loan", "Terms", "Monthly", "Balance"].forEach((h) => hr.append(el("th", h))); th.append(hr);
    d.ln.forEach(([p, r, type, bal, inst]) => { const tr = el("tr"); tr.append(el("td", kes(p)), el("td", `${r}% a month, ${type}`), el("td", kes(inst)), el("td", bal ? kes(bal) : "Cleared")); tb.append(tr); });
    t.append(th, tb); out.push(t);
  }
  if (d.pay && d.pay.length) {
    out.push(sec("Recent payments"));
    const w = el("div", undefined, "scroll"), t = el("table"), th = el("thead"), hr = el("tr"), tb = el("tbody");
    ["Date", "Type", "Amount", "Code"].forEach((h) => hr.append(el("th", h))); th.append(hr);
    d.pay.forEach(([date, kind, amt, ref]) => { const tr = el("tr"); tr.append(el("td", date), el("td", KIND[kind] || kind), el("td", kes(amt)), el("td", ref)); tb.append(tr); });
    t.append(th, tb); w.append(t); out.push(w);
  }
  out.push(el("p", "This statement was made from your chama's records on the date shown and is not signed. Check it against the group's own records. Anyone with this link can read it, so share it carefully.", "note"));
  body.replaceChildren(...out);
})();
