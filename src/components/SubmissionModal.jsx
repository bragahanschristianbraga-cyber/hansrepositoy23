import React, { useState } from 'react'
import { api } from '../lib/api'
import { fmt, isLate, semLabel } from '../lib/format'
import { Badge, Checks, Field, Modal, Timeline } from './ui'

export default function SubmissionModal({ id, subs, logs, reload, notify, onClose }) {
  const s = subs.find((x) => x.id === id)
  const [returning, setReturning] = useState(false)
  const [reason, setReason] = useState('')
  const [decision, setDecision] = useState('Approved')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  if (!s) return null
  const sc = s.scholars
  const late = isLate(s.submitted_at, sc.programs.deadline)

  async function run(fn, okMsg) {
    setBusy(true)
    try { await fn(); await reload(); notify(okMsg) } catch (e) { notify(e.message, 'bad') } finally { setBusy(false) }
  }

  return (
    <Modal title={`${sc.full_name} (${sc.student_id})`} subtitle={`${sc.programs.name} | AY ${s.academic_year}, ${semLabel(s.semester)}`} onClose={onClose}>
      <div className="status-row" style={{ marginBottom: 14 }}>
        <span className="lbl">Evidence</span><Badge value={s.verification_status} />
        <span className="lbl">Compliance</span><Badge value={s.compliance_result} />
        <span className="lbl">Renewal</span><Badge value={s.renewal_decision} kind={s.renewal_decision === 'Pending' ? 'gray' : undefined} />
        <span className="lbl">Award</span><Badge value={sc.award_status} />
      </div>

      <div className="kv">
        <div><span>GWA</span><b>{Number(s.gwa).toFixed(2)}</b></div>
        <div><span>Enrolled units</span><b>{s.enrolled_units}</b></div>
        <div><span>Failed</span><b>{s.failed_count}</b></div>
        <div><span>Incomplete</span><b>{s.incomplete_count}</b></div>
        <div><span>Dropped</span><b>{s.dropped_count}</b></div>
        <div><span>Submitted</span><b>{fmt(s.submitted_at, true)} {late && <Badge kind="red" label="Late" />}</b></div>
        <div style={{ gridColumn: '1 / -1' }}><span>Grade-document reference</span><b style={{ wordBreak: 'break-all' }}>{s.evidence_ref}</b></div>
      </div>
      <p className="muted small" style={{ marginTop: 6 }}>Academic summary entered by the scholar. The Registrar holds the official grades.</p>

      <h3 className="section-title">1. Verify evidence</h3>
      {s.verification_status === 'Returned' ? (
        <div className="alert red"><b>Returned:</b> {s.verification_reason}. Waiting for the scholar to correct and resubmit.</div>
      ) : (
        <>
          {s.verification_status === 'Verified' && <div className="alert green" style={{ marginBottom: 10 }}>Verified {fmt(s.verified_at)}.</div>}
          <div className="btn-row">
            <button className="btn primary" disabled={busy || s.verification_status === 'Verified'} onClick={() => run(() => api.verify(s.id, 'Verified', ''), 'Evidence marked Verified.')}>Mark Verified</button>
            <button className="btn danger" disabled={busy} onClick={() => setReturning(!returning)}>Return to scholar</button>
          </div>
          {returning && (
            <div style={{ marginTop: 10 }}>
              <Field label="Reason for returning (required)" hint="The scholar will see this message.">
                <textarea className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. GWA does not match the attached grade document" />
              </Field>
              <div className="btn-row" style={{ marginTop: 8 }}>
                <button className="btn danger" disabled={busy} onClick={() => run(async () => { await api.verify(s.id, 'Returned', reason); setReturning(false); setReason('') }, 'Returned to the scholar for correction.')}>Confirm return</button>
              </div>
            </div>
          )}
        </>
      )}

      <h3 className="section-title">2. Evaluate compliance</h3>
      <p className="muted small" style={{ marginBottom: 8 }}>Uses the thresholds saved on the {sc.programs.name} policy. Only verified evidence can be evaluated.</p>
      <div className="btn-row" style={{ marginBottom: 10 }}>
        <button className="btn primary" disabled={busy} onClick={() => run(() => api.evaluate(s.id), 'Evaluation saved.')}>{s.compliance_result === 'Not Evaluated' ? 'Run evaluation' : 'Re-run evaluation'}</button>
        {s.evaluated_at && <span className="muted small">Last evaluated {fmt(s.evaluated_at)}</span>}
      </div>
      <Checks checks={s.compliance_checks} reasons={s.compliance_reasons} result={s.compliance_result} />

      <h3 className="section-title">3. Renewal decision</h3>
      {s.renewal_decision !== 'Pending' && (
        <div className={`alert ${s.renewal_decision === 'Approved' ? 'green' : 'amber'}`} style={{ marginBottom: 10 }}>
          <b>{s.renewal_decision}</b> on {fmt(s.decided_at)}{s.decision_note ? `: ${s.decision_note}` : ''}
        </div>
      )}
      <div className="form-grid">
        <Field label="Decision"><select className="input" value={decision} onChange={(e) => setDecision(e.target.value)}><option>Approved</option><option>Held</option></select></Field>
        <div className="wide"><Field label="Decision note" hint="Required when holding. Approval needs a Compliant evaluation."><textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>
      </div>
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button className="btn primary" disabled={busy} onClick={() => run(async () => { await api.decide(s.id, decision, note); setNote('') }, `Renewal ${decision.toLowerCase()}.`)}>Save decision</button>
      </div>

      <h3 className="section-title">History</h3>
      <Timeline logs={logs.filter((l) => l.submission_id === s.id)} />
    </Modal>
  )
}
