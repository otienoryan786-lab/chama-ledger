const I = require('../insights.js');
const assert = require('assert'); let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const base = () => ({ memberCount: 4, monthLabel: '2026-11', members: [
  { name: 'A', paidThisMonth: true, monthsBehind: 0 }, { name: 'B', paidThisMonth: true, monthsBehind: 0 },
  { name: 'C', paidThisMonth: true, monthsBehind: 0 }, { name: 'D', paidThisMonth: true, monthsBehind: 0 }],
  loans: [], loansOut: 0, savings: 40000, cash: 40000, booksBalanced: true, cashNegative: false, pending: { count: 0, amount: 0 } });

t('a healthy chama scores 100 and says so', () => { const h = I.healthScore(base()); assert.equal(h.score, 100); assert.equal(h.label, 'Strong'); const i = I.buildInsights(base()); assert.equal(i[0].level, 'good'); assert(i[0].text.includes('Everyone is paid up')); });
t('no members: no score, and a nudge to add some', () => { const s = base(); s.memberCount = 0; s.members = []; assert.equal(I.healthScore(s).score, null); assert.equal(I.buildInsights(s)[0].view, 'members'); });
t('members behind lower the score and are flagged first', () => { const s = base(); s.members[0] = { name: 'A', paidThisMonth: false, monthsBehind: 3 }; s.members[1] = { name: 'B', paidThisMonth: false, monthsBehind: 1 };
  const h = I.healthScore(s); assert.equal(h.parts[0].points, 20); assert.equal(h.parts[1].points, 17); // 4 months behind of a possible 12: 25 x 2/3, rounded assert(h.score < 85);
  const i = I.buildInsights(s); assert.equal(i[0].level, 'bad'); assert(i[0].text.includes('A')); assert(i.some((x) => x.level === 'warn' && x.text.includes('B'))); assert(!i.some((x) => x.level === 'good' && x.text.includes('Everyone'))); });
t('loans behind schedule are reported and cost points', () => { const s = base(); s.loans = [{ name: 'A', behindBy: 3733, balance: 15000 }, { name: 'B', behindBy: 0, balance: 5000 }]; const h = I.healthScore(s); assert.equal(h.parts[2].points, 13); const i = I.buildInsights(s); assert(i.some((x) => x.text.includes("A's loan is KES 3,733 behind"))); });
t('unbalanced books and short cash are flagged', () => { const s = base(); s.booksBalanced = false; assert.equal(I.healthScore(s).parts[3].points, 5); assert(I.buildInsights(s).some((x) => x.level === 'bad' && x.view === 'ledger')); const c = base(); c.cashNegative = true; assert(I.buildInsights(c).some((x) => x.level === 'warn' && x.text.includes('more than the money'))); });
t('a loan book above 80% of savings and pending expenses are mentioned', () => { const s = base(); s.loansOut = 36000; s.pending = { count: 2, amount: 9000 }; const i = I.buildInsights(s); assert(i.some((x) => x.text.includes('90% of savings'))); assert(i.some((x) => x.view === 'expenses' && x.text.includes('KES 9,000'))); });
t('long lists are shortened and the list is capped', () => { const s = base(); s.memberCount = 8; s.members = 'ABCDEFGH'.split('').map((c) => ({ name: c, paidThisMonth: false, monthsBehind: 2 })); const i = I.buildInsights(s); assert(i[0].text.includes('and 5 more')); assert(i.length <= 7); });
t('labels follow the score bands', () => { assert.equal(I.labelFor(90), 'Strong'); assert.equal(I.labelFor(70), 'Steady'); assert.equal(I.labelFor(50), 'Needs attention'); assert.equal(I.labelFor(10), 'At risk'); });
console.log(n + ' insight tests passed');
