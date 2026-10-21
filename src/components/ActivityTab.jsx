import React, { useState } from 'react'
import { fmt } from '../lib/format'
import { Empty } from './ui'

export default function ActivityTab({ logs, reload }) {
  const [q, setQ] = useState('')
  const rows = logs.filter((l) => `${l.action} ${l.actor_name} ${l.details || ''} ${l.scholars?.student_id || ''} ${l.scholars?.full_name || ''}`.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <>
      <div className="page-head"><div><h1>Activity log</h1><p>Every submission, verification, evaluation, and renewal change with who did it and when.</p></div><button className="btn" onClick={reload}>Refresh</button></div>
      <div className="card">
        <div className="toolbar"><label className="field grow">Filter<input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Action, person, or student" /></label></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>When (Manila)</th><th>Action</th><th>Student</th><th>By</th><th>Details</th></tr></thead>
            <tbody>{rows.map((l) => (
              <tr key={l.id}><td style={{ whiteSpace: 'nowrap' }}>{fmt(l.created_at, true)}</td><td><b>{l.action}</b></td>
                <td>{l.scholars ? `${l.scholars.student_id} ${l.scholars.full_name}` : '-'}</td><td>{l.actor_name}</td><td>{l.details}</td></tr>))}
            </tbody>
          </table>
          {!rows.length && <Empty title="Nothing logged yet">Actions appear here as soon as they happen.</Empty>}
        </div>
      </div>
    </>
  )
}
