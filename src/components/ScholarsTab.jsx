import React, { useState } from 'react'
import { api } from '../lib/api'
import { Badge, Empty, Field } from './ui'

export default function ScholarsTab({ scholars, programs, reload, notify }) {
  const [f, setF] = useState({ studentId: '', fullName: '', email: '', programId: '' })
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function register(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await api.registerScholar({ ...f, programId: f.programId || programs[0]?.id })
      notify(`${f.fullName} registered.`)
      setF({ studentId: '', fullName: '', email: '', programId: '' })
      await reload()
    } catch (err) { notify(err.message, 'bad') } finally { setBusy(false) }
  }
  async function reassign(sc, programId) {
    try { await api.assignProgram(sc.id, programId); notify(`${sc.full_name} reassigned.`); await reload() } catch (err) { notify(err.message, 'bad') }
  }

  const rows = scholars.filter((s) => `${s.student_id} ${s.full_name} ${s.email || ''}`.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <>
      <div className="page-head"><div><h1>Scholars</h1><p>Register scholars and assign each one scholarship program.</p></div></div>
      <div className="card">
        <h2 style={{ marginBottom: 12 }}>Register a scholar</h2>
        <form onSubmit={register}>
          <div className="form-grid">
            <Field label="Student ID"><input className="input" required value={f.studentId} onChange={set('studentId')} placeholder="e.g. 2026-0123" /></Field>
            <Field label="Full name"><input className="input" required value={f.fullName} onChange={set('fullName')} /></Field>
            <Field label="E-mail" hint="Links the scholar's login automatically"><input className="input" type="email" value={f.email} onChange={set('email')} /></Field>
            <Field label="Program"><select className="input" value={f.programId || programs[0]?.id || ''} onChange={set('programId')}>{programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          </div>
          <div className="btn-row" style={{ marginTop: 14 }}><button className="btn primary" disabled={busy}>Register scholar</button></div>
        </form>
      </div>
      <div className="card">
        <div className="toolbar"><label className="field grow">Search scholars<input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Student ID, name, or e-mail" /></label></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Student ID</th><th>Name</th><th>E-mail</th><th>Login</th><th>Program</th><th>Award</th></tr></thead>
            <tbody>{rows.map((s) => (
              <tr key={s.id}>
                <td><b>{s.student_id}</b></td><td>{s.full_name}</td><td>{s.email || '-'}</td>
                <td>{s.profile_id ? <Badge kind="green" label="Linked" /> : <Badge kind="gray" label="No account yet" />}</td>
                <td><select className="input" value={s.program_id} onChange={(e) => reassign(s, e.target.value)} aria-label={`Program for ${s.full_name}`}>{programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
                <td><Badge value={s.award_status} /></td>
              </tr>))}
            </tbody>
          </table>
          {!rows.length && <Empty title="No scholars found">Register one with the form above.</Empty>}
        </div>
      </div>
    </>
  )
}
