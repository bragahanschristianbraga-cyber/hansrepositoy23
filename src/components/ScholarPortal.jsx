import React, { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { fmt, semLabel, SEMESTERS, YEARS } from '../lib/format'
import { validateSummary } from '../lib/validate'
import { Badge, Checks, Empty, Field, Timeline } from './ui'
import { Check } from './Auth'

const BLANK = { year: '2026-2027', semester: '1', gwa: '', units: '', failed: '0', inc: '0', drop: '0', evidence: '' }
const toForm = (s) => ({ year: s.academic_year, semester: String(s.semester), gwa: String(s.gwa), units: String(s.enrolled_units),
  failed: String(s.failed_count), inc: String(s.incomplete_count), drop: String(s.dropped_count), evidence: s.evidence_ref })

export default function ScholarPortal({ profile, notify, onSignOut }) {
  const [scholar, setScholar] = useState(undefined)
  const [subs, setSubs] = useState([])
  const [logs, setLogs] = useState([])
  const [form, setForm] = useState(BLANK)
  const [errors, setErrors] = useState({})
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const formRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const sc = await api.myScholar()
      setScholar(sc)
      if (sc) { const [s, l] = await Promise.all([api.mySubmissions(), api.logs(300)]); setSubs(s); setLogs(l) }
    } catch (e) { notify(e.message, 'bad') }
  }, [notify])
  useEffect(() => { load() }, [load])

  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); if (errors[k]) setErrors({ ...errors, [k]: undefined }) }

  async function submit(e) {
    e.preventDefault()
    const v = validateSummary(form)
    setErrors(v)
    if (Object.keys(v).length) { notify('Fix the highlighted fields and try again.', 'bad'); return }
    setBusy(true)
    try {
      const r = editing ? await api.resubmit(editing, form) : await api.submit(form)
      notify(editing ? 'Correction sent. Your submission is Pending verification again.'
        : `Submission received on ${fmt(r.submitted_at, true)} (Manila time).`)
      setEditing(null); setForm(BLANK); await load()
    } catch (err) { notify(err.message, 'bad') } finally { setBusy(false) }
  }

  function startCorrection(s) {
    setEditing(s.id); setForm(toForm(s)); setErrors({})
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const prog = scholar?.programs
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand"><span className="brand-mark"><Check /></span><div>Scholarship Office<small>Scholar portal</small></div></div>
          <span className="spacer" />
          <div className="who"><b>{profile.full_name || profile.email}</b><span className="role-pill">Scholar</span></div>
          <button className="btn sm" onClick={onSignOut}>Sign out</button>
        </div>
      </header>
      <main>
        {scholar === undefined && <p>Loading...</p>}
        {scholar === null && (
          <div className="card"><Empty title="Your account is not registered yet">
            Ask Scholarship Staff to register <b>{profile.email}</b> and assign your scholarship program. Then refresh this page.
          </Empty></div>
        )}
        {scholar && (
          <div className="stack">
            <div className="card">
              <div className="card-head">
                <div><h1>Hello, {scholar.full_name.split(' ')[0]}</h1><p className="muted">Student ID {scholar.student_id}</p></div>
                <div className="status-row"><span className="lbl">Program</span><Badge kind="green" label={prog.name} /><span className="lbl">Award</span><Badge value={scholar.award_status} /></div>
              </div>
              <div className="chips">
                <span className="chip">GWA {Number(prog.max_gwa).toFixed(2)} or better</span>
                <span className="chip">At least {prog.min_units} units</span>
                <span className="chip">Failed up to {prog.max_failed}</span>
                <span className="chip">Incomplete up to {prog.max_incomplete}</span>
                <span className="chip">Dropped up to {prog.max_dropped}</span>
                <span className="chip">Deadline {fmt(prog.deadline)} (Manila)</span>
              </div>
            </div>

            <div className="card" ref={formRef}>
              <div className="card-head">
                <h2>{editing ? 'Correct and resubmit your grades' : 'Submit semester grades'}</h2>
                {editing && <button className="btn sm" onClick={() => { setEditing(null); setForm(BLANK); setErrors({}) }}>Cancel correction</button>}
              </div>
              {editing && <div className="alert amber" style={{ marginBottom: 12 }}>Staff returned this record. Update the values or the document reference, then resubmit. It goes back to Pending verification.</div>}
              <form onSubmit={submit} noValidate>
                <div className="form-grid">
                  <Field label="Academic year">
                    <select className="input" value={form.year} onChange={set('year')} disabled={!!editing}>{YEARS.map((y) => <option key={y}>{y}</option>)}</select>
                  </Field>
                  <Field label="Semester">
                    <select className="input" value={form.semester} onChange={set('semester')} disabled={!!editing}>{SEMESTERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
                  </Field>
                  <Field label="GWA" hint="1.00 best, 5.00 failing" error={errors.gwa}>
                    <input className={`input ${errors.gwa ? 'bad' : ''}`} type="number" step="0.01" inputMode="decimal" value={form.gwa} onChange={set('gwa')} placeholder="e.g. 1.75" />
                  </Field>
                  <Field label="Enrolled units" error={errors.units}>
                    <input className={`input ${errors.units ? 'bad' : ''}`} type="number" min="0" step="1" value={form.units} onChange={set('units')} placeholder="e.g. 18" />
                  </Field>
                  <Field label="Failed subjects" error={errors.failed}>
                    <input className={`input ${errors.failed ? 'bad' : ''}`} type="number" min="0" step="1" value={form.failed} onChange={set('failed')} />
                  </Field>
                  <Field label="Incomplete grades" error={errors.inc}>
                    <input className={`input ${errors.inc ? 'bad' : ''}`} type="number" min="0" step="1" value={form.inc} onChange={set('inc')} />
                  </Field>
                  <Field label="Dropped subjects" error={errors.drop}>
                    <input className={`input ${errors.drop ? 'bad' : ''}`} type="number" min="0" step="1" value={form.drop} onChange={set('drop')} />
                  </Field>
                  <div className="wide">
                    <Field label="Grade-document reference" hint="File name, shared link, or document code for your grade report" error={errors.evidence}>
                      <input className={`input ${errors.evidence ? 'bad' : ''}`} value={form.evidence} onChange={set('evidence')} placeholder="e.g. GRADES-2026-1ST-SEM.pdf" />
                    </Field>
                  </div>
                </div>
                <div className="btn-row" style={{ marginTop: 16 }}>
                  <button className="btn primary" disabled={busy}>{busy ? 'Sending...' : editing ? 'Resubmit correction' : 'Submit grades'}</button>
                  <span className="muted small">The time you send this is recorded automatically.</span>
                </div>
              </form>
            </div>

            <div>
              <div className="page-head"><div><h2>My submissions</h2><p>Track each step: received, verified, evaluated, decided.</p></div><button className="btn sm" onClick={load}>Refresh</button></div>
              {!subs.length && <div className="card"><Empty title="No submissions yet">Use the form above to send your first semester summary.</Empty></div>}
              <div className="stack">
                {subs.map((s) => <SubmissionCard key={s.id} s={s} scholar={scholar} logs={logs.filter((l) => l.submission_id === s.id)} onCorrect={() => startCorrection(s)} />)}
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  )
}

function SubmissionCard({ s, scholar, logs, onCorrect }) {
  const [open, setOpen] = useState(false)
  const late = new Date(s.submitted_at) > new Date(scholar.programs.deadline)
  return (
    <div className="card">
      <div className="card-head">
        <div><h3>AY {s.academic_year}, {semLabel(s.semester)}</h3><p className="muted small">Received {fmt(s.submitted_at, true)} {late && <Badge kind="red" label="Late" />}</p></div>
        <div className="status-row">
          <span className="lbl">Evidence</span><Badge value={s.verification_status} />
          <span className="lbl">Compliance</span><Badge value={s.compliance_result} />
          <span className="lbl">Renewal</span><Badge value={s.renewal_decision} kind={s.renewal_decision === 'Pending' ? 'gray' : undefined} />
        </div>
      </div>
      <div className="kv">
        <div><span>GWA</span><b>{Number(s.gwa).toFixed(2)}</b></div>
        <div><span>Units</span><b>{s.enrolled_units}</b></div>
        <div><span>Failed</span><b>{s.failed_count}</b></div>
        <div><span>Incomplete</span><b>{s.incomplete_count}</b></div>
        <div><span>Dropped</span><b>{s.dropped_count}</b></div>
        <div><span>Document</span><b style={{ wordBreak: 'break-all' }}>{s.evidence_ref}</b></div>
      </div>
      {s.verification_status === 'Returned' && (
        <div className="alert red" style={{ marginTop: 12 }}>
          <b>Returned for correction:</b> {s.verification_reason}
          <div className="btn-row" style={{ marginTop: 8 }}><button className="btn danger sm" onClick={onCorrect}>Correct and resubmit</button></div>
        </div>
      )}
      {s.verification_status === 'Pending' && <div className="alert gray" style={{ marginTop: 12 }}>Received. Waiting for Scholarship Staff to verify your grade document.</div>}
      {s.verification_status === 'Verified' && s.compliance_result === 'Not Evaluated' && <div className="alert green" style={{ marginTop: 12 }}>Evidence verified. Staff will evaluate it against your program policy.</div>}
      {s.compliance_checks && <div style={{ marginTop: 12 }}><Checks checks={s.compliance_checks} reasons={s.compliance_reasons} result={s.compliance_result} /></div>}
      {s.renewal_decision !== 'Pending' && (
        <div className={`alert ${s.renewal_decision === 'Approved' ? 'green' : 'amber'}`} style={{ marginTop: 12 }}>
          <b>Renewal {s.renewal_decision.toLowerCase()}</b> on {fmt(s.decided_at)}{s.decision_note ? `: ${s.decision_note}` : '.'}
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <button className="btn sm" onClick={() => setOpen(!open)}>{open ? 'Hide history' : `Show history (${logs.length})`}</button>
        {open && <div style={{ marginTop: 12 }}><Timeline logs={[...logs].reverse()} /></div>}
      </div>
    </div>
  )
}
