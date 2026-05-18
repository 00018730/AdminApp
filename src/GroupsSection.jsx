import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const G  = '#009472'
const D  = '#002b2a'

const TIME_SLOTS = [
  { start: '09:00', label: '09:00 – 10:30' },
  { start: '10:30', label: '10:30 – 12:00' },
  { start: '14:30', label: '14:30 – 16:00' },
  { start: '16:00', label: '16:00 – 17:30' },
  { start: '17:30', label: '17:30 – 19:00' },
  { start: '19:00', label: '19:00 – 20:30' },
]

const DAYS   = ['odd', 'even']
const LEVELS = ['Beginner','Elementary','Pre-Intermediate','Intermediate','Upper-Intermediate','IELTS Foundation','IELTS Proficiency']

// ── CREATE GROUP MODAL ────────────────────────────────────────────────────────
function CreateGroupModal({ teacher, day, slot, onClose, onCreated }) {
  const [level,   setLevel]   = useState('Elementary')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const create = async () => {
    setSaving(true); setError('')
    const { error: err } = await supabase.from('groups').insert({
      teacher_username: teacher.username,
      day,
      class_time: slot.start,
      level,
    })
    if (err) { setError(err.message); setSaving(false); return }
    onCreated()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'24px', fontFamily:"'DM Sans',sans-serif" }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'white', borderRadius:'20px', padding:'28px', width:'100%', maxWidth:'380px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div style={{ fontSize:'17px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Create Group</div>
          <button onClick={onClose} style={{ width:'32px', height:'32px', borderRadius:'8px', background:'#f0f2f1', border:'none', cursor:'pointer', fontSize:'16px' }}>✕</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'16px' }}>
          {[
            { label:'Teacher',   value: teacher.full_name },
            { label:'Time',      value: slot.label },
            { label:'Day',       value: day === 'odd' ? 'Mon / Wed / Fri' : 'Tue / Thu / Sat' },
          ].map(r => (
            <div key={r.label} style={{ background:'#f8fafb', borderRadius:'10px', padding:'10px 12px' }}>
              <div style={{ fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em' }}>{r.label}</div>
              <div style={{ fontSize:'13px', fontWeight:'700', color:D, marginTop:'2px' }}>{r.value}</div>
            </div>
          ))}
        </div>

        <label style={{ fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:'6px' }}>Level</label>
        <select value={level} onChange={e => setLevel(e.target.value)}
          style={{ width:'100%', padding:'12px 14px', borderRadius:'10px', border:'1.5px solid #e4e8e7', fontSize:'14px', color:D, fontFamily:"'DM Sans',sans-serif", outline:'none', background:'white', marginBottom:'16px' }}>
          {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        {error && <div style={{ color:'#ef4444', fontSize:'13px', fontWeight:'600', marginBottom:'12px' }}>{error}</div>}

        <div style={{ background:'#fef3c7', borderRadius:'10px', padding:'10px 12px', marginBottom:'16px', fontSize:'12px', color:'#92400e' }}>
          ⚠️ After creating, the teacher must open <strong>Name Group</strong> in their app to generate lesson records.
        </div>

        <div style={{ display:'flex', gap:'10px' }}>
          <button onClick={onClose} style={{ flex:1, padding:'12px', borderRadius:'12px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>Cancel</button>
          <button onClick={create} disabled={saving}
            style={{ flex:2, padding:'12px', borderRadius:'12px', border:'none', background:G, color:'white', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
            {saving ? 'Creating…' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── TEACHER GROUPS GRID ───────────────────────────────────────────────────────
function TeacherGrid({ teacher, groups, studentCounts, onCreateSlot }) {
  // Map: `${day}_${class_time}` → group
  const groupMap = {}
  for (const g of groups) groupMap[`${g.day}_${g.class_time}`] = g

  const levelColors = {
    'Beginner': '#dcfce7', 'Elementary': '#dbeafe', 'Pre-Intermediate': '#ede9fe',
    'Intermediate': '#fef3c7', 'Upper-Intermediate': '#fee2e2',
    'IELTS Foundation': '#f0fdf4', 'IELTS Proficiency': '#f0f9ff',
  }

  return (
    <div style={{ background:'white', borderRadius:'16px', padding:'20px', marginBottom:'16px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px' }}>
        <div style={{ width:'40px', height:'40px', borderRadius:'10px', background:`${G}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px' }}>👨‍🏫</div>
        <div>
          <div style={{ fontSize:'16px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{teacher.full_name}</div>
          <div style={{ fontSize:'12px', color:'#94a3b8' }}>@{teacher.username}</div>
        </div>
        <div style={{ marginLeft:'auto', fontSize:'12px', color:'#94a3b8', fontWeight:'600' }}>
          {groups.length}/12 groups
        </div>
      </div>

      {/* Grid header */}
      <div style={{ display:'grid', gridTemplateColumns:'120px 1fr 1fr', gap:'6px', marginBottom:'6px' }}>
        <div />
        {DAYS.map(d => (
          <div key={d} style={{ textAlign:'center', fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em' }}>
            {d === 'odd' ? 'Mon/Wed/Fri' : 'Tue/Thu/Sat'}
          </div>
        ))}
      </div>

      {/* Grid rows */}
      {TIME_SLOTS.map(slot => (
        <div key={slot.start} style={{ display:'grid', gridTemplateColumns:'120px 1fr 1fr', gap:'6px', marginBottom:'6px' }}>
          <div style={{ fontSize:'12px', fontWeight:'700', color:'#64748b', display:'flex', alignItems:'center' }}>{slot.label}</div>
          {DAYS.map(day => {
            const key = `${day}_${slot.start}`
            const group = groupMap[key]
            const count = group ? (studentCounts[`${group.teacher_username}_${group.day}_${group.class_time}`] || 0) : 0

            if (group) return (
              <div key={day} style={{ background: levelColors[group.level] || '#f8fafb', borderRadius:'10px', padding:'10px 12px', border:'1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize:'11px', fontWeight:'800', color:D }}>{group.level}</div>
                <div style={{ fontSize:'11px', color:'#64748b', marginTop:'2px' }}>{count} student{count!==1?'s':''}</div>
              </div>
            )

            return (
              <button key={day} onClick={() => onCreateSlot(teacher, day, slot)}
                style={{ borderRadius:'10px', padding:'10px 12px', border:'1.5px dashed #e4e8e7', background:'#fafafa', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', color:'#94a3b8', fontSize:'12px', fontWeight:'600', transition:'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor=G; e.currentTarget.style.color=G }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='#e4e8e7'; e.currentTarget.style.color='#94a3b8' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New group
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function GroupsSection() {
  const [teachers,      setTeachers]      = useState([])
  const [groups,        setGroups]        = useState([])
  const [studentCounts, setStudentCounts] = useState({})
  const [loading,       setLoading]       = useState(true)
  const [creating,      setCreating]      = useState(null) // { teacher, day, slot }

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: teachers }, { data: groups }, { data: students }] = await Promise.all([
      supabase.from('teachers').select('username, full_name').neq('username', 'test').order('full_name'),
      supabase.from('groups').select('*'),
      supabase.from('students').select('teacher_username, day, class_time'),
    ])

    // Count students per group
    const counts = {}
    for (const s of students || []) {
      const key = `${s.teacher_username}_${s.day}_${s.class_time}`
      counts[key] = (counts[key] || 0) + 1
    }

    setTeachers(teachers || [])
    setGroups(groups || [])
    setStudentCounts(counts)
    setLoading(false)
  }

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ marginBottom:'24px' }}>
        <h2 style={{ fontSize:'20px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D, marginBottom:'4px' }}>Groups</h2>
        <p style={{ fontSize:'13px', color:'#94a3b8' }}>View all teacher groups and create new ones in empty time slots.</p>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'60px', color:'#94a3b8' }}>Loading…</div>
      ) : teachers.map(teacher => {
        const teacherGroups = groups.filter(g => g.teacher_username === teacher.username)
        return (
          <TeacherGrid key={teacher.username} teacher={teacher} groups={teacherGroups}
            studentCounts={studentCounts} onCreateSlot={(t, d, s) => setCreating({ teacher: t, day: d, slot: s })} />
        )
      })}

      {creating && (
        <CreateGroupModal
          teacher={creating.teacher} day={creating.day} slot={creating.slot}
          onClose={() => setCreating(null)}
          onCreated={() => { setCreating(null); fetchAll() }}
        />
      )}
    </div>
  )
}