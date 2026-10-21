import React, { useState } from 'react'
import { supabase } from '../supabaseClient'
import { Field } from './ui'

export default function Auth({ notify }) {
  const [mode, setMode] = useState('login')
  const [f, setF] = useState({ name: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: f.email.trim(), password: f.password })
        if (error) throw error
      } else {
        if (f.password.length < 6) throw new Error('Password must be at least 6 characters.')
        const { data, error } = await supabase.auth.signUp({
          email: f.email.trim(), password: f.password, options: { data: { full_name: f.name.trim() } },
        })
        if (error) throw error
        if (!data.session) notify('Account created. Check your e-mail to confirm it, then sign in.', 'ok')
      }
    } catch (err) {
      notify(err.message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <section className="auth-hero">
        <div className="brand"><span className="brand-mark"><Check /></span>Scholarship Office</div>
        <h1>Know where your scholarship stands.</h1>
        <p>Submit semester grades, follow verification, and see the renewal decision in one place. Staff review evidence and apply each program's policy the same way every time.</p>
        <ul>
          <li>Instant receipt with timestamp for every submission</li>
          <li>Clear reasons when evidence is returned or a requirement is missed</li>
          <li>Official grades stay with the Registrar. This system never changes them.</li>
        </ul>
      </section>
      <section className="auth-panel">
        <form className="auth-form" onSubmit={submit}>
          <h2>{mode === 'login' ? 'Sign in' : 'Create a scholar account'}</h2>
          <div className="seg" role="group" aria-label="Sign in or create account">
            <button type="button" aria-pressed={mode === 'login'} onClick={() => setMode('login')}>Sign in</button>
            <button type="button" aria-pressed={mode === 'signup'} onClick={() => setMode('signup')}>Create account</button>
          </div>
          {mode === 'signup' && (
            <Field label="Full name"><input className="input" required value={f.name} onChange={set('name')} autoComplete="name" /></Field>
          )}
          <Field label="E-mail" hint={mode === 'signup' ? 'Use the e-mail Scholarship Staff registered for you.' : undefined}>
            <input className="input" type="email" required value={f.email} onChange={set('email')} autoComplete="email" />
          </Field>
          <Field label="Password">
            <input className="input" type="password" required value={f.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </Field>
          <button className="btn primary" disabled={busy}>{busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
          <p className="muted small">Scholarship Staff accounts are granted by the Scholarship Office, not through this form.</p>
        </form>
      </section>
    </div>
  )
}

export function Check({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  )
}
