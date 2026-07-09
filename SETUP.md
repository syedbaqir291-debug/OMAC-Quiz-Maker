# OMAC Quiz Launcher — Setup Guide

Two pieces: a Google Sheet + Apps Script (the backend/database) and one
`index.html` file (the whole app, hosted free on GitHub Pages).

## 1. Backend — Google Sheet + Apps Script

1. Create a new Google Sheet (any name, e.g. "OMAC Quiz Launcher DB").
2. Copy its **Sheet ID** from the URL:
   `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`
3. In the Sheet, go to **Extensions → Apps Script**.
4. Delete any starter code, paste in the full contents of `code.gs`.
5. Near the top, set:
   ```js
   const SHEET_ID = 'PASTE_YOUR_SHEET_ID_HERE';
   ```
6. In the function dropdown (top toolbar), select **setupSheet**, then click **Run**.
   - First run will ask you to authorize permissions — approve it (it's your own script).
   - This creates the `Users`, `Quizzes`, `Attempts` tabs and one admin account:
     - Email: `admin@omac.dev`
     - Password: `Admin@123`
     - **Log in and change this password immediately** via the Admin Dashboard's "Reset PW" on your own row, or the Forgot Password flow with DOB `2000-01-01`.
7. Click **Deploy → New deployment**.
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**, authorize again if prompted.
8. Copy the **Web app URL** (ends in `/exec`). You'll need it next.

> Any time you edit `code.gs` later, you must **Deploy → Manage deployments → Edit (pencil) → New version** for changes to go live — Apps Script doesn't auto-update the live URL otherwise.

## 2. Frontend — index.html

1. Open `index.html`, find this near the top of the `<script>` block:
   ```js
   const CONFIG = {
     SCRIPT_URL: 'PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE',
     OMAC_SITE: 'https://syedbaqir291-debug.github.io/OMAC/'
   };
   ```
2. Replace `SCRIPT_URL` with the `/exec` URL from step 8 above.
3. Push `index.html` to a GitHub repo (e.g. a new repo `OMAC-Quiz-Launcher`), enable **GitHub Pages** on it (Settings → Pages → Deploy from branch → `main` / root).
4. Your live tool will be at:
   `https://<your-username>.github.io/<repo-name>/`

## 3. Quiz upload format (shown in-app too)

```
Q1. What does QI stand for?
A) Quiz Item
B) Quality Improvement
C) Quick Insight
Answer: B

Q2. PDCA stands for Plan-Do-Check-Act.
Answer: True
```
- Every question must be followed by a line starting with `Answer:`.
- Multiple-choice: list `A)` `B)` `C)` `D)` option lines before the `Answer:` line.
- Open-ended: just question + `Answer:` — the taker types their answer, matched
  against the answer key (case-insensitive, exact match).

## 4. Limits & Admin controls

- New accounts: **5 quizzes max**, **60 questions max per quiz**.
- Log in as admin (`admin@omac.dev`) → **Admin** tab in the nav → adjust any
  user's Quiz Limit / Question Limit inline, or reset their password.
- Admin dashboard also shows total users, quizzes, questions, and attempts.

## 5. Notes

- Shareable quiz links look like:
  `https://<your-pages-url>/#/quiz/QZ_xxxxxxx`
- Anyone with the link can attempt the quiz — no login required for takers.
- Passwords are SHA-256 hashed client-side before ever reaching the Sheet
  (matches the pattern used across your other OMAC tools). This is a
  lightweight scheme suitable for an internal/community tool, not a bank.
- All data lives in your own Google Sheet — you can inspect, back up, or
  export it any time.
