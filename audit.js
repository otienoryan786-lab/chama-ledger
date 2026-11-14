// Tamper-evident audit trail.
// Every change to the records becomes an entry. Each entry carries a fingerprint (SHA-256) of the entry before it,
// so the entries form a chain. If anyone changes, removes or reorders an entry, the chain no longer checks out.
// A short "checkpoint" code shared with the group (for example on WhatsApp) lets anyone check later that
// nothing before that point was rewritten. This makes changes visible. It cannot stop them.
// Pure functions: no page access, tested in Node.
(function (root) {
  "use strict";

  // ---------- SHA-256 (synchronous, so it works anywhere the app runs) ----------
  const PRIMES = []; for (let n = 2; PRIMES.length < 64; n++) if (PRIMES.every((p) => n % p)) PRIMES.push(n);
  const frac = (x) => Math.floor((x - Math.floor(x)) * 4294967296) >>> 0;
  const K = PRIMES.map((p) => frac(Math.cbrt(p)));
  const H0 = PRIMES.slice(0, 8).map((p) => frac(Math.sqrt(p)));
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));

  function sha256(text) {
    const bytes = new TextEncoder().encode(String(text)), len = bytes.length;
    const total = (((len + 9) + 63) >> 6) << 6, buf = new Uint8Array(total);
    buf.set(bytes); buf[len] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(total - 8, Math.floor((len * 8) / 4294967296)); dv.setUint32(total - 4, (len * 8) >>> 0);
    const H = H0.slice(), w = new Array(64);
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g), t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      [a, b, c, d, e, f, g, h].forEach((v, i) => { H[i] = (H[i] + v) >>> 0; });
    }
    return H.map((v) => v.toString(16).padStart(8, "0")).join("");
  }

  // ---------- The chain ----------
  const GENESIS = "0".repeat(64);
  const SEP = "\u001f";
  const entryHash = (prev, e) => sha256([prev, e.n, e.ts, e.actor, e.action, e.what, e.id, e.text, JSON.stringify(e.changes || null)].join(SEP));

  function append(log, e) {
    const prev = log.length ? log[log.length - 1].hash : GENESIS;
    const entry = { n: log.length + 1, ts: e.ts, actor: e.actor || "Unknown", action: e.action, what: e.what || "", id: e.id || "", text: e.text || "", changes: e.changes || null, prev };
    entry.hash = entryHash(prev, entry);
    log.push(entry);
    return entry;
  }

  function verify(log) {
    let prev = GENESIS;
    for (let i = 0; i < log.length; i++) {
      const e = log[i];
      if (e.n !== i + 1) return { ok: false, brokenAt: i + 1, reason: "An entry is missing, added or out of order." };
      if (e.prev !== prev) return { ok: false, brokenAt: e.n, reason: "This entry does not follow on from the one before it." };
      if (e.hash !== entryHash(prev, e)) return { ok: false, brokenAt: e.n, reason: "The contents of this entry were changed." };
      prev = e.hash;
    }
    return { ok: true, count: log.length, head: prev };
  }

  // ---------- Checkpoints: a short code the group can keep ----------
  function checkpoint(log) {
    if (!log.length) return null;
    const last = log[log.length - 1];
    return { n: last.n, hash: last.hash, code: `CL-${last.n}-${last.hash.slice(0, 12).toUpperCase()}` };
  }
  function parseCheckpoint(code) {
    const m = String(code || "").trim().match(/^CL-(\d+)-([0-9A-F]{12})$/i);
    return m ? { n: Number(m[1]), prefix: m[2].toLowerCase() } : null;
  }
  // Does this record still contain the history the checkpoint was taken from?
  function verifyCheckpoint(log, code) {
    const cp = parseCheckpoint(code);
    if (!cp) return { ok: false, message: "That does not look like a checkpoint code. It should look like CL-12-A1B2C3D4E5F6." };
    const chain = verify(log);
    if (!chain.ok) return { ok: false, message: `The audit trail is damaged at entry ${chain.brokenAt}. ${chain.reason}` };
    if (cp.n > log.length) return { ok: false, message: `This record has only ${log.length} entries, but the checkpoint was taken after ${cp.n}. Entries have been removed, or this is a different record.` };
    const e = log[cp.n - 1];
    if (e.hash.slice(0, 12) !== cp.prefix) return { ok: false, message: `Entry ${cp.n} is not the one the checkpoint was taken from. History before that point has been changed.` };
    return { ok: true, message: `Matches. Entries 1 to ${cp.n} are exactly as they were when the checkpoint was taken (${e.ts.slice(0, 10)}).`, later: log.length - cp.n };
  }

  // ---------- Finding what changed between two moments ----------
  // spec = { collections: { name: { label, summary(item, action, before) } }, singles: { name: { label } } }
  function snapshot(state, spec) {
    const snap = { coll: {}, single: {} };
    Object.keys(spec.collections).forEach((c) => { snap.coll[c] = {}; (state[c] || []).forEach((it) => { snap.coll[c][it.id] = JSON.stringify(it); }); });
    Object.keys(spec.singles || {}).forEach((k) => { snap.single[k] = JSON.stringify(state[k] === undefined ? null : state[k]); });
    return snap;
  }
  const short = (v) => { const s = typeof v === "string" ? v : JSON.stringify(v); return s === undefined ? "" : s.length > 80 ? s.slice(0, 77) + "..." : s; };
  function fieldChanges(a, b) {
    const out = {}; let n = 0;
    if (a && b && typeof a === "object" && typeof b === "object") {
      new Set([...Object.keys(a), ...Object.keys(b)]).forEach((k) => { if (n < 8 && JSON.stringify(a[k]) !== JSON.stringify(b[k])) { out[k] = [short(a[k]), short(b[k])]; n++; } });
    }
    return n ? out : null;
  }
  function diff(prev, state, spec) {
    const now = snapshot(state, spec), out = [];
    Object.keys(spec.collections).forEach((c) => {
      const p = (prev.coll && prev.coll[c]) || {}, q = now.coll[c], def = spec.collections[c];
      Object.keys(q).forEach((id) => {
        if (!(id in p)) out.push({ action: "add", what: def.label, id, text: def.summary(JSON.parse(q[id]), "add") });
        else if (p[id] !== q[id]) { const a = JSON.parse(p[id]), b = JSON.parse(q[id]), ch = fieldChanges(a, b); out.push({ action: "change", what: def.label, id, text: def.summary(b, "change", a) + (ch ? ` (changed: ${Object.keys(ch).join(", ")})` : ""), changes: ch }); }
      });
      Object.keys(p).forEach((id) => { if (!(id in q)) out.push({ action: "remove", what: def.label, id, text: def.summary(JSON.parse(p[id]), "remove") }); });
    });
    Object.keys(spec.singles || {}).forEach((k) => {
      const before = prev.single ? prev.single[k] : undefined;
      if (before !== undefined && before !== now.single[k]) { const ch = fieldChanges(JSON.parse(before), JSON.parse(now.single[k])); out.push({ action: "change", what: spec.singles[k].label, id: k, text: `${spec.singles[k].label} changed${ch ? ": " + Object.keys(ch).join(", ") : ""}`, changes: ch }); }
    });
    return out;
  }

  const api = { sha256, GENESIS, entryHash, append, verify, checkpoint, parseCheckpoint, verifyCheckpoint, snapshot, diff };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Audit = api;
})(typeof window !== "undefined" ? window : globalThis);
