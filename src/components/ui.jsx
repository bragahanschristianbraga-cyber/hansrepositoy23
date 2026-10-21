import React from 'react'
import { fmt } from '../lib/format'

const KIND = {
  Verified: 'green', Compliant: 'green', Approved: 'green', Active: 'green',
  Pending: 'amber', Held: 'amber', Suspended: 'amber',
  Returned: 'red', 'With Deficiency': 'red', Terminated: 'red',
  'Not Evaluated': 'gray',
}

export function Badge({ value, kind, label }) {
  return <span className={`badge b-${kind || KIND[value] || 'gray'}`}>{label || value}</span>
}

export function Modal({ title, subtitle, onClose, children }) {
  React.useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div><h2>{title}</h2>{subtitle && <p className="small" style={{ opacity: .9 }}>{subtitle}</p>}</div>
          <button className="btn sm" onClick={onClose}>Close</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function Toasts({ items }) {
  return (
    <div className="toast-zone" aria-live="polite">
      {items.map((t) => <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>)}
    </div>
  )
}

export function Field({ label, hint, error, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="err">{error}</span>}
    </label>
  )
}

export function Empty({ title, children }) {
  return <div className="empty"><b>{title}</b>{children}</div>
}

export function Timeline({ logs }) {
  if (!logs.length) return <p className="muted small">No history yet.</p>
  return (
    <ul className="timeline">
      {logs.map((l) => (
        <li key={l.id}>
          <b>{l.action}</b> <span className="muted">by {l.actor_name}</span>
          {l.details && <div className="muted">{l.details}</div>}
          <div className="when">{fmt(l.created_at, true)}</div>
        </li>
      ))}
    </ul>
  )
}

export function Checks({ checks, reasons, result }) {
  if (!checks) return null
  return (
    <div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Policy check</th><th>Rule</th><th>Submitted</th><th>Result</th></tr></thead>
          <tbody>
            {checks.map((c) => (
              <tr key={c.label}>
                <td>{c.label}</td><td>{c.rule}</td><td>{c.actual}</td>
                <td className={c.passed ? 'pass' : 'fail'}>{c.passed ? 'Pass' : 'Fail'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result === 'With Deficiency' && (
        <div className="alert red" style={{ marginTop: 10 }}>
          <b>Deficiency reasons</b>
          <ul className="reasons">{reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}
      {result === 'Compliant' && <div className="alert green" style={{ marginTop: 10 }}><b>All policy checks passed.</b></div>}
    </div>
  )
}
