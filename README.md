<p align="center">
  <img src="logo.svg" alt="Chama Ledger logo" width="96">
</p>

<h1 align="center">Chama Ledger</h1>

<p align="center">
  One shared, trustworthy record for Kenyan chamas: contributions, fines, loans, welfare and the merry-go-round.
</p>

<p align="center">
  <a href="https://YOUR-USERNAME.github.io/chama-ledger/">Live demo</a>
</p>

![Dashboard screenshot](docs/dashboard.png)

> Replace `YOUR-USERNAME` in the live demo link above once GitHub Pages is on.

## Screenshots

| Loans | Merry-go-round and welfare |
|---|---|
| ![Loans](docs/loans.png) | ![Funds](docs/funds.png) |

| Members | On a phone |
|---|---|
| ![Members](docs/members.png) | <img src="docs/mobile.png" alt="Dashboard on a phone" width="260"> |

The screenshots show the built-in demo data (a made-up group), not real members.

## The problem

Chamas (savings groups) move a lot of money every month, but most keep their records in three places: **ledger books, WhatsApp chats and Word documents**. That causes the same problems again and again:

- Members dispute whether they paid, and nobody can prove it.
- M-Pesa codes get lost in message threads.
- The treasurer calculates fines, loan interest and the merry-go-round by hand.
- When a treasurer leaves, the history leaves with them.

Chama Ledger replaces the notebook with one record that anyone in the group can check.

## Features

**Contributions**
- Fixed contributions, or an **own monthly amount for each member** for groups where people pay what they can afford.
- Arrears worked out per member from the group's start month.
- Payments by **M-Pesa or cash**. A **duplicate M-Pesa code is rejected**, which prevents most disputes.
- **Balance brought forward** for members who paid before the group started using the app.

**Fines, welfare and loans**
- **Late fines** with rules set per chama: due day, grace days, and a flat amount, an amount per day late, or a percent of the contribution.
- **Welfare fund** with monthly collection, a balance and payouts with reasons.
- **Loans with interest**, either flat or reducing balance, with instalments, repayments and the balance still owed.

**Merry-go-round**
- Rotation order you can reorder or draw at random, a list of past and coming rounds with the pot, and a record of each payout.

**Dashboard**
- Overview cards, a six-month collections chart with a target line, a progress ring, biggest arrears and latest payments.
- Member search and filters (paid, not paid, in arrears), plus a member profile with history.
- **WhatsApp reminder** button that opens a ready-written message for a member who owes money.

**Bringing in existing records**
- **Paste WhatsApp or M-Pesa messages.** The app finds the M-Pesa code, amount, date and sender, with a preview before saving.
- **Paste a table from Word or Excel**, with months across the top and member names down the side.
- Every import shows a preview where you can fix details, and duplicates are flagged and skipped.

**Data**
- CSV export of all payments.
- A **Load demo data** button that fills the app with sample data.

## How to run

No install and no build step. You only need a browser.

1. Download or clone the repository.
2. Open `index.html`.
3. Go to **Settings**, then click **Load demo data** to explore, or enter your group's details.

```bash
git clone https://github.com/YOUR-USERNAME/chama-ledger.git
cd chama-ledger
# then open index.html in your browser
```

## How data is stored

Everything is saved in your browser's `localStorage`. There is no server, and nothing leaves your device. This is fine for trying the app out, but it means:

- Data lives on one device and one browser only.
- Clearing browser data erases it, so use **Download payments (CSV)** to keep a copy.
- Please don't commit real member names, phone numbers or exported CSV files to this repository.

A shared database with logins is the next phase (see the roadmap).

## Importing your records

**WhatsApp or M-Pesa messages.** Paste one message per line. Each line needs a 10-character M-Pesa code, for example `SJK4X9ABCD`:

```
SJK4X9ABCD Confirmed. Ksh2,000.00 received from WANJIKU KAMAU 0712000001 on 5/11/26
```

**Tables from Word or Excel.** The first row has the months (`Jan`, `Feb` or `2026-01`), the first column has names, and the cells hold the amount paid:

```
Name              Jan    Feb    Mar
Wanjiku Kamau     2000   2000
Otieno Odhiambo   2000          2000
```

Records imported from a table have no payment date, so they are treated as paid on the due date and don't produce late fines.

## Project structure

```
chama-ledger/
├── index.html   Page layout: dashboard, members, payments, loans, funds, import, settings
├── style.css    All styling, including the mobile layout
├── app.js       Logic: data, money rules, rendering, import, demo data
├── logo.svg     Logo and favicon
├── docs/        Screenshots used in this README
└── README.md
```

Plain HTML, CSS and JavaScript, with no frameworks or libraries. The charts are drawn as SVG by `app.js`.

## Roadmap

- [x] Dashboard, members, payments and CSV export
- [x] Import from WhatsApp messages and Word or Excel tables
- [x] Own monthly amounts, late fines, welfare fund, loans and merry-go-round
- [ ] Fine cap setting
- [ ] Loan limits and guarantors
- [ ] Year-end share-out of savings and interest
- [ ] Backend and database, so a whole group shares one record
- [ ] Member logins and roles (treasurer, official, member)
- [ ] M-Pesa STK push for contributions
- [ ] Automatic SMS and WhatsApp reminders
- [ ] Printable monthly statements

## Built from field research

The features come from conversations with real chamas. So far:

- Records are kept in ledger books, WhatsApp chats and Word documents.
- Some chamas fix the contribution and others set it by what each member can afford.
- Late fines exist and differ from one chama to the next.
- Most chamas run a merry-go-round, some have a welfare fund, and most give loans with interest.

More research is under way, and the rules in the app will keep following what chamas actually do.

## Author

**Ryan Otieno**, graphic designer and software development student, Nairobi, Kenya. Chama Ledger is a portfolio project built to solve a real problem for community savings groups.

## Contributing and feedback

Treasurers and chama members: if the rules in your group are not covered here, please open an issue and describe how your chama handles them.
