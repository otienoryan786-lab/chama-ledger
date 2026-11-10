# Design notes

Chama Ledger is used by treasurers on a phone, often in a meeting, and by members who may check it once a month. The design has to be calm, quick to scan and trustworthy with money. These notes record the thinking so changes stay consistent.

## Principles

1. **Money first.** Figures are the hero: large, aligned and easy to scan. Everything else supports them.
2. **One signature.** The logo is a circle of members around a shared pot. That idea is used again as **The circle** on the Overview: every member is a dot, coloured by whether they have paid, and the person who takes the pot is ringed. It is the one thing nobody else's dashboard looks like.
3. **Say it in words.** Colour is never the only signal. Statuses are badges with text, the circle's dots have names and labels, and the health panel explains itself in plain sentences.
4. **Phone first.** A tab bar for the four things used most, a sheet for everything else, tables that become cards, and touch targets of at least 38px.
5. **Show less until needed.** Add-forms fold away once a list has items, and open by themselves when it is empty.

## What changed, and why

| Before | Problem | Now |
|---|---|---|
| 12 flat, text-only sidebar items | Hard to scan, no sense of where things live | Grouped under **Money, Group, Records and Your chama**, each with its own icon |
| Sideways-scrolling bottom bar on phones | Most pages were hidden off-screen | A 5-tab bar (Home, Members, Payments, Meetings, More) and a full-page sheet |
| Eight equal cards | Nothing said what matters | Four large headline figures (with a trend line and a progress meter) and four smaller ones |
| Generic dashboard | Looked like any other template | **The circle**, taken from the logo |
| Names as plain text, status as coloured words | Slow to read, colour-only meaning | Initial avatars and text badges |
| Add-forms always open | Pushed the actual content down | Folding forms |
| Wide tables on phones | Sideways scrolling | Cards with labelled rows |
| Empty lists showed a grey sentence | Felt unfinished | A small illustration in the brand motif |
| Greeting-less page title | Impersonal | A time-of-day greeting with the group name and date |

## Tokens

Defined in `design.css`, with a dark theme alongside.

- **Colour:** navy `#0f2438` for ink and structure, gold `#f2a900` for emphasis and primary actions, green and red only for paid and owed. Tints are mixed from the same colours, so the palette stays tight.
- **Type:** Bricolage Grotesque for headings and large figures (distinctive, slightly warm) and IBM Plex Sans for reading. Figures use tabular numerals so columns line up.
- **Shape:** 8, 12 and 18px radii, one soft shadow, one focus ring.
- **Motion:** short and purposeful (dots pop in, figures count up, the gauge fills). All of it stops when the device asks for reduced motion.

## Components

| Component | Where it lives |
|---|---|
| Icon set (about 25 icons, drawn on a 24-point grid) | `design.js` |
| Avatar (initials, a colour that is always the same for the same name) | `design.js`, `design.css` |
| Badge (ok, bad, warn, info) | `design.css` |
| The circle | `design.js` (`renderCircle`) |
| Figure decorations: icon chip, trend line, meter | `design.js` (`decorateStats`) |
| Folding add-form | `design.css` (`details.fold`), `design.js` (`syncFolds`) |
| Stacked table (cards on phones) | `design.css` (`table.stack`), `design.js` (`autoLabel`) |
| Tab bar and sheet | `design.js`, `design.css` |
| Command palette, toasts with undo | `ui.js` |

## Accessibility

- Skip link to the main content, a visible focus ring everywhere and full keyboard use, including the circle (Tab to a dot, Enter to open).
- Icons are decorative and hidden from screen readers. Every icon-only button has a label.
- Statuses carry text, not just colour.
- Motion is switched off for people who ask for that.
- Light, dark and automatic themes, with contrast checked on both.

## Still to do

- Replace the browser's date and month pickers with a custom picker that matches the design.
- An onboarding walk-through for a brand-new chama.
- A shared look for the welcome page, which currently keeps its own stylesheet.
