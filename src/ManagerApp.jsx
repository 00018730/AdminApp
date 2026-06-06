import { useState } from 'react'
import { supabase } from './supabase'
import StudentsSection from './StudentsSection'
import PaymentsSection from './PaymentsSection'
import TestsSection from './TestsSection'
import ParentsSection from './ParentsSection'
import TeachersSection from './TeachersSection'
import GroupsSection from './GroupsSection'
import AnnouncementsSection from './AnnouncementsSection'
import HolidaysSection from './HolidaysSection'
import RequestsSection from './RequestsSection'

const G = '#009472'
const D = '#002b2a'

const NAV = [
  { id:'payments',      label:'Payments',      icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
  { id:'announcements', label:'Announcements',  icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> },
  { id:'holidays',      label:'Holidays',       icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  { id:'requests',      label:'Requests',       icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/></svg> },
  { id:'students',      label:'Students',       icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { id:'tests',         label:'Placement Tests', icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg> },
  { id:'parents',       label:'Parents',        icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  { id:'teachers',      label:'Teachers',       icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { id:'groups',        label:'Groups',         icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
]

// Sections the manager can fully control
const FULL_ACCESS = ['payments', 'announcements', 'holidays', 'requests']

const TITLES = {
  payments:'Payments', announcements:'Announcements', holidays:'Holidays',
  requests:'Requests', students:'Students', tests:'Placement Tests',
  parents:'Parents', teachers:'Teachers', groups:'Groups',
}

// ── READ-ONLY OVERLAY ─────────────────────────────────────────────────────────
// Renders the section normally, then puts a transparent overlay over any
// button/input/select that shouldn't be interactive.
// Much simpler than patching every child component.
function ReadOnlyWrapper({ children }) {
  return (
    <div style={{ position:'relative' }}>
      {children}
      {/* Intercept all clicks on buttons and inputs */}
      <style>{`
        .ro-section button:not(.ro-safe),
        .ro-section input:not(.ro-safe),
        .ro-section select:not(.ro-safe),
        .ro-section textarea:not(.ro-safe) {
          pointer-events: none !important;
          opacity: 0.5 !important;
          cursor: default !important;
        }
      `}</style>
      <div className="ro-section" style={{ position:'absolute', inset:0, zIndex:10 }}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
      />
    </div>
  )
}

export default function ManagerApp({ onLogout }) {
  const [section,     setSection]     = useState('payments')
  const [showLogout,  setShowLogout]  = useState(false)

  const isReadOnly = !FULL_ACCESS.includes(section)

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#f0f2f1', fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}`}</style>

      {/* ── SIDEBAR ── */}
      <aside style={{ width:'230px', flexShrink:0, background:D, display:'flex', flexDirection:'column', position:'sticky', top:0, height:'100vh', overflow:'hidden' }}>
        <div style={{ padding:'22px 18px 18px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ width:'36px', height:'36px', borderRadius:'10px', background:G, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
            </div>
            <div>
              <div style={{ fontSize:'13px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:'white', letterSpacing:'-0.2px', lineHeight:'1.2' }}>Smart LC</div>
              <div style={{ fontSize:'10px', color:G, fontWeight:'600', marginTop:'2px' }}>Manager Panel</div>
            </div>
          </div>
        </div>

        <nav style={{ flex:1, padding:'14px 10px', overflowY:'auto' }}>
          {/* Full access group */}
          <p style={{ fontSize:'10px', fontWeight:'700', color:'rgba(255,255,255,0.25)', textTransform:'uppercase', letterSpacing:'0.09em', padding:'0 8px', marginBottom:'8px' }}>Full Access</p>
          {NAV.filter(x => FULL_ACCESS.includes(x.id)).map(item => {
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

          {/* View only group */}
          <p style={{ fontSize:'10px', fontWeight:'700', color:'rgba(255,255,255,0.25)', textTransform:'uppercase', letterSpacing:'0.09em', padding:'0 8px', marginBottom:'8px', marginTop:'16px' }}>View Only</p>
          {NAV.filter(x => !FULL_ACCESS.includes(x.id)).map(item => {
            const active = section === item.id
            return (
              <button key={item.id} onClick={() => setSection(item.id)}
                style={{ width:'100%', padding:'10px 12px', borderRadius:'8px', border:'none', background:active?`rgba(255,255,255,0.08)`:'transparent', color:active?'rgba(255,255,255,0.7)':'rgba(255,255,255,0.35)', fontSize:'13px', fontWeight:active?'600':'400', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:'10px', marginBottom:'2px', transition:'all 0.15s', fontFamily:"'DM Sans',sans-serif" }}>
                <span style={{ opacity:0.5, flexShrink:0 }}>{item.icon}</span>
                {item.label}
                {active && <span style={{ marginLeft:'auto', fontSize:'9px', fontWeight:'700', color:'rgba(255,255,255,0.3)', background:'rgba(255,255,255,0.08)', padding:'2px 6px', borderRadius:'4px', flexShrink:0 }}>VIEW</span>}
              </button>
            )
          })}
        </nav>

        <div style={{ padding:'14px 10px', borderTop:'1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ padding:'10px 12px', marginBottom:'6px' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'rgba(255,255,255,0.6)' }}>Manager</div>
            <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.3)', marginTop:'1px' }}>manager</div>
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

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <header style={{ background:'white', borderBottom:'1px solid #e4e8e7', padding:'0 32px', height:'58px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <h1 style={{ fontSize:'20px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D, letterSpacing:'-0.3px' }}>
              {TITLES[section]}
            </h1>
            {isReadOnly && (
              <span style={{ fontSize:'10px', fontWeight:'700', padding:'3px 8px', borderRadius:'6px', background:'#fef9ec', color:'#92400e', border:'1px solid #fde68a' }}>
                VIEW ONLY
              </span>
            )}
          </div>
          <div style={{ fontSize:'13px', color:'#94a3b8' }}>
            {new Date().toLocaleDateString('en-US',{ weekday:'long', month:'long', day:'numeric', year:'numeric' })}
          </div>
        </header>

        <main style={{ flex:1, padding:'28px 32px', overflowY:'auto' }}>
          {/* ── FULL ACCESS SECTIONS ── */}
          {section === 'payments'      && <PaymentsSection />}
          {section === 'announcements' && <AnnouncementsSection />}
          {section === 'holidays'      && <HolidaysSection />}
          {section === 'requests'      && <RequestsSection />}

          {/* ── READ-ONLY SECTIONS ── */}
          {/* We render the real component but wrap it so all interactive elements are disabled */}
          {section === 'students' && (
            <div style={{ position:'relative' }}>
              <StudentsSection />
              <div style={{ position:'fixed', inset:0, zIndex:50, cursor:'not-allowed' }}
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                onPointerDown={e => e.stopPropagation()}
              />
            </div>
          )}
          {section === 'tests' && (
            <div style={{ position:'relative' }}>
              <TestsSection />
              <div style={{ position:'fixed', inset:0, zIndex:50, cursor:'not-allowed' }}
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                onPointerDown={e => e.stopPropagation()}
              />
            </div>
          )}
          {section === 'parents' && (
            <div style={{ position:'relative' }}>
              <ParentsSection />
              <div style={{ position:'fixed', inset:0, zIndex:50, cursor:'not-allowed' }}
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                onPointerDown={e => e.stopPropagation()}
              />
            </div>
          )}
          {section === 'teachers' && (
            <div style={{ position:'relative' }}>
              <TeachersSection />
              <div style={{ position:'fixed', inset:0, zIndex:50, cursor:'not-allowed' }}
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                onPointerDown={e => e.stopPropagation()}
              />
            </div>
          )}
          {section === 'groups' && (
            <div style={{ position:'relative' }}>
              <GroupsSection />
              <div style={{ position:'fixed', inset:0, zIndex:50, cursor:'not-allowed' }}
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                onPointerDown={e => e.stopPropagation()}
              />
            </div>
          )}
        </main>
      </div>

      {/* ── SIGN OUT MODAL ── */}
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
    </div>
  )
}