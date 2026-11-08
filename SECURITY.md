# Security

## What is and is not in this repository

- The repository holds only the app's front-end code (HTML, CSS and JavaScript) and screenshots built from made-up demo data.
- It holds **no passwords, API keys, M-Pesa credentials or real member data**, and it must stay that way.
- A chama's records are saved in the user's own browser (`localStorage`). They are never sent to a server and never reach this repository.

## Rules for contributors (and for the author)

1. Never commit secrets: passwords, tokens, API keys, M-Pesa consumer keys or passkeys. They belong in environment variables on the server, never in front-end code.
2. Never commit real member names, phone numbers or exported CSV files. `.gitignore` blocks `*.csv`, `*.xlsx`, `.env` and key files, but check `git status` before every commit.
3. Anything that must be trusted (logins, who may see which chama, M-Pesa calls, final calculations) belongs on a server that checks every request. Code that runs in the browser can always be read and changed by the person using it.
4. Keep the security headers in `_headers` and the Content-Security-Policy in the HTML pages. They limit what a page can load, which reduces the damage from a malicious script.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use the **Report a vulnerability** button under the repository's **Security** tab (private reporting), and describe what you found and how to reproduce it.

## Statement links

A member statement link carries the member's figures inside the link (after the `#`), so nothing is sent to a server when it is opened. Anyone who holds the link can read it. Send it only to the member concerned, and remember it is an unsigned copy made on the date shown.
