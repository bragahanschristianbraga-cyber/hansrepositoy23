import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Check } from './Auth'
import Dashboard from './Dashboard'
import ScholarsTab from './ScholarsTab'
import PoliciesTab from './PoliciesTab'
import ActivityTab from './ActivityTab'

const TABS = [['dash', 'Dashboard'], ['scholars', 'Scholars'], ['policies', 'Policies'], ['activity', 'Activity log']]

export default function StaffPortal({ profile, notify, onSignOut }) {
  const [tab, setTab] = useState('dash')
  const [data, setData] = useState({ subs: [], scholars: [], programs: [], logs: [] })
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const [subs, scholars, programs, logs] = await Promise.all([api.allSubmissions(), api.scholars(), api.programs(), api.logs(500)])
      setData({ subs, scholars, programs, logs })
    } catch (e) { notify(e.message, 'bad') } finally { setLoading(false) }
  }, [notify])
  useEffect(() => { reload() }, [reload])

  const props = { ...data, reload, notify }
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand"><span className="brand-mark"><Check /></span><div>Scholarship Office<small>Staff workspace</small></div></div>
          <span className="spacer" />
          <div className="who"><b>{profile.full_name || profile.email}</b><span className="role-pill">Scholarship Staff</span></div>
          <button className="btn sm" onClick={onSignOut}>Sign out</button>
        </div>
      </header>
      <nav className="tabs" aria-label="Sections"><div className="tabs-inner" role="tablist">
        {TABS.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} className="tab" onClick={() => setTab(k)}>{label}</button>)}
      </div></nav>
      <main>
        {loading ? <p>Loading...</p> : (
          <>
            {tab === 'dash' && <Dashboard {...props} />}
            {tab === 'scholars' && <ScholarsTab {...props} />}
            {tab === 'policies' && <PoliciesTab {...props} />}
            {tab === 'activity' && <ActivityTab {...props} />}
          </>
        )}
      </main>
    </>
  )
}
