// Chama Ledger engine: "Policy + Ledger".
//
//  1. POLICY  - one small JSON object per chama (state.policy) that answers how that group works.
//  2. LEDGER  - every payment, fine, loan, payout and expense becomes a balanced journal entry
//               between named buckets (savings, fines, welfare, ...). Nothing is stored twice:
//               the journal is worked out from the records, so it can never drift out of step.
//  3. ENGINES - the share-out and the expense approvals read the policy and the ledger.
//
// This file has no access to the page, so it can be tested in Node. app.js draws the screens.
(function (root) {
  "use strict";

  // ---------- 1. Policy ----------
  const MODELS = ["equal", "savings_proportional", "time_weighted"];
  const APPROVALS = ["treasurer_only", "majority_vote", "multi_sig"];
  const OFFICIALS = ["chair", "secretary", "treasurer", "official"];

  const defaultPolicy = () => ({
    version: 1,
    year_end_shareout: {
      model: "savings_proportional", // equal | savings_proportional | time_weighted
      include_fines: true,
      include_loan_interest: true,
      include_welfare_surplus: false, // false: welfare rolls over to next year
      deduct_unpaid_loans: true,
      return_savings: true, // false: only the share of income is paid out; savings stay in the group
    },
    merry_go_round: {
      is_separate_fund: true, // true: its own pot on top of savings. false: an advance taken from savings
      payout_frequency: "monthly",
      amount_per_member: 0, // monthly pot contribution, used when the pot is separate
    },
    expense_governance: {
      approval_policy: "treasurer_only", // treasurer_only | majority_vote | multi_sig
      signatories_required: 2,
      approval_threshold: 0, // expenses up to this amount post straight away (0 = no limit)
    },
    welfare: {
      reserve_min: 0, // the fund should never fall below this (0 = no reserve)
      claim_cap: 0, // the most one claim can be (0 = no cap)
      max_claims_per_year: 0, // claims one member can make in a year (0 = no limit)
    },
    meetings: {
      absent_fine: 0, // charged to a member marked absent (0 = no fine)
      late_fine: 0, // charged to a member marked late
      apology_excused: true, // true: a member who sent an apology pays nothing
      quorum_percent: 50, // share of members who must attend for a meeting to count
    },
  });

  const isMoney = (v) => typeof v === "number" && isFinite(v) && v >= 0;
  // Overlay a (possibly partial or hand-written) policy on a base policy. Unknown or invalid values
  // are never applied; they are reported in `problems` so the screen can tell the person.
  function mergePolicy(input, base) {
    const p = JSON.parse(JSON.stringify(base || defaultPolicy()));
    const problems = [];
    if (!input || typeof input !== "object" || Array.isArray(input)) return { policy: p, problems: ["The policy must be a JSON object."] };
    const bool = (obj, key, where) => {
      if (!(key in obj)) return;
      if (typeof obj[key] === "boolean") where[key] = obj[key]; else problems.push(`"${key}" must be true or false.`);
    };
    const section = (key) => {
      if (!(key in input)) return null;
      const value = input[key];
      if (value && typeof value === "object" && !Array.isArray(value)) return value;
      problems.push(`"${key}" must be a JSON object.`);
      return null;
    };
    const ye = section("year_end_shareout"), mg = section("merry_go_round"), ex = section("expense_governance"), mt = section("meetings"), wf = section("welfare");
    if (ye) {
      if ("model" in ye) { if (MODELS.includes(ye.model)) p.year_end_shareout.model = ye.model; else problems.push(`Unknown share-out model "${ye.model}". Use ${MODELS.join(", ")}.`); }
      ["include_fines", "include_loan_interest", "include_welfare_surplus", "deduct_unpaid_loans", "return_savings"].forEach((k) => bool(ye, k, p.year_end_shareout));
    }
    if (mg) {
      bool(mg, "is_separate_fund", p.merry_go_round);
      if ("payout_frequency" in mg) { if (mg.payout_frequency === "monthly") p.merry_go_round.payout_frequency = "monthly"; else problems.push('Only "monthly" payout_frequency is supported for now.'); }
      if ("amount_per_member" in mg) { if (isMoney(mg.amount_per_member)) p.merry_go_round.amount_per_member = mg.amount_per_member; else problems.push('"amount_per_member" must be a number, 0 or more.'); }
    }
    if (ex) {
      if ("approval_policy" in ex) { if (APPROVALS.includes(ex.approval_policy)) p.expense_governance.approval_policy = ex.approval_policy; else problems.push(`Unknown approval_policy "${ex.approval_policy}". Use ${APPROVALS.join(", ")}.`); }
      if ("signatories_required" in ex) { if (Number.isInteger(ex.signatories_required) && ex.signatories_required >= 1 && ex.signatories_required <= 10) p.expense_governance.signatories_required = ex.signatories_required; else problems.push('"signatories_required" must be a whole number from 1 to 10.'); }
      if ("approval_threshold" in ex) { if (isMoney(ex.approval_threshold)) p.expense_governance.approval_threshold = ex.approval_threshold; else problems.push('"approval_threshold" must be a number, 0 or more.'); }
    }
    if (wf) {
      ["reserve_min", "claim_cap"].forEach((k) => { if (k in wf) { if (isMoney(wf[k])) p.welfare[k] = wf[k]; else problems.push(`"${k}" must be a number, 0 or more.`); } });
      if ("max_claims_per_year" in wf) { if (Number.isInteger(wf.max_claims_per_year) && wf.max_claims_per_year >= 0) p.welfare.max_claims_per_year = wf.max_claims_per_year; else problems.push('"max_claims_per_year" must be a whole number, 0 or more.'); }
    }
    if (mt) {
      ["absent_fine", "late_fine"].forEach((k) => { if (k in mt) { if (isMoney(mt[k])) p.meetings[k] = mt[k]; else problems.push(`"${k}" must be a number, 0 or more.`); } });
      bool(mt, "apology_excused", p.meetings);
      if ("quorum_percent" in mt) { if (typeof mt.quorum_percent === "number" && mt.quorum_percent >= 1 && mt.quorum_percent <= 100) p.meetings.quorum_percent = mt.quorum_percent; else problems.push('"quorum_percent" must be a number from 1 to 100.'); }
    }
    return { policy: p, problems };
  }

  // Starting points. A template only sets the rules; amounts (like the pot size) are kept.
  const PRESETS = [
    { id: "simple", label: "Small friends' chama", text: "Equal share-out, merry-go-round taken from savings, the treasurer logs expenses.",
      policy: { year_end_shareout: { model: "equal", include_fines: true, include_loan_interest: true, include_welfare_surplus: false, deduct_unpaid_loans: true }, merry_go_round: { is_separate_fund: false }, expense_governance: { approval_policy: "treasurer_only" } } },
    { id: "investment", label: "Savings and investment group", text: "Time-weighted share-out, separate merry-go-round pot, two officials sign larger expenses.",
      policy: { year_end_shareout: { model: "time_weighted", include_fines: true, include_loan_interest: true, include_welfare_surplus: false, deduct_unpaid_loans: true }, merry_go_round: { is_separate_fund: true }, expense_governance: { approval_policy: "multi_sig", signatories_required: 2, approval_threshold: 5000 } } },
    { id: "formal", label: "Formal group with votes", text: "Share by savings, welfare shared out at year-end, expenses need a majority vote.",
      policy: { year_end_shareout: { model: "savings_proportional", include_fines: true, include_loan_interest: true, include_welfare_surplus: true, deduct_unpaid_loans: true }, merry_go_round: { is_separate_fund: true }, expense_governance: { approval_policy: "majority_vote", approval_threshold: 2000 } } },
  ];

  // ---------- 2. Ledger ----------
  // Buckets. "normal" is the side a healthy balance sits on.
  const ACCOUNTS = {
    cash: { label: "Cash in the chama account", normal: "dr" },
    loans_receivable: { label: "Loans owed to the chama", normal: "dr" },
    mgr_advances: { label: "Merry-go-round advances", normal: "dr" },
    expenses: { label: "Expenses", normal: "dr" },
    savings: { label: "Member savings", normal: "cr" },
    fines: { label: "Fines collected", normal: "cr" },
    welfare: { label: "Welfare fund", normal: "cr" },
    loan_interest: { label: "Loan interest earned", normal: "cr" },
    mgr: { label: "Merry-go-round pot", normal: "cr" },
  };
  const kindOf = (p) => p.kind || "contribution";
  const dateOf = (p) => p.paidOn || p.date;

  // Total a loan repays, interest included. Flat: interest on the full amount every month.
  // Reducing: a level instalment worked out from the monthly rate.
  function loanTotal(l) {
    const r = l.rate / 100, n = l.months;
    if (l.type === "flat") return l.principal * (1 + r * n);
    const inst = r ? (l.principal * r) / (1 - Math.pow(1 + r, -n)) : l.principal / n;
    return inst * n;
  }

  // Every record becomes one balanced entry: its lines add up to the same debit and credit.
  function journal(s) {
    const J = [];
    const sep = s.policy.merry_go_round.is_separate_fund;
    const name = (id) => (s.members.find((m) => m.id === id) || { name: "(removed)" }).name;
    const add = (date, month, memo, memberId, kind, lines) => J.push({ date, month, memo, memberId: memberId || "", kind, lines: lines.map(([acct, dr, cr]) => ({ acct, dr, cr })) });
    s.members.forEach((m) => {
      if (m.opening) add((s.settings.start || "1970-01") + "-01", "", "Balance brought forward", m.id, "opening", [["cash", m.opening, 0], ["savings", 0, m.opening]]);
    });
    s.payments.forEach((p) => {
      const bucket = { contribution: "savings", fine: "fines", welfare: "welfare", mgr: "mgr" }[kindOf(p)];
      if (!bucket) return;
      const label = { contribution: "Contribution", fine: "Late fine", welfare: "Welfare", mgr: "Merry-go-round pot" }[kindOf(p)];
      add(dateOf(p), p.month, `${label} for ${p.month} (${p.ref})`, p.memberId, kindOf(p), [["cash", p.amount, 0], [bucket, 0, p.amount]]);
    });
    s.payouts.forEach((p) => {
      if (p.kind === "welfare") add(p.date, "", `Welfare payout: ${p.reason || ""}`.trim(), p.memberId, "welfare_payout", [["welfare", p.amount, 0], ["cash", 0, p.amount]]);
      if (p.kind === "round") add(p.date, p.month, `Merry-go-round payout for ${p.month}`, p.memberId, "round", [[sep ? "mgr" : "mgr_advances", p.amount, 0], ["cash", 0, p.amount]]);
    });
    s.loans.forEach((l) => {
      add(l.issued, l.issued.slice(0, 7), `Loan given to ${name(l.memberId)}`, l.memberId, "loan", [["loans_receivable", l.principal, 0], ["cash", 0, l.principal]]);
      const total = loanTotal(l), ratio = total ? l.principal / total : 1;
      let principalLeft = l.principal;
      (l.repayments || []).forEach((r) => {
        const pp = Math.min(principalLeft, Math.round(r.amount * ratio)), ip = r.amount - pp;
        principalLeft -= pp;
        const lines = [["cash", r.amount, 0], ["loans_receivable", 0, pp]];
        if (ip) lines.push(["loan_interest", 0, ip]);
        add(r.date, r.date.slice(0, 7), "Loan repayment", l.memberId, "repayment", lines);
      });
    });
    (s.expenses || []).filter((e) => e.status === "approved").forEach((e) => {
      add(e.approvedOn || e.date, (e.date || "").slice(0, 7), `Expense: ${e.description}`, e.draftedBy, "expense", [["expenses", e.amount, 0], ["cash", 0, e.amount]]);
    });
    return J.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }

  // Balance of each bucket, on its normal side. `keep` optionally filters entries.
  function balances(J, keep) {
    const t = {};
    Object.keys(ACCOUNTS).forEach((a) => (t[a] = 0));
    J.forEach((e) => {
      if (keep && !keep(e)) return;
      e.lines.forEach((l) => { t[l.acct] += (ACCOUNTS[l.acct].normal === "dr" ? l.dr - l.cr : l.cr - l.dr); });
    });
    return t;
  }
  // The books balance when what the chama holds (cash, loans out, advances, expenses)
  // equals what it owes or has earned (savings, fines, welfare, interest, pot).
  function check(J) {
    let dr = 0, cr = 0;
    J.forEach((e) => e.lines.forEach((l) => { dr += l.dr; cr += l.cr; }));
    const b = balances(J);
    return { debits: dr, credits: cr, balanced: Math.abs(dr - cr) < 0.005, cashNegative: b.cash < 0, cash: b.cash };
  }

  // ---------- 3a. Share-out ----------
  // Split a whole-shilling total in proportion to weights, so the parts add up exactly.
  function allocate(total, weights) {
    const sum = weights.reduce((a, b) => a + b, 0);
    if (!(sum > 0) || !(total > 0)) return weights.map(() => 0);
    const raw = weights.map((w) => (total * w) / sum), base = raw.map(Math.floor);
    let left = total - base.reduce((a, b) => a + b, 0);
    raw.map((r, i) => [r - base[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { base[i]++; left--; } });
    return base;
  }

  const monthsBetween = (a, b) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + (Number(b.slice(5, 7)) - Number(a.slice(5, 7)));

  // opts: { model, loanBalance(loan), from, to, extra }
  //   from/to  "YYYY-MM": the chama's own financial year. Default January to December of `year`.
  //   extra    income (or, if negative, expense) the person adds by hand, counted before the pool is worked out.
  // Time-weighted: money saved in the first month of the period counts for every month, the last month once.
  // Savings from before the period (and balances brought forward) count for the whole period.
  function shareOut(s, year, opts) {
    opts = opts || {};
    const pol = s.policy.year_end_shareout, model = MODELS.includes(opts.model) ? opts.model : pol.model;
    const first = opts.from || `${year}-01`, last = opts.to || `${year}-12`, d1 = `${first}-01`, d2 = `${last}-31`;
    const span = monthsBetween(first, last) + 1;
    const J = journal(s);
    const weight = (month) => (!month || month < first ? span : monthsBetween(month, last) + 1);
    const rows = s.members.map((m) => {
      let savings = 0, weighted = 0, advances = 0;
      J.forEach((e) => {
        if (e.memberId !== m.id) return;
        if (e.month && e.month > last) return;
        e.lines.forEach((l) => {
          let amt = 0;
          if (l.acct === "savings") amt = l.cr - l.dr;
          if (l.acct === "mgr_advances") { amt = -(l.dr - l.cr); advances += l.dr - l.cr; } // already taken out of their savings
          if (!amt) return;
          savings += amt; weighted += amt * weight(e.kind === "opening" ? "" : e.month);
        });
      });
      return { memberId: m.id, name: m.name, savings, advances, weighted: Math.max(0, weighted), basis: 0, pct: 0, dividend: 0, loan: 0, total: 0 };
    });
    const inPeriod = (e) => e.date >= d1 && e.date <= d2;
    const yb = balances(J, inPeriod);
    const parts = {
      interest: pol.include_loan_interest ? yb.loan_interest : 0,
      fines: pol.include_fines ? yb.fines : 0,
      welfare: pol.include_welfare_surplus ? Math.max(0, balances(J, (e) => e.date <= d2).welfare) : 0,
      expenses: yb.expenses,
      extra: Number(opts.extra) || 0,
    };
    const raw = parts.interest + parts.fines + parts.welfare - parts.expenses + parts.extra;
    const pool = Math.max(0, Math.round(raw));
    rows.forEach((r) => { r.basis = model === "equal" ? 1 : model === "time_weighted" ? r.weighted : Math.max(0, r.savings); });
    const bs = rows.reduce((t, r) => t + r.basis, 0);
    const shares = allocate(pool, rows.map((r) => r.basis));
    rows.forEach((r, i) => {
      r.pct = bs ? r.basis / bs : 0;
      r.dividend = shares[i];
      r.loan = pol.deduct_unpaid_loans && opts.loanBalance
        ? s.loans.filter((l) => l.memberId === r.memberId).reduce((t, l) => t + opts.loanBalance(l), 0) : 0;
      r.total = r.savings + r.dividend - r.loan;
    });
    const notes = [];
    if (!s.members.length) notes.push("Add members to see a share-out.");
    else if (raw < 0) notes.push("Expenses are bigger than the income in this period, so there is nothing to share. The shortfall is not charged to members.");
    else if (!pool) notes.push("Nothing to share yet: no fines, loan interest or welfare surplus is counted for this period.");
    if (s.members.length && !bs) notes.push("Nobody has any savings counted yet, so the pool cannot be divided.");
    if (model === "time_weighted") notes.push("Time-weighted: KES 1,000 saved in the first month counts for the whole period, in the last month once. Earlier money earns more.");
    if (model === "equal") notes.push("Equal split: the pool is divided by the number of members, whatever they saved.");
    if (model === "savings_proportional") notes.push("By savings: each member's share of the pool matches their share of everyone's savings.");
    const cash = balances(J, (e) => e.date <= d2).cash;
    const totals = rows.reduce((t, r) => ({ savings: t.savings + r.savings, advances: t.advances + r.advances, dividend: t.dividend + r.dividend, loan: t.loan + r.loan, total: t.total + r.total }), { savings: 0, advances: 0, dividend: 0, loan: 0, total: 0 });
    return { year, from: first, to: last, model, pool: { ...parts, total: pool }, rows, totals, notes, cash };
  }

  // ---------- 3c. Meetings ----------
  // A meeting has an agenda, a register, minutes and action items. Closing it turns the register into
  // attendance fines (charges) using the policy. Charges are owed amounts: they are paid later as fines.
  const ATTENDANCE = ["present", "late", "apology", "absent"];
  const newId = () => Math.random().toString(36).slice(2, 10);

  function createMeeting(s, d) {
    s.meetings = s.meetings || [];
    const m = { id: d.id || newId(), title: d.title || "Meeting", type: d.type || "monthly", date: d.date, time: d.time || "", venue: d.venue || "", status: "planned", agenda: [], attendance: {}, minutes: "", actions: [], closedOn: "" };
    s.meetings.push(m);
    return m;
  }
  const findMeeting = (s, id) => (s.meetings || []).find((x) => x.id === id);

  function meetingStats(s, m) {
    const counts = { present: 0, late: 0, apology: 0, absent: 0, unmarked: 0 };
    s.members.forEach((x) => { const st = (m.attendance || {})[x.id]; if (counts[st] !== undefined) counts[st]++; else counts.unmarked++; });
    const total = s.members.length, attended = counts.present + counts.late;
    const quorumNeeded = Math.ceil((total * s.policy.meetings.quorum_percent) / 100);
    return { counts, total, attended, rate: total ? attended / total : 0, quorumNeeded, quorumMet: total > 0 && attended >= quorumNeeded };
  }

  function attendanceCharge(s, status) {
    const p = s.policy.meetings;
    if (status === "late") return p.late_fine;
    if (status === "absent") return p.absent_fine;
    if (status === "apology") return p.apology_excused ? 0 : p.absent_fine;
    return 0;
  }
  function chargesForMeeting(s, m) {
    const label = { late: "Late to", absent: "Absent from", apology: "Apology not excused for" };
    return s.members.map((x) => {
      const st = (m.attendance || {})[x.id], amount = attendanceCharge(s, st);
      return amount > 0 ? { memberId: x.id, amount, reason: `${label[st]} ${m.title} on ${m.date}` } : null;
    }).filter(Boolean);
  }

  // Makes s.charges match the register for a meeting. A charge that was waived stays waived.
  function syncCharges(s, m) {
    s.charges = s.charges || [];
    const wanted = chargesForMeeting(s, m), mine = s.charges.filter((c) => c.meetingId === m.id);
    s.charges = s.charges.filter((c) => c.meetingId !== m.id);
    wanted.forEach((w) => {
      const old = mine.find((c) => c.memberId === w.memberId);
      s.charges.push({ id: old ? old.id : newId(), memberId: w.memberId, amount: w.amount, reason: w.reason, date: m.date, meetingId: m.id, waived: old ? !!old.waived : false });
    });
    const live = s.charges.filter((c) => c.meetingId === m.id && !c.waived);
    return { posted: live.length, total: live.reduce((t, c) => t + c.amount, 0) };
  }

  function setAttendance(s, meetingId, memberId, status) {
    const m = findMeeting(s, meetingId);
    if (!m) return { ok: false, error: "Meeting not found." };
    if (status !== "" && !ATTENDANCE.includes(status)) return { ok: false, error: "Unknown attendance status." };
    if (!s.members.some((x) => x.id === memberId)) return { ok: false, error: "Member not found." };
    m.attendance = m.attendance || {};
    if (status === "") delete m.attendance[memberId]; else m.attendance[memberId] = status;
    return { ok: true, ...(m.status === "held" ? syncCharges(s, m) : {}) };
  }

  function closeMeeting(s, id, on) {
    const m = findMeeting(s, id);
    if (!m) return { ok: false, error: "Meeting not found." };
    if (m.status === "held") return { ok: false, error: "This meeting is already closed." };
    const st = meetingStats(s, m);
    if (st.counts.unmarked) return { ok: false, error: `Mark attendance for everyone first (${st.counts.unmarked} not marked).` };
    m.status = "held"; m.closedOn = on;
    return { ok: true, quorumMet: st.quorumMet, ...syncCharges(s, m) };
  }

  // Share of held meetings a member attended (on time or late).
  function attendanceRate(s, memberId, lastN) {
    let held = (s.meetings || []).filter((m) => m.status === "held").sort((a, b) => b.date.localeCompare(a.date));
    if (lastN) held = held.slice(0, lastN);
    const attended = held.filter((m) => ["present", "late"].includes((m.attendance || {})[memberId])).length;
    return { held: held.length, attended, rate: held.length ? attended / held.length : null };
  }

  function openActions(s, today) {
    const out = [];
    (s.meetings || []).forEach((m) => (m.actions || []).forEach((a) => { if (!a.done) out.push({ meetingId: m.id, meetingTitle: m.title, meetingDate: m.date, id: a.id, text: a.text, ownerId: a.ownerId || "", due: a.due || "", overdue: !!(a.due && today && a.due < today) }); }));
    return out.sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  }

  // ---------- 3d. Welfare protection ----------
  // Welfare funds fail when several claims arrive together. These rules do not forbid a claim: they tell the
  // treasurer, before the money goes out, which of the group's own rules it would break.
  function checkWelfareClaim(s, c) {
    const w = s.policy.welfare, bal = balances(journal(s)).welfare, issues = [];
    if (c.amount > bal) issues.push({ rule: "balance", text: `The welfare fund only has ${fmtKES(bal)}.` });
    else if (w.reserve_min > 0 && bal - c.amount < w.reserve_min) issues.push({ rule: "reserve", text: `This would leave ${fmtKES(bal - c.amount)} in the fund, below the reserve of ${fmtKES(w.reserve_min)}.` });
    if (w.claim_cap > 0 && c.amount > w.claim_cap) issues.push({ rule: "cap", text: `This is more than the claim limit of ${fmtKES(w.claim_cap)}.` });
    if (w.max_claims_per_year > 0) {
      const year = String(c.date).slice(0, 4), made = (s.payouts || []).filter((p) => p.kind === "welfare" && p.memberId === c.memberId && String(p.date).slice(0, 4) === year).length;
      if (made >= w.max_claims_per_year) issues.push({ rule: "frequency", text: `This member has already had ${made} claim${made === 1 ? "" : "s"} this year. The limit is ${w.max_claims_per_year}.` });
    }
    return { ok: !issues.length, issues, balance: bal, after: bal - c.amount };
  }
  // How many months the fund would last at the pace of the last twelve months (null when nothing has been paid out).
  function welfareCover(s, today) {
    const from = `${Number(today.slice(0, 4)) - 1}-${today.slice(5, 7)}-${today.slice(8, 10)}`;
    const out = (s.payouts || []).filter((p) => p.kind === "welfare" && p.date > from && p.date <= today).reduce((t, p) => t + p.amount, 0);
    return out ? balances(journal(s)).welfare / (out / 12) : null;
  }
  const fmtKES = (n) => "KES " + Math.round(n).toLocaleString("en-KE");

  // ---------- 3e. Checking the books against the real money ----------
  // `statementTotal` is what the bank, the paybill and the cash box really hold. The books say what they should hold.
  function reconcileCash(s, date, statementTotal) {
    const expected = Math.round(balances(journal(s), (e) => e.date <= date).cash), diff = Math.round(statementTotal - expected);
    return { expected, statement: Math.round(statementTotal), diff, status: Math.abs(diff) <= 1 ? "matched" : diff > 0 ? "statement_higher" : "statement_lower" };
  }

  // ---------- 3f. Financial statements ----------
  // Money in and out over a period, grouped in words, and the position at a date. Both come straight from the ledger.
  const RECEIPT = { savings: "Contributions", fines: "Fines", welfare: "Welfare contributions", mgr: "Merry-go-round pot contributions", loans_receivable: "Loan principal repaid", loan_interest: "Loan interest received" };
  const PAYMENT = { loans_receivable: "Loans given out", expenses: "Expenses", welfare: "Welfare payouts", mgr: "Merry-go-round pots paid out", mgr_advances: "Merry-go-round pots paid out" };
  function cashStatement(s, from, to) {
    const J = journal(s), a = `${from}-01`, b = `${to}-31`, receipts = {}, payments = {};
    J.filter((e) => e.date >= a && e.date <= b).forEach((e) => {
      const cash = e.lines.find((l) => l.acct === "cash");
      if (!cash) return;
      if (cash.dr > 0) e.lines.filter((l) => l.acct !== "cash" && l.cr > 0).forEach((l) => { const k = e.kind === "opening" ? "Balance brought forward from earlier records" : RECEIPT[l.acct] || l.acct; receipts[k] = (receipts[k] || 0) + l.cr; });
      if (cash.cr > 0) e.lines.filter((l) => l.acct !== "cash" && l.dr > 0).forEach((l) => { const k = PAYMENT[l.acct] || l.acct; payments[k] = (payments[k] || 0) + l.dr; });
    });
    const opening = balances(J, (e) => e.date < a).cash, closing = balances(J, (e) => e.date <= b).cash;
    const sum = (o) => Object.values(o).reduce((t, v) => t + v, 0), r = sum(receipts), p = sum(payments);
    return { from, to, opening, receipts, payments, totalReceipts: r, totalPayments: p, closing, reconciles: Math.abs(opening + r - p - closing) < 1 };
  }
  function position(s, date) {
    const b = balances(journal(s), (e) => e.date <= date);
    const assets = { "Cash in the chama account": b.cash, "Loans owed to the chama": b.loans_receivable, "Merry-go-round advances to members": b.mgr_advances };
    const funds = { "Member savings": b.savings, "Merry-go-round pot": b.mgr, "Welfare fund": b.welfare, "Fines collected": b.fines, "Loan interest earned": b.loan_interest, "Less expenses paid": -b.expenses };
    const sum = (o) => Object.values(o).reduce((t, v) => t + v, 0);
    return { date, assets, funds, totalAssets: sum(assets), totalFunds: sum(funds), balanced: Math.abs(sum(assets) - sum(funds)) < 1 };
  }

  // ---------- 3b. Expense approvals ----------
  const isOfficial = (m) => OFFICIALS.includes(m.role);
  // How many approvals an expense of this size needs under the group's policy.
  function approvalsNeeded(s, amount) {
    const g = s.policy.expense_governance;
    if (g.approval_policy === "treasurer_only") return 0;
    if (g.approval_threshold && amount <= g.approval_threshold) return 0;
    if (g.approval_policy === "multi_sig") return g.signatories_required;
    return Math.floor(s.members.length / 2) + 1; // majority_vote
  }
  // Who may approve: multi-sig needs officials other than the person who asked; a vote is open to every member.
  function eligibleApprovers(s, e) {
    const multi = s.policy.expense_governance.approval_policy === "multi_sig";
    const done = new Set([...(e.approvals || []), ...(e.rejections || [])].map((a) => a.memberId));
    return s.members.filter((m) => !done.has(m.id) && (multi ? isOfficial(m) && m.id !== e.draftedBy : true));
  }
  function createExpense(s, d) {
    s.expenses = s.expenses || [];
    const needed = approvalsNeeded(s, d.amount);
    const e = { id: d.id || Math.random().toString(36).slice(2, 10), date: d.date, amount: d.amount, description: d.description, draftedBy: d.draftedBy || "", receipt: d.receipt || "", category: d.category || "", needed, approvals: [], status: needed === 0 ? "approved" : "pending", approvedOn: needed === 0 ? d.date : "" };
    s.expenses.push(e);
    return e;
  }
  function approveExpense(s, id, memberId, on) {
    const e = (s.expenses || []).find((x) => x.id === id);
    if (!e || e.status !== "pending") return { ok: false, error: "That expense is not waiting for approval." };
    if (!eligibleApprovers(s, e).some((m) => m.id === memberId)) return { ok: false, error: "That person cannot approve this expense (not allowed, or already approved)." };
    e.approvals.push({ memberId, at: on });
    if (e.approvals.length >= e.needed) { e.status = "approved"; e.approvedOn = on; }
    return { ok: true, expense: e };
  }
  // Without a member: the request is withdrawn or turned down outright.
  // With a member: that person's "no" is recorded, and the expense is only declined once it can no longer reach
  // the approvals it needs (so one "no" does not end a vote that others can still carry).
  function rejectExpense(s, id, memberId, on) {
    const e = (s.expenses || []).find((x) => x.id === id);
    if (!e || e.status !== "pending") return false;
    if (!memberId) { e.status = "rejected"; return true; }
    if (!eligibleApprovers(s, e).some((m) => m.id === memberId)) return false;
    (e.rejections = e.rejections || []).push({ memberId, at: on });
    if (e.approvals.length + eligibleApprovers(s, e).length < e.needed) { e.status = "rejected"; e.rejectedOn = on; }
    return true;
  }

  const api = { MODELS, APPROVALS, OFFICIALS, ACCOUNTS, PRESETS, defaultPolicy, mergePolicy, loanTotal, journal, balances, check, allocate, shareOut, approvalsNeeded, eligibleApprovers, createExpense, approveExpense, rejectExpense, isOfficial, ATTENDANCE, createMeeting, meetingStats, attendanceCharge, chargesForMeeting, syncCharges, setAttendance, closeMeeting, attendanceRate, openActions, checkWelfareClaim, welfareCover, reconcileCash, cashStatement, position };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Engine = api;
})(typeof window !== "undefined" ? window : globalThis);
