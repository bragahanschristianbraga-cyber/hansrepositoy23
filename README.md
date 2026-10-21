# Scholarship Monitoring and Academic Compliance System
**SAD Laboratory Examination - Section B** | React (Vite) + Supabase (Postgres, Auth, Row Level Security) | green and white UI

A browser-based minimum viable system with two roles. **Scholars** submit semester academic summaries with a grade-document reference and follow the status. **Scholarship Staff** verify evidence, evaluate policy compliance with reasons, and record renewal decisions. The Registrar remains the source of official grades; this app never changes official grades or releases payments. Use synthetic records only.

## What is inside

| Folder or file | Purpose |
|----------------|---------|
| `src/` | React app: sign in, scholar portal, staff workspace (Dashboard, Scholars, Policies, Activity log) |
| `supabase/01_schema.sql` | Tables, keys, default policy records, Row Level Security, and the database functions that enforce every rule |
| `supabase/02_seed.sql` | Six seeded scholars B01 to B06 (AY 2026-2027, Semester 1). Re-run to reset |
| `supabase/03_make_staff.sql` | Makes `staff@sad.test` a staff user and links the two scholar test accounts |
| `supabase/04_run_tests.sql` | Runs TC01 to TC10 against the real backend and prints the results table |
| `docs/analysis_report.md` | Part I: A1 to A6, UML use case diagram, two detailed use cases, ERD, traceability (also exported as `.docx`) |
| `docs/test_results.md` | Results table to complete, plus screenshot checklist |
| `evidence/` | Your screenshots |

## Setup (about 10 minutes)

1. **Create a Supabase project** at supabase.com (free tier is fine).
2. **Turn off e-mail confirmation** (Authentication > Providers > Email > "Confirm email" off) so test accounts can sign in right away.
3. Open **SQL Editor** and run, in order: `supabase/01_schema.sql`, then `supabase/02_seed.sql`.
4. Go to **Authentication > Users > Add user** (tick *Auto Confirm User*) and create three accounts. Choose your own passwords and give them to the instructor privately; never put them in code or screenshots.
   - `staff@sad.test` (Scholarship Staff)
   - `scholar1@sad.test` (becomes scholar B01, Alyssa Reyes)
   - `scholar2@sad.test` (becomes scholar B02, Brandon Cruz)
5. Run `supabase/03_make_staff.sql` in the SQL Editor. The result table should show staff, and scholar1 and scholar2 linked to 2026-B01 and 2026-B02.
6. In the project root, copy `.env.example` to `.env` and fill in the **Project URL** and **anon public key** (Project Settings > API).
7. In VS Code open the folder, open a terminal, and run:

```bash
npm install
npm run dev
```
Open the printed address (usually http://localhost:5173).

### Environment variable names
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (anon key only; the service-role key is never used and must never be committed). `.env` is git-ignored.

## Using the system

**Scholar** (`scholar1@sad.test`): see your program requirements and deadline, submit grades, track Evidence / Compliance / Renewal badges, read staff reasons, correct and resubmit a returned record, and open the history of each submission.

**Staff** (`staff@sad.test`):
- *Dashboard*: pick academic year and semester; see assigned scholars, pending verification, compliant, and with deficiency; search by student ID or name; filter by program, compliance, or evidence status. Click a row to open the review window: **1 Verify** or return with a reason, **2 Run evaluation**, **3 Save renewal decision** (approval needs Compliant), and the history.
- *Scholars*: register a scholar (the e-mail links their login automatically) and assign a program.
- *Policies*: edit thresholds and deadline stored in the database. Re-run an evaluation after changing them.
- *Activity log*: every submission, verification, evaluation, renewal, registration, and policy change with actor and time.

## How the rules are enforced (backend, not just buttons)
- Row Level Security: scholars can read only their own scholar record, submissions, and history; staff can read all. There are **no** insert, update, or delete policies, so a browser cannot write tables directly.
- All changes go through database functions (`submit_grades`, `resubmit_grades`, `verify_submission`, `evaluate_submission`, `decide_renewal`, `register_scholar`, `assign_program`, `update_program`). They check the caller's role, validate input, block evaluation until Verified, refuse Approved unless Compliant, and write the audit log.
- Thresholds are read from the `programs` row inside `evaluate_submission`; no policy numbers are duplicated in code.
- Duplicate prevention: unique key on `(scholar_id, academic_year, semester)`. Roles are never taken from client data; the sign-up trigger always creates a scholar.
- Deadlines use Asia/Manila (UTC+8). Exactly 2026-11-06 17:00:00 is on time; any later instant is late.

## Running the tests
1. Run `supabase/04_run_tests.sql`. It impersonates staff and scholars at the database level and prints TC01 to TC10 with PASS or FAIL.
2. Repeat each case in the app and capture screenshots in `evidence/`.
3. Fill in `docs/test_results.md`. Run `02_seed.sql` again to reset the seed data.

## Design assumptions (state these if asked)
- A corrected (resubmitted) record keeps its **original** submission time for lateness, so correcting evidence cannot make an on-time record late or hide a late one.
- Evaluating again, re-verifying, or resubmitting resets the renewal decision to Pending, so a decision never outlives the evidence it was based on.
- Holding a renewal requires a note; approving does not.
- The award status is stored and displayed separately (Active by default). Evaluation and renewal never change it automatically.
- Evidence is a text reference (file name, link, or code), as the exam asks for a reference rather than a file upload.

## Known defects
None found in the database tests run during preparation. Record anything you find in `docs/test_results.md`.

## Hosting (optional)
Hosting is not required if network access fails: submit this folder as a ZIP and the run steps above. To publish on GitHub Pages, push to GitHub, set Pages source to *GitHub Actions*, and add the two `VITE_` values as repository secrets (`.github/workflows/deploy.yml` is included).

## Submission folder
Rename the folder to `SAD_Exam_Section_B_StudentID` (replace `StudentID` with your ID). Before zipping, delete `node_modules` and `dist`, and make sure `.env` is not included.
