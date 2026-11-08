# Competitor research

Researched in November 2026 from public pages: app-store listings, the products' own help centres and websites, news articles and sector reports. Pricing and features change, so check each provider before relying on this. "Vendor claims" are marketing statements and are not independently verified.

## Who is solving this problem

| Product | What it is | What its own pages say it offers |
|---|---|---|
| **Chamasoft** | The best-known chama platform. Web, Android and iOS. | Dashboard with cash, contributions, fines and expenses; member directory; meetings (agendas, minutes, attendance); loan products and repayment schedules; automated fines; financial reports; SMS and email; an M-Pesa e-wallet for payments and withdrawals. Its site shows a free plan; older press reports gave per-member monthly prices. Sources: [help centre](https://help.chamasoft.com/?p=17), [MIT Solve profile](https://solve.mit.edu/solutions/85265), [App Store listing](https://apps.apple.com/ec/app/chamasoft/id1489712788) |
| **Kikundify** | Free "paperless" chama app on Android. | Merry-go-round, goal and welfare contributions, loans to members. Source: [Google Play](https://play.google.com/store/apps/details?id=app.kikundify.com) |
| **MyChama.app** | Chama platform built around M-Pesa. | Says M-Pesa payments are confirmed and logged in real time. Its blog also quotes a figure from FSD Kenya that 13% of chama members have had a financial dispute (vendor claim). Source: [vendor blog](https://mychama-marketing.pages.dev/blog/why-your-chama-needs-digital-tools) |
| **OneKitty** | Group contributions and fundraising. | Create a group, invite by link or phone number, collect by M-Pesa. Claims 2,000+ chamas. Source: [onekitty.co.ke](https://onekitty.co.ke/) |
| **Stanbic Chama App** | A bank's chama app (iPhone). | Identity-verified profiles; groups set their own loan interest and loan rules. Source: [App Store](https://apps.apple.com/us/app/id1564047823) |
| **Zimele ChamaManager** | Chama management tied to a regulated unit trust. | Management plus a Capital Markets Authority-regulated savings plan. Source: [Business Today](https://businesstoday.co.ke/?p=121578) |
| **Nobuk Africa** | Chama automation platform. | Reports 700+ groups. Source: [Capital FM](https://capitalfm.africa/tech-firm-nobuk-africa-streamlines-chama-operations-with-digital-solutions/) |
| **Excel and Word templates** | Cheap do-it-yourself kits sold online. | Fund balance, loan tracker, merry-go-round payout schedule. Source: [Selar listing](https://selar.com/7by714130o) |
| **Digital savings-group apps (other countries)** | MiKashBoks (Sierra Leone), CARE's Sanchay Sathi (India), Tearfund-supported groups. | Offline-first ledgers, automatic calculations and error checks, simpler share-outs. They report that share-out is where groups make the most mistakes. Sources: [AVSI](https://www.avsi.org/en/news-and-press/news/empowering-village-savings-and-loans-associations-through-digitalization-in-sierra-leone), [CARE](https://care.org/wp-content/uploads/2024/07/CARE_Brief-3_Sanchay-Sathi_Digital.pdf), [Tearfund](https://learn.tearfund.org/en/resources/footsteps/footsteps-121-130/footsteps-123/digital-savings-groups) |

## What the research suggests

1. **The market competes on collecting money and sending messages.** M-Pesa wallets, automatic payment matching and SMS are the headline features of the larger products.
2. **Most products need an account, a connection and a provider that holds the group's data.** That suits groups that want payments handled for them. It leaves a gap for groups that want privacy, no sign-up or no subscription.
3. **Each chama computes things differently** (fines, merry-go-round, loan interest, share-out), and products tend to offer standard options. Share-out is repeatedly named as the hardest and most error-prone step.
4. **Meetings matter.** One sector write-up warns that fully digital groups can lose the social contact that holds a savings group together, so a tool should support meetings, not replace them.
5. **Privacy law applies.** Kenya's Data Protection Act, 2019 covers anyone who collects and stores members' personal data. Hosting member records on a server brings duties such as consent and, depending on size, registration with the Office of the Data Protection Commissioner. Chama Ledger keeps data on the user's own device today. A server-based version will need a privacy notice, consent and legal advice. Sources: [ODPC](https://www.odpc.go.ke/data-protection-compliance/), [Act text](https://www.odpc.go.ke/wp-content/uploads/2024/02/TheDataProtectionAct__No24of2019.pdf)

## Where Chama Ledger is different

| Gap in the market | What Chama Ledger does |
|---|---|
| Needs an account and a connection | Opens in a browser, needs no sign-up, and installs on a phone and **works offline** |
| The provider holds the group's data | Data stays **on the user's device** by default |
| Standard rules only | A **policy per chama**: templates, merry-go-round as its own pot or from savings, approval rules, three share-out models and any financial year |
| Records are trapped in WhatsApp, Word and notebooks | **Imports** pasted WhatsApp or M-Pesa messages and tables from Word or Excel, with a preview |
| "Trust me" statements | **Explains every figure** ("Why is this the amount?"), keeps a **balanced, searchable ledger** and shows a health score with plain-language insights |
| Members cannot check their own record without a login | A **statement link** any member can open on their own phone, with no account |
| Year-end is a nasty surprise | A **projection** of what each member will get if the year ended today, and what they will get if members keep paying |
| Spreadsheets cannot be tested | The rules are **automatically tested** on every change |

## Where competitors are ahead today

Being honest about this shapes the roadmap:

- **Automatic M-Pesa collection and payment matching.** Chama Ledger records payments; it does not take them yet.
- **SMS and push notifications.** Chama Ledger opens WhatsApp messages for you to send in one tap.
- **Real member logins**, so each official can approve from their own phone.
- **Meetings:** agendas, minutes and attendance fines.
- **Store-listed mobile apps and customer support.**

## What this means for the roadmap

1. A small backend with logins and roles, so approvals become verifiable and members can see their records in real time.
2. M-Pesa STK push and payment matching, with automatic confirmation.
3. Meetings: attendance, attendance fines and printable minutes.
4. A privacy notice, consent records and a data-protection review before any member data is held on a server.
