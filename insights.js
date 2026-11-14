// Group health score and plain-language insights.
// Pure functions: they take a small summary of the chama and return results, so they can be tested in Node.
(function (root) {
  "use strict";
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const money = (n) => "KES " + Math.round(n).toLocaleString("en-KE");
  const labelFor = (score) => (score >= 85 ? "Strong" : score >= 65 ? "Steady" : score >= 40 ? "Needs attention" : "At risk");
  const list = (names, max = 3) => (names.length <= max ? names.join(", ") : names.slice(0, max).join(", ") + ` and ${names.length - max} more`);

  // s: { memberCount, monthLabel, members:[{name, paidThisMonth, monthsBehind}], loans:[{name, behindBy, balance}],
  //      loansOut, savings, cash, booksBalanced, cashNegative, pending:{count, amount} }
  function healthScore(s) {
    if (!s.memberCount) return { score: null, label: "No data yet", parts: [] };
    const paid = s.members.filter((m) => m.paidThisMonth).length;
    const behindMonths = s.members.reduce((t, m) => t + Math.min(m.monthsBehind, 3), 0);
    const arrearsRatio = clamp(1 - behindMonths / (s.memberCount * 3), 0, 1);
    const onTrack = s.loans.filter((l) => l.behindBy <= 0).length;
    const loanRatio = s.loans.length ? onTrack / s.loans.length : 1;
    const parts = [
      { key: "collection", label: "Paid up this month", max: 40, points: Math.round(40 * (paid / s.memberCount)), detail: `${paid} of ${s.memberCount} members` },
      { key: "arrears", label: "Few members behind", max: 25, points: Math.round(25 * arrearsRatio), detail: s.members.filter((m) => m.monthsBehind > 0).length + " behind" },
      { key: "loans", label: "Loans on schedule", max: 25, points: Math.round(25 * loanRatio), detail: s.loans.length ? `${onTrack} of ${s.loans.length} on schedule` : "No loans out" },
      { key: "books", label: "Books and cash in order", max: 10, points: (s.booksBalanced ? 5 : 0) + (s.cashNegative ? 0 : 5), detail: s.booksBalanced ? (s.cashNegative ? "Cash looks short" : "Balanced") : "Out of balance" },
    ];
    const score = parts.reduce((t, p) => t + p.points, 0);
    return { score, label: labelFor(score), parts };
  }

  const ORDER = { bad: 0, warn: 1, info: 2, good: 3 };
  function buildInsights(s) {
    if (!s.memberCount) return [{ level: "info", text: "Add your members to start tracking contributions.", view: "members" }];
    const out = [];
    const behind = s.members.filter((m) => m.monthsBehind >= 2);
    if (behind.length) out.push({ level: "bad", text: `${behind.length} member${behind.length > 1 ? "s are" : " is"} two or more months behind: ${list(behind.map((m) => m.name))}.`, view: "members" });
    const unpaid = s.members.filter((m) => !m.paidThisMonth && m.monthsBehind < 2);
    if (unpaid.length) out.push({ level: "warn", text: `${unpaid.length} member${unpaid.length > 1 ? "s have" : " has"} not paid for ${s.monthLabel} yet: ${list(unpaid.map((m) => m.name))}.`, view: "members" });
    s.loans.filter((l) => l.behindBy > 0).slice(0, 3).forEach((l) => out.push({ level: "warn", text: `${l.name}'s loan is ${money(l.behindBy)} behind schedule.`, view: "loans" }));
    if (s.savings > 0 && s.loansOut / s.savings > 0.8) out.push({ level: "warn", text: `Loans out are ${Math.round((s.loansOut / s.savings) * 100)}% of savings, so little is left in reserve.`, view: "loans" });
    if (s.pending && s.pending.count) out.push({ level: "info", text: `${s.pending.count} expense${s.pending.count > 1 ? "s (" + money(s.pending.amount) + ") are" : " (" + money(s.pending.amount) + ") is"} waiting for approval.`, view: "expenses" });
    const mt = s.meeting;
    if (mt && !mt.quorumMet) out.push({ level: "warn", text: `The last meeting (${mt.date}) did not reach quorum: ${mt.attended} of ${mt.total} attended.`, view: "meetings" });
    if (s.actions && s.actions.overdue > 0) out.push({ level: "warn", text: `${s.actions.overdue} action item${s.actions.overdue > 1 ? "s are" : " is"} overdue from earlier meetings.`, view: "meetings" });
    else if (s.actions && s.actions.open > 0) out.push({ level: "info", text: `${s.actions.open} action item${s.actions.open > 1 ? "s" : ""} from meetings ${s.actions.open > 1 ? "are" : "is"} still open.`, view: "meetings" });
    if (s.lowAttendance && s.lowAttendance.length) out.push({ level: "info", text: `${list(s.lowAttendance)} ${s.lowAttendance.length > 1 ? "have" : "has"} attended less than half of recent meetings.`, view: "meetings" });
    if (s.daysSinceMeeting !== null && s.daysSinceMeeting !== undefined && s.daysSinceMeeting > 60) out.push({ level: "info", text: `No meeting has been held for ${s.daysSinceMeeting} days.`, view: "meetings" });
    if (s.welfare && s.welfare.reserve > 0 && s.welfare.balance < s.welfare.reserve) out.push({ level: "warn", text: `The welfare fund (${money(s.welfare.balance)}) is below its reserve of ${money(s.welfare.reserve)}.`, view: "funds" });
    const rc = s.reconcile;
    if (rc && rc.last && rc.last.diff !== 0 && rc.last.days <= 35) out.push({ level: "warn", text: `The last check of the books against the real money found a difference of ${money(Math.abs(rc.last.diff))}.`, view: "reconcile" });
    else if (rc && rc.hasRecords && (!rc.last || rc.last.days > 35)) out.push({ level: "info", text: rc.last ? `The books were last checked against the real money ${rc.last.days} days ago.` : "The books have never been checked against the bank, paybill and cash. Do it on the Reconcile page.", view: "reconcile" });
    if (!s.booksBalanced) out.push({ level: "bad", text: "The books are out of balance. Check the Ledger page for entries that look wrong.", view: "ledger" });
    else if (s.cashNegative) out.push({ level: "warn", text: "Recorded loans, payouts and expenses are more than the money recorded coming in. Look for missing payments.", view: "ledger" });
    if (!behind.length && !unpaid.length) out.push({ level: "good", text: `Everyone is paid up for ${s.monthLabel}.` });
    if (s.loans.length && s.loans.every((l) => l.behindBy <= 0)) out.push({ level: "good", text: s.loans.length === 1 ? "The loan is on schedule." : `All ${s.loans.length} loans are on schedule.` });
    return out.sort((a, b) => ORDER[a.level] - ORDER[b.level]).slice(0, 7);
  }

  const api = { healthScore, buildInsights, labelFor };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Insights = api;
})(typeof window !== "undefined" ? window : globalThis);
