// Group track record: a score for how reliably a chama has behaved over time.
// This is different from the health score on the Overview, which is a snapshot of this month.
// The score is only as good as the records behind it, so it also rewards an unbroken audit trail
// and says how many months of history it rests on. Pure functions: tested in Node.
(function (root) {
  "use strict";
  const clamp = (n) => Math.max(0, Math.min(1, n));
  const pct = (r) => Math.round(r * 100) + "%";
  const label = (s) => (s >= 85 ? "Excellent" : s >= 70 ? "Good" : s >= 50 ? "Fair" : "Weak");

  // input: { monthsActive, memberCount,
  //          contributions: { expected, paid, paidMonths, onTimeMonths },
  //          loans: { issued, onSchedule, cleared, defaulted },
  //          meetings: { held, expected, attendance },
  //          records: { chainOk, entries } }
  function trackRecord(i) {
    const c = i.contributions || {}, l = i.loans || {}, m = i.meetings || {}, r = i.records || {};
    const parts = [];
    const add = (key, name, max, ratio, detail) => parts.push({ key, label: name, max, points: ratio === null ? null : Math.round(max * clamp(ratio) * 10) / 10, detail });
    add("collection", "Contributions received", 35, c.expected > 0 ? c.paid / c.expected : null, c.expected > 0 ? `${pct(clamp(c.paid / c.expected))} of what was due was paid` : "No contributions were due yet");
    add("ontime", "Paid on time", 20, c.paidMonths > 0 ? c.onTimeMonths / c.paidMonths : null, c.paidMonths > 0 ? `${pct(c.onTimeMonths / c.paidMonths)} of paid months arrived by the due date` : "No payments yet");
    const behind = (l.issued || 0) - (l.onSchedule || 0) - (l.cleared || 0);
    add("loans", "Loans repaid as agreed", 25, l.issued > 0 ? 1 - (Math.max(0, behind) + (l.defaulted || 0)) / l.issued : null, l.issued > 0 ? `${l.issued} loan${l.issued === 1 ? "" : "s"}: ${l.cleared || 0} cleared, ${l.onSchedule || 0} on schedule, ${Math.max(0, behind)} behind${l.defaulted ? `, ${l.defaulted} badly behind` : ""}` : "No loans have been given");
    add("meetings", "Meets regularly", 5, m.expected > 0 ? m.held / m.expected : null, m.expected > 0 ? `${m.held || 0} meetings held, about ${m.expected} expected` : "Too early to judge");
    add("attendance", "Members attend", 5, m.attendance === null || m.attendance === undefined ? null : m.attendance, m.attendance === null || m.attendance === undefined ? "No meetings recorded" : `${pct(m.attendance)} average attendance`);
    add("records", "Records can be trusted", 10, r.entries > 0 ? (r.chainOk ? 1 : 0) : null, r.entries > 0 ? (r.chainOk ? `Audit trail intact (${r.entries} entries)` : "The audit trail is broken") : "No audit trail yet");
    const avail = parts.filter((p) => p.points !== null).reduce((t, p) => t + p.max, 0), got = parts.reduce((t, p) => t + (p.points || 0), 0);
    const score = avail ? Math.round((got / avail) * 100) : null, months = i.monthsActive || 0;
    return {
      score, label: score === null ? "No data yet" : months < 3 ? "Too early to rate" : label(score),
      confidence: months >= 12 ? "high" : months >= 6 ? "medium" : "low", monthsActive: months, memberCount: i.memberCount || 0, parts,
      basis: score === null ? "" : `Based on ${months} month${months === 1 ? "" : "s"} of records and ${parts.filter((p) => p.points !== null).length} of ${parts.length} measures.`,
    };
  }
  const api = { trackRecord, label };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.TrackRecord = api;
})(typeof window !== "undefined" ? window : globalThis);
