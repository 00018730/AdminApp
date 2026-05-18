import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const G  = '#009472'
const D  = '#002b2a'
const OR = '#f59e0b'

function StatusBadge({ status }) {
  const cfg = {
    pending:   { label:'Pending',   bg:'#fef3c7', color:'#a05a00' },
    confirmed: { label:'Confirmed', bg:'#d1fae5', color:'#065f46' },
    rejected:  { label:'Rejected',  bg:'#fee2e2', color:'#b91c1c' },
  }[status] || { label: status, bg:'#f1f5f9', color:'#64748b' }
  return (
    <span style={{ fontSize:'11px', fontWeight:'700', padding:'3px 10px', borderRadius:'20px', background:cfg.bg, color:cfg.color }}>
      {cfg.label}
    </span>
  )
}

// Group rows by request_id into single request objects
function groupRequests(rows) {
  const map = {}
  for (const row of rows) {
    const key = row.request_id || row.id
    if (!map[key]) {
      map[key] = { ...row, dates: [] }
    }
    map[key].dates.push(row.unavail_date)
  }
  return Object.values(map).map(r => {
    r.dates.sort()
    return r
  }).sort((a,b) => b.requested_at.localeCompare(a.requested_at))
}

function dateRangeLabel(dates) {
  if (!dates.length) return '—'
  if (dates.length === 1) return new Date(dates[0]+'T12:00:00').toLocaleDateString('en-US',{ weekday:'short', month:'short', day:'numeric' })
  const from = new Date(dates[0]+'T12:00:00').toLocaleDateString('en-US',{ month:'short', day:'numeric' })
  const to   = new Date(dates[dates.length-1]+'T12:00:00').toLocaleDateString('en-US',{ month:'short', day:'numeric' })
  return `${from} – ${to} (${dates.length} days)`
}

// ── REQUEST CARD ──────────────────────────────────────────────────────────────
function RequestCard({ request, role, onAction }) {
  const [loading, setLoading] = useState(false)

  const respond = async (newStatus) => {
    setLoading(true)
    const table = role === 'teacher' ? 'teacher_unavailability' : 'mentor_unavailability'
    const field = role === 'teacher' ? 'teacher_username'        : 'mentor_username'

    // Update all rows with this request_id (or this single date)
    if (request.request_id) {
      await supabase.from(table).update({ status: newStatus }).eq('request_id', request.request_id)
    } else {
      await supabase.from(table).update({ status: newStatus })
        .eq(field, request[field]).eq('unavail_date', request.unavail_date)
    }

    // If mentor request confirmed → cancel affected booked sessions
    if (role === 'mentor' && newStatus === 'confirmed') {
      for (const date of request.dates) {
        await supabase.from('mentor_sessions')
          .update({ status: 'cancelled_by_mentor' })
          .eq('mentor_username', request.mentor_username)
          .eq('session_date', date)
          .eq('status', 'booked')
      }
    }

    setLoading(false)
    onAction()
  }

  const name     = request.teacher_full_name || request.mentor_full_name || (role === 'teacher' ? request.teacher_username : request.mentor_username)
  const isPending = request.status === 'pending'

  return (
    <div style={{ background:'white', borderRadius:'16px', padding:'18px', marginBottom:'10px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)', border:`1px solid ${isPending ? `${OR}40` : '#f0f2f1'}` }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px', marginBottom:'10px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <div style={{ width:'42px', height:'42px', borderRadius:'12px', background: role==='teacher' ? `${G}15` : '#e0e7ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', flexShrink:0 }}>
            {role === 'teacher' ? '👩‍🏫' : '🧑‍💼'}
          </div>
          <div>
            <div style={{ fontSize:'15px', fontWeight:'700', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{name}</div>
            <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'1px', textTransform:'capitalize' }}>{role}</div>
          </div>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:'6px 12px', fontSize:'13px', marginBottom:'12px' }}>
        <span style={{ color:'#94a3b8', fontWeight:'600' }}>Date(s)</span>
        <span style={{ color:D, fontWeight:'700' }}>{dateRangeLabel(request.dates)}</span>
        {request.reason && <>
          <span style={{ color:'#94a3b8', fontWeight:'600' }}>Reason</span>
          <span style={{ color:'#64748b' }}>{request.reason}</span>
        </>}
        <span style={{ color:'#94a3b8', fontWeight:'600' }}>Requested</span>
        <span style={{ color:'#64748b' }}>{new Date(request.requested_at).toLocaleDateString('en-US',{ month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}</span>
      </div>

      {isPending && (
        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={() => respond('rejected')} disabled={loading}
            style={{ flex:1, padding:'10px', borderRadius:'10px', border:'1.5px solid #fca5a5', background:'white', color:'#ef4444', fontSize:'13px', fontWeight:'700', cursor:'pointer' }}>
            ✕ Reject
          </button>
          <button onClick={() => respond('confirmed')} disabled={loading}
            style={{ flex:2, padding:'10px', borderRadius:'10px', border:'none', background:G, color:'white', fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
            {loading ? '…' : '✓ Confirm'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function RequestsSection() {
  const [activeTab,   setActiveTab]   = useState('all')
  const [teachers,    setTeachers]    = useState([])
  const [mentors,     setMentors]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [pendingCount,setPendingCount]= useState(0)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)

    const [{ data: tr }, { data: mr }, { data: tn }, { data: mn }] = await Promise.all([
      supabase.from('teacher_unavailability').select('*').order('requested_at', { ascending: false }),
      supabase.from('mentor_unavailability').select('*').order('requested_at', { ascending: false }),
      supabase.from('teachers').select('username, full_name'),
      supabase.from('mentors').select('username, full_name'),
    ])

    // Enrich with full names
    const teacherMap = Object.fromEntries((tn||[]).map(t => [t.username, t.full_name]))
    const mentorMap  = Object.fromEntries((mn||[]).map(m => [m.username, m.full_name]))

    const tRows = (tr||[]).map(r => ({ ...r, teacher_full_name: teacherMap[r.teacher_username] }))
    const mRows = (mr||[]).map(r => ({ ...r, mentor_full_name: mentorMap[r.mentor_username] }))

    const tGroups = groupRequests(tRows)
    const mGroups = groupRequests(mRows)

    setTeachers(tGroups)
    setMentors(mGroups)
    setPendingCount(
      tGroups.filter(r=>r.status==='pending').length +
      mGroups.filter(r=>r.status==='pending').length
    )
    setLoading(false)
  }

  const TABS = [
    { id:'all',     label:'All' },
    { id:'teacher', label:'Teachers' },
    { id:'mentor',  label:'Mentors' },
    { id:'pending', label:'Pending' },
  ]

  const allRequests = [
    ...teachers.map(r => ({ ...r, _role:'teacher' })),
    ...mentors.map(r  => ({ ...r, _role:'mentor' })),
  ].sort((a,b) => b.requested_at.localeCompare(a.requested_at))

  const filtered = activeTab === 'all'     ? allRequests :
                   activeTab === 'teacher' ? allRequests.filter(r => r._role === 'teacher') :
                   activeTab === 'mentor'  ? allRequests.filter(r => r._role === 'mentor') :
                   allRequests.filter(r => r.status === 'pending')

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'20px' }}>
        <h2 style={{ fontSize:'20px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D }}>Time-Off Requests</h2>
        {pendingCount > 0 && (
          <span style={{ padding:'3px 10px', borderRadius:'20px', background:'#fef3c7', color:'#a05a00', fontSize:'12px', fontWeight:'700' }}>
            {pendingCount} pending
          </span>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'20px', background:'#f0f2f1', borderRadius:'12px', padding:'4px', width:'fit-content' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding:'7px 16px', borderRadius:'8px', border:'none', background: activeTab===t.id ? 'white' : 'transparent', color: activeTab===t.id ? D : '#94a3b8', fontSize:'13px', fontWeight: activeTab===t.id ? '700' : '500', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", transition:'all 0.15s', boxShadow: activeTab===t.id ? '0 1px 4px rgba(0,0,0,0.10)' : 'none' }}>
            {t.label}
            {t.id === 'pending' && pendingCount > 0 && (
              <span style={{ marginLeft:'6px', background:OR, color:'white', borderRadius:'10px', padding:'1px 6px', fontSize:'10px', fontWeight:'800' }}>{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign:'center', padding:'60px', color:'#94a3b8' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 24px', background:'white', borderRadius:'16px' }}>
          <div style={{ fontSize:'40px', marginBottom:'12px' }}>🌿</div>
          <div style={{ fontSize:'16px', fontWeight:'700', color:'#111', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>No requests</div>
          <div style={{ fontSize:'13px', color:'#94a3b8', marginTop:'4px' }}>Nothing to review right now.</div>
        </div>
      ) : (
        <div style={{ maxWidth:'640px' }}>
          {filtered.map(r => (
            <RequestCard key={r.request_id || r.id} request={r} role={r._role} onAction={fetchAll} />
          ))}
        </div>
      )}
    </div>
  )
}