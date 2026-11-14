// Builds a first draft of a chama's constitution from the rules it already uses in the app,
// so what the group writes down and what the app does cannot drift apart.
// Where the app cannot know the answer, the draft leaves a [bracketed placeholder] for the group to fill in.
// Pure functions: tested in Node. This is a starting point in plain language, not legal advice.
(function (root) {
  "use strict";
  const kes = (n) => "KES " + Math.round(n).toLocaleString("en-KE");
  const MODELS = {
    savings_proportional: "Each member's share of the income follows their share of everyone's savings.",
    time_weighted: "Each member's share of the income follows their savings and how long the money stayed in the Chama, so money saved earlier earns more.",
    equal: "The income is divided equally between all members, whatever they saved.",
  };

  // ctx: { name, amount, customAmounts, dueDay, graceDays, fineType, fineValue, welfareAmount, mgr:{used,separate,amount},
  //        approval:{policy,signatories,threshold}, meetings:{quorum,absentFine,lateFine,apologyExcused},
  //        welfare:{reserve,cap,maxClaims}, shareout:{model,fines,interest,welfare,returnSavings,deduct},
  //        loan:{rate,type}, officials:{chair,secretary,treasurer} }
  function buildConstitution(c) {
    const S = [], add = (id, title, text) => S.push({ id, title, text, custom: false });
    const name = c.name || "[name of the group]";
    add("name", "1. Name and purpose", `The name of the group is ${name} ("the Chama"). It is a self-help group of members who save and invest together. Its purposes are to help members save regularly, to lend to members, to support members in times of need, and to invest the Chama's money for the good of all members.`);
    add("membership", "2. Membership", `Membership is open to adults who agree to follow this constitution. New members are admitted by [a majority of the members at a meeting]. The Secretary keeps a register of members with their names and phone numbers. A member may leave by giving [one month's] notice. Their savings are returned [at the next share-out], after any money they owe the Chama has been settled.`);
    const grace = c.graceDays ? `, with ${c.graceDays} days of grace` : "";
    add("contributions", "3. Contributions", (c.amount > 0 ? `Each member pays ${kes(c.amount)} every month, by day ${c.dueDay || 5} of the month${grace}.` : `Each member pays [monthly amount] every month, by day ${c.dueDay || 5} of the month${grace}.`)
      + (c.customAmounts ? " Members whose circumstances differ may agree a different monthly amount with the group. Each member's amount is recorded in the register." : "") + " Every payment is recorded in the Chama's ledger and the member is given a receipt.");
    const late = c.fineType === "flat" ? `A member who pays after the due date pays a fine of ${kes(c.fineValue)}.` : c.fineType === "daily" ? `A member who pays after the due date pays a fine of ${kes(c.fineValue)} for each day late.` : c.fineType === "percent" ? `A member who pays after the due date pays a fine of ${c.fineValue}% of the contribution.` : "No fine is charged for late contributions.";
    const mt = c.meetings || {}, att = [];
    if (mt.absentFine) att.push(`a member who is absent from a meeting pays ${kes(mt.absentFine)}`);
    if (mt.lateFine) att.push(`a member who arrives late pays ${kes(mt.lateFine)}`);
    add("fines", "4. Fines", `${late} ${att.length ? `At meetings, ${att.join(", and ")}. ${mt.apologyExcused ? "A member who sends an apology before the meeting pays no fine." : "An apology does not remove the fine."}` : "No fines are charged for attendance."} Fines are recorded in the ledger and reported to members.`);
    add("meetings", "5. Meetings", `The Chama meets [every month]. A meeting can take decisions only when at least ${mt.quorum || 50}% of members are present (the quorum). Notice of a meeting is given at least [7 days] before it. The Secretary keeps minutes, and each decision is recorded against the item on the agenda. Minutes are read and agreed at the next meeting.`);
    const o = c.officials || {}, who = (r, v) => (v ? ` (currently ${v})` : "");
    add("officials", "6. Officials", `The officials are the Chairperson${who("chair", o.chair)}, the Secretary${who("secretary", o.secretary)} and the Treasurer${who("treasurer", o.treasurer)}. They are elected by the members for [a term of two years] and may be removed by [a vote of two thirds of members]. The Chairperson leads meetings. The Secretary keeps the register and the minutes. The Treasurer receives and records money and reports on it at every meeting.`);
    const ap = c.approval || {}, th = ap.threshold > 0 ? `Expenses of ${kes(ap.threshold)} or less may be paid on the Treasurer's authority and are reported at the next meeting. For larger expenses, ` : "";
    const rule = ap.policy === "multi_sig" ? `${th}${ap.signatories} officials, other than the person who recorded the expense, must approve it before it is paid.` : ap.policy === "majority_vote" ? `${th}more than half of the members must approve the expense before it is paid.` : "The Treasurer may record expenses and reports them at each meeting.";
    add("money", "7. Money and expenses", `All money received is recorded in the Chama's ledger. The Chama's money is kept in [bank or M-Pesa account name and number]. ${rule} The Treasurer checks the ledger against the bank and M-Pesa statements at least [every month] and reports the result to members.`);
    const ln = c.loan || {}, terms = ln.rate ? `Loans currently carry interest of ${ln.rate}% a month on a ${ln.type === "reducing" ? "reducing balance" : "flat"} basis.` : "Interest is [rate]% a month, charged on a [flat or reducing balance] basis.";
    add("loans", "8. Loans", `Members may borrow from the Chama. A loan may be up to [number] times the borrower's savings. ${terms} A loan is repaid within [number] months. Loans are approved by [the officials, or the members at a meeting]. A member who falls behind on a loan [pays a penalty of ...] and may have what they owe taken from their savings or share-out.`);
    const g = c.mgr || {};
    if (g.used) add("mgr", "9. Merry-go-round", g.separate ? `Members pay ${g.amount ? kes(g.amount) : "[amount]"} a month into a separate merry-go-round pot. Each month the pot is given to one member, in an order agreed or drawn at a meeting. This money is separate from savings.` : "Each month the pot is paid out of the monthly contributions to one member, in an order agreed or drawn at a meeting. What a member has received is counted as taken from their savings until the cycle is complete.");
    const w = c.welfare || {};
    if (c.welfareAmount > 0 || w.reserve || w.cap || w.maxClaims) {
      const lim = [w.reserve ? `the fund must not fall below ${kes(w.reserve)}` : "", w.cap ? `one claim may not be more than ${kes(w.cap)}` : "", w.maxClaims ? `a member may make at most ${w.maxClaims} claim${w.maxClaims === 1 ? "" : "s"} a year` : ""].filter(Boolean);
      add("welfare", "10. Welfare fund", `${c.welfareAmount > 0 ? `Each member pays ${kes(c.welfareAmount)} a month into the welfare fund.` : "A welfare fund is kept for members in times of need."} Claims are approved by [the officials or the members]. ${lim.length ? `To protect the fund, ${lim.join(", ")}.` : "The group may set a reserve and limits on claims."} A claim above these limits needs the approval of the members at a meeting, with the reason recorded.`);
    }
    const s = c.shareout || {};
    add("shareout", "11. Year-end share-out", `At the end of each financial year the Chama shares out its income. ${MODELS[s.model] || MODELS.savings_proportional} The income counted is ${[s.interest !== false ? "loan interest" : "", s.fines !== false ? "fines" : "", s.welfare ? "the unused welfare surplus" : ""].filter(Boolean).join(", ") || "[income to be shared]"}, less the Chama's expenses. ${s.deduct !== false ? "Money a member still owes the Chama is taken from their payout. " : ""}${s.returnSavings !== false ? "Each member also receives their savings back." : "Savings stay in the Chama; only the share of income is paid out."}`);
    add("disputes", "12. Disagreements and discipline", "A disagreement is first discussed by the officials. If it is not settled, it goes to a general meeting. A member who repeatedly breaks this constitution may be [warned, fined or suspended] by [a majority of members].");
    add("changes", "13. Changing this constitution and closing the Chama", "This constitution can be changed only at a meeting where the quorum is present, by [two thirds] of the members present, and the change is recorded in the minutes. If the Chama is closed, its debts are paid first. Each member then receives their savings and a share of what remains, as set out in the share-out rule, after informing [the Social Development Officer].");
    return S;
  }
  const PLACEHOLDER = /\[[^\]]+\]/g;
  const placeholders = (sections) => sections.flatMap((s) => (s.text.match(PLACEHOLDER) || []).map((p) => ({ section: s.title, text: p })));
  const fullText = (sections) => sections.map((s) => `${s.title}\n${s.text}`).join("\n\n");

  const api = { buildConstitution, placeholders, fullText };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Constitution = api;
})(typeof window !== "undefined" ? window : globalThis);
