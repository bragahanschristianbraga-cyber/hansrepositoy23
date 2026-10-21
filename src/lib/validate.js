// Client-side checks give instant feedback. The database repeats every rule (the real enforcement).
const isCount = (v) => v !== '' && Number.isInteger(Number(v)) && Number(v) >= 0

export function validateSummary(f) {
  const e = {}
  const gwa = Number(f.gwa)
  if (f.gwa === '' || Number.isNaN(gwa) || gwa < 1 || gwa > 5) e.gwa = 'Enter a GWA from 1.00 to 5.00 (1.00 is best).'
  else if (Math.round(gwa * 100) / 100 !== gwa) e.gwa = 'Use at most 2 decimal places.'
  if (!isCount(f.units)) e.units = 'Enter a whole number, 0 or more.'
  if (!isCount(f.failed)) e.failed = 'Enter a whole number, 0 or more.'
  if (!isCount(f.inc)) e.inc = 'Enter a whole number, 0 or more.'
  if (!isCount(f.drop)) e.drop = 'Enter a whole number, 0 or more.'
  if (!f.evidence || !f.evidence.trim()) e.evidence = 'Add the grade-document reference (file name, link, or code).'
  return e
}
