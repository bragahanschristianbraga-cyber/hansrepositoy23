import React, { useMemo, useState } from 'react'
import { fmt, isLate, semLabel, SEMESTERS, YEARS } from '../lib/format'
import { Badge, Empty } from './ui'
import SubmissionModal from './SubmissionModal'

export default function Dashboard({ subs, scholars, programs, logs, reload, notify }) {
  const [year, setYear] = useState('2026-2027')
  const [sem, setSem] = useState('1')
  const [q, setQ] = useState('')
  const [prog, setProg] = useState('all')
  const [comp, setComp] = useState('all')
  const [ver, setVer] = useState('all')
  const [openId, setOpenId] = useState(null)

  const term = useMemo(() => subs.filter((s) => s.academic_year === year && String(s.semester) === sem), [subs, year, sem])
  const stats = {
    total: scholars.length,
    pending: term.filter((s) => s.verification_status === 'Pending').length,
    compliant: term.filter((s) => s.compliance_result === 'Compliant').length,
    deficient: term.filter((s) => s.compliance_result === 'With Deficiency').length,
    waiting: scholars.filter((sc) => !term.some((s) => s.scholar_id === sc.id)).length,
  }

  const rows = term.filter((s) => {
    const sc = s.scholars
    const needle = q.trim().toLowerCase()
    if (needle && !(`${sc.student_id} ${sc.full_name}`.toLowerCase().includes(needle))) return false
    if (prog !== 'all' && sc.program_id !== prog) return false
    if (comp !== 'all' && s.compliance_result !== comp) return false
    if (ver !== 'all' && s.verification_status !== ver) return false
    return true
  }).sort((a, b) => a.scholars.student_id.localeCompare(b.scholars.student_id))

  return (
    <>
      <div className="page-head">
        <div><h1>Dashboard</h1><p>Review submissions for the selected term. Click a row to verify, evaluate, or decide renewal.</p></div>
        <div className="toolbar" style={{ margin: 0 }}>
          <label className="field">Academic year<select className="input" value={year} onChange={(e) => setYear(e.target.value)}>{YEARS.map((y) => <option key={y}>{y}</option>)}</select></label>
          <label className="field">Semester<select className="input" value={sem} onChange={(e) => setSem(e.target.value)}>{SEMESTERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
          <button className="btn" onClick={reload}>Refresh</button>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><div className="num">{stats.total}</div><div className="lbl">Assigned scholars</div></div>
        <div className="stat amber"><div className="num">{stats.pending}</div><div className="lbl">Pending verification</div></div>
        <div className="stat lime"><div className="num">{stats.compliant}</div><div className="lbl">Compliant</div></div>
        <div className="stat red"><div className="num">{stats.deficient}</div><div className="lbl">With deficiency</div></div>
        <div className="stat gray"><div className="num">{stats.waiting}</div><div className="lbl">No submission this term</div></div>
      </div>

      <div className="card">
        <div className="toolbar">
          <label className="field grow">Search by student ID or name
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. 2026-B03 or Mendoza" />
          </label>
          <label className="field">Program<select className="input" value={prog} onChange={(e) => setProg(e.target.value)}>
            <option value="all">All programs</option>{programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="field">Compliance<select className="input" value={comp} onChange={(e) => setComp(e.target.value)}>
            <option value="all">All</option><option>Not Evaluated</option><option>Compliant</option><option>With Deficiency</option></select></label>
          <label className="field">Evidence<select className="input" value={ver} onChange={(e) => setVer(e.target.value)}>
            <option value="all">All</option><option>Pending</option><option>Verified</option><option>Returned</option></select></label>
          {(q || prog !== 'all' || comp !== 'all' || ver !== 'all') && <button className="btn sm" onClick={() => { setQ(''); setProg('all'); setComp('all'); setVer('all') }}>Clear filters</button>}
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Student ID</th><th>Name</th><th>Program</th><th>Submitted (Manila)</th><th>GWA</th><th>Evidence</th><th>Compliance</th><th>Renewal</th><th></th></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="clickable" onClick={() => setOpenId(s.id)}>
                  <td><b>{s.scholars.student_id}</b></td>
                  <td>{s.scholars.full_name}</td>
                  <td>{s.scholars.programs.name}</td>
                  <td>{fmt(s.submitted_at)} {isLate(s.submitted_at, s.scholars.programs.deadline) && <Badge kind="red" label="Late" />}</td>
                  <td>{Number(s.gwa).toFixed(2)}</td>
                  <td><Badge value={s.verification_status} /></td>
                  <td><Badge value={s.compliance_result} /></td>
                  <td><Badge value={s.renewal_decision} kind={s.renewal_decision === 'Pending' ? 'gray' : undefined} /></td>
                  <td><button className="btn sm" onClick={(e) => { e.stopPropagation(); setOpenId(s.id) }}>Review</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <Empty title="No submissions match">Try another term or clear the filters. Showing {semLabel(sem)}, AY {year}.</Empty>}
        </div>
      </div>

      {openId && <SubmissionModal id={openId} subs={subs} logs={logs} reload={reload} notify={notify} onClose={() => setOpenId(null)} />}
    </>
  )
}
