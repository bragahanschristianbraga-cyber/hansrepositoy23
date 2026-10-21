import React, { useCallback, useEffect, useState } from 'react'
import { configured, supabase } from './supabaseClient'
import { api } from './lib/api'
import Auth, { Check } from './components/Auth'
import ScholarPortal from './components/ScholarPortal'
import StaffPortal from './components/StaffPortal'
import { Toasts } from './components/ui'

export default function App() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  const [profile, setProfile] = useState(null)
  const [toasts, setToasts] = useState([])

  const notify = useCallback((msg, type = 'ok') => {
    const id = Math.random()
    setToasts((t) => [...t, { id, msg, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === 'bad' ? 7000 : 4000)
  }, [])

  useEffect(() => {
    if (!configured) { setReady(true); return }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    setProfile(null)
    if (!session) return
    api.profile(session.user.id).then(setProfile).catch((e) => notify(e.message, 'bad'))
  }, [session, notify])

  if (!configured) return <Setup />
  if (!ready) return <p style={{ padding: 40 }}>Loading...</p>

  let body
  if (!session) body = <Auth notify={notify} />
  else if (!profile) body = <p style={{ padding: 40 }}>Loading your account...</p>
  else {
    const out = () => supabase.auth.signOut()
    body = profile.role === 'staff'
      ? <StaffPortal profile={profile} notify={notify} onSignOut={out} />
      : <ScholarPortal profile={profile} notify={notify} onSignOut={out} />
  }
  return <>{body}<Toasts items={toasts} /></>
}

function Setup() {
  return (
    <div className="setup card">
      <div className="brand" style={{ color: 'var(--green-700)', marginBottom: 12 }}><span className="brand-mark" style={{ background: 'var(--green-50)' }}><Check /></span>Almost there</div>
      <h2>Connect your Supabase project</h2>
      <p className="muted" style={{ margin: '8px 0 12px' }}>Create a file named <code>.env</code> in the project root (copy <code>.env.example</code>) and add:</p>
      <pre>{`VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY`}</pre>
      <p className="muted small" style={{ marginTop: 10 }}>Then stop and restart <code>npm run dev</code>. Use the anon key only, never the service-role key. See README.md for the full setup.</p>
    </div>
  )
}
