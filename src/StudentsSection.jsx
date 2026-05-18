import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const G  = '#009472'
const D  = '#002b2a'

const TIME_SLOTS = {
  '09:00': '09:00 – 10:30', '10:30': '10:30 – 12:00',
  '14:30': '14:30 – 16:00', '16:00': '16:00 – 17:30',
  '17:30': '17:30 – 19:00', '19:00': '19:00 – 20:30',
}

const dayLabel = d => d === 'odd' ? 'Mon/Wed/Fri' : 'Tue/Thu/Sat'

// ── TRANSFER MODAL ────────────────────────────────────────────────────────────
function TransferModal({ student, onClose, onTransferred }) {
  const [groups,       setGroups]       = useState([])
  const [teachers,     setTeachers]     = useState({})
  const [lessonMap,    setLessonMap]    = useState({})
  const [selectedKey,  setSelectedKey]  = useState(null)
  const [transferring, setTransferring] = useState(false)
  const [loading,      setLoading]      = useState(true)

  useEffect(() => { fetchGroups() }, [])

  const fetchGroups = async () => {
    const [{ data: groups }, { data: teachers }, { data: latestLessons }] = await Promise.all([
      supabase.from('groups').select('*').order('class_time'),
      supabase.from('teachers').select('username, full_name'),
      // Get the latest lesson order per group
      supabase.from('lessons').select('teacher_username, day, class_time, lesson_order')
        .order('lesson_order', { ascending: false }),
    ])

    // Build teacher name map
    const teacherMap = {}
    for (const t of teachers || []) teacherMap[t.username] = t.full_name
    setTeachers(teacherMap)

    // Build latest lesson per group
    const lmap = {}
    for (const l of latestLessons || []) {
      const key = `${l.teacher_username}_${l.day}_${l.class_time}`
      if (!lmap[key]) lmap[key] = l.lesson_order // first = highest (ordered desc)
    }
    setLessonMap(lmap)

    // Exclude current group
    const filtered = (groups || []).filter(g =>
      !(g.teacher_username === student.teacher_username &&
        g.day === student.day &&
        g.class_time === student.class_time)
    )
    setGroups(filtered)
    setLoading(false)
  }

  const confirm = async () => {
    if (!selectedKey) return
    const [teacher_username, day, class_time] = selectedKey.split('|')
    setTransferring(true)

    // Get new group's level from groups
    const newGroup = groups.find(g =>
      g.teacher_username === teacher_username && g.day === day && g.class_time === class_time
    )
    const currentLesson = lessonMap[`${teacher_username}_${day}_${class_time}`] || 1

    // Update student
    const { error } = await supabase.from('students')
      .update({ teacher_username, day, class_time })
      .eq('username', student.username)

    if (error) { alert(error.message); setTransferring(false); return }

    setTransferring(false)
    onTransferred()
  }

  const selectedGroup = selectedKey
    ? groups.find(g => `${g.teacher_username}|${g.day}|${g.class_time}` === selectedKey)
    : null

  const currentLesson = selectedKey ? (lessonMap[selectedKey.replace(/\|/g,'_').replace('|','_')] || 1) : null

  // Fix: compute key consistently
  const getKey = g => `${g.teacher_username}|${g.day}|${g.class_time}`
  const getLessonForGroup = g => lessonMap[`${g.teacher_username}_${g.day}_${g.class_time}`] || 0

  // Same level first, then others
  const sorted = [...groups].sort((a, b) => {
    const aMatch = a.level === student.level ? 0 : 1
    const bMatch = b.level === student.level ? 0 : 1
    return aMatch - bMatch
  })

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'24px', fontFamily:"'DM Sans',sans-serif" }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'white', borderRadius:'20px', width:'100%', maxWidth:'500px', maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ padding:'24px 24px 16px', borderBottom:'1px solid #f0f2f1', flexShrink:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
            <span style={{ fontSize:'18px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Transfer Student</span>
            <button onClick={onClose} style={{ width:'32px', height:'32px', borderRadius:'8px', background:'#f0f2f1', border:'none', cursor:'pointer', fontSize:'16px' }}>✕</button>
          </div>
          {/* Student info */}
          <div style={{ background:'#f8fafb', borderRadius:'12px', padding:'12px 16px' }}>
            <div style={{ fontSize:'15px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{student.full_name}</div>
            <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'3px' }}>
              {student.level} · {teachers[student.teacher_username] || student.teacher_username} · {dayLabel(student.day)} · {TIME_SLOTS[student.class_time] || student.class_time}
            </div>
          </div>
        </div>

        {/* Group list */}
        <div style={{ flex:1, overflowY:'auto', padding:'16px 24px' }}>
          <div style={{ fontSize:'12px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'10px' }}>
            Select new group
          </div>

          {loading ? (
            <div style={{ textAlign:'center', padding:'40px', color:'#94a3b8' }}>Loading groups…</div>
          ) : sorted.map(g => {
            const key      = getKey(g)
            const isSelected = selectedKey === key
            const lesson   = getLessonForGroup(g)
            const isMatch  = g.level === student.level
            return (
              <div key={key} onClick={() => setSelectedKey(isSelected ? null : key)}
                style={{ padding:'14px 16px', borderRadius:'12px', marginBottom:'8px', cursor:'pointer',
                  border:`1.5px solid ${isSelected ? G : '#f0f2f1'}`,
                  background: isSelected ? `${G}08` : 'white',
                  transition:'all 0.15s',
                }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'3px' }}>
                      <span style={{ fontSize:'14px', fontWeight:'700', color: isSelected ? G : D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
                        {g.level}
                      </span>
                      {isMatch && (
                        <span style={{ fontSize:'10px', fontWeight:'700', padding:'1px 6px', borderRadius:'6px', background:`${G}15`, color:G }}>Same level</span>
                      )}
                    </div>
                    <div style={{ fontSize:'12px', color:'#64748b' }}>
                      {teachers[g.teacher_username] || g.teacher_username} · {dayLabel(g.day)} · {TIME_SLOTS[g.class_time] || g.class_time}
                    </div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:'12px', color:'#94a3b8' }}>Current lesson</div>
                    <div style={{ fontSize:'14px', fontWeight:'800', color: isSelected ? G : D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
                      {lesson > 0 ? `#${lesson}` : '—'}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ padding:'16px 24px 24px', borderTop:'1px solid #f0f2f1', flexShrink:0 }}>
          {selectedGroup && (
            <div style={{ background:`${G}08`, borderRadius:'10px', padding:'10px 14px', marginBottom:'12px', fontSize:'13px', color:G, fontWeight:'600' }}>
              ✓ Moving to {selectedGroup.level} · {dayLabel(selectedGroup.day)} · {TIME_SLOTS[selectedGroup.class_time]}
              {getLessonForGroup(selectedGroup) > 0 && ` · Starting at lesson #${getLessonForGroup(selectedGroup)}`}
            </div>
          )}
          <div style={{ display:'flex', gap:'10px' }}>
            <button onClick={onClose} style={{ flex:1, padding:'13px', borderRadius:'12px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>Cancel</button>
            <button onClick={confirm} disabled={!selectedKey || transferring}
              style={{ flex:2, padding:'13px', borderRadius:'12px', border:'none', background: selectedKey ? G : '#e4e8e7', color:'white', fontSize:'14px', fontWeight:'700', cursor: selectedKey ? 'pointer' : 'default', fontFamily:"'Plus Jakarta Sans',sans-serif", transition:'all 0.2s' }}>
              {transferring ? 'Transferring…' : 'Confirm Transfer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── STUDENT CARD ──────────────────────────────────────────────────────────────
function StudentCard({ student, teacherName, onTransfer }) {
  const initials = student.full_name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()
  return (
    <div style={{ background:'white', borderRadius:'14px', padding:'14px 16px', display:'flex', alignItems:'center', gap:'12px', boxShadow:'0 1px 6px rgba(0,0,0,0.06)', border:'1px solid #f0f2f1' }}>
      <div style={{ width:'40px', height:'40px', borderRadius:'10px', background:`${G}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', fontWeight:'800', color:G, flexShrink:0, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
        {initials}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:'14px', fontWeight:'700', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{student.full_name}</div>
        <div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'2px' }}>
          {teacherName} · {dayLabel(student.day)} · {TIME_SLOTS[student.class_time] || student.class_time}
        </div>
      </div>
      <div style={{ textAlign:'right', flexShrink:0, marginRight:'8px' }}>
        <div style={{ fontSize:'11px', color:'#94a3b8' }}>{student.level || '—'}</div>
        <div style={{ fontSize:'12px', color:'#f59e0b', fontWeight:'600', marginTop:'1px' }}>🪙 {student.coins || 0}</div>
      </div>
      <button onClick={() => onTransfer(student)}
        style={{ padding:'8px 14px', borderRadius:'8px', border:`1.5px solid ${G}`, background:'white', color:G, fontSize:'12px', fontWeight:'700', cursor:'pointer', flexShrink:0, whiteSpace:'nowrap' }}>
        Transfer
      </button>
    </div>
  )
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function StudentsSection() {
  const [students,   setStudents]   = useState([])
  const [teachers,   setTeachers]   = useState({})
  const [groups,     setGroups]     = useState({}) // key → level
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [filterLevel,setFilterLevel]= useState('All')
  const [transferring,setTransferring]= useState(null) // student object

  const LEVELS = ['All','Beginner','Elementary','Pre-Intermediate','Intermediate','Upper-Intermediate','IELTS Foundation','IELTS Proficiency']

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: students }, { data: teachers }, { data: groups }] = await Promise.all([
      supabase.from('students').select('*').order('full_name'),
      supabase.from('teachers').select('username, full_name'),
      supabase.from('groups').select('teacher_username, day, class_time, level'),
    ])

    const teacherMap = {}
    for (const t of teachers || []) teacherMap[t.username] = t.full_name

    const groupMap = {}
    for (const g of groups || []) groupMap[`${g.teacher_username}_${g.day}_${g.class_time}`] = g.level

    // Enrich students with level from groups
    const enriched = (students || []).map(s => ({
      ...s,
      level: groupMap[`${s.teacher_username}_${s.day}_${s.class_time}`] || s.level || '—'
    }))

    setStudents(enriched)
    setTeachers(teacherMap)
    setGroups(groupMap)
    setLoading(false)
  }

  const filtered = students.filter(s => {
    const matchSearch = s.full_name.toLowerCase().includes(search.toLowerCase()) ||
                        s.username.toLowerCase().includes(search.toLowerCase())
    const matchLevel  = filterLevel === 'All' || s.level === filterLevel
    return matchSearch && matchLevel
  })

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h2 style={{ fontSize:'20px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D, marginBottom:'2px' }}>Students</h2>
          <p style={{ fontSize:'13px', color:'#94a3b8' }}>{students.length} total · {filtered.length} shown</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or username…"
          style={{ flex:1, minWidth:'200px', padding:'10px 14px', borderRadius:'10px', border:'1.5px solid #e4e8e7', fontSize:'14px', outline:'none', color:D, fontFamily:"'DM Sans',sans-serif" }} />
        <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)}
          style={{ padding:'10px 14px', borderRadius:'10px', border:'1.5px solid #e4e8e7', fontSize:'14px', color:D, fontFamily:"'DM Sans',sans-serif", outline:'none', background:'white' }}>
          {LEVELS.map(l => <option key={l}>{l}</option>)}
        </select>
      </div>

      {/* Student list */}
      {loading ? (
        <div style={{ textAlign:'center', padding:'60px', color:'#94a3b8' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px', background:'white', borderRadius:'16px' }}>
          <div style={{ fontSize:'36px', marginBottom:'10px' }}>🔍</div>
          <div style={{ fontSize:'15px', fontWeight:'700', color:'#111', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>No students found</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {filtered.map(s => (
            <StudentCard key={s.username} student={s}
              teacherName={teachers[s.teacher_username] || s.teacher_username}
              onTransfer={setTransferring} />
          ))}
        </div>
      )}

      {/* Transfer modal */}
      {transferring && (
        <TransferModal
          student={transferring}
          onClose={() => setTransferring(null)}
          onTransferred={() => { setTransferring(null); fetchAll() }}
        />
      )}
    </div>
  )
}