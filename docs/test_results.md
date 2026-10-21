# Test results - TC01 to TC10

Run on: ____________  Environment: Supabase project ____________ (hosted URL / local `npm run dev`)

**How to fill the "Actual result" column**
1. Run `supabase/04_run_tests.sql` in the Supabase SQL Editor. It signs in as staff and as two scholars at the database level and prints one row per test. Copy the `actual` and `result` values into the table below.
2. Repeat TC01 to TC10 once in the web app and save a screenshot per test in `evidence/` (names below).
3. Run `supabase/02_seed.sql` again afterwards to reset the data.
4. If anything fails, write it honestly in "Known defects" instead of changing the expected result.

## Expected status derived from the policy (seeded records)

| Record | Program | Inputs | Expected status | Expected reasons |
|--------|---------|--------|-----------------|------------------|
| B01 (2026-B01) | Excellence | GWA 2.00, 18 units, 0/0/0, submitted exactly 2026-11-06 17:00 | Compliant | none (2.00 is at the inclusive limit; exact deadline is on time) |
| B02 (2026-B02) | Excellence | GWA 2.01, 18 units | With Deficiency | GWA 2.01 is above 2.00 |
| B03 (2026-B03) | Access | GWA 2.50, 15 units, 1 dropped | Compliant | none (Access allows 1 dropped subject) |
| B04 (2026-B04) | Access | GWA 2.50, 14 units, 1 incomplete | With Deficiency | units 14 below 15; incomplete grade 1 (allowed 0) |
| B05 (2026-B05) | Excellence | GWA 1.75, 18 units, 1 failed, submitted 17:01 | With Deficiency | failed subject 1 (allowed 0); late submission (1 minute) |
| B06 (2026-B06) | Access | GWA 2.25, 15 units, Pending verification | Not evaluable | evaluation and renewal blocked until verified |

## Results table

| Test ID | Input or action | Expected result | Actual result | Pass / Fail | Evidence reference |
|---------|-----------------|-----------------|---------------|-------------|--------------------|
| TC01 | Evaluate record 01 (B01) | Compliant at the exact GWA and deadline boundaries | | | `evidence/TC01.png` |
| TC02 | Evaluate record 02 (B02) | With Deficiency with a GWA reason | | | `evidence/TC02.png` |
| TC03 | Evaluate record 03 (B03) | Compliant (one dropped subject is allowed by its program) | | | `evidence/TC03.png` |
| TC04 | Evaluate record 04 (B04) | With Deficiency: insufficient units and incomplete grade | | | `evidence/TC04.png` |
| TC05 | Evaluate record 05 (B05) | With Deficiency: failing subject and late submission | | | `evidence/TC05.png` |
| TC06 | Try evaluation and renewal approval for record 06 (B06) | Both blocked until verified and evaluated | | | `evidence/TC06.png` |
| TC07 | Duplicate semester record; GWA 0.50; negative count | Each rejected with a clear message | | | `evidence/TC07.png` |
| TC08 | As scholar1, read scholar2's record and attempt verification | Backend denies access | | | `evidence/TC08.png` + `04_run_tests.sql` output |
| TC09 | Return a record, correct and resubmit, refresh | Stays Pending verification; history preserved | | | `evidence/TC09.png` |
| TC10 | Staff approve a compliant record and hold a deficient one; scholar tries to change the decision | Approve (compliant) works; deficient can only be Held; scholar denied | | | `evidence/TC10.png` |

## Required screenshots checklist
- [ ] Scholar submission form and receipt (`evidence/submission.png`)
- [ ] Staff verification (`evidence/verification.png`)
- [ ] Compliance result with policy checks (`evidence/compliance.png`)
- [ ] Renewal decision (`evidence/renewal.png`)
- [ ] Dashboard with search and filter (`evidence/dashboard.png`)
- [ ] Role-access evidence (`evidence/role-access.png`)

## Known defects
(List honestly, or write "None found".)
