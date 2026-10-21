export const TZ = 'Asia/Manila'
export const SEMESTERS = [
  { value: 1, label: '1st Semester' },
  { value: 2, label: '2nd Semester' },
  { value: 3, label: 'Summer' },
]
export const YEARS = ['2025-2026', '2026-2027', '2027-2028']
export const semLabel = (v) => SEMESTERS.find((s) => s.value === Number(v))?.label ?? String(v)

export function fmt(ts, withSeconds = false) {
  if (!ts) return '-'
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: TZ, year: 'numeric', month: 'short', day: '2-digit',
    hour: 'numeric', minute: '2-digit', second: withSeconds ? '2-digit' : undefined, hour12: true,
  }).format(new Date(ts))
}

// ISO timestamp -> "YYYY-MM-DDTHH:mm" in Manila time (for <input type="datetime-local">)
export function toManilaInput(ts) {
  const d = new Date(new Date(ts).getTime() + 8 * 3600 * 1000)
  return d.toISOString().slice(0, 16)
}
// "YYYY-MM-DDTHH:mm" (Manila) -> ISO string with +08:00 offset
export const fromManilaInput = (v) => `${v}:00+08:00`

export const isLate = (submittedAt, deadline) => new Date(submittedAt) > new Date(deadline)
