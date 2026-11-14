# From the strategy text to the product

This maps each idea in the strategy text to what exists in Chama Ledger today, what is only partly possible without a server, and what comes next. It is deliberately honest about the limits of an app that runs on a phone with no server, because members' trust is the whole point.

## A note on the numbers

The text opens with a claim that over 10% of chamas fail because of mismanagement or theft. I could not find a source for that figure. The nearest number in the research is a statistic quoted by one vendor's blog (13% of members having had a financial dispute), and that is a vendor claim. Do not quote either figure as fact in marketing until you have a source you can name.

## What each idea became

| Challenge | Idea in the text | Status | What was built, or what is needed |
|---|---|---|---|
| **Trust and embezzlement** | Live bank and paybill reconciliation | **Interim built** | The **Reconcile** page: count the bank, paybill and cash, compare with what the ledger says should be there, keep a history of checks, and compare a pasted M-Pesa statement with the records (missing, different amount, not in statement). A true live connection needs a server plus Safaricom Daraja or bank APIs and their approvals. |
| | Immutable, time-stamped audit log with user ID | **Built (tamper-evident)** | The **Audit trail**: every change is logged with time and who, in a chain where each entry holds a fingerprint (SHA-256) of the one before. Changing, removing or reordering an entry breaks the chain, and changes made outside the app are found when it opens. **Checkpoint codes** shared on WhatsApp let anyone later prove the past was not rewritten. A device cannot offer true immutability, because a determined person can rebuild a chain. The checkpoint is what makes that detectable. A server is needed for real immutability. |
| | One-tap WhatsApp verification | **Built** | A **receipt** for every payment, sent to the member on WhatsApp in one tap. Approval requests and checkpoint messages use the same one-tap pattern. |
| **Legal identity and banking** | One-click compliance reporting | **Built** | **Documents:** a member list with space for ID numbers and signatures, founding minutes, a bank-account resolution, financial statements (money received and paid, and position), and an annual report. Requirements and fees are set by the office or bank, so each document is a starting point to check with them. National ID numbers are never stored. |
| | Digital constitution engine | **Built** | A constitution drafted **from the group's own rules**, so the app and the document cannot disagree. Edit it, adopt it (who approved, which date, a fingerprint of the exact text) and print it for signatures. The adoption is a record, not a claim of legally valid e-signatures. |
| **Credit score and capital** | Group reliability score | **Built** | A **track record** with a 0 to 100 score, six measures, a statement of how many months of records it rests on, and a printable report that names no members. It is not a credit rating. It rewards an intact audit trail. |
| | Sharing the score with SACCOs and banks | **Needs partners and a server** | Needs agreements with lenders and a way to confirm records independently. For now the printed report points the lender to the group's bank statements and checkpoints. |
| **Investments** | Asset tracker and due-diligence checklist | **Planned next** | Needs ledger changes (assets, income, valuations, unit ownership per member) and careful wording so it is not mistaken for financial advice. |
| **Literacy and access** | USSD and SMS for basic phones | **Needs a server and a partner** | Needs a shortcode, a telecom or aggregator account and a backend. |
| | Kiswahili and English | **Planned next** | The visual signals already exist (the circle, bars and status badges). Translation should be done with a native speaker, because financial words matter. |
| **Welfare crises** | Reserve buffer, claim controls | **Built** | Welfare **reserve**, **claim cap** and **claims per member per year**. A claim that breaks a rule shows which one, and goes ahead only with a recorded reason. The Funds page shows the months of cover at the recent pace, and the health panel warns when the fund is below its reserve. |

## Phases, adjusted to what is true

| Phase | Focus | Already built | Still to do |
|---|---|---|---|
| **1: Trust and governance** | Approvals, audit, verification | Multi-signature and majority approvals, tamper-evident audit trail with checkpoints, WhatsApp receipts and requests, reconciliation | Verified approvals from each official's own phone (needs logins) |
| **2: Automation and inclusion** | Money in, wider access | Auto share-out, calculators, statement checks | A backend with logins, M-Pesa collection and live matching, USSD and SMS, Kiswahili |
| **3: Ecosystem** | Capital and growth | Track record report, constitution and registration pack | Lender integrations, investments tracker, a signed and verifiable track record |

## Privacy

Everything above runs on the user's own device. When a server arrives, the Kenya Data Protection Act, 2019 applies to the member data it holds: a privacy notice, member consent and, depending on size, registration with the Office of the Data Protection Commissioner. Take legal advice before then.
