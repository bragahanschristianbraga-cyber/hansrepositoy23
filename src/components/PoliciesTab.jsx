import React, { useState } from 'react'
import { api } from '../lib/api'
import { fromManilaInput, toManilaInput } from '../lib/format'
import { Field } from './ui'

function PolicyCard({ program, reload, notify }) {
  const [p, setP] = useState({ ...program, deadline: toManilaInput(program.deadline) })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setP({ ...p, [k]: e.target.value })
  async function save(e) {
    e.preventDefault(); setBusy(true)
    try { await api.updateProgram({ ...p, deadline: fromManilaInput(p.deadline) }); notify(`${program.name} policy saved.`); await reload() }
    catch (err) { notify(err.message, 'bad') } finally { setBusy(false) }
  }
  return (
    <form className="card" onSubmit={save}>
      <div className="card-head"><h2>{program.name}</h2></div>
      <div className="form-grid">
        <Field label="Maximum GWA" hint="Smaller is better"><input className="input" type="number" step="0.01" min="1" max="5" value={p.max_gwa} onChange={set('max_gwa')} /></Field>
        <Field label="Minimum enrolled units"><input className="input" type="number" min="0" step="1" value={p.min_units} onChange={set('min_units')} /></Field>
        <Field label="Allowed failed subjects"><input className="input" type="number" min="0" step="1" value={p.max_failed} onChange={set('max_failed')} /></Field>
        <Field label="Allowed incomplete grades"><input className="input" type="number" min="0" step="1" value={p.max_incomplete} onChange={set('max_incomplete')} /></Field>
        <Field label="Allowed dropped subjects"><input className="input" type="number" min="0" step="1" value={p.max_dropped} onChange={set('max_dropped')} /></Field>
        <Field label="Submission deadline (Manila)"><input className="input" type="datetime-local" value={p.deadline} onChange={set('deadline')} /></Field>
      </div>
      <div className="btn-row" style={{ marginTop: 14 }}><button className="btn primary" disabled={busy}>Save policy</button>
        <span className="muted small">Evaluations read these values. Re-run an evaluation after changing them.</span></div>
    </form>
  )
}

export default function PoliciesTab({ programs, reload, notify }) {
  return (
    <>
      <div className="page-head"><div><h1>Scholarship policies</h1><p>Thresholds are stored in the database and read by every evaluation.</p></div></div>
      <div className="grid-2">{programs.map((p) => <PolicyCard key={p.id + p.deadline} program={p} reload={reload} notify={notify} />)}</div>
    </>
  )
}
