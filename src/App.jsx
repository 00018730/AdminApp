import BooksSection from './BooksSection'
import { useState } from 'react'
import { supabase } from './supabase'
import { logEdit } from './editLog'
import StudentsSection from './StudentsSection'
import PaymentsSection from './PaymentsSection'
import TestsSection from './TestsSection'
import ParentsSection from './ParentsSection'
import TeachersSection from './TeachersSection.jsx'
import VocabAdmin from './VocabAdmin'
import EssayImageAdmin from './EssayImageAdmin'
import GroupsSection from './GroupsSection'
import ProgressTestAdmin from './ProgressTestAdmin'
import LibraryAdmin from './LibraryAdmin'
import ManagerApp from './ManagerApp'

const G = '#009472'
const D = '#002b2a'

// Login is checked against these tables in order; first match wins and sets the
// role. Each table has username + password + full_name (see roles_migration.sql).
const ROLE_TABLES = [
  { table: 'ceo',       role: 'ceo' },
  { table: 'managers',  role: 'manager' },
  { table: 'admins',    role: 'admin' },
  { table: 'education', role: 'education' },
]

// logEdit now lives in ./editLog (re-exported for any existing importers).
export { logEdit }

function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPw,   setShowPw]   = useState(false)

  const handle = async () => {
    if (!username || !password) { setError('Enter username and password.'); return }
    setLoading(true); setError('')
    const uname = username.trim()
    try {
      for (const { table, role } of ROLE_TABLES) {
        const { data } = await supabase.from(table).select('username,password,full_name').eq('username', uname).maybeSingle()
        if (data && data.password === password) {
          onLogin({ username: data.username, full_name: data.full_name || data.username, role })
          return
        }
      }
      setError('Incorrect username or password.')
      setLoading(false)
    } catch (e) {
      setError('Could not sign in. Check your connection and try again.')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', width:'100%', display:'flex', fontFamily:"'DM Sans',sans-serif", background:`linear-gradient(135deg, ${D} 0%, #003d3a 50%, ${G} 100%)` }}>
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'60px' }}>
        <div style={{ color:'white' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'14px', marginBottom:'48px' }}>
            <div style={{ width:'48px', height:'48px', borderRadius:'14px', background:'rgba(255,255,255,0.15)', border:'2px solid rgba(255,255,255,0.3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
            </div>
            <div>
              <div style={{ fontSize:'18px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', letterSpacing:'-0.3px' }}>Smart Learning Center</div>
              <div style={{ fontSize:'12px', color:'rgba(255,255,255,0.6)', marginTop:'2px' }}>English School · Tashkent</div>
            </div>
          </div>
          <h1 style={{ fontSize:'40px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', lineHeight:'1.15', letterSpacing:'-0.5px', marginBottom:'16px' }}>Admin<br/>Dashboard</h1>
          <p style={{ fontSize:'15px', color:'rgba(255,255,255,0.65)', lineHeight:'1.6', maxWidth:'320px' }}>Manage students, payments, placement tests and parent accounts from one place.</p>
          <div style={{ display:'flex', gap:'14px', marginTop:'40px', flexWrap:'wrap' }}>
            {[['👥','Students'],['💳','Payments'],['📝','Tests'],['👨‍👩‍👧','Parents'],['🗓','Holidays']].map(([icon,label]) => (
              <div key={label} style={{ padding:'10px 16px', borderRadius:'10px', background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', fontSize:'13px', fontWeight:'600', color:'rgba(255,255,255,0.85)', display:'flex', alignItems:'center', gap:'6px' }}>
                {icon} {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ width:'480px', flexShrink:0, background:'white', display:'flex', alignItems:'center', justifyContent:'center', padding:'48px 40px', boxShadow:'-20px 0 60px rgba(0,0,0,0.2)' }}>
        <div style={{ width:'100%' }}>
          <h2 style={{ fontSize:'26px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D, letterSpacing:'-0.3px', marginBottom:'6px' }}>Welcome back</h2>
          <p style={{ fontSize:'14px', color:'#94a3b8', marginBottom:'32px' }}>Sign in to continue</p>

          <label style={{ fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:'6px' }}>Username</label>
          <input value={username} onChange={e => { setUsername(e.target.value); setError('') }} onKeyDown={e => e.key==='Enter' && handle()} placeholder="Enter username"
            style={{ width:'100%', padding:'13px 16px', borderRadius:'10px', border:`1.5px solid ${error?'#fca5a5':'#e4e8e7'}`, fontSize:'15px', outline:'none', color:D, marginBottom:'14px', boxSizing:'border-box', fontFamily:"'DM Sans',sans-serif" }} />

          <label style={{ fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:'6px' }}>Password</label>
          <div style={{ position:'relative', marginBottom:'6px' }}>
            <input type={showPw?'text':'password'} value={password} onChange={e => { setPassword(e.target.value); setError('') }} onKeyDown={e => e.key==='Enter' && handle()} placeholder="Enter password"
              style={{ width:'100%', padding:'13px 44px 13px 16px', borderRadius:'10px', border:`1.5px solid ${error?'#fca5a5':'#e4e8e7'}`, fontSize:'15px', outline:'none', color:D, boxSizing:'border-box', fontFamily:"'DM Sans',sans-serif" }} />
            <button onClick={() => setShowPw(!showPw)} style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'white', border:'none', cursor:'pointer', fontSize:'18px', lineHeight:1 }}>{showPw?'🙈':'👁'}</button>
          </div>

          {error && <p style={{ fontSize:'13px', color:'#dc2626', marginBottom:'14px', fontWeight:'500' }}>⚠️ {error}</p>}

          <button onClick={handle} disabled={loading}
            style={{ width:'100%', padding:'14px', borderRadius:'10px', border:'none', background:`linear-gradient(135deg,${D},${G})`, color:'white', fontSize:'15px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'700', cursor:'pointer', marginTop:'8px', transition:'opacity 0.2s', opacity:loading?.7:1 }}>
            {loading ? 'Signing in...' : 'Sign in →'}
          </button>

          <p style={{ textAlign:'center', fontSize:'12px', color:'#94a3b8', marginTop:'24px' }}>Smart Learning Center · Admin Panel v1.0</p>
        </div>
      </div>

      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>
    </div>
  )
}

// NOTE: "Students" was removed from the navigation. Students are now reached by
// opening a group in the Groups section and tapping its "Students" button.
const ADMIN_NAV = [
  { id:'payments', label:'Payments',        icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
  { id:'tests',    label:'New Students', icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
  { id:'parents',  label:'Parents',         icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  { id:'teachers', label:'Team',        icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { id:'books',    label:'Books',           icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> },
  { id:'groups',   label:'Groups',          icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
]

const EDU_NAV = [
  { id:'vocab',    label:'Vocabulary Recap', icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> },
  { id:'hw',       label:'Essay Images',     icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> },
  { id:'progress', label:'Progress Tests',   icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
  { id:'library',  label:'Library',         icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> },
]

const TITLES = {
  students:'Students', payments:'Payments', tests:'New Students',
  parents:'Parents',   teachers:'Team', groups:'Groups', books:'Books',
  vocab:'Vocabulary Recap', hw:'Essay Images', progress:'Progress Tests', library:'Library',
}

function AppShell({ nav, section, setSection, brand, username, children, onLogout }) {
  const [showLogout, setShowLogout] = useState(false)
  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#f0f2f1', fontFamily:"'DM Sans',sans-serif" }}>
      <aside style={{ width:'230px', flexShrink:0, background:D, display:'flex', flexDirection:'column', position:'sticky', top:0, height:'100vh', overflow:'hidden' }}>
        <div style={{ padding:'22px 18px 18px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ width:'36px', height:'36px', borderRadius:'10px', background:G, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
            </div>
            <div>
              <div style={{ fontSize:'13px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:'white', letterSpacing:'-0.2px', lineHeight:'1.2' }}>Smart LC</div>
              <div style={{ fontSize:'10px', color:G, fontWeight:'600', marginTop:'2px' }}>{brand}</div>
            </div>
          </div>
        </div>
        <nav style={{ flex:1, padding:'14px 10px', overflowY:'auto' }}>
          <p style={{ fontSize:'10px', fontWeight:'700', color:'rgba(255,255,255,0.25)', textTransform:'uppercase', letterSpacing:'0.09em', padding:'0 8px', marginBottom:'8px' }}>Navigation</p>
          {nav.map(item => {
            const active = section === item.id
            return (
              <button key={item.id} onClick={() => setSection(item.id)}
                style={{ width:'100%', padding:'10px 12px', borderRadius:'8px', border:'none', background:active?`${G}22`:'transparent', color:active?G:'rgba(255,255,255,0.45)', fontSize:'13px', fontWeight:active?'700':'500', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:'10px', marginBottom:'2px', transition:'all 0.15s', fontFamily:"'DM Sans',sans-serif" }}>
                <span style={{ opacity:active?1:0.7, flexShrink:0 }}>{item.icon}</span>
                {item.label}
                {active && <div style={{ width:'4px', height:'4px', borderRadius:'50%', background:G, marginLeft:'auto', flexShrink:0 }} />}
              </button>
            )
          })}
        </nav>
        <div style={{ padding:'14px 10px', borderTop:'1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ padding:'10px 12px', marginBottom:'6px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'rgba(255,255,255,0.6)' }}>{brand}</div>
            <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.3)', marginTop:'1px' }}>{username}</div>
          </div>
          <button onClick={() => setShowLogout(true)}
            style={{ width:'100%', padding:'10px 12px', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(255,255,255,0.35)', fontSize:'13px', fontWeight:'500', cursor:'pointer', textAlign:'left', fontFamily:"'DM Sans',sans-serif", display:'flex', alignItems:'center', gap:'8px', transition:'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color='#ef4444'; e.currentTarget.style.borderColor='rgba(239,68,68,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.color='rgba(255,255,255,0.35)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.1)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign out
          </button>
        </div>
      </aside>

      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <header style={{ background:'white', borderBottom:'1px solid #e4e8e7', padding:'0 32px', height:'58px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <h1 style={{ fontSize:'20px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D, letterSpacing:'-0.3px' }}>{TITLES[section]}</h1>
          <div style={{ fontSize:'13px', color:'#94a3b8' }}>{new Date().toLocaleDateString('en-US',{ weekday:'long', month:'long', day:'numeric', year:'numeric' })}</div>
        </header>
        <main style={{ flex:1, padding:'28px 32px', overflowY:'auto' }}>
          {children}
        </main>
      </div>

      {showLogout && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300 }}>
          <div style={{ background:'white', borderRadius:'16px', padding:'32px', width:'320px', textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize:'40px', marginBottom:'12px' }}>👋</div>
            <p style={{ fontSize:'18px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D, marginBottom:'8px' }}>Sign out?</p>
            <p style={{ fontSize:'13px', color:'#94a3b8', marginBottom:'24px' }}>You'll be returned to the login screen.</p>
            <div style={{ display:'flex', gap:'10px' }}>
              <button onClick={() => setShowLogout(false)} style={{ flex:1, padding:'13px', borderRadius:'10px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>Cancel</button>
              <button onClick={onLogout} style={{ flex:1, padding:'13px', borderRadius:'10px', border:'none', background:'#dc2626', color:'white', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Sign out</button>
            </div>
          </div>
        </div>
      )}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{background:#f0f2f1}`}</style>
    </div>
  )
}

function EducationApp({ session, onLogout }) {
  const [section, setSection] = useState('vocab')
  return (
    <AppShell nav={EDU_NAV} section={section} setSection={setSection} brand="Education Dept" username={session?.full_name || 'education'} onLogout={onLogout}>
      {section === 'vocab'    && <VocabAdmin />}
      {section === 'hw'       && <EssayImageAdmin />}
      {section === 'progress' && <ProgressTestAdmin />}
      {section === 'library'  && <LibraryAdmin />}
    </AppShell>
  )
}

function AdminApp({ session, onLogout }) {
  // Default landing section is Groups (Students is no longer a top-level item).
  const [section, setSection] = useState('groups')
  // Which group's students we're viewing. Set when the admin taps "Students"
  // inside a group; the Students section then opens scoped to that group.
  const [studentsGroup, setStudentsGroup] = useState(null)

  return (
    <AppShell nav={ADMIN_NAV} section={section} setSection={setSection} brand="Admin Panel" username={session?.full_name || 'admin'} onLogout={onLogout}>
      {section === 'books'    && <BooksSection />}
      {section === 'groups'   && <GroupsSection onOpenStudents={(g) => { setStudentsGroup(g); setSection('students') }} />}
      {section === 'students' && <StudentsSection initialGroup={studentsGroup} onExit={() => { setStudentsGroup(null); setSection('groups') }} />}
      {section === 'payments' && <PaymentsSection role="admin" />}
      {section === 'tests'    && <TestsSection onNavigate={setSection} />}
      {section === 'parents'  && <ParentsSection />}
      {section === 'teachers' && <TeachersSection />}
    </AppShell>
  )
}

export default function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('slc_session') || 'null') } catch { return null }
  })
  const login  = (s) => { localStorage.setItem('slc_session', JSON.stringify(s)); setSession(s) }
  const logout = ()  => { localStorage.removeItem('slc_session'); localStorage.removeItem('slc_role'); setSession(null) }

  if (!session)                  return <Login onLogin={login} />
  if (session.role === 'education') return <EducationApp session={session} onLogout={logout} />
  if (session.role === 'manager')  return <ManagerApp session={session} onLogout={logout} />
  if (session.role === 'ceo')      return <ManagerApp session={session} onLogout={logout} isCEO />
  return <AdminApp session={session} onLogout={logout} />
}